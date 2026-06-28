"""Provenance hashing: tie each prediction to its exact inputs and config.

A prediction you submit money against must be reproducible (eng Decision 7).
Image hashes, the prompt hash, the packet hash, the standards version, and the
code commit pin the run. Browser uploads degrade EXIF-based capture validation
(see exif_validate.py), but the server can always capture these hashes.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from typing import Any

from .config import REPO_ROOT


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def hash_packet(obj: Any) -> str:
    """Deterministic hash of a structured packet (sorted keys)."""
    payload = json.dumps(obj, sort_keys=True, default=str, separators=(",", ":"))
    return sha256_text(payload)


def code_commit() -> str:
    """Best-effort short git commit of the repo, for the ledger. Returns
    "unknown" outside a git checkout."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return "unknown"
