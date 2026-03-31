# Executável de Inicialização do Serviço API Unidasul

Este documento explica como criar e usar o executável para iniciar o serviço API Unidasul no Windows Server.

## Criação do Executável

Para criar o executável `API_Unidasul_Service.exe`, siga os passos abaixo:

1. Certifique-se de que o Python esteja instalado no sistema
2. Execute o script `criar_executavel_servico.py`:
   ```
   python criar_executavel_servico.py
   ```
3. Aguarde a conclusão do processo. O executável será criado no diretório principal.

## Requisitos para Criação

- Python 3.6 ou superior
- PyInstaller (será instalado automaticamente pelo script se não estiver presente)
- Acesso de administrador ao sistema

## Funcionalidades do Executável

O executável `API_Unidasul_Service.exe` possui as seguintes funcionalidades:

1. **Verificação de Privilégios**: Solicita automaticamente privilégios de administrador se necessário
2. **Verificação do Serviço**: Verifica se o serviço API Unidasul está instalado
3. **Inicialização do Serviço**: Se o serviço estiver instalado mas não em execução, inicia-o
4. **Instalação Automática**: Se o serviço não estiver instalado, executa o script de instalação

## Como Usar

1. **Execução Manual**:
   - Clique duas vezes no arquivo `API_Unidasul_Service.exe`
   - Conceda permissões de administrador quando solicitado
   - O executável verificará e iniciará o serviço automaticamente

2. **Inicialização com o Windows**:
   - Crie um atalho para `API_Unidasul_Service.exe`
   - Pressione `Win + R`, digite `shell:startup` e pressione Enter
   - Mova o atalho para a pasta de inicialização que foi aberta
   - O executável será iniciado automaticamente quando o Windows iniciar

3. **Execução via Agendador de Tarefas**:
   - Abra o Agendador de Tarefas do Windows
   - Crie uma nova tarefa com as seguintes configurações:
     - Trigger: Na inicialização
     - Ação: Iniciar programa
     - Programa/script: Caminho completo para `API_Unidasul_Service.exe`
     - Executar com privilégios mais altos: Sim

## Solução de Problemas

### O executável não inicia o serviço

1. Verifique se o executável está sendo executado como administrador
2. Verifique os logs em `api-unidasul-master_version_15\servico_error.log`
3. Tente executar o script `instalar_servico.bat` manualmente

### Erro ao criar o executável

1. Certifique-se de que o Python está instalado corretamente
2. Instale o PyInstaller manualmente: `pip install pyinstaller`
3. Verifique se o arquivo `icon_sistema.ico` existe no diretório `api-unidasul-master_version_15`

## Notas Adicionais

- O executável foi configurado para não mostrar a janela de console
- O ícone do executável é o mesmo usado pela aplicação principal
- As informações de versão do executável estão configuradas como versão 1.0.0

## Instalação no Windows Server (como Serviço)

Siga este passo a passo para instalar e iniciar automaticamente com o Windows:

1. Copie para o servidor a pasta completa do projeto:
   - `api-unidasul-master_version_15` (inclui `main.py`, `requirements.txt`, `icon_sistema.ico` etc.)
   - `API_Unidasul_Service.exe`
   - `instalar_servico.bat` e `desinstalar_servico.bat`

2. Execute o instalador do serviço:
   - Clique com o botão direito em `instalar_servico.bat` e escolha “Executar como administrador”.
   - O script usa o NSSM para registrar o serviço “APIUnidasul”.
   - Se o executável da aplicação existir em `api-unidasul-master_version_15\output\API Unidasul V15\API Unidasul V15.exe`, ele é usado; caso contrário, o serviço roda o `python main.py`.
   - O serviço é configurado como “Automático” e iniciará com o Windows.

3. Alternativa: use o inicializador
   - Dê dois cliques em `API_Unidasul_Service.exe` (executa com privilégios elevados).
   - Se o serviço não existir, ele chamará o `instalar_servico.bat`.
   - Se já existir, ele inicia o serviço.

4. Verifique o serviço
   - Abra `services.msc` e confirme que “APIUnidasul” está em execução e com tipo de inicialização “Automático”.
   - A API padrão responde em `http://localhost:5000/`.

5. (Opcional) Libere a porta 5000 no Firewall
   - Abra PowerShell como Administrador e execute:
     ```
     netsh advfirewall firewall add rule name="APIUnidasul 5000" dir=in action=allow protocol=TCP localport=5000
     ```

6. Logs do serviço
   - Saída: `api-unidasul-master_version_15\servico_output.log`
   - Erros: `api-unidasul-master_version_15\servico_error.log`

7. Desinstalação
   - Execute `desinstalar_servico.bat` como Administrador.
