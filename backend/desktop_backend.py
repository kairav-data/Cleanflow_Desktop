from __future__ import annotations

import os

import uvicorn

from runtime_env import bootstrap_environment

bootstrap_environment()

from main import app


if __name__ == "__main__":
    backend_host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    backend_port = int(os.environ.get("BACKEND_PORT", "38123"))
    uvicorn.run(
        app,
        host=backend_host,
        port=backend_port,
        log_level=os.environ.get("UVICORN_LOG_LEVEL", "info").lower(),
    )
