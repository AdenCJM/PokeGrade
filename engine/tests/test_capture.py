"""Capture-validation and lens-calibration tests.

These cover the fail-closed contracts that the rest of the engine relies on:
EXIF validation must degrade (never raise) on scrubbed web uploads and on
garbage, and calibration load/save must round-trip while tolerating a missing
or empty profile. The point is resilience, not numerical accuracy: we are
proving the module survives the inputs the real pipeline will throw at it.
"""

from __future__ import annotations

import io

import pytest
from PIL import Image

from pokegrade.calibrate import calibrate_lens, load_calibration, save_calibration
from pokegrade.exif_validate import validate_exif


# --- exif validation --------------------------------------------------------


def _plain_jpeg_bytes() -> bytes:
    """A freshly-encoded JPEG with no camera EXIF, like a canvas/web upload."""
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (180, 60, 60)).save(buf, format="JPEG")
    return buf.getvalue()


def test_validate_exif_plain_jpeg_is_degraded_and_stripped() -> None:
    """A plain re-encoded JPEG carries no camera tags, so capture validation
    must degrade with the explicit stripped-EXIF flag, not crash."""
    result = validate_exif(_plain_jpeg_bytes())

    assert result["degraded"] is True
    assert result["ok"] is True  # missing EXIF is not a positive doubt
    assert any("exif-stripped" in flag for flag in result["flags"])
    assert result["settings"] == {}


def test_validate_exif_garbage_bytes_does_not_raise() -> None:
    """Non-image bytes must fail closed: degraded result, no exception."""
    result = validate_exif(b"\x00\x01\x02not-an-image\xff\xd8\xff")

    assert result["degraded"] is True
    assert isinstance(result["flags"], list)
    assert result["settings"] == {}


def test_validate_exif_empty_bytes_does_not_raise() -> None:
    """An empty payload behaves like a scrubbed upload, never an error."""
    result = validate_exif(b"")

    assert result["degraded"] is True
    assert result["ok"] is True


# --- calibration load / save ------------------------------------------------


def test_load_calibration_missing_path_returns_none(tmp_path) -> None:
    """A phone that was never calibrated is the normal state: None, not raise."""
    missing = tmp_path / "does-not-exist.json"
    assert load_calibration(missing) is None


def test_save_then_load_calibration_round_trips(tmp_path) -> None:
    """Persisting and reloading a profile must return an equal dict."""
    profile = {
        "calibration_id": "abc123def456",
        "camera_matrix": [[1000.0, 0.0, 320.0], [0.0, 1000.0, 240.0], [0.0, 0.0, 1.0]],
        "dist_coeffs": [0.1, -0.05, 0.0, 0.0, 0.01],
        "image_size": [640, 480],
        "rms": 0.42,
        "n_images": 12,
    }
    target = tmp_path / "calibration.json"

    save_calibration(profile, target)
    loaded = load_calibration(target)

    assert loaded == profile


# --- calibration solve (degenerate input) -----------------------------------


def test_calibrate_lens_no_images_returns_dict_without_raising() -> None:
    """An empty image list cannot solve intrinsics; it must yield an
    insufficient result, not an exception."""
    result = calibrate_lens([])

    assert isinstance(result, dict)
    assert result["n_images"] == 0
    assert "insufficient" in result.get("note", "")
    # No intrinsics should be emitted for an unsolvable session.
    assert "camera_matrix" not in result


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
