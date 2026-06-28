"""Engine configuration: paths, env loading, model selection.

Local-only v1. The ledger DB and per-run artefact directories live under
``engine/.data`` (gitignored). The Anthropic key is shared with the web app via
the repo-root ``.env.local`` so there is one place to set it.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# engine/pokegrade/config.py -> engine/ -> repo root
ENGINE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = ENGINE_DIR.parent

# Load the shared key file (repo-root .env.local), then engine/.env if present.
# load_dotenv does not overwrite already-set vars, so a real environment wins.
load_dotenv(REPO_ROOT / ".env.local")
load_dotenv(ENGINE_DIR / ".env")

DATA_DIR = Path(os.environ.get("POKEGRADE_DATA_DIR", ENGINE_DIR / ".data"))
RUNS_DIR = DATA_DIR / "runs"
LEDGER_PATH = Path(os.environ.get("POKEGRADE_LEDGER", DATA_DIR / "ledger.db"))
STANDARDS_PATH = ENGINE_DIR / "standards.json"
CALIBRATION_PATH = Path(
    os.environ.get("POKEGRADE_CALIBRATION", DATA_DIR / "calibration.json")
)

DEFAULT_MODEL = "claude-opus-4-8"


def resolve_model() -> str:
    return os.environ.get("MODEL", "").strip() or DEFAULT_MODEL


def has_api_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
