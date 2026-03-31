@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ===================================================
echo Criador de Executavel para API Unidasul
echo ===================================================
echo.

:: Verificar se o Python esta instalado
set "PYTHON_EXE="
py -3 --version >nul 2>&1
if %errorLevel% equ 0 (
    set "PYTHON_EXE=py -3"
) else (
    python --version >nul 2>&1
    if %errorLevel% equ 0 (
        set "PYTHON_EXE=python"
    )
)
if "%PYTHON_EXE%"=="" (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale o Python 3.8 ou superior e tente novamente.
    pause
    exit /b 1
)

if not exist "criar_executavel_servico.py" (
    echo ERRO: criar_executavel_servico.py nao encontrado em:
    echo %CD%
    pause
    exit /b 1
)

if not exist "api-unidasul-master_version_15\icon_sistema.ico" (
    echo ERRO: Icone nao encontrado:
    echo api-unidasul-master_version_15\icon_sistema.ico
    pause
    exit /b 1
)

:: Executar o script Python para criar o executavel
echo Iniciando a criacao do executavel...
echo Este processo pode levar alguns minutos.
echo.

%PYTHON_EXE% -m pip --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: pip nao encontrado para o Python selecionado.
    echo Tente reinstalar o Python com a opcao de pip habilitada.
    pause
    exit /b 1
)

%PYTHON_EXE% -m pip install --upgrade pyinstaller >nul 2>&1
%PYTHON_EXE% criar_executavel_servico.py
if %errorLevel% neq 0 (
    echo.
    echo ===================================================
    echo ERRO: Falha ao executar criar_executavel_servico.py
    echo ===================================================
    pause
    exit /b 1
)

if exist "API_Unidasul_Service.exe" (
    echo.
    echo ===================================================
    echo Executavel criado com sucesso!
    echo.
    echo O arquivo API_Unidasul_Service.exe foi criado no diretorio atual.
    echo Para iniciar o servico automaticamente com o Windows:
    echo 1. Crie um atalho para API_Unidasul_Service.exe
    echo 2. Pressione Win + R, digite shell:startup e pressione Enter
    echo 3. Mova o atalho para a pasta de inicializacao
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo ERRO: Nao foi possivel criar o executavel.
    echo Verifique as mensagens de erro acima.
    echo ===================================================
)

pause
