# Documentação da API Unidasul

Este documento contém a documentação completa das APIs disponíveis no sistema Unidasul, incluindo rotas, parâmetros, respostas e exemplos de uso.

## Índice

1. [Autenticação](#autenticação)
2. [Consulta de Produtos](#consulta-de-produtos)
3. [Imagens de Produtos](#imagens-de-produtos)
4. [Gerenciamento de Imagens](#gerenciamento-de-imagens)
5. [Dashboard e Relatórios](#dashboard-e-relatórios)
6. [Upload de Arquivos](#upload-de-arquivos)
7. [Registro de Entradas/Saídas](#registro-de-entradasaídas)
8. [Webhooks e Atualizações](#webhooks-e-atualizações)
9. [Interface Web](#interface-web)

## Autenticação

### Gerar Token

```
GET /generate-token
```

Gera um token JWT para autenticação.

**Parâmetros de Query:**
- `username`: Nome de usuário
- `password`: Senha do usuário

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Códigos de Status:**
- `200 OK`: Token gerado com sucesso
- `401 Unauthorized`: Credenciais inválidas

### Login API

```
POST /api/login
```

Autentica um usuário e retorna um token JWT.

**Corpo da Requisição:**
```json
{
  "username": "usuario",
  "password": "senha"
}
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Códigos de Status:**
- `200 OK`: Login bem-sucedido
- `401 Unauthorized`: Credenciais inválidas

## Consulta de Produtos

### Consultar Produto por EAN e Filial

```
GET /api/consulta/<ean>/<num_filial>
```

Consulta informações de um produto pelo código EAN e número da filial.

**Parâmetros de URL:**
- `ean`: Código EAN do produto
- `num_filial`: Número da filial

**Resposta:**
```json
{
  "ean": "7891234567890",
  "descricao": "Nome do Produto",
  "preco": 10.99,
  "preco_clube": 9.99,
  "imagem_url": "http://localhost:5000/imgs_produtos/7891234567890.png",
  "filial": "1",
  "tipo": "consulta"
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso
- `400 Bad Request`: Parâmetros inválidos
- `404 Not Found`: Produto não encontrado
- `500 Internal Server Error`: Erro ao processar a consulta

### Obter Preço

```
GET /get_price
```

Consulta o preço de um produto pelo código EAN e número da filial.

**Parâmetros de Query:**
- `ean`: Código EAN do produto
- `num_filial`: Número da filial

**Resposta:**
```json
{
  "ean": "7891234567890",
  "descricao": "Nome do Produto",
  "preco": 10.99,
  "preco_clube": 9.99,
  "imagem_url": "http://localhost:5000/imgs_produtos/7891234567890.png",
  "filial": "1",
  "tipo": "consulta",
  "device_info": {
    "ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso
- `400 Bad Request`: Parâmetros inválidos
- `404 Not Found`: Produto não encontrado
- `500 Internal Server Error`: Erro ao processar a consulta

### Obter Preço em HTML

```
GET /get_price_html/<ean>/<num_filial>
```

Consulta o preço de um produto e retorna em formato HTML.

**Parâmetros de URL:**
- `ean`: Código EAN do produto
- `num_filial`: Número da filial

**Resposta:**
Página HTML com as informações do produto.

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso
- `400 Bad Request`: Parâmetros inválidos
- `404 Not Found`: Produto não encontrado
- `500 Internal Server Error`: Erro ao processar a consulta

## Imagens de Produtos

### Obter Imagem do Produto

```
GET /imgs_produtos/<ean>
```

Retorna a imagem do produto pelo código EAN.

**Parâmetros de URL:**
- `ean`: Código EAN do produto

**Resposta:**
Arquivo de imagem (PNG)

**Códigos de Status:**
- `200 OK`: Imagem encontrada
- `404 Not Found`: Imagem não encontrada (retorna imagem padrão)

### Obter Imagem do Produto com Extensão

```
GET /imgs_produtos/<ean>.<ext>
```

Retorna a imagem do produto pelo código EAN com extensão específica.

**Parâmetros de URL:**
- `ean`: Código EAN do produto
- `ext`: Extensão do arquivo (png, jpg, etc.)

**Resposta:**
Arquivo de imagem (PNG, JPG, etc.)

**Códigos de Status:**
- `200 OK`: Imagem encontrada
- `404 Not Found`: Imagem não encontrada (retorna imagem padrão)

### Verificar Status da Imagem

```
GET /imagem-status/<ean>
```

Verifica se existe uma imagem para o produto especificado.

**Parâmetros de URL:**
- `ean`: Código EAN do produto

**Resposta:**
```json
{
  "exists": true,
  "path": "/imgs_produtos/7891234567890.png"
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

### Listar Produtos sem Imagem

```
GET /produtos-sem-imagem
```

Retorna uma lista de produtos que não possuem imagem.

**Resposta:**
```json
{
  "produtos": [
    {
      "ean": "7891234567890",
      "descricao": "Nome do Produto"
    }
  ]
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

## Gerenciamento de Imagens

### Página de Gerenciamento de Imagens

```
GET /gerenciar_imagens
```

Retorna a página HTML para gerenciamento de imagens de produtos.

**Resposta:**
Página HTML para gerenciamento de imagens.

### Visualizar Imagem do Produto

```
GET /gerenciar_imagens/view/<ean>
```

Retorna a imagem do produto para visualização.

**Parâmetros de URL:**
- `ean`: Código EAN do produto

**Resposta:**
Arquivo de imagem (PNG, JPG, etc.)

**Códigos de Status:**
- `200 OK`: Imagem encontrada
- `404 Not Found`: Imagem não encontrada (retorna imagem padrão)

### Enviar Imagem do Produto

```
POST /gerenciar_imagens/upload
```

Envia uma nova imagem para um produto.

**Parâmetros do Formulário:**
- `ean`: Código EAN do produto
- `file`: Arquivo de imagem (PNG)

**Resposta:**
```json
{
  "message": "Imagem enviada com sucesso!",
  "filename": "7891234567890.png"
}
```

**Códigos de Status:**
- `200 OK`: Upload realizado com sucesso
- `400 Bad Request`: Parâmetros inválidos ou tipo de arquivo não permitido

### Excluir Imagem do Produto

```
POST /gerenciar_imagens/delete
```

Exclui a imagem de um produto.

**Corpo da Requisição:**
```json
{
  "ean": "7891234567890"
}
```

**Resposta:**
```json
{
  "message": "Imagem deletada com sucesso."
}
```

**Códigos de Status:**
- `200 OK`: Imagem excluída com sucesso
- `404 Not Found`: Imagem não encontrada

### Listar Imagens de Produtos

```
GET /imagens_produtos
```

Retorna uma página HTML com a lista de imagens de produtos.

**Parâmetros de Query:**
- `page`: Número da página (padrão: 1)
- `q`: Termo de busca (opcional)

**Resposta:**
Página HTML com a lista de imagens de produtos.

## Dashboard e Relatórios

### Obter Dados do Dashboard

```
GET /api/dashboard-data
```

Retorna dados para o dashboard.

**Resposta:**
```json
{
  "consultas_hoje": 10,
  "consultas_semana": 50,
  "consultas_mes": 200,
  "produtos_sem_imagem": 5,
  "ultimas_consultas": [
    {
      "data_hora": "2023-01-01T12:00:00",
      "ean": "7891234567890",
      "descricao": "Nome do Produto",
      "filial": "1",
      "tipo": "consulta",
      "preco": 10.99,
      "preco_clube": 9.99
    }
  ]
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

### Obter Últimas Consultas

```
GET /api/ultimas-consultas
```

Retorna as últimas consultas realizadas.

**Parâmetros de Query:**
- `limit`: Número máximo de consultas a retornar (padrão: 10)

**Resposta:**
```json
{
  "consultas": [
    {
      "data_hora": "2023-01-01T12:00:00",
      "ean": "7891234567890",
      "descricao": "Nome do Produto",
      "filial": "1",
      "tipo": "consulta",
      "preco": 10.99,
      "preco_clube": 9.99
    }
  ]
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

### Obter Logs

```
GET /api/logs
```

Retorna os logs do sistema.

**Parâmetros de Query:**
- `limit`: Número máximo de logs a retornar (padrão: 100)

**Resposta:**
```json
{
  "logs": [
    {
      "data_hora": "2023-01-01T12:00:00",
      "tipo": "info",
      "mensagem": "Consulta realizada: EAN 7891234567890",
      "ip": "192.168.1.100"
    }
  ]
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

### Exportar Relatório

```
POST /api/exportar-relatorio
```

Exporta um relatório de consultas em formato CSV ou JSON.

**Corpo da Requisição:**
```json
{
  "formato": "csv",
  "tipo": "todos",
  "periodo": "mes",
  "filial": "todas"
}
```

**Parâmetros:**
- `formato`: Formato do relatório ("csv" ou "json")
- `tipo`: Tipo de consulta ("todos", "consulta", "preco", etc.)
- `periodo`: Período do relatório ("hoje", "semana", "mes")
- `filial`: Filial específica ou "todas"

**Resposta:**
Arquivo CSV ou JSON para download.

**Códigos de Status:**
- `200 OK`: Relatório gerado com sucesso
- `400 Bad Request`: Parâmetros inválidos
- `500 Internal Server Error`: Erro ao gerar relatório

## Upload de Arquivos

### Página de Upload

```
GET /upload
```

Retorna a página HTML para upload de arquivos.

**Resposta:**
Página HTML para upload de arquivos.

### Enviar Arquivo

```
POST /upload
```

Envia um arquivo para o servidor.

**Autenticação:**
Requer token JWT válido.

**Parâmetros do Formulário:**
- `file`: Arquivo a ser enviado

**Resposta:**
```json
{
  "message": "File uploaded successfully",
  "filename": "arquivo.png"
}
```

**Códigos de Status:**
- `201 Created`: Upload realizado com sucesso
- `400 Bad Request`: Arquivo inválido ou não fornecido
- `401 Unauthorized`: Token JWT inválido ou não fornecido

## Registro de Entradas/Saídas

### Registrar Entrada/Saída

```
POST /registro
```

Registra a entrada ou saída de um usuário.

**Autenticação:**
Requer token JWT válido.

**Corpo da Requisição:**
```json
{
  "usuario": "nome_usuario",
  "tipo": "entrada",
  "timestamp": "2023-01-01T12:00:00"
}
```

**Parâmetros:**
- `usuario`: Nome do usuário
- `tipo`: Tipo de registro ("entrada" ou "saida")
- `timestamp`: Data e hora do registro (opcional, padrão: data/hora atual)

**Resposta:**
```json
{
  "message": "Entrada registrada com sucesso",
  "usuario": "nome_usuario",
  "timestamp": "2023-01-01T12:00:00"
}
```

**Códigos de Status:**
- `200 OK`: Registro realizado com sucesso
- `401 Unauthorized`: Token JWT inválido ou não fornecido

## Webhooks e Atualizações

### Webhook de Atualização

```
POST /webhook/atualizacao
```

Recebe notificações de atualização.

**Corpo da Requisição:**
```json
{
  "tipo": "atualizacao_produto",
  "dados": {
    "ean": "7891234567890",
    "descricao": "Nome do Produto Atualizado",
    "preco": 11.99
  }
}
```

**Resposta:**
```json
{
  "message": "Webhook recebido com sucesso"
}
```

**Códigos de Status:**
- `200 OK`: Webhook recebido com sucesso

### Obter Atualizações

```
GET /atualizacoes
```

Retorna as atualizações recebidas via webhook.

**Resposta:**
```json
{
  "updates": [
    {
      "tipo": "atualizacao_produto",
      "dados": {
        "ean": "7891234567890",
        "descricao": "Nome do Produto Atualizado",
        "preco": 11.99
      }
    }
  ]
}
```

**Códigos de Status:**
- `200 OK`: Consulta realizada com sucesso

## Interface Web

### Página Inicial

```
GET /
```

Retorna a página inicial do sistema.

**Resposta:**
Página HTML inicial.

### Página de Administração

```
GET /admin
```

Retorna a página de administração do sistema.

**Resposta:**
Página HTML de administração.

### Página de Consulta

```
GET /consulta
```

Retorna a página de consulta de produtos.

**Resposta:**
Página HTML de consulta de produtos.

### Página de Dashboard

```
GET /dashboard
```

Retorna a página de dashboard do sistema.

**Resposta:**
Página HTML de dashboard.