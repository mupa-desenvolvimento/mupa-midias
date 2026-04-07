# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

PROJECT_DIR = Path(__file__).resolve().parent
ICON = PROJECT_DIR / "icon_sistema.ico"

datas = [
    (str(PROJECT_DIR / "templates"), "templates"),
    (str(PROJECT_DIR / "static"), "static"),
    (str(PROJECT_DIR / "imgs_produtos"), "imgs_produtos"),
    (str(ICON), "."),
]

hiddenimports = []
hiddenimports += collect_submodules("flask")
hiddenimports += collect_submodules("flask_jwt_extended")
hiddenimports += collect_submodules("flask_caching")
hiddenimports += collect_submodules("pydantic")
hiddenimports += collect_submodules("mysql")
hiddenimports += collect_submodules("mysql.connector")
hiddenimports += collect_submodules("PIL")
hiddenimports += collect_submodules("pystray")
hiddenimports += collect_submodules("waitress")

# Extras comuns que aparecem em runtime (hooks/plug-ins)
hiddenimports += [
    "sqlite3",
    "pytz",
    "bs4",
    "requests",
    "werkzeug",
    "jinja2",
]

a = Analysis(
    [str(PROJECT_DIR / "main.py")],
    pathex=[str(PROJECT_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ONEFILE: não use COLLECT aqui
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="APIUnidasulV15",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # --noconsole
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ICON) if ICON.exists() else None,
)