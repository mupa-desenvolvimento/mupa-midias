# Estrutura de Banco de Dados – Módulo de Notícias

Objetivo:
Armazenar feeds RSS e notícias coletadas automaticamente.

---

# Tabela: news_feeds

Armazena os feeds RSS cadastrados.

Campos:

id (uuid)
nome_fonte (string)
categoria (string)
rss_url (string)
prioridade (int)
ativo (boolean)
data_criacao (timestamp)

Exemplo:

id: 1
nome_fonte: G1 Economia
categoria: Economia
rss_url: https://g1.globo.com/rss/g1/economia/
prioridade: 1
ativo: true

---

# Tabela: news_articles

Armazena as notícias coletadas.

Campos:

id (uuid)
titulo (text)
descricao (text)
conteudo (text)
link (text)
imagem (text)
categoria (string)
fonte (string)
slug (string unique)
data_publicacao (timestamp)
data_importacao (timestamp)
ativo (boolean)

---

# Indexação recomendada

index:

categoria
data_publicacao
slug
fonte

---

# Tabela: news_settings

Configuração de exibição das notícias.

Campos:

id
categorias_ativas (json)
type_view (string)
tempo_exibicao (int)
quantidade_noticias (int)

---

# Tabela opcional: news_cache

Usado para cache rápido.

Campos:

id
json_data
data_cache

---

# Regras de armazenamento

Evitar duplicidade usando:

slug
ou hash do título.

---

# Limpeza automática

Excluir notícias com mais de:

7 dias

ou manter apenas:

500 por categoria.

---

# Estrutura ideal do JSON para players

{
  "titulo": "",
  "descricao": "",
  "imagem": "",
  "fonte": "",
  "categoria": "",
  "data": ""
}

---

# Fluxo do sistema

RSS → Coletor → Banco → API → Player → TV
