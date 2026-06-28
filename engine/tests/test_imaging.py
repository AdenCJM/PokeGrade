"""Tests for image normalisation (imaging.py).

This is the module a media-type-mismatch bug was fixed in, and it now also
carries the decompression-bomb guard, so it earns direct coverage: format
normalisation (PNG for CV, JPEG for Claude), EXIF orientation baking, the
oversized-image guard, and the garbage-bytes fail-soft contract pipeline.py
relies on.
"""

from __future__ import annotations

import base64
import io

from PIL import Image

from pokegrade import imaging
from tests import fixtures as fx


def _decode_format(b: bytes) -> str:
    return Image.open(io.BytesIO(b)).format


def test_to_jpeg_b64_returns_decodable_jpeg():
    png = fx.bordered_card_png(left=60, right=60, top=60, bottom=60)
    b64 = imaging.to_jpeg_b64(png)
    assert b64
    assert _decode_format(base64.b64decode(b64)) == "JPEG"


def test_normalize_for_cv_returns_png():
    jpeg = io.BytesIO()
    Image.new("RGB", (300, 400), (120, 120, 120)).save(jpeg, format="JPEG")
    out = imaging.normalize_for_cv(jpeg.getvalue())
    assert _decode_format(out) == "PNG"


def test_to_jpeg_b64_downscales_to_max_edge():
    big = io.BytesIO()
    Image.new("RGB", (4000, 3000), (90, 90, 90)).save(big, format="JPEG")
    b64 = imaging.to_jpeg_b64(big.getvalue())
    img = Image.open(io.BytesIO(base64.b64decode(b64)))
    assert max(img.size) == imaging.MAX_EDGE


def test_garbage_bytes_fail_soft():
    # normalize must NOT pass undecodable bytes to cv2 — it returns empty so
    # centering fails closed; to_jpeg returns None so the adjudicator skips it.
    assert imaging.normalize_for_cv(fx.garbage_bytes()) == b""
    assert imaging.to_jpeg_b64(fx.garbage_bytes()) is None


def test_oversized_image_rejected_pre_allocation(monkeypatch):
    # Shrink the pixel cap so a tiny fixture trips the bomb guard without
    # actually allocating a gigapixel bitmap.
    monkeypatch.setattr(imaging, "MAX_PIXELS", 1000)
    small = io.BytesIO()
    Image.new("RGB", (200, 200), (100, 100, 100)).save(small, format="PNG")
    raw = small.getvalue()
    assert imaging.normalize_for_cv(raw) == b""  # not the raw bytes
    assert imaging.to_jpeg_b64(raw) is None


def test_exif_orientation_is_baked_in():
    # Orientation 6 = rotate 90deg; a 40x80 portrait should come out 80x40.
    img = Image.new("RGB", (40, 80), (130, 130, 130))
    exif = img.getexif()
    exif[0x0112] = 6
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    out = imaging.normalize_for_cv(buf.getvalue())
    assert Image.open(io.BytesIO(out)).size == (80, 40)
