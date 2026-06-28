"""PokeGrade engine package.

A local FastAPI sidecar behind the Next.js web UI. It measures centering
deterministically (OpenCV), rules the soft pillars with Claude, computes an
EV-aware SUBMIT / IN_HAND_CHECK / SKIP verdict, and records every prediction
to an append-only SQLite ledger (the substrate for the open verified log).
"""

ENGINE_VERSION = "0.1.0"
