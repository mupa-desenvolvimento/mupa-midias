# Manual do Usuário (Servidor) — APIUnidasulV15 como Serviço do Windows

Este manual explica como colocar a APIUnidasulV15 para rodar como um Serviço do Windows, iniciando automaticamente com o servidor e continuando em execução mesmo após logoff do RDP (serviço roda como LocalSystem na Sessão 0).

## O que você precisa ter em mãos

- `setup_APIUnidasulV15_servico.ps1` (script de instalação/atualização do serviço)
- `APIUnidasulV15.exe` (executável da API)

## Onde instalar no servidor

Recomendação:

- `C:\Services\APIUnidasulV15\` (pasta do serviço e arquivos do NSSM)
- `C:\ProgramData\APIUnidasulV15\` (logs e banco `mupa.db` quando rodando como serviço)

## Instalação / Atualização do serviço (passo único)

1. Copie para o servidor, na mesma pasta:
   - `setup_APIUnidasulV15_servico.ps1`
   - `APIUnidasulV15.exe`

2. Clique com o botão direito no `setup_APIUnidasulV15_servico.ps1` e execute com PowerShell como administrador (ou abra PowerShell como administrador e rode):

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup_APIUnidasulV15_servico.ps1
```

O script:

- instala/atualiza o serviço `APIUnidasulV15`
- configura para iniciar automaticamente com o Windows
- configura para rodar como `LocalSystem`
- define `RUNNING_AS_SERVICE=1`
- configura reinício automático após falha (10s)
- cria regra de firewall de entrada para TCP 5000
- inicia o serviço

## Como acessar a API

- Local: `http://localhost:5000`
- Pela rede: `http://<IP_DO_SERVIDOR>:5000`

## Como confirmar que está rodando como serviço (e não cai no logoff)

No PowerShell (como Administrador):

```powershell
sc query APIUnidasulV15
sc qc APIUnidasulV15
```

O `SERVICE_START_NAME` deve ser `LocalSystem`.

## Comandos úteis

PowerShell (como Administrador):

```powershell
sc start APIUnidasulV15
sc stop APIUnidasulV15
sc query APIUnidasulV15
```

Abrir serviços do Windows:

- `Win + R` → `services.msc`

## Logs e banco (onde olhar quando não tem janela)

- Log principal da aplicação:
  - `C:\ProgramData\APIUnidasulV15\logs\apiunidasul.log`
- Logs do wrapper do serviço (stdout/stderr):
  - `C:\Services\APIUnidasulV15\service_stdout.log`
  - `C:\Services\APIUnidasulV15\service_stderr.log`
- Banco:
  - `C:\ProgramData\APIUnidasulV15\mupa.db`

## Solução de problemas

### O serviço inicia e para na sequência

1. Veja `C:\Services\APIUnidasulV15\service_stderr.log`
2. Veja `C:\ProgramData\APIUnidasulV15\logs\apiunidasul.log`
3. Confirme se a porta 5000 está livre:

```powershell
netstat -ano | findstr :5000
```

### Porta 5000 bloqueada na rede

O script cria uma regra de firewall local. Se ainda não acessar de outra máquina:

- Confirme a regra no Firewall do Windows (Inbound Rules)
- Confirme se não existe firewall de rede/borda bloqueando

### Atualizar o executável sem parar o servidor por muito tempo

1. Substitua o arquivo `APIUnidasulV15.exe` que o script usa
2. Rode novamente `setup_APIUnidasulV15_servico.ps1` como Administrador

### Desinstalar/remover serviço

PowerShell (como Administrador):

```powershell
sc stop APIUnidasulV15
sc delete APIUnidasulV15
```
