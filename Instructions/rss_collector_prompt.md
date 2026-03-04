# Prompt para Desenvolvimento do Coletor Automático de RSS

Quero desenvolver um **coletor automático de notícias via RSS** para a plataforma.

O sistema deve ler feeds RSS cadastrados, extrair notícias e salvar no banco de dados.

---

# Objetivo

Criar um serviço que:

1. Busque feeds RSS cadastrados
2. Leia o XML
3. Extraia as notícias
4. Evite duplicidade
5. Salve no banco

Esse sistema alimentará as TVs e players do Digital Signage.

---

# Passo 1 – Buscar feeds ativos

Consultar tabela:

news_feeds

Filtrar:

ativo = true

---

# Passo 2 – Ler RSS

Para cada feed:

Fazer request HTTP no RSS.

Parsear o XML.

Extrair:

title
description
link
pubDate
image (se existir)

---

# Passo 3 – Normalização

Converter datas para:

UTC

Remover HTML da descrição.

Limitar descrição para:

300 caracteres.

---

# Passo 4 – Evitar duplicidade

Criar slug baseado em:

titulo

Ou gerar hash do título.

Antes de salvar verificar:

se slug já existe.

---

# Passo 5 – Salvar no banco

Inserir em:

news_articles

Campos:

titulo
descricao
link
imagem
categoria
fonte
slug
data_publicacao
data_importacao

---

# Passo 6 – Limite de armazenamento

Após inserir novas notícias:

remover notícias com mais de:

7 dias

ou manter apenas:

500 por categoria.

---

# Passo 7 – Frequência de execução

Executar via cron job.

Intervalo recomendado:

30 minutos.

---

# Passo 8 – Logs

Registrar logs para:

erro de RSS
erro de conexão
RSS inválido
feed offline

---

# Passo 9 – Performance

Implementar:

timeout de request
limite de tamanho do XML
cache de requisição

---

# Passo 10 – Estrutura final

Fluxo:

RSS feeds
↓
coletor
↓
banco de dados
↓
API
↓
player
↓
TV

---

# Resultado esperado

Sistema totalmente automático que:

coleta notícias
salva no banco
fornece conteúdo atualizado
exibe nas TVs
