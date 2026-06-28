"""Best-effort EXIF capture validation (eng Decision 7).

A prediction you submit money against is only as trustworthy as the photo it
read. EXIF is the cheapest signal we have about *how* the shot was taken: which
camera, what exposure, and crucially whether the device or an app baked in
processing (HDR fusion, computational sharpening) that fabricates edge and
surface detail the grader will never see in hand.

The catch: browser uploads almost always STRIP or rewrite EXIF. A `<input
type=file>` round-trip, a canvas re-encode, or a privacy-scrubbing share sheet
all drop the camera tags. So a missing-EXIF photo is the COMMON case, not an
error: we degrade capture validation rather than reject the card. The function
is fail-closed in the honest direction. when we cannot read EXIF we say so and
mark the result degraded, never raise into the happy path.

`degraded=True` means "trust the photo less, lean toward IN_HAND_CHECK"; it is
advisory and does not by itself block a verdict. `ok` stays True unless we have
a positive reason to doubt the capture (e.g. HDR/sharpening detected).
"""

from __future__ import annotations

import io
from typing import Any

from PIL import Image
from PIL.ExifTags import TAGS

# Software/processing fingerprints that imply the pixels were synthesised or
# sharpened past what the sensor saw. Matched case-insensitively against the
# EXIF Software/ProcessingSoftware/HostComputer tags and the maker note. These
# are the tells that a photo's crisp corners/edges are an artefact of fusion,
# not the card, so we surface them as a capture concern.
_PROCESSING_HINTS = (
    "hdr",
    "deep fusion",
    "smart hdr",
    "night mode",
    "photonic",
    "sharpen",
    "enhance",
    "ai ",
    "topaz",
    "lightroom",
    "photoshop",
    "snapseed",
    "gimp",
)

# A photo straight off a camera carries dozens of EXIF entries. A scrubbed web
# upload carries a handful of orientation/thumbnail leftovers at most. Below
# this count we treat capture validation as degraded (web-upload assumption).
_MIN_TAGS_FOR_CAMERA = 4


def _stripped_result() -> dict[str, Any]:
    """The standard 'web upload scrubbed the EXIF' outcome.

    Not an error: the card is still gradeable, we just cannot corroborate the
    capture, so capture-dependent confidence is degraded."""
    return {
        "ok": True,
        "degraded": True,
        "flags": ["exif-stripped (web upload): capture validation degraded"],
        "settings": {},
    }


def _coerce_scalar(value: Any) -> Any:
    """Make an EXIF value JSON/plain-dict friendly.

    Pillow hands back IFDRational, bytes, and tuples. We keep numbers as floats
    and decode bytes leniently so a settings dict never carries a type that
    later json.dumps or a Pydantic round-trip would choke on."""
    try:
        # IFDRational and friends are real numbers; float() handles them.
        if isinstance(value, bytes):
            return value.decode("utf-8", "replace").strip("\x00").strip()
        if isinstance(value, (tuple, list)):
            return [_coerce_scalar(v) for v in value]
        if isinstance(value, (int, float)):
            return float(value) if not isinstance(value, bool) else value
        return str(value).strip()
    except Exception:
        # Never let a single odd tag sink the whole read.
        return None


def _processing_concern(blob: str) -> str | None:
    """Return the first processing hint found in a lowercased text blob, or
    None. Centralised so the Software tag and the maker note share one rule."""
    haystack = blob.lower()
    for hint in _PROCESSING_HINTS:
        if hint in haystack:
            return hint.strip()
    return None


def validate_exif(image_bytes: bytes) -> dict:
    """Validate capture metadata from an image's EXIF, best effort.

    Returns a dict with:
      - ``ok`` (bool): False only when we positively suspect the capture
        (processing detected). Missing EXIF alone keeps ok True.
      - ``degraded`` (bool): True when EXIF was absent/scrubbed/unreadable, or
        when a processing concern was raised. Signals "trust this photo less".
      - ``flags`` (list[str]): human-readable notes for the ledger/UI.
      - ``settings`` (dict): surfaced camera settings (make/model, exposure,
        ISO, software) when present.

    Fail-closed: any decode/parse failure returns a degraded result, never an
    exception, because the verdict pipeline must not crash on a weird upload.
    """
    if not image_bytes:
        # Empty payload behaves like a scrubbed upload: nothing to validate.
        return _stripped_result()

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # getexif() never raises on a valid image; it returns an empty
            # mapping when there is no EXIF, which is exactly the web case.
            exif = img.getexif()
    except Exception:
        # Garbage bytes, truncated file, unsupported codec: we cannot read it,
        # so capture validation is degraded but the pipeline keeps moving.
        return {
            "ok": True,
            "degraded": True,
            "flags": ["exif unreadable"],
            "settings": {},
        }

    try:
        # Map numeric EXIF tag ids to human names. Unknown ids fall back to the
        # raw id so we never drop data silently.
        named: dict[str, Any] = {}
        for tag_id, raw in exif.items():
            name = TAGS.get(tag_id, str(tag_id))
            coerced = _coerce_scalar(raw)
            if coerced is not None and coerced != "":
                named[name] = coerced

        # Pull the richer Exif IFD (exposure, ISO, lens) when the image carries
        # one. Many phones keep camera settings here rather than in IFD0.
        settings: dict[str, Any] = {}
        try:
            exif_ifd = exif.get_ifd(0x8769)  # ExifOffset / Exif sub-IFD
        except Exception:
            exif_ifd = {}
        for tag_id, raw in (exif_ifd or {}).items():
            name = TAGS.get(tag_id, str(tag_id))
            coerced = _coerce_scalar(raw)
            if coerced is not None and coerced != "":
                settings[name] = coerced

        # If, after all that, we essentially have nothing, treat it as a
        # stripped web upload. We count both top-level and sub-IFD entries so a
        # photo that keeps only exposure data still counts as "has EXIF".
        if (len(named) + len(settings)) < _MIN_TAGS_FOR_CAMERA:
            return _stripped_result()

        # Surface the headline camera identity and capture settings the user
        # (and the ledger) care about. Absent keys are simply omitted.
        for src, dst in (
            ("Make", "make"),
            ("Model", "model"),
            ("LensModel", "lens"),
            ("Software", "software"),
            ("DateTimeOriginal", "captured_at"),
        ):
            if src in named:
                settings.setdefault(dst, named[src])
            elif src in settings and src != dst:
                settings[dst] = settings.pop(src)

        # Normalise the most useful exposure keys to friendly names so the UI
        # does not have to know EXIF spelling. Keep the originals too.
        for src, dst in (
            ("ExposureTime", "exposure_time"),
            ("FNumber", "f_number"),
            ("ISOSpeedRatings", "iso"),
            ("FocalLength", "focal_length"),
        ):
            if src in settings:
                settings[dst] = settings[src]

        flags: list[str] = []

        # HDR/sharpening detection. We scan every text-ish capture tag plus the
        # maker note, because the tell can live in Software, in a custom
        # processing tag, or in the vendor maker note string.
        scan_sources: list[str] = []
        for key in ("Software", "ProcessingSoftware", "HostComputer", "ImageDescription"):
            if key in named:
                scan_sources.append(str(named[key]))
            if key in settings:
                scan_sources.append(str(settings[key]))
        # CustomRendered == 3 is Apple's HDR flag; SceneCaptureType hints too.
        custom_rendered = settings.get("CustomRendered")
        if custom_rendered in (3, 3.0):
            scan_sources.append("hdr")

        concern = None
        for blob in scan_sources:
            concern = _processing_concern(blob)
            if concern:
                break

        ok = True
        degraded = False
        if concern:
            ok = False
            degraded = True
            flags.append(
                f"processing detected ({concern}): HDR/sharpening can fabricate "
                "edge and surface detail. verify in hand"
            )

        return {
            "ok": ok,
            "degraded": degraded,
            "flags": flags,
            "settings": settings,
        }
    except Exception:
        # Any surprise in the tag-walking path still fails closed, not loud.
        return {
            "ok": True,
            "degraded": True,
            "flags": ["exif unreadable"],
            "settings": {},
        }
