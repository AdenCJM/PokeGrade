"""Image normalisation shared by the CV and adjudicator paths.

Phone uploads arrive as JPEG, PNG, WebP, or HEIC, often with an EXIF
orientation tag. cv2.imdecode ignores EXIF (cards come out sideways) and cannot
read HEIC at all, and Claude vision rejects HEIC and 400s on a media_type that
does not match the bytes. So we normalise once, up front:

  - decode with EXIF orientation APPLIED (so the card is upright for both the
    CV measurement and Claude's read),
  - hand the CV path a lossless PNG at full resolution (faithful pixels, no
    second lossy re-encode — this honours the design's "raw, not a canvas blob"
    intent while still being readable by cv2 and oriented correctly),
  - hand Claude a correctly-typed JPEG capped at the Opus 4.8 high-res ceiling.

HEIC support comes from pillow-heif registering a HEIF opener with Pillow.
"""

from __future__ import annotations

import io
from typing import Optional

# Opus 4.8 vision high-res ceiling (long edge). Card defects live in this detail.
MAX_EDGE = 2576

# Decompression-bomb guard. A small compressed file can expand into a
# multi-gigabyte bitmap (e.g. a 0.4 MB PNG -> ~400 MB RGB), so we cap decoded
# pixels BEFORE allocating. 50 MP is well above any real phone photo (~12-48 MP)
# but bounds a hostile or corrupt upload. This is the load-bearing guard: cv2
# has no pixel cap of its own, so undecodable/oversized inputs must NOT fall
# through to cv2 with the raw bytes (see normalize_for_cv).
MAX_PIXELS = 50_000_000

_HEIF_REGISTERED = False


def _ensure_heif() -> None:
    global _HEIF_REGISTERED
    if _HEIF_REGISTERED:
        return
    try:  # optional — JPEG/PNG/WebP work without it
        import pillow_heif  # type: ignore

        pillow_heif.register_heif_opener()
    except Exception:
        pass
    _HEIF_REGISTERED = True


def _decode(raw: bytes):
    """Decode bytes to an upright RGB Pillow image, or None if undecodable or
    too large. Image.open is lazy, so img.size reads the header WITHOUT
    allocating the bitmap — we reject an oversized image before convert()."""
    _ensure_heif()
    try:
        from PIL import Image, ImageOps

        img = Image.open(io.BytesIO(raw))
        w, h = img.size
        if w * h > MAX_PIXELS:  # decompression-bomb guard, pre-allocation
            return None
        img = ImageOps.exif_transpose(img)  # bake in EXIF orientation
        return img.convert("RGB")
    except Exception:  # corrupt, unsupported, or PIL's own DecompressionBombError
        return None


def normalize_for_cv(raw: bytes) -> bytes:
    """Faithful, upright, full-resolution PNG bytes for the CV path. Returns
    empty bytes if the image cannot be safely decoded, so cv2.imdecode fails
    closed rather than being handed an oversized/hostile buffer (cv2 has no
    pixel cap; centering then routes the card to could_not_assess)."""
    img = _decode(raw)
    if img is None:
        return b""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def to_jpeg_b64(raw: bytes, max_edge: int = MAX_EDGE) -> Optional[str]:
    """Upright JPEG (base64, no data: prefix) capped at max_edge for Claude
    vision. None if the image cannot be decoded (caller skips that image)."""
    import base64

    img = _decode(raw)
    if img is None:
        return None
    w, h = img.size
    scale = min(1.0, max_edge / max(w, h)) if max(w, h) else 1.0
    if scale < 1.0:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")
