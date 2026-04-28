from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = os.getenv("CLEANFLOW_APP_NAME", "CleanFlow")


def _platform_data_root() -> Path:
    if os.name == "nt":
        base_dir = os.getenv("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        base_dir = str(Path.home() / "Library" / "Application Support")
    else:
        base_dir = os.getenv("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")

    return Path(base_dir).expanduser().resolve() / APP_NAME


def get_data_root() -> Path:
    configured_root = os.getenv("CLEANFLOW_DATA_DIR")
    if configured_root:
        root = Path(configured_root).expanduser().resolve()
    elif getattr(sys, "frozen", False):
        root = _platform_data_root()
    else:
        root = Path(__file__).resolve().parent.parent

    root.mkdir(parents=True, exist_ok=True)
    return root


def ensure_subdirectory(name: str) -> str:
    path = get_data_root() / name
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


UPLOAD_DIR = ensure_subdirectory("uploads")
RESULTS_DIR = ensure_subdirectory("results")
LOGS_DIR = ensure_subdirectory("logs")
CONFIG_DIR = ensure_subdirectory("config")
