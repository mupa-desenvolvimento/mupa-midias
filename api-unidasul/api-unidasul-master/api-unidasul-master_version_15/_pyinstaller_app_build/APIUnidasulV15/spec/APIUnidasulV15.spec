
# -*- mode: python ; coding: utf-8 -*-
block_cipher = None

a = Analysis(
    ['C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/main.py'],
    pathex=['C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15'],
    binaries=[],
    datas=[
        ('C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/templates', 'templates'),
        ('C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/static', 'static'),
        ('C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/imgs_produtos', 'imgs_produtos'),
        ('C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/icon_sistema.ico', '.'),
    ],
    hiddenimports=[],
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
    a.binaries,
    a.datas,
    [],
    name='APIUnidasulV15',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['C:/src/api-unidasul/api-unidasul-master/api-unidasul-master_version_15/icon_sistema.ico'],
)
