# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

block_cipher = None

project_dir = Path(SPECPATH)

datas = []
binaries = []
hiddenimports = []

packages_to_collect = [
    "authlib",
    "bcrypt",
    "duckdb",
    "email_validator",
    "fastapi",
    "fastexcel",
    "httpx",
    "motor",
    "numpy",
    "openpyxl",
    "pandas",
    "passlib",
    "polars",
    "psycopg2",
    "pyarrow",
    "pydantic",
    "pymssql",
    "pymysql",
    "pyodbc",
    "python_dotenv",
    "rapidfuzz",
    "resend",
    "scipy",
    "sklearn",
    "sqlalchemy",
    "starlette",
    "uvicorn",
    "xlsxwriter",
]

for package_name in packages_to_collect:
    collected_datas, collected_binaries, collected_hiddenimports = collect_all(package_name)
    datas += collected_datas
    binaries += collected_binaries
    hiddenimports += collected_hiddenimports

a = Analysis(
    ["desktop_backend.py"],
    pathex=[str(project_dir)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CleanFlowBackend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="CleanFlowBackend",
)
