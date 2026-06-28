"""Deterministic centering measurement with OpenCV.

Centering is the ONLY pillar PokeGrade can measure deterministically (verdict.py
gates the 10-eligibility on it), so this module is the of-record number, not a
hint. The pipeline is: decode -> (optional) undistort -> find the card and warp
it flat to a canonical 63x88 mm portrait -> find the printed inner border inside
the flat card -> turn the four edge-to-border gaps into a worse-axis percentage
-> map that to a PSA grade via the shared ladder.

Two design constraints shape every branch here:

  1. Fail-closed, never raise. Centering feeds a money decision, so on any decode
     / contour / parse failure we return a low-confidence, non-assessable result
     with a note rather than throwing out of the happy path. A missing number
     routes the card to IN_HAND_CHECK; a wrong number costs a grading fee.

  2. Never emit a false-precise ratio. Full-bleed SIR / full-art cards have no
     printed border to measure against, so a "WW.W/LL.L" there would be a lie.
     The borderless branch degrades honestly to assess-by-eye instead of
     inventing a split.
"""

from __future__ import annotations

import base64

import cv2
import numpy as np

from .models import (
    BorderType,
    CenteringMeasurement,
    Confidence,
    SideCentering,
)
from .standards import front_thresholds, grade_for_worse_pct

# --- canonical card geometry ------------------------------------------------
# A standard trading card is 63 x 88 mm. We warp to a 10 px/mm portrait so the
# inner-border search runs on a fixed, aspect-correct canvas regardless of how
# the card was photographed. 630 x 880 keeps the maths exact and the overlay
# legible.
CARD_W = 630
CARD_H = 880

# --- inner-border search tuning ---------------------------------------------
# We scan inward from each edge along a band of scan-lines and look for the first
# strong, sustained brightness/colour transition: the card stock -> printed
# border edge. These constants were tuned against the synthetic fixtures and the
# real-card smoke set; they are deliberately conservative so a noisy edge fails
# closed to borderless rather than reporting a bogus split.
_EDGE_GRAD_MIN = 28.0  # min gradient magnitude (0..255) to count as an edge
_SCAN_BAND_FRAC = 0.5  # central fraction of each side to average the scan over
_MAX_INWARD_FRAC = 0.30  # an inner border deeper than 30% of the dim is implausible
_MIN_INWARD_PX = 4  # ignore edges hugging the card edge (warp ringing)
_BORDER_FOUND_MIN_SIDES = 4  # need all four gaps for a trustworthy ratio


def _decode_bgr(image_bytes: bytes) -> np.ndarray | None:
    """Decode raw bytes to a BGR ndarray, or None on any failure.

    cv2.imdecode returns None (it does not raise) for a non-image buffer, so the
    only thing we must guard is an empty / malformed input upstream of it."""
    try:
        buf = np.frombuffer(image_bytes, dtype=np.uint8)
        if buf.size == 0:
            return None
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        return img
    except Exception:
        # frombuffer can choke on a non-bytes input; treat as undecodable.
        return None


def _maybe_undistort(img: np.ndarray, calibration: dict | None) -> np.ndarray:
    """Undistort with the supplied intrinsics when present, else pass through.

    A bad calibration dict must not sink the whole measurement, so we swallow
    shape/parse errors and fall back to the raw frame."""
    if not calibration:
        return img
    try:
        cam = calibration.get("camera_matrix")
        dist = calibration.get("dist_coeffs")
        if cam is None or dist is None:
            return img
        cam_mat = np.asarray(cam, dtype=np.float64).reshape(3, 3)
        dist_arr = np.asarray(dist, dtype=np.float64).reshape(-1)
        return cv2.undistort(img, cam_mat, dist_arr)
    except Exception:
        return img


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order four points as TL, TR, BR, BL for a stable perspective transform.

    Sum (x+y) is smallest at TL / largest at BR; difference (x-y) is smallest at
    TR / largest at BL. This is the standard, rotation-robust ordering."""
    pts = pts.reshape(4, 2).astype(np.float32)
    ordered = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).reshape(-1)
    ordered[0] = pts[np.argmin(s)]  # TL
    ordered[2] = pts[np.argmax(s)]  # BR
    ordered[1] = pts[np.argmin(d)]  # TR
    ordered[3] = pts[np.argmax(d)]  # BL
    return ordered


def _find_card_quad(img: np.ndarray) -> np.ndarray | None:
    """Find the card's four corners as an ordered quad, or None if not found.

    Strategy: grayscale -> blur -> Otsu threshold AND Canny (union of masks, so a
    card that contrasts by brightness OR by texture is caught) -> findContours ->
    largest contour by area -> approxPolyDP to a 4-gon, falling back to the
    minAreaRect box when the polygon is not clean. The largest-contour heuristic
    assumes the card dominates the frame, which the capture guidance enforces."""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        # Two complementary edge sources, unioned: Otsu handles a card that sits
        # on a contrasting background; Canny handles a low-contrast background
        # where only the printed edge fires.
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        canny = cv2.Canny(gray, 50, 150)
        canny = cv2.dilate(canny, np.ones((3, 3), np.uint8), iterations=1)
        mask = cv2.bitwise_or(otsu, canny)

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return None

        biggest = max(contours, key=cv2.contourArea)
        frame_area = float(img.shape[0] * img.shape[1])
        # Guard against picking up a speck: the card should be a real chunk of
        # the frame. Below 10% we have no card, only noise -> fail closed.
        if cv2.contourArea(biggest) < 0.10 * frame_area:
            return None

        peri = cv2.arcLength(biggest, True)
        approx = cv2.approxPolyDP(biggest, 0.02 * peri, True)
        if len(approx) == 4:
            return _order_corners(approx)

        # Polygon was not a clean quad (rounded card corners, noisy edge): fall
        # back to the rotated bounding box, which is always four points.
        rect = cv2.minAreaRect(biggest)
        box = cv2.boxPoints(rect)
        return _order_corners(box)
    except Exception:
        return None


def _warp_card(img: np.ndarray, quad: np.ndarray) -> np.ndarray | None:
    """Perspective-warp the card quad to a canonical CARD_W x CARD_H portrait.

    If the quad is landscape (the card was shot rotated 90 deg), we re-map the
    destination so the long axis lands on the portrait height. This keeps the
    canonical card upright so 'top/bottom' and 'left/right' mean what they say."""
    try:
        tl, tr, br, bl = quad
        width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
        height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))

        dst_w, dst_h = CARD_W, CARD_H
        if width > height:
            # Source is landscape: rotate the destination ordering so the long
            # side maps to the portrait height instead of stretching it.
            dst = np.array(
                [[0, dst_h], [0, 0], [dst_w, 0], [dst_w, dst_h]],
                dtype=np.float32,
            )
        else:
            dst = np.array(
                [[0, 0], [dst_w, 0], [dst_w, dst_h], [0, dst_h]],
                dtype=np.float32,
            )

        m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
        return cv2.warpPerspective(img, m, (dst_w, dst_h))
    except Exception:
        return None


def _scan_inward(profile: np.ndarray) -> int | None:
    """Given a 1-D brightness profile running inward from a card edge, return the
    pixel offset of the first strong, real edge (the inner border), or None.

    We threshold the absolute first difference of the profile: the first sample
    past _MIN_INWARD_PX whose gradient clears _EDGE_GRAD_MIN is the border edge.
    Bounding the search to _MAX_INWARD_FRAC of the run keeps a textured inner art
    region from being mistaken for the border."""
    n = profile.size
    if n < _MIN_INWARD_PX + 2:
        return None
    grad = np.abs(np.diff(profile.astype(np.float32)))
    # The profile is already bounded to _MAX_INWARD_FRAC of the dimension by the
    # caller, so scanning the whole gradient run cannot stray into inner art.
    for i in range(_MIN_INWARD_PX, grad.size):
        if grad[i] >= _EDGE_GRAD_MIN:
            return i + 1  # the edge sits between sample i and i+1
    return None


def _measure_inner_border(
    card: np.ndarray,
) -> tuple[float | None, float | None, float | None, float | None]:
    """Measure the four card-edge-to-inner-border gaps on the flat card.

    Returns (left, right, top, bottom) in pixels, any of which may be None if
    that side's border edge could not be located. Each side is scanned over the
    central _SCAN_BAND_FRAC band of scan-lines and the per-line edge offsets are
    medianed, which rejects the odd line that hits a logo or text spur."""
    gray = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Central band limits, so corner artwork and rounded corners do not bias the
    # scan. We average over the middle half of each side by default.
    band = _SCAN_BAND_FRAC
    row_lo, row_hi = int(h * (0.5 - band / 2)), int(h * (0.5 + band / 2))
    col_lo, col_hi = int(w * (0.5 - band / 2)), int(w * (0.5 + band / 2))

    max_h = int(w * _MAX_INWARD_FRAC)
    max_v = int(h * _MAX_INWARD_FRAC)

    def _median_offset(offsets: list[int]) -> float | None:
        # Require a quorum of scan-lines to agree before trusting the side; a
        # handful of stray hits is not a border.
        good = [o for o in offsets if o is not None]
        if len(good) < max(3, len(offsets) // 3):
            return None
        return float(np.median(good))

    # LEFT: scan each row left->right across the band.
    left_offsets: list[int | None] = []
    for r in range(row_lo, row_hi):
        prof = gray[r, 0:max_h]
        left_offsets.append(_scan_inward(prof))
    left = _median_offset(left_offsets)

    # RIGHT: scan each row right->left (reverse the profile).
    right_offsets: list[int | None] = []
    for r in range(row_lo, row_hi):
        prof = gray[r, w - max_h : w][::-1]
        right_offsets.append(_scan_inward(prof))
    right = _median_offset(right_offsets)

    # TOP: scan each column top->bottom.
    top_offsets: list[int | None] = []
    for c in range(col_lo, col_hi):
        prof = gray[0:max_v, c]
        top_offsets.append(_scan_inward(prof))
    top = _median_offset(top_offsets)

    # BOTTOM: scan each column bottom->top (reverse).
    bottom_offsets: list[int | None] = []
    for c in range(col_lo, col_hi):
        prof = gray[h - max_v : h, c][::-1]
        bottom_offsets.append(_scan_inward(prof))
    bottom = _median_offset(bottom_offsets)

    return left, right, top, bottom


def _share(a: float, b: float) -> float:
    """Larger of the two border shares as a percentage, 50..100.

    a and b are the opposing gaps on one axis. The card's centring on that axis
    is how lopsided the two are; 50 is perfect, 100 is the art touching one edge."""
    total = a + b
    if total <= 0:
        return 50.0
    return round(100.0 * max(a, b) / total, 1)


def _ratio_str(a: float, b: float) -> str:
    """Format an axis as 'WW.W/LL.L' with the larger share first."""
    hi = _share(a, b)
    lo = round(100.0 - hi, 1)
    return f"{hi:.1f}/{lo:.1f}"


def _draw_overlay(
    card: np.ndarray,
    left: float | None,
    right: float | None,
    top: float | None,
    bottom: float | None,
) -> str | None:
    """Render the annotated overlay (card rect + inner border + the four gaps)
    and return its base64 PNG, or None on any failure. The overlay is a debugging
    / trust aid, so it must never break the measurement if drawing fails."""
    try:
        canvas = card.copy()
        h, w = canvas.shape[:2]
        green = (0, 200, 0)
        red = (0, 0, 255)

        # Outer card rectangle.
        cv2.rectangle(canvas, (0, 0), (w - 1, h - 1), green, 2)

        # Inner border rectangle from whichever sides we found.
        if None not in (left, right, top, bottom):
            x0, y0 = int(left), int(top)
            x1, y1 = int(w - right), int(h - bottom)
            cv2.rectangle(canvas, (x0, y0), (x1, y1), red, 2)

        # The four measured widths, drawn as lines through the card centre.
        cy, cx = h // 2, w // 2
        if left is not None:
            cv2.line(canvas, (0, cy), (int(left), cy), red, 2)
        if right is not None:
            cv2.line(canvas, (w - 1, cy), (int(w - right), cy), red, 2)
        if top is not None:
            cv2.line(canvas, (cx, 0), (cx, int(top)), red, 2)
        if bottom is not None:
            cv2.line(canvas, (cx, h - 1), (cx, int(h - bottom)), red, 2)

        ok, png = cv2.imencode(".png", canvas)
        if not ok:
            return None
        return base64.b64encode(png.tobytes()).decode("ascii")
    except Exception:
        return None


def measure(
    image_bytes: bytes,
    side: str = "front",
    calibration: dict | None = None,
) -> SideCentering:
    """Measure centering for one side of a card. Never raises.

    On a clean bordered card this returns an assessable, high-confidence ratio
    plus the PSA grade for the worse axis. A full-bleed card degrades to a
    borderless, non-assessable result; an undecodable / cardless image fails
    closed to a non-assessable could-not-detect result. The overlay PNG is always
    attached when we have a warped card to draw on."""
    img = _decode_bgr(image_bytes)
    if img is None:
        return SideCentering(
            confidence=Confidence.low,
            assessable=False,
            notes=["could not decode image"],
        )

    img = _maybe_undistort(img, calibration)

    quad = _find_card_quad(img)
    if quad is None:
        # No card edge -> we have nothing to measure against. Fail closed.
        return SideCentering(
            confidence=Confidence.low,
            assessable=False,
            notes=["could not detect card edge"],
        )

    card = _warp_card(img, quad)
    if card is None:
        return SideCentering(
            confidence=Confidence.low,
            assessable=False,
            notes=["could not warp card to canonical view"],
        )

    left, right, top, bottom = _measure_inner_border(card)
    overlay = _draw_overlay(card, left, right, top, bottom)

    found = sum(v is not None for v in (left, right, top, bottom))
    if found < _BORDER_FOUND_MIN_SIDES:
        # No reliable inner border on all four sides -> treat as borderless /
        # full-bleed art. Emit NO numeric ratio; route to assess-by-eye.
        return SideCentering(
            left_px=left,
            right_px=right,
            top_px=top,
            bottom_px=bottom,
            border_type=BorderType.borderless,
            confidence=Confidence.low,
            assessable=False,
            overlay_png_b64=overlay,
            notes=["centering low-confidence: borderless art, assess by eye"],
        )

    # All four gaps in hand: compute the two axes and the worse one.
    assert left is not None and right is not None
    assert top is not None and bottom is not None

    h_share = _share(left, right)
    v_share = _share(top, bottom)
    h_ratio = _ratio_str(left, right)
    v_ratio = _ratio_str(top, bottom)

    if v_share >= h_share:
        worse_axis = "v"
        worse_pct = v_share
    else:
        worse_axis = "h"
        worse_pct = h_share

    grade = grade_for_worse_pct(worse_pct, side=side)

    # Confidence: a clean four-sided measurement on a warped card is the good
    # case. We hold back from 'high' if the gaps are implausibly tiny (sub-pixel
    # warp ringing rather than a real border), keeping the verdict honest.
    smallest = min(left, right, top, bottom)
    confidence = Confidence.high if smallest >= _MIN_INWARD_PX else Confidence.medium

    notes: list[str] = []
    f_front = front_thresholds()
    if worse_pct > float(f_front["ten_eligible_max_pct"]):
        notes.append("worse-axis centering past 10-eligible band")

    return SideCentering(
        left_px=round(left, 1),
        right_px=round(right, 1),
        top_px=round(top, 1),
        bottom_px=round(bottom, 1),
        h_ratio=h_ratio,
        v_ratio=v_ratio,
        worse_axis=worse_axis,
        worse_pct=worse_pct,
        border_type=BorderType.bordered,
        confidence=confidence,
        assessable=True,
        grade_estimate=grade,
        overlay_png_b64=overlay,
        notes=notes,
    )


def measure_card(
    front_bytes: bytes,
    back_bytes: bytes | None = None,
    calibration: dict | None = None,
) -> CenteringMeasurement:
    """Measure both sides of a card into a single CenteringMeasurement.

    The back is optional: a missing back leaves `back=None` rather than a
    fabricated assessment. Each side is measured independently and neither can
    raise, so a bad back never sinks a good front."""
    front = measure(front_bytes, side="front", calibration=calibration)
    back = None
    if back_bytes is not None:
        back = measure(back_bytes, side="back", calibration=calibration)
    return CenteringMeasurement(front=front, back=back)
