"""`pokegrade` CLI — the local ingest + ledger + calibration entry point.

    pokegrade ingest <folder>                 grade a card-folder (front_flat.* required)
    pokegrade record-actual <card_id> --grade N [--cert C] [--submitted]
    pokegrade calibrate-lens <folder> [--cols 9 --rows 6]
    pokegrade report                          dual-error report from the ledger
    pokegrade serve [--port 8000]             run the FastAPI engine (uvicorn)

The web UI uses the FastAPI `/grade` path; this CLI is the local ingest path
that retains fuller EXIF validation and writes overlay PNGs to disk.
"""

from __future__ import annotations

import argparse
import base64
import glob
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import RUNS_DIR, ensure_data_dirs
from .ledger import Ledger
from .models import Actual, ValueInputs

_IMG_EXTS = ("jpg", "jpeg", "png", "webp", "heic", "heif")


def _find(folder: Path, stem: str) -> Optional[Path]:
    for ext in _IMG_EXTS:
        hits = sorted(glob.glob(str(folder / f"{stem}.{ext}")))
        if hits:
            return Path(hits[0])
    return None


def _find_many(folder: Path, prefix: str) -> list[Path]:
    out: list[Path] = []
    for ext in _IMG_EXTS:
        out.extend(Path(p) for p in sorted(glob.glob(str(folder / f"{prefix}*.{ext}"))))
    return out


def cmd_ingest(args: argparse.Namespace) -> int:
    from .pipeline import grade  # lazy: keeps `serve`/`report` light

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"Not a folder: {folder}", file=sys.stderr)
        return 2
    front = _find(folder, "front_flat") or _find(folder, "front")
    if front is None:
        print("No front_flat.<ext> found in the folder.", file=sys.stderr)
        return 2
    back = _find(folder, "back_flat") or _find(folder, "back")
    closeups = _find_many(folder, "corner_macro_") + _find_many(folder, "closeup")

    resp = grade(
        front_bytes=front.read_bytes(),
        back_bytes=back.read_bytes() if back else None,
        closeup_bytes=[p.read_bytes() for p in closeups],
        value=ValueInputs(card_value=args.value, fee=args.fee, spread_9_10=args.spread),
    )

    # Write the centering overlay PNG — the core local artefact.
    ensure_data_dirs()
    run_dir = RUNS_DIR / resp.card_id
    run_dir.mkdir(parents=True, exist_ok=True)
    if resp.centering.front and resp.centering.front.overlay_png_b64:
        (run_dir / "centering_front.png").write_bytes(
            base64.b64decode(resp.centering.front.overlay_png_b64)
        )
    (run_dir / "response.json").write_text(resp.model_dump_json(indent=2))

    print(f"\n  VERDICT: {resp.verdict.value}   (confidence: {resp.confidence.value})")
    if resp.limiting_pillar:
        print(f"  limiting pillar: {resp.limiting_pillar.value}")
    if resp.centering.front and resp.centering.front.assessable:
        f = resp.centering.front
        print(f"  centering: {f.worse_axis} {f.h_ratio} / {f.v_ratio}  (~PSA {f.grade_estimate})")
    print(f"  reasons: {', '.join(resp.reason_codes)}")
    if resp.soft_pillars.loupe_checklist:
        print("  loupe checklist:")
        for item in resp.soft_pillars.loupe_checklist:
            print(f"    - [{item.pillar.value}] {item.location}: {item.what_to_check}")
    if resp.notes:
        print("  notes: " + " | ".join(resp.notes))
    print(f"\n  card_id {resp.card_id}  ->  {run_dir}")
    return 0


def cmd_record_actual(args: argparse.Namespace) -> int:
    led = Ledger()
    led.init_db()
    led.record_actual(
        Actual(
            card_id=args.card_id,
            submitted=args.submitted,
            psa_grade=args.grade,
            cert=args.cert,
            recorded_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    print(f"Recorded actual for {args.card_id}: grade={args.grade} cert={args.cert} (appended).")
    return 0


def cmd_calibrate(args: argparse.Namespace) -> int:
    from .calibrate import calibrate_lens, save_calibration

    folder = Path(args.folder)
    images = []
    for ext in _IMG_EXTS:
        images.extend(sorted(glob.glob(str(folder / f"*.{ext}"))))
    profile = calibrate_lens(images, chessboard=(args.cols, args.rows))
    save_calibration(profile)
    print(json.dumps({k: v for k, v in profile.items() if k != "camera_matrix"}, indent=2))
    print(f"Saved calibration profile ({profile.get('n_images', 0)} images).")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    led = Ledger()
    led.init_db()
    rows = led.dual_error_report()
    if not rows:
        print("No reconciled predictions yet (record actuals with `pokegrade record-actual`).")
        return 0
    print(json.dumps(rows, indent=2))
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("pokegrade.app:app", host=args.host, port=args.port, reload=args.reload)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pokegrade", description="PokeGrade engine CLI")
    sub = p.add_subparsers(dest="command", required=True)

    pi = sub.add_parser("ingest", help="grade a card folder")
    pi.add_argument("folder")
    pi.add_argument("--value", type=float, default=None, help="market price of the raw/likely-9 card")
    pi.add_argument("--fee", type=float, default=None, help="grading + shipping fee")
    pi.add_argument("--spread", type=float, default=None, help="price(PSA 10) - price(PSA 9)")
    pi.set_defaults(func=cmd_ingest)

    pa = sub.add_parser("record-actual", help="append an official outcome (never overwrites)")
    pa.add_argument("card_id")
    pa.add_argument("--grade", type=float, required=True)
    pa.add_argument("--cert", default=None)
    pa.add_argument("--submitted", action="store_true")
    pa.set_defaults(func=cmd_record_actual)

    pc = sub.add_parser("calibrate-lens", help="one-time chessboard lens calibration")
    pc.add_argument("folder")
    pc.add_argument("--cols", type=int, default=9)
    pc.add_argument("--rows", type=int, default=6)
    pc.set_defaults(func=cmd_calibrate)

    pr = sub.add_parser("report", help="dual-error report (false submits + skips that gemmed)")
    pr.set_defaults(func=cmd_report)

    ps = sub.add_parser("serve", help="run the FastAPI engine")
    ps.add_argument("--host", default="127.0.0.1")
    ps.add_argument("--port", type=int, default=8000)
    ps.add_argument("--reload", action="store_true")
    ps.set_defaults(func=cmd_serve)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
