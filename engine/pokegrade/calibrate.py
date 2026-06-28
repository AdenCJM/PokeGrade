"""One-time chessboard lens-distortion calibration, per phone.

Phone cameras bend straight lines, especially near the frame edge where a card
border lives. That barrel/pincushion distortion is exactly the region centering
measurement reads, so an uncorrected lens biases the worse-axis percentage and,
with it, the grade. The fix is a one-off per device: shoot a printed chessboard
from a few angles, solve for the intrinsics, and persist them. Centering can
then undistort before it measures.

This is a local CLI one-off, not a request-path module. It runs rarely, on the
operator's own machine, against a handful of images. So it favours clear
diagnostics and graceful failure (return a dict explaining what went wrong)
over throughput. It never raises out of the happy path: too few good board
detections yields an ``insufficient`` result, not an exception, so a calibration
session that finds a bad photo set fails quietly and tells you why.

The persisted profile's ``calibration_id`` is a short hash of the solved
coefficients. It is stamped into ``Provenance.calibration_id`` so every logged
prediction is tied to the exact lens model that corrected its photo.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

from .config import CALIBRATION_PATH

# OpenCV needs at least a handful of consistent views to solve the intrinsics
# without overfitting. Below this we refuse to emit a profile, because a
# one-or-two-image "calibration" is worse than none (it looks authoritative but
# is unstable). The recommended capture set is 10 to 20 angles.
_MIN_VALID_VIEWS = 3

# Sub-pixel corner refinement settings. Tightening the detected corner to the
# true crossing materially improves the solve, and costs nothing at this scale.
_CRITERIA = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)


def _object_points(chessboard: tuple[int, int]) -> np.ndarray:
    """The 3D coordinates of the inner chessboard corners, z=0, unit spacing.

    Absolute square size is irrelevant for the camera matrix and distortion
    coefficients, so we use unit squares: the intrinsics are scale-free."""
    cols, rows = chessboard
    grid = np.zeros((rows * cols, 3), np.float32)
    grid[:, :2] = np.mgrid[0:cols, 0:rows].T.reshape(-1, 2)
    return grid


def _calibration_id(camera_matrix: Any, dist_coeffs: Any) -> str:
    """Short, deterministic id from the solved coefficients.

    A content hash (not a random uuid) so re-running calibration on the same
    images yields the same id, and two different lenses never collide. Twelve
    hex chars is plenty of room to avoid accidental collisions in a personal
    ledger while staying readable in a provenance row."""
    payload = json.dumps(
        {
            "camera_matrix": np.asarray(camera_matrix).round(6).tolist(),
            "dist_coeffs": np.asarray(dist_coeffs).round(6).ravel().tolist(),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def calibrate_lens(
    image_paths: list[str], chessboard: tuple[int, int] = (9, 6)
) -> dict:
    """Solve a camera's intrinsics from chessboard photos.

    ``chessboard`` is the count of INNER corners (columns, rows), i.e. one less
    than the squares per side. The default (9, 6) matches the common printable
    10x7-square board.

    On success returns:
      ``{calibration_id, camera_matrix, dist_coeffs, image_size, rms,
         n_images}`` where ``camera_matrix`` is a 3x3 list-of-lists,
      ``dist_coeffs`` is a flat list, ``image_size`` is ``[w, h]``, and ``rms``
      is the reprojection error (lower is better, under ~1.0 is good).

    On too few usable detections returns ``{n_images, note, ...}`` with an
    ``insufficient`` note and no intrinsics, rather than raising. ``n_images``
    always reflects how many photos produced a valid board detection.
    """
    obj_template = _object_points(chessboard)
    object_points: list[np.ndarray] = []  # 3D board points, one set per view
    image_points: list[np.ndarray] = []  # matching 2D corners per view
    image_size: Optional[tuple[int, int]] = None  # (w, h), from the first read
    failed: list[str] = []  # photos where no board was found, for diagnostics

    for path in image_paths:
        try:
            # Read greyscale: corner finding only needs luminance, and this
            # sidesteps any colour-profile surprises.
            gray = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
            if gray is None:
                # Unreadable / missing file: skip it, keep going.
                failed.append(str(path))
                continue

            if image_size is None:
                h, w = gray.shape[:2]
                image_size = (int(w), int(h))

            found, corners = cv2.findChessboardCorners(
                gray,
                chessboard,
                flags=(
                    cv2.CALIB_CB_ADAPTIVE_THRESH
                    + cv2.CALIB_CB_NORMALIZE_IMAGE
                    + cv2.CALIB_CB_FAST_CHECK
                ),
            )
            if not found:
                failed.append(str(path))
                continue

            # Refine to sub-pixel accuracy before recording the view.
            refined = cv2.cornerSubPix(
                gray, corners, (11, 11), (-1, -1), _CRITERIA
            )
            object_points.append(obj_template.copy())
            image_points.append(refined)
        except Exception:
            # One bad photo must not abort the whole session.
            failed.append(str(path))
            continue

    n_images = len(object_points)

    # Fail closed: not enough good views to trust an intrinsics solve.
    if n_images < _MIN_VALID_VIEWS or image_size is None:
        return {
            "n_images": n_images,
            "note": (
                "insufficient: need at least "
                f"{_MIN_VALID_VIEWS} valid chessboard detections, got "
                f"{n_images}. Shoot 10 to 20 angles of a {chessboard[0]}x"
                f"{chessboard[1]} inner-corner board, filling the frame."
            ),
            "failed_images": failed,
        }

    try:
        rms, camera_matrix, dist_coeffs, _rvecs, _tvecs = cv2.calibrateCamera(
            object_points, image_points, image_size, None, None
        )
    except Exception as exc:
        # The detections passed but the solve itself failed (degenerate
        # geometry, all-coplanar views). Report it, do not raise.
        return {
            "n_images": n_images,
            "note": f"insufficient: calibration solve failed ({exc})",
            "failed_images": failed,
        }

    return {
        "calibration_id": _calibration_id(camera_matrix, dist_coeffs),
        "camera_matrix": np.asarray(camera_matrix).tolist(),
        "dist_coeffs": np.asarray(dist_coeffs).ravel().tolist(),
        "image_size": [image_size[0], image_size[1]],
        "rms": float(rms),
        "n_images": n_images,
    }


def save_calibration(profile: dict, path: Optional[str | Path] = None) -> None:
    """Persist a calibration profile as JSON.

    Defaults to ``config.CALIBRATION_PATH``. Creates the parent directory if
    needed so a fresh checkout's ``.data`` directory does not have to exist
    first. Writes pretty JSON because a human occasionally eyeballs this file."""
    target = Path(path) if path is not None else CALIBRATION_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        json.dump(profile, fh, indent=2, sort_keys=True)


def load_calibration(path: Optional[str | Path] = None) -> dict | None:
    """Load a saved calibration profile, or None when absent/unreadable.

    The request path calls this once at startup. A missing file is the normal
    'this phone is not calibrated yet' state, so we return None rather than
    raise, letting centering proceed without undistortion. A corrupt file is
    treated the same way (None), so a half-written profile cannot crash the
    engine."""
    target = Path(path) if path is not None else CALIBRATION_PATH
    try:
        if not target.exists():
            return None
        with open(target, encoding="utf-8") as fh:
            data = json.load(fh)
        # Guard against a JSON value that is not an object (e.g. a bare list).
        return data if isinstance(data, dict) else None
    except Exception:
        return None
