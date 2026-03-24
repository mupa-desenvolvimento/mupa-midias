# Audient Insight Display — Guia do Sistema (para Desenvolvedores e IA)

## Visão Geral
- Plataforma de gestão e reprodução de campanhas e conteúdos com distribuição hierárquica até o nível de dispositivo.
- Frontend React com UI dark (shadcn/ui), drag-and-drop (DndKit) e construtor visual em Fabric.js.
- Backend Supabase com PostgREST, RLS e funções serverless, mantendo segurança por tenant.
- Páginas principais: Programações (/admin/schedule) com abas para campanhas, conteúdos, timeline, hierarquia tradicional e hierarquia visual.

## Arquitetura
- Frontend
  - React + Vite.
  - shadcn/ui para componentes e estilo dark.
  - DndKit para reordenação de listas e árvore hierárquica.
  - Fabric.js para canvas interativo de hierarquia visual.
  - Capacitor para integrações nativas opcionais de player.
- Backend
  - Supabase: PostgREST, Postgres, RLS, funções Edge.
  - Tabelas principais: estados, regiões, cidades, lojas, setores, grupos, zonas, tipos de dispositivo, dispositivos, device_group_members, campaign_contents, campaign_targets.
- Player
  - Web e offline, reproduzindo conteúdos conforme ordem e regras de alvo.

## Módulos Principais
- Página de Programações
  - Arquivo: [ScheduleTimeline.tsx](file:///c:/src/audient-insight-display/src/pages/admin/ScheduleTimeline.tsx)
  - Abas:
    - Campanhas: criação e gerenciamento de campanhas.
    - Conteúdos: cadastro e vinculação a campanhas.
    - Timeline: ordenação de reprodução, com correções no update de posição para evitar violar campaign_id.
    - Hierarquia: árvore baseada em tipos de nós com DndKit.
    - Hierarquia Visual: construtor em Fabric.js com agrupamentos e cores por tipo.
- Árvore de Hierarquia
  - Arquivo: [HierarchyTree.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/HierarchyTree.tsx)
  - Estrutura: Estado → Região → Cidade → Loja → Setor → Grupo → Dispositivo.
  - Tipagem base: TreeNode (exportada pelo componente).
  - Regras de DnD:
    - Estado movimenta entre regiões somente quando aplicável ao modelo.
    - Loja só pode estar dentro de Região.
    - Setor dentro de Loja.
    - Dispositivo dentro de Setor ou Loja.
  - Integração com JSON local e posterior sync com DB.
- Hierarquia Visual (Fabric.js)
  - Arquivo: [FabricHierarchy.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/FabricHierarchy.tsx)
  - Canvas 1100x650 com fundo azul escuro, borda azul (#007bff).
  - Paleta lateral com itens arrastáveis:
    - Região (verde #00c853 e laranja #ff9800).
    - Loja (roxo #8e24aa e variações laranja/vermelho).
    - Setor (verde escuro #1b5e20 ou preto).
    - Dispositivo (azul #0288d1).
  - Funcionalidades:
    - Drag-and-drop do sidebar para o canvas.
    - Objetos livres; agrupamento lógico ao soltar dentro de pai permitido.
    - Duplo-clique para editar nomes (IText).
    - Zoom In/Out, Reset viewport.
    - Exportar/Importar JSON com metadados: id, type, name, color, parentId.
    - Delete via tecla Delete; Undo/Redo (Ctrl+Z/Ctrl+Y) com histórico.
    - Snap to grid opcional com tamanho ajustável.
    - Preparado para “Salvar no banco”.

## Domínio e Modelagem
- Entidades
  - Estado, Região, Cidade, Loja, Setor, Grupo, Zona, Tipo de Dispositivo, Dispositivo.
- Relações
  - Região pertence a Estado.
  - Cidade pertence a Região ou Estado (conforme modelagem).
  - Loja pertence a Cidade ou Região (conforme modelagem atual).
  - Setor pertence a Loja.
  - Grupo agrega Dispositivos (muitos-para-muitos via device_group_members).
  - Dispositivo pertence a Setor ou Loja; pode ter Zona e Tipo.
- Convenções de cores
  - Região: verde/laranja.
  - Loja: roxo/laranja/vermelho.
  - Setor: verde escuro/preto.
  - Dispositivo: azul claro.

## Tipos e Estruturas
- TreeNode
  - Local: [HierarchyTree.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/HierarchyTree.tsx)
  - Representa um nó com id, type, name, children e metadados.
- VisualItem (FabricHierarchy)
  - Campos: id, type, name, color, children[], parentId.
  - Serialização JSON do canvas preserva “data” de cada objeto para reconstrução e sincronização.

## Fluxos de Dados
- Hierarquia baseada em JSON local
  - Criação visual alimenta estado local e permite exportar JSON.
  - Importação carrega cenário visual e relações parentId.
- Migração para banco de dados
  - Salvar no banco percorre VisualItem[] e insere/atualiza nas tabelas correspondentes.
  - Respeito às chaves estrangeiras na ordem adequada: estados → regiões → cidades → lojas → setores → dispositivos; grupos e device_group_members isoladamente.
  - Inclusão de tenant_id em todas as inserções para RLS.
- Timeline de campanhas
  - Reordenação usa update de posição, sem alterar campaign_id.
  - Engine recupera ordem para playback nos dispositivos.
- Distribuição de campanhas
  - Futuro: drag de campanhas para Loja/Setor/Dispositivo no canvas.
  - Cria campaign_targets com target_type e target_id conforme nível.

## Segurança e RLS
- Regras de segurança por tenant no Supabase.
- Sempre enviar tenant_id em operações de escrita.
- Evitar violar constraints not null:
  - Ex.: region_id obrigatório ao criar Estado quando o modelo exige associação imediata.
- Não expor chaves ou segredos no cliente; utilize variáveis de ambiente e políticas do Supabase.

## UI/UX e Design
- Tema dark consistente com shadcn/ui.
- Hierarquia visual segue o layout solicitado:
  - “Estado RS” cabeçalho azul.
  - “Região Serra” verde; Lojas com cores específicas; Setores e Dispositivos conforme paleta.
  - “Região Litoral” laranja ocupando a parte inferior.
- Operações:
  - Arrastar itens da paleta e soltar no canvas.
  - Soltar dentro de um bloco pai permitido para vincular hierarquia.
  - Editar texto com duplo clique; excluir com Delete; desfazer/refazer.

## Integrações Principais
- ScheduleTimeline
  - Abas e alternância de viewMode, incluindo “hierarchy” e “hierarchy-visual”.
  - Arquivo: [ScheduleTimeline.tsx](file:///c:/src/audient-insight-display/src/pages/admin/ScheduleTimeline.tsx)
- FabricHierarchy
  - Exportar/Importar JSON e preparar “Salvar no banco”.
  - Arquivo: [FabricHierarchy.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/FabricHierarchy.tsx)
- HierarchyTree
  - DndKit e validações de constraints; integração com TreeNode.
  - Arquivo: [HierarchyTree.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/HierarchyTree.tsx)
- Campaign Engine
  - Função edge que decide ordem e conteúdo por dispositivo.
  - Arquivo: [index.ts](file:///c:/src/audient-insight-display/supabase/functions/campaign-engine/index.ts)

## Operações e Comandos
- Build
  - npm run build:dev
- Lint/Typecheck
  - Utilizar comandos definidos no projeto quando disponíveis para garantir qualidade.
- Ambiente
  - Windows, Vite dev server, Supabase.

## Padrões de Código
- TypeScript estrito.
- Componentes shadcn/ui com tamanhos válidos (“default”, “sm”, “lg”, “icon”).
- Sem comentários desnecessários inline em código de produção.
- Nomes claros e tipagem consistente.
- Não comitar segredos.

## Roadmap
- Completar drag-and-drop em todos os níveis na hierarquia visual.
- “Carregar da Hierarquia DB” para montar o canvas a partir do estado atual.
- “Salvar para DB” com mapeamento completo e validação de relações.
- Integração de campanhas no canvas:
  - Arrastar campanha para Loja/Setor/Dispositivo.
  - Criar campaign_targets conforme nível e escopo.
  - Visuais de contagem/indicadores por bloco.
- Linhas de conexão (setas), snap avançado, temas customizáveis.

## Glossário
- RLS: Row Level Security, restringe leitura/escrita por tenant.
- TreeNode: nó de hierarquia no componente tradicional.
- VisualItem: representação serializada dos blocos no canvas Fabric.js.
- campaign_targets: tabela de vinculação entre campanha e alvo (nível hierárquico).

## Exemplos
- Estrutura JSON exportada pelo FabricHierarchy (simplificada):
```json
{
  "objects": [
    { "type": "rect", "data": { "id": "STATE", "type": "state", "name": "Estado RS", "color": "#2f6ef7", "parentId": null } },
    { "type": "rect", "data": { "id": "REG_SER", "type": "region", "name": "Região Serra", "color": "#00c853", "parentId": "STATE" } },
    { "type": "rect", "data": { "id": "LOJA_002", "type": "store", "name": "Loja 002", "color": "#8e24aa", "parentId": "REG_SER" } },
    { "type": "rect", "data": { "id": "SET_BAZ", "type": "sector", "name": "Setor bazar", "color": "#121212", "parentId": "LOJA_002" } },
    { "type": "rect", "data": { "id": "DSP_02", "type": "device", "name": "Dispositivo 02", "color": "#0288d1", "parentId": "SET_BAZ" } }
  ]
}
```
- Regras de agrupamento:
  - store → region
  - sector → store
  - device → sector | store

## Referências de Código
- Programações: [ScheduleTimeline.tsx](file:///c:/src/audient-insight-display/src/pages/admin/ScheduleTimeline.tsx)
- Hierarquia DnD: [HierarchyTree.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/HierarchyTree.tsx)
- Hierarquia Visual (Fabric): [FabricHierarchy.tsx](file:///c:/src/audient-insight-display/src/components/enterprise/FabricHierarchy.tsx)
- Campaign Engine: [index.ts](file:///c:/src/audient-insight-display/supabase/functions/campaign-engine/index.ts)
