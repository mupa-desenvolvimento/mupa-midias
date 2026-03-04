# AI News Summarizer – Sistema de Resumo Automático de Notícias

Objetivo:
Criar um sistema que utilize Inteligência Artificial para gerar **resumos curtos de notícias**, ideais para exibição em TVs e telas de Digital Signage.

Como as notícias exibidas em TVs precisam ser rápidas de ler, o sistema deve transformar textos longos em **resumos de no máximo 2 linhas**.

---

# Problema

Notícias coletadas via RSS geralmente possuem:

- textos longos
- linguagem jornalística extensa
- informações redundantes

Para Digital Signage precisamos:

- leitura rápida
- frases curtas
- impacto visual

---

# Objetivo do Resumo

Converter:

Descrição original:
"Segundo o IBGE, o índice de inflação apresentou desaceleração no mês de fevereiro, registrando uma queda de 0,2% em comparação ao mês anterior..."

Resumo para TV:

"Inflação desacelera em fevereiro e registra queda de 0,2% segundo IBGE."

---

# Regras do Resumo

O resumo deve:

- ter entre **80 e 140 caracteres**
- ser **claro e objetivo**
- evitar termos técnicos longos
- manter a informação principal

---

# Campos no Banco de Dados

Adicionar campo na tabela:

news_articles

Campos novos:

summary
summary_ai
summary_created_at

---

# Fluxo do Sistema

1. notícia coletada via RSS
2. verificar se possui resumo
3. enviar texto para IA
4. gerar resumo curto
5. salvar no banco

Fluxo:

RSS → Banco → IA → Resumo → Player → TV

---

# Prompt para IA

Gerar resumo com base no texto da notícia.

Prompt sugerido:

Resuma a notícia abaixo para exibição em uma TV de digital signage.

Regras:

- máximo 140 caracteres
- linguagem simples
- frase única
- manter informação principal

Texto da notícia:
{{descricao}}

---

# Regras de fallback

Caso IA falhe:

usar os **primeiros 120 caracteres da descrição**.

---

# Otimização

Gerar resumo **apenas uma vez** e salvar no banco.

Evitar gerar resumo repetidamente.

---

# Benefícios

- leitura rápida
- conteúdo mais claro
- melhor experiência nas TVs
- redução de poluição visual
