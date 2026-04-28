from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_BOOTSTRAPPED = False


def _candidate_env_paths() -> list[Path]:
    candidates: list[Path] = []
    seen: set[str] = set()

    def add_candidate(value: os.PathLike[str] | str | None) -> None:
        if not value:
            return
        path = Path(value).expanduser().resolve()
        key = str(path).lower()
        if key in seen:
            return
        seen.add(key)
        candidates.append(path)

    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parent

    add_candidate(os.getenv("CLEANFLOW_ENV_FILE"))
    add_candidate(repo_root / ".env")
    add_candidate(current_dir / ".env")

    if getattr(sys, "frozen", False):
        executable_dir = Path(sys.executable).resolve().parent
        add_candidate(executable_dir / ".env")
        add_candidate(executable_dir.parent / ".env")
        add_candidate(Path(os.getenv("CLEANFLOW_DATA_DIR", "")) / "config" / ".env")

        bundled_root = getattr(sys, "_MEIPASS", "")
        if bundled_root:
            add_candidate(Path(bundled_root) / ".env")

    return candidates


def bootstrap_environment(*, override: bool = False) -> None:
    global _BOOTSTRAPPED

    if _BOOTSTRAPPED and not override:
        return

    for candidate in _candidate_env_paths():
        if candidate.is_file():
            load_dotenv(candidate, override=override)

    _BOOTSTRAPPED = True
