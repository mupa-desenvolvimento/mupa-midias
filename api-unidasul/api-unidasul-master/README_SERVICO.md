# Instalação da API Unidasul como Serviço do Windows

Este guia explica como instalar a API Unidasul como um serviço do Windows Server, permitindo que ela seja executada automaticamente na inicialização do sistema, sem necessidade de intervenção manual.

## Requisitos

- Windows Server 2012 R2 ou superior
- Python 3.9 ou superior instalado e configurado no PATH
- Privilégios de administrador

## Arquivos de Instalação

- `instalar_servico.bat`: Script para instalar a API como serviço do Windows
- `desinstalar_servico.bat`: Script para remover o serviço

## Processo de Instalação

1. **Preparação**:
   - Certifique-se de que o Python esteja instalado e configurado no PATH do sistema
   - Verifique se todos os arquivos da API estão na pasta `api-unidasul-master_version_15`

2. **Instalação do Serviço**:
   - Clique com o botão direito no arquivo `instalar_servico.bat`
   - Selecione "Executar como administrador"
   - Aguarde a conclusão do processo de instalação
   - O script irá:
     - Verificar os requisitos necessários
     - Instalar as dependências do Python listadas no arquivo requirements.txt
     - Baixar e configurar o NSSM (Non-Sucking Service Manager)
     - Registrar a API como um serviço do Windows
     - Configurar o serviço para iniciar automaticamente com o Windows
     - Iniciar o serviço

3. **Verificação**:
   - Após a instalação, o serviço "API Unidasul" deve estar em execução
   - Você pode verificar no Gerenciador de Serviços do Windows (services.msc)
   - A API estará disponível em http://localhost:5000

## Logs do Serviço

Os logs do serviço são armazenados nos seguintes arquivos:

- `api-unidasul-master_version_15\servico_output.log`: Saída padrão do serviço
- `api-unidasul-master_version_15\servico_error.log`: Erros do serviço

Estes arquivos são rotacionados automaticamente quando atingem 10MB ou após 24 horas de execução.

## Gerenciamento do Serviço

### Usando o Gerenciador de Serviços do Windows

1. Pressione `Win + R`, digite `services.msc` e pressione Enter
2. Localize o serviço "API Unidasul" na lista
3. Clique com o botão direito para iniciar, parar, reiniciar ou configurar o serviço

### Usando Comandos do PowerShell (como Administrador)

```powershell
# Iniciar o serviço
Start-Service -Name APIUnidasul

# Parar o serviço
Stop-Service -Name APIUnidasul

# Reiniciar o serviço
Restart-Service -Name APIUnidasul

# Verificar o status do serviço
Get-Service -Name APIUnidasul
```

### Usando Comandos do CMD (como Administrador)

```cmd
:: Iniciar o serviço
sc start APIUnidasul

:: Parar o serviço
sc stop APIUnidasul

:: Verificar o status do serviço
sc query APIUnidasul
```

## Desinstalação

Para remover o serviço:

1. Clique com o botão direito no arquivo `desinstalar_servico.bat`
2. Selecione "Executar como administrador"
3. Aguarde a conclusão do processo de desinstalação

## Solução de Problemas

### O serviço não inicia

1. Verifique os logs em `api-unidasul-master_version_15\servico_error.log`
2. Certifique-se de que o Python está instalado e configurado corretamente
3. Verifique se todas as dependências foram instaladas corretamente
4. Tente executar o script `main.py` manualmente para identificar possíveis erros

### Erro de permissão

1. Certifique-se de executar os scripts como administrador
2. Verifique se o usuário que executa o serviço tem permissões adequadas para acessar os arquivos da aplicação

### Conflito de porta

Se a porta 5000 já estiver em uso por outro serviço, você precisará modificar a configuração da API para usar uma porta diferente. Isso pode ser feito editando o arquivo `main.py` e alterando a linha que define a porta do servidor.