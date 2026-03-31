# Manual de Uso - Sistema API Unidasul

Este manual fornece instruções detalhadas sobre como utilizar o sistema API Unidasul, incluindo suas funcionalidades, interfaces e APIs disponíveis.

## Índice

1. [Introdução](#introdução)
2. [Requisitos do Sistema](#requisitos-do-sistema)
3. [Instalação e Configuração](#instalação-e-configuração)
4. [Interface Web](#interface-web)
5. [Autenticação](#autenticação)
6. [Consulta de Produtos](#consulta-de-produtos)
7. [Gerenciamento de Imagens](#gerenciamento-de-imagens)
8. [Relatórios e Dashboard](#relatórios-e-dashboard)
9. [Integração com Outros Sistemas](#integração-com-outros-sistemas)
10. [Solução de Problemas](#solução-de-problemas)

## Introdução

O Sistema API Unidasul é uma aplicação desenvolvida para consulta de preços e informações de produtos, gerenciamento de imagens, geração de relatórios e integração com outros sistemas. Este manual fornece instruções detalhadas sobre como utilizar todas as funcionalidades disponíveis.

## Requisitos do Sistema

### Requisitos de Hardware
- Processador: 1 GHz ou superior
- Memória RAM: 2 GB ou superior
- Espaço em disco: 500 MB para instalação

### Requisitos de Software
- Sistema Operacional: Windows 7 ou superior
- Python 3.6 ou superior (caso não esteja usando o executável)
- Navegador web moderno (Chrome, Firefox, Edge)
- Conexão com a internet para consultas online

## Instalação e Configuração

### Instalação a partir do Executável

1. Baixe o arquivo executável do sistema
2. Execute o instalador e siga as instruções na tela
3. Após a instalação, o sistema estará disponível como um ícone na bandeja do sistema

### Instalação a partir do Código-fonte

1. Clone ou baixe o repositório do sistema
2. Instale as dependências necessárias:
   ```
   pip install -r requirements.txt
   ```
3. Execute o sistema:
   ```
   python main.py
   ```

### Configuração Inicial

O sistema utiliza um banco de dados SQLite que será criado automaticamente na primeira execução. Não é necessária configuração adicional para o banco de dados.

## Interface Web

O sistema disponibiliza uma interface web acessível através do navegador. Por padrão, o sistema é executado na porta 5000.

### Acessando a Interface Web

1. Abra seu navegador web
2. Acesse o endereço: `http://localhost:5000` ou `http://<IP_LOCAL>:5000`
3. Você será redirecionado para a página inicial do sistema

### Páginas Principais

#### Página Inicial

A página inicial fornece acesso rápido às principais funcionalidades do sistema:

- Consulta de produtos
- Dashboard
- Gerenciamento de imagens
- Administração

#### Página de Consulta

A página de consulta permite buscar informações de produtos por código EAN e filial:

1. Acesse `http://localhost:5000/consulta`
2. Insira o código EAN do produto
3. Selecione a filial desejada
4. Clique em "Consultar"
5. Os resultados serão exibidos, incluindo preço, descrição e imagem (se disponível)

#### Página de Dashboard

O dashboard apresenta estatísticas e informações sobre as consultas realizadas:

1. Acesse `http://localhost:5000/dashboard`
2. Visualize gráficos e estatísticas sobre:
   - Consultas realizadas (hoje, semana, mês)
   - Produtos mais consultados
   - Produtos sem imagem
   - Últimas consultas realizadas

#### Página de Administração

A página de administração permite gerenciar usuários, configurações e logs do sistema:

1. Acesse `http://localhost:5000/admin`
2. Faça login com credenciais de administrador
3. Acesse as diferentes seções de administração

## Autenticação

O sistema utiliza autenticação baseada em tokens JWT (JSON Web Token) para proteger recursos sensíveis.

### Obtendo um Token

#### Via Interface Web

1. Acesse a página de login
2. Insira suas credenciais (usuário e senha)
3. Após o login bem-sucedido, o token será armazenado no navegador

#### Via API

1. Faça uma requisição GET para `/generate-token` com os parâmetros `username` e `password`
2. Ou faça uma requisição POST para `/api/login` com um JSON contendo `username` e `password`
3. O token retornado deve ser incluído no cabeçalho `Authorization` das requisições subsequentes

### Utilizando o Token

Para acessar recursos protegidos, inclua o token no cabeçalho `Authorization` das requisições:

```
Authorization: Bearer <seu_token_jwt>
```

## Consulta de Produtos

### Consulta via Interface Web

1. Acesse a página de consulta (`/consulta`)
2. Insira o código EAN do produto
3. Selecione a filial
4. Clique em "Consultar"

### Consulta via API

Para consultar produtos via API, utilize os endpoints:

- `/api/consulta/<ean>/<num_filial>` - Retorna informações do produto em formato JSON
- `/get_price?ean=<ean>&num_filial=<num_filial>` - Retorna informações do produto em formato JSON
- `/get_price_html/<ean>/<num_filial>` - Retorna informações do produto em formato HTML

Exemplo de uso:

```
GET http://localhost:5000/api/consulta/7891234567890/1
```

## Gerenciamento de Imagens

### Visualização de Imagens

1. Acesse a página de imagens de produtos (`/imagens_produtos`)
2. Utilize a barra de pesquisa para encontrar imagens específicas
3. Navegue pelas páginas para visualizar todas as imagens disponíveis

### Upload de Imagens

1. Acesse a página de gerenciamento de imagens (`/gerenciar_imagens`)
2. Insira o código EAN do produto
3. Selecione o arquivo de imagem (PNG, JPG ou JPEG)
4. Clique em "Enviar"

### Exclusão de Imagens

1. Acesse a página de gerenciamento de imagens (`/gerenciar_imagens`)
2. Insira o código EAN do produto
3. Clique em "Excluir"

### Gerenciamento via API

Para gerenciar imagens via API, utilize os endpoints:

- `/gerenciar_imagens/view/<ean>` - Visualiza a imagem de um produto
- `/gerenciar_imagens/upload` - Envia uma nova imagem (POST)
- `/gerenciar_imagens/delete` - Exclui a imagem de um produto (POST)

## Relatórios e Dashboard

### Visualização do Dashboard

1. Acesse a página de dashboard (`/dashboard`)
2. Visualize estatísticas e gráficos sobre consultas e produtos

### Geração de Relatórios

1. Acesse a seção de relatórios no dashboard
2. Selecione os filtros desejados:
   - Formato (CSV ou JSON)
   - Tipo de consulta
   - Período
   - Filial
3. Clique em "Exportar Relatório"
4. O arquivo será gerado e disponibilizado para download

### Relatórios via API

Para gerar relatórios via API, utilize o endpoint:

```
POST /api/exportar-relatorio
```

Com o corpo da requisição:

```json
{
  "formato": "csv",
  "tipo": "todos",
  "periodo": "mes",
  "filial": "todas"
}
```

## Integração com Outros Sistemas

### Webhooks

O sistema disponibiliza webhooks para integração com outros sistemas:

- `/webhook/atualizacao` - Recebe notificações de atualização (POST)
- `/atualizacoes` - Retorna as atualizações recebidas (GET)

### API REST

Todas as funcionalidades do sistema estão disponíveis através de uma API REST, conforme detalhado na [documentação da API](./API_DOCUMENTATION.md).

## Solução de Problemas

### Problemas Comuns

#### O sistema não inicia

- Verifique se a porta 5000 está disponível
- Verifique se todas as dependências estão instaladas
- Verifique os logs do sistema

#### Erro ao consultar produtos

- Verifique sua conexão com a internet
- Verifique se o código EAN e a filial estão corretos
- Verifique se o serviço de consulta está disponível

#### Imagens não são exibidas

- Verifique se a pasta `imgs_produtos` existe e tem permissões de leitura/escrita
- Verifique se a imagem foi enviada corretamente
- Verifique se o código EAN está correto

### Logs do Sistema

Os logs do sistema podem ser acessados através da API:

```
GET /api/logs
```

Ou através do arquivo de log gerado na pasta do sistema.

### Reiniciando o Sistema

Para reiniciar o sistema:

1. Clique com o botão direito no ícone da bandeja do sistema
2. Selecione "Reiniciar"

Ou encerre o processo atual e inicie novamente o executável ou script.

---

Para mais informações técnicas sobre as APIs disponíveis, consulte a [documentação da API](./API_DOCUMENTATION.md).