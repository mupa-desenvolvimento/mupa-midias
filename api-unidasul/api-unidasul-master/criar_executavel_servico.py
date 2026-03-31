import os
import sys
import shutil
from pathlib import Path
import argparse

# Verificar se PyInstaller está instalado
try:
    import PyInstaller
except ImportError:
    print("Instalando PyInstaller...")
    os.system("pip install pyinstaller")

# Caminho do diretório atual
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
# Caminho para o diretório da versão 15
VERSION_DIR = BASE_DIR / "api-unidasul-master_version_15"
# Caminho para o ícone
ICON_PATH = VERSION_DIR / "icon_sistema.ico"

# Criar arquivo Python temporário para o executável
service_launcher_path = BASE_DIR / "service_launcher.py"

with open(service_launcher_path, "w", encoding="utf-8") as f:
    f.write("""
import os
import sys
import time
import ctypes
import subprocess
import webbrowser
import urllib.request
import zipfile
import tempfile
from pathlib import Path

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def run_as_admin():
    if not is_admin():
        print("Solicitando privilégios de administrador...")
        ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, ' '.join(sys.argv), None, 1
        )
        sys.exit(0)

def show_message(title: str, message: str) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(None, message, title, 0x00000040)
    except Exception:
        pass

def wait_http_ok(url: str, timeout_seconds: int = 30) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "APIUnidasul-ServiceLauncher"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                status = getattr(resp, "status", 200)
                if 200 <= int(status) < 400:
                    return True
        except Exception:
            time.sleep(1)
    return False

def find_python_cmd():
    try:
        r = subprocess.run(["py", "-3", "--version"], capture_output=True, text=True)
        if r.returncode == 0:
            return ["py", "-3"]
    except Exception:
        pass
    try:
        r = subprocess.run(["python", "--version"], capture_output=True, text=True)
        if r.returncode == 0:
            return ["python"]
    except Exception:
        pass
    return None

def download_and_extract_nssm(temp_dir: Path) -> Path:
    url = "https://nssm.cc/release/nssm-2.24.zip"
    zip_path = temp_dir / "nssm.zip"
    urllib.request.urlretrieve(url, zip_path)
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(temp_dir)
    nssm_exe = temp_dir / "nssm-2.24" / "win64" / "nssm.exe"
    if not nssm_exe.exists():
        raise RuntimeError("NSSM não encontrado após extração.")
    return nssm_exe

def ensure_service_installed(base_dir: Path, service_name: str) -> bool:
    version_dir = base_dir / "api-unidasul-master_version_15"
    app_dir = version_dir
    app_script = version_dir / "main.py"
    app_exe = version_dir / "output" / "API Unidasul V15" / "API Unidasul V15.exe"
    if not app_dir.exists():
        show_message("API Unidasul", "Pasta api-unidasul-master_version_15 não encontrada ao lado do executável.")
        return False

    use_exe = app_exe.exists()
    python_cmd = None if use_exe else find_python_cmd()
    if not use_exe and not python_cmd:
        show_message("API Unidasul", "Python não encontrado e o executável da API não está disponível.")
        return False
    if not use_exe and not app_script.exists():
        show_message("API Unidasul", "main.py não encontrado para instalar o serviço via Python.")
        return False

    try:
        temp_root = Path(tempfile.mkdtemp(prefix="apiunidasul_nssm_"))
        nssm_exe = download_and_extract_nssm(temp_root)
        if use_exe:
            subprocess.run([str(nssm_exe), "install", service_name, str(app_exe)], check=False)
            subprocess.run([str(nssm_exe), "set", service_name, "AppDirectory", str(app_dir)], check=False)
        else:
            subprocess.run([str(nssm_exe), "install", service_name, python_cmd[0]], check=False)
            if len(python_cmd) > 1:
                subprocess.run([str(nssm_exe), "set", service_name, "AppParameters", " ".join(python_cmd[1:] + [str(app_script)])], check=False)
            else:
                subprocess.run([str(nssm_exe), "set", service_name, "AppParameters", str(app_script)], check=False)
            subprocess.run([str(nssm_exe), "set", service_name, "AppDirectory", str(app_dir)], check=False)

        subprocess.run([str(nssm_exe), "set", service_name, "DisplayName", "API Unidasul"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "Description", "Serviço da API Unidasul para consulta de preços"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "Start", "SERVICE_AUTO_START"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppStdout", str(app_dir / "servico_output.log")], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppStderr", str(app_dir / "servico_error.log")], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppRotateFiles", "1"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppRotateOnline", "1"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppRotateSeconds", "86400"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppRotateBytes", "10485760"], check=False)
        subprocess.run([str(nssm_exe), "set", service_name, "AppEnvironmentExtra", "RUNNING_AS_SERVICE=1"], check=False)
        return True
    except Exception as e:
        show_message("API Unidasul", f"Falha ao instalar o serviço automaticamente: {e}")
        return False

def main():
    # Verificar privilégios de administrador
    run_as_admin()
    
    # Caminho base do executável
    base_dir = Path(os.path.dirname(os.path.abspath(sys.argv[0])))
    
    # Nome do serviço
    service_name = "APIUnidasul"
    
    # Verificar se o serviço existe
    check_service = subprocess.run(
        ["sc", "query", service_name], 
        capture_output=True, 
        text=True
    )
    
    if check_service.returncode == 0:
        # O serviço existe, verificar se está em execução
        if "RUNNING" in check_service.stdout:
            print(f"O serviço {service_name} já está em execução.")
            if wait_http_ok("http://localhost:5000/", timeout_seconds=30):
                webbrowser.open("http://localhost:5000/")
        else:
            # Iniciar o serviço
            print(f"Iniciando o serviço {service_name}...")
            subprocess.run(["sc", "start", service_name])
            time.sleep(2)
            
            # Verificar novamente
            check_again = subprocess.run(
                ["sc", "query", service_name], 
                capture_output=True, 
                text=True
            )
            
            if "RUNNING" in check_again.stdout:
                print(f"Serviço {service_name} iniciado com sucesso!")
                if wait_http_ok("http://localhost:5000/", timeout_seconds=30):
                    webbrowser.open("http://localhost:5000/")
            else:
                print(f"Não foi possível iniciar o serviço {service_name}.")
                print("Verifique os logs em api-unidasul-master_version_15\\servico_error.log")
                show_message("API Unidasul", "Não foi possível iniciar o serviço APIUnidasul. Verifique os logs do serviço.")
    else:
        ok = ensure_service_installed(base_dir, service_name)
        if not ok:
            return

        subprocess.run(["sc", "start", service_name], check=False)
        time.sleep(3)
        check_install = subprocess.run(["sc", "query", service_name], capture_output=True, text=True)
        if check_install.returncode == 0 and "RUNNING" in check_install.stdout:
            if wait_http_ok("http://localhost:5000/", timeout_seconds=30):
                webbrowser.open("http://localhost:5000/")
        else:
            show_message("API Unidasul", "Serviço instalado, mas não foi possível iniciar. Verifique servico_error.log.")
    
    # Finaliza
    pass

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Erro: {e}")
""")

# Criar o arquivo spec para o PyInstaller
spec_path = BASE_DIR / "service_launcher.spec"

with open(spec_path, "w", encoding="utf-8") as f:
    f.write(f"""
# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['service_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={{}},
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
    name='API_Unidasul_Service',
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
    icon=[r'{ICON_PATH}'],
    version='file_version_info.txt',
    uac_admin=True,
)
""")

# Criar arquivo de informações de versão
version_info_path = BASE_DIR / "file_version_info.txt"

with open(version_info_path, "w", encoding="utf-8") as f:
    f.write("""
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
    ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Unidasul'),
        StringStruct(u'FileDescription', u'Inicializador de Serviço API Unidasul'),
        StringStruct(u'FileVersion', u'1.0.0'),
        StringStruct(u'InternalName', u'API_Unidasul_Service'),
        StringStruct(u'LegalCopyright', u'Copyright (c) 2024 Unidasul'),
        StringStruct(u'OriginalFilename', u'API_Unidasul_Service.exe'),
        StringStruct(u'ProductName', u'API Unidasul'),
        StringStruct(u'ProductVersion', u'1.0.0')])
      ]), 
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
""")

parser = argparse.ArgumentParser()
parser.add_argument("--ci", action="store_true")
args = parser.parse_args()

# Executar PyInstaller
print("Criando executável...")
os.chdir(BASE_DIR)
os.system(f"pyinstaller --clean {spec_path}")

# Verificar se o executável foi criado
exe_path = BASE_DIR / "dist" / "API_Unidasul_Service.exe"
if exe_path.exists():
    destino_padrao = BASE_DIR / "API_Unidasul_Service.exe"
    destino = destino_padrao
    try:
        if destino.exists():
            try:
                os.chmod(destino, 0o666)
            except Exception:
                pass
        shutil.copy(exe_path, destino)
    except PermissionError:
        destino = BASE_DIR / "API_Unidasul_Service_novo.exe"
        shutil.copy(exe_path, destino)
    print(f"\nExecutável criado com sucesso: {destino}")
    
    # Limpar arquivos temporários
    try:
        shutil.rmtree(BASE_DIR / "build")
        shutil.rmtree(BASE_DIR / "dist")
        os.remove(service_launcher_path)
        os.remove(spec_path)
        os.remove(version_info_path)
        print("Arquivos temporários removidos.")
    except Exception as e:
        print(f"Aviso: Não foi possível remover alguns arquivos temporários: {e}")
        
    print("\nO executável API_Unidasul_Service.exe foi criado com sucesso!")
    print("Este executável irá verificar se o serviço API Unidasul está instalado e em execução.")
    print("Se o serviço não estiver instalado, ele tentará instalar automaticamente e abrir a API no navegador.")
else:
    print("\nErro: Não foi possível criar o executável.")

if not args.ci:
    input("\nPressione Enter para sair...")
