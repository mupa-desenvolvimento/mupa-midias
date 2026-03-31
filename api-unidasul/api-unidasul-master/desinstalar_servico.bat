@echo off
echo ===================================================
echo Desinstalador do Servico API Unidasul
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
set "NSSM_URL=https://nssm.cc/release/nssm-2.24.zip"
set "NSSM_ZIP=%TEMP%\nssm.zip"
set "NSSM_DIR=%TEMP%\nssm"
set "NSSM_EXE=%NSSM_DIR%\nssm-2.24\win64\nssm.exe"

:: Verificar se o serviço existe
echo Verificando se o servico existe...
sc query "%SERVICO_NOME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo O servico %SERVICO_NOME% nao esta instalado.
    pause
    exit /b 0
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
    echo Tentando remover o servico usando comandos nativos do Windows...
    
    sc stop "%SERVICO_NOME%"
    sc delete "%SERVICO_NOME%"
    
    echo Servico removido.
    pause
    exit /b 0
)

:: Parar e remover o servico
echo Parando o servico...
"%NSSM_EXE%" stop "%SERVICO_NOME%"

echo Removendo o servico...
"%NSSM_EXE%" remove "%SERVICO_NOME%" confirm

:: Verificar se o servico foi removido
sc query "%SERVICO_NOME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ===================================================
    echo Servico removido com sucesso!
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo AVISO: Houve um problema ao remover o servico.
    echo Tente remover manualmente usando o Gerenciador de Servicos do Windows.
    echo ===================================================
)

pause