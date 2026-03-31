@echo off
echo ===================================================
echo Instalador do Servico API Unidasul
echo ===================================================
echo.

:: Verificar se está sendo executado como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Este script precisa ser executado como Administrador!
    echo Por favor, clique com o botao direito e selecione "Executar como administrador".
    pause
    exit /b 1
)

:: Definir variaveis
set "SERVICO_NOME=APIUnidasul"
set "PYTHON_EXE=python"
set "APP_DIR=%~dp0api-unidasul-master_version_15"
set "APP_SCRIPT=%APP_DIR%\main.py"
set "APP_EXE=%APP_DIR%\output\API Unidasul V15\API Unidasul V15.exe"
set "NSSM_URL=https://nssm.cc/release/nssm-2.24.zip"
set "NSSM_ZIP=%TEMP%\nssm.zip"
set "NSSM_DIR=%TEMP%\nssm"
set "NSSM_EXE=%NSSM_DIR%\nssm-2.24\win64\nssm.exe"

echo Diretorio da aplicacao: %APP_DIR%
echo Script principal: %APP_SCRIPT%
echo Executavel (se existir): %APP_EXE%
echo.

:: Verificar se o Python esta instalado
echo Verificando instalacao do Python...
%PYTHON_EXE% --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Python nao encontrado! Por favor, instale o Python e adicione-o ao PATH.
    pause
    exit /b 1
)
echo Python encontrado.
echo.

:: Verificar se o script principal existe
echo Verificando script principal...
if not exist "%APP_SCRIPT%" (
    echo ERRO: O script %APP_SCRIPT% nao foi encontrado!
    pause
    exit /b 1
)
echo Script principal encontrado.
echo.

:: Definir modo de instalacao do servico (preferir executavel se existir)
set "USE_EXE=0"
if exist "%APP_EXE%" (
    set "USE_EXE=1"
)

if "%USE_EXE%"=="0" (
    :: Instalar dependencias (somente modo Python)
    echo Instalando dependencias...
    cd "%APP_DIR%"
    %PYTHON_EXE% -m pip install -r requirements.txt
    if %errorLevel% neq 0 (
        echo AVISO: Houve um problema ao instalar as dependencias.
        echo Verifique se o arquivo requirements.txt existe e se todas as dependencias estao disponiveis.
        echo Continuando com a instalacao do servico...
    )
    echo.
) else (
    echo Modo selecionado: Executavel
    echo.
)

:: Baixar e extrair NSSM se necessario
if not exist "%NSSM_EXE%" (
    echo Baixando NSSM...
    powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%NSSM_URL%', '%NSSM_ZIP%')"
    
    echo Extraindo NSSM...
    if not exist "%NSSM_DIR%" mkdir "%NSSM_DIR%"
    powershell -Command "Expand-Archive -Path '%NSSM_ZIP%' -DestinationPath '%NSSM_DIR%' -Force"
)

:: Verificar se o NSSM foi baixado corretamente
if not exist "%NSSM_EXE%" (
    echo ERRO: Nao foi possivel baixar ou extrair o NSSM.
    pause
    exit /b 1
)

:: Remover o servico se ja existir
echo Verificando se o servico ja existe...
sc query "%SERVICO_NOME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Removendo servico existente...
    "%NSSM_EXE%" stop "%SERVICO_NOME%"
    "%NSSM_EXE%" remove "%SERVICO_NOME%" confirm
)

:: Instalar o servico
echo Instalando servico...
if "%USE_EXE%"=="1" (
    "%NSSM_EXE%" install "%SERVICO_NOME%" "%APP_EXE%"
    "%NSSM_EXE%" set "%SERVICO_NOME%" AppDirectory "%APP_DIR%"
) else (
    "%NSSM_EXE%" install "%SERVICO_NOME%" "%PYTHON_EXE%"
    "%NSSM_EXE%" set "%SERVICO_NOME%" AppParameters "%APP_SCRIPT%"
    "%NSSM_EXE%" set "%SERVICO_NOME%" AppDirectory "%APP_DIR%"
)
"%NSSM_EXE%" set "%SERVICO_NOME%" DisplayName "API Unidasul"
"%NSSM_EXE%" set "%SERVICO_NOME%" Description "Servico da API Unidasul para consulta de precos"
"%NSSM_EXE%" set "%SERVICO_NOME%" Start SERVICE_AUTO_START
"%NSSM_EXE%" set "%SERVICO_NOME%" AppStdout "%APP_DIR%\servico_output.log"
"%NSSM_EXE%" set "%SERVICO_NOME%" AppStderr "%APP_DIR%\servico_error.log"
"%NSSM_EXE%" set "%SERVICO_NOME%" AppRotateFiles 1
"%NSSM_EXE%" set "%SERVICO_NOME%" AppRotateOnline 1
"%NSSM_EXE%" set "%SERVICO_NOME%" AppRotateSeconds 86400
"%NSSM_EXE%" set "%SERVICO_NOME%" AppRotateBytes 10485760
"%NSSM_EXE%" set "%SERVICO_NOME%" AppEnvironmentExtra "RUNNING_AS_SERVICE=1"

:: Iniciar o servico
echo Iniciando o servico...
"%NSSM_EXE%" start "%SERVICO_NOME%"

:: Verificar se o servico foi iniciado corretamente
timeout /t 5 /nobreak >nul
sc query "%SERVICO_NOME%" | findstr "RUNNING" >nul
if %errorLevel% equ 0 (
    echo.
    echo ===================================================
    echo Servico instalado e iniciado com sucesso!
    echo Nome do servico: %SERVICO_NOME%
    echo.
    echo O servico sera iniciado automaticamente quando o Windows iniciar.
    echo Para gerenciar o servico, use o Gerenciador de Servicos do Windows.
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo AVISO: O servico foi instalado, mas pode nao ter iniciado corretamente.
    echo Verifique os logs em: %APP_DIR%\servico_output.log e %APP_DIR%\servico_error.log
    echo ===================================================
)

pause
