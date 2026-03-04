# News Priority Engine – Sistema de Prioridade de Notícias

Objetivo:
Criar um sistema que priorize automaticamente **notícias mais relevantes para o ambiente de varejo**.

Nem todas as notícias são interessantes para exibição em supermercados ou lojas.

O sistema deve destacar conteúdos relacionados a:

economia
consumo
varejo
tecnologia
promoções
tendências de mercado

---

# Problema

RSS traz muitos conteúdos irrelevantes.

Exemplos que devem ter baixa prioridade:

celebridades
fofocas
notícias muito locais
acidentes

---

# Solução

Criar um sistema de **pontuação de relevância**.

Cada notícia recebe uma pontuação.

---

# Critérios de Pontuação

Categoria:

Varejo +10
Economia +8
Negócios +7
Tecnologia +6
Consumo +6
Esportes +2
Entretenimento +1

---

# Palavras-chave

Se o título contiver:

supermercado +10
varejo +10
consumidor +6
inflação +6
economia +5
tecnologia +5
inovação +4

---

# Recência

Notícia publicada nas últimas:

2 horas +5
6 horas +3
24 horas +1

---

# Fonte

Fontes especializadas em varejo recebem bônus.

Exemplo:

SuperVarejo +8
Mercado & Consumo +8
Giro News +7

---

# Cálculo final

score = categoria + keywords + recencia + fonte

---

# Campo no Banco

Adicionar campo:

priority_score

Tabela:

news_articles

---

# Exemplo

Notícia:

"Inflação impacta preços de alimentos nos supermercados"

Pontuação:

categoria economia = 8
keyword supermercado = 10
keyword inflação = 6
recência = 3

score final = 27

---

# Uso no sistema

Ordenar notícias por:

priority_score DESC

---

# Benefícios

Exibir primeiro:

notícias relevantes para consumidores
notícias de economia
notícias de varejo

---

# Resultado esperado

As TVs exibem conteúdos mais úteis para clientes dentro das lojas.

Exemplo:

"Preço do café sobe no Brasil"

"Inflação impacta alimentos"

"Novo sistema de pagamento chega aos supermercados"
