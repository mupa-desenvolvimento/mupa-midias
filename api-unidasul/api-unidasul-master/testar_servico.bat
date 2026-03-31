@echo off
echo ===================================================
echo Teste do Servico API Unidasul
echo ===================================================
echo.

:: Definir variaveis
set "SERVICO_NOME=APIUnidasul"
set "API_URL=http://localhost:5000"

:: Verificar se o servico existe
echo Verificando se o servico existe...
sc query "%SERVICO_NOME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: O servico %SERVICO_NOME% nao esta instalado!
    echo Execute primeiro o script instalar_servico.bat como administrador.
    pause
    exit /b 1
)

:: Verificar se o servico esta em execucao
echo Verificando status do servico...
sc query "%SERVICO_NOME%" | findstr "RUNNING" >nul
if %errorLevel% neq 0 (
    echo O servico %SERVICO_NOME% nao esta em execucao.
    
    echo Tentando iniciar o servico...
    sc start "%SERVICO_NOME%" >nul
    
    echo Aguardando inicializacao do servico (10 segundos)...
    timeout /t 10 /nobreak >nul
    
    sc query "%SERVICO_NOME%" | findstr "RUNNING" >nul
    if %errorLevel% neq 0 (
        echo ERRO: Nao foi possivel iniciar o servico %SERVICO_NOME%!
        echo Verifique os logs em api-unidasul-master_version_15\servico_error.log
        pause
        exit /b 1
    )
)

echo Servico %SERVICO_NOME% esta em execucao.
echo.

:: Testar conexao com a API
echo Testando conexao com a API em %API_URL%...
powershell -Command "try { $response = Invoke-WebRequest -Uri '%API_URL%' -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host 'Conexao bem-sucedida! A API esta respondendo.' -ForegroundColor Green } else { Write-Host 'A API respondeu com status code:' $response.StatusCode -ForegroundColor Yellow } } catch { Write-Host 'ERRO: Nao foi possivel conectar a API!' -ForegroundColor Red; Write-Host $_.Exception.Message }"

echo.
echo ===================================================
echo Informacoes do servico:
echo.
sc qc "%SERVICO_NOME%"
echo.
echo ===================================================
echo.
echo Para verificar os logs do servico, consulte:
echo - api-unidasul-master_version_15\servico_output.log
echo - api-unidasul-master_version_15\servico_error.log
echo.
echo Para acessar a API no navegador, abra: %API_URL%
echo.

pause