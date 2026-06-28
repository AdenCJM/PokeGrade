"""Synthetic card fixtures for the centering tests.

The whole point of these fixtures is that the TRUE centering ratio is known by
construction, independent of the measurement code: we draw a card rectangle and
place an inner-border rectangle at explicit, asymmetric pixel offsets, so the
expected worse-axis share is arithmetic on those offsets — not a re-derivation
of what `centering.py` happens to compute. If the measurement drifts, the test
catches it because the expectation comes from the drawing, not the measurer.

We render at the canonical 63:88 portrait aspect so the perspective warp inside
`measure()` is near-identity and the constructed offsets survive it intact.
"""

from __future__ import annotations

import cv2
import numpy as np

# Match the engine's canonical card so the warp is near-identity and the
# constructed offsets land where we drew them.
CARD_W = 630
CARD_H = 880

# A grey margin around the card gives the card detector a contrasting edge to
# lock onto, mirroring a card shot on a neutral surface.
_MARGIN = 60
_BG_GREY = 128  # mid-grey background
_CARD_STOCK = 245  # near-white card border (PSA white border / card stock)
_INNER_FILL = 40  # dark inner art region, a strong card-stock -> art transition


def _encode_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:  # pragma: no cover - imencode of a valid ndarray does not fail
        raise RuntimeError("failed to encode fixture PNG")
    return buf.tobytes()


def bordered_card_png(
    left: int,
    right: int,
    top: int,
    bottom: int,
) -> bytes:
    """Draw a bordered card whose inner border sits at the given edge gaps.

    `left/right/top/bottom` are the card-edge-to-inner-border gaps in canonical
    card pixels (CARD_W x CARD_H). The returned PNG is a grey-backed card with a
    near-white stock border and a dark inner art rectangle at exactly those
    offsets, so the true horizontal/vertical shares are computable directly from
    the four numbers passed in."""
    h = CARD_H + 2 * _MARGIN
    w = CARD_W + 2 * _MARGIN
    img = np.full((h, w, 3), _BG_GREY, dtype=np.uint8)

    # Card body (stock / border colour).
    cx0, cy0 = _MARGIN, _MARGIN
    cx1, cy1 = _MARGIN + CARD_W, _MARGIN + CARD_H
    cv2.rectangle(img, (cx0, cy0), (cx1 - 1, cy1 - 1), (_CARD_STOCK,) * 3, -1)

    # Inner art rectangle, offset asymmetrically from the card edges.
    ix0 = cx0 + left
    iy0 = cy0 + top
    ix1 = cx1 - right
    iy1 = cy1 - bottom
    cv2.rectangle(img, (ix0, iy0), (ix1 - 1, iy1 - 1), (_INNER_FILL,) * 3, -1)

    return _encode_png(img)


def expected_worse_pct(left: int, right: int, top: int, bottom: int) -> tuple[str, float]:
    """The constructed worse-axis (h/v) and its larger share, from the offsets.

    This is the ground truth the measurement is asserted against. It is pure
    arithmetic on the drawing inputs and never calls `centering.py`."""
    h_total = left + right
    v_total = top + bottom
    h_share = 100.0 * max(left, right) / h_total
    v_share = 100.0 * max(top, bottom) / v_total
    if v_share >= h_share:
        return "v", round(v_share, 1)
    return "h", round(h_share, 1)


def borderless_card_png() -> bytes:
    """Draw a full-bleed card: art runs edge to edge, no printed inner border.

    The card body is a single mid-tone fill with faint low-contrast texture, so
    there is no strong card-stock -> border transition for the inward scan to
    latch onto — the borderless branch should trigger."""
    h = CARD_H + 2 * _MARGIN
    w = CARD_W + 2 * _MARGIN
    img = np.full((h, w, 3), _BG_GREY, dtype=np.uint8)

    cx0, cy0 = _MARGIN, _MARGIN
    cx1, cy1 = _MARGIN + CARD_W, _MARGIN + CARD_H
    # A uniform-ish full-art fill (distinct from the grey background so the card
    # is still detectable, but with no internal border edge).
    cv2.rectangle(img, (cx0, cy0), (cx1 - 1, cy1 - 1), (170, 150, 160), -1)

    # Faint texture, well below the edge-gradient threshold, to look like art
    # without creating a border-strength transition.
    rng = np.random.default_rng(7)
    noise = rng.integers(-6, 7, size=(CARD_H, CARD_W, 3), dtype=np.int16)
    region = img[cy0:cy1, cx0:cx1].astype(np.int16) + noise
    img[cy0:cy1, cx0:cx1] = np.clip(region, 0, 255).astype(np.uint8)

    return _encode_png(img)


def blank_png() -> bytes:
    """A uniform blank image with no card at all — the fail-closed case."""
    img = np.full((400, 400, 3), _BG_GREY, dtype=np.uint8)
    return _encode_png(img)


def garbage_bytes() -> bytes:
    """Non-image bytes: cv2.imdecode must return None and we must not crash."""
    return b"this is not an image, not even close \x00\x01\x02"
