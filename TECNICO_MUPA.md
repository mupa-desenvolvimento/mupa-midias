# 🛠️ Documentação Técnica: Ecossistema Mupa

Esta documentação fornece uma visão técnica aprofundada da plataforma Mupa, detalhando sua arquitetura, recursos e fluxos de integração para desenvolvedores.

---

## 🏗️ Arquitetura Core

A Mupa é construída sobre uma stack moderna focada em performance, escalabilidade e offline-first:

-   **Frontend**: React + TypeScript + Vite.
-   **Estilização**: Tailwind CSS + Shadcn UI + Framer Motion.
-   **Backend (BaaS)**: Supabase (Auth, Database, Storage).
-   **Serverless**: Supabase Edge Functions (Deno runtime).
-   **Mobile/Desktop Hybrid**: Capacitor.js (para execução nativa em Android/Tizen/WebOS).
-   **PWA**: Service Workers para suporte offline total.

---

## 📺 Player Core (Digital Signage)

O motor de exibição foi projetado para rodar em ambientes de rede instáveis.

### Recursos Técnicos:
-   **Sincronização Inteligente**: Utiliza `useSyncManager` para gerenciar downloads de mídia em background e persistência no IndexedDB.
-   **Offline Player**: Localizado em `src/pages/OfflinePlayer.tsx`, permite reprodução contínua sem internet.
-   **Comando Remoto via Pub/Sub**: Integração com Supabase Realtime para execução de comandos instantâneos (reiniciar, atualizar, mudar volume).
-   **Monitoramento de Health**: Heartbeats periódicos enviados via Edge Functions para tracking de status (online/offline) e logs de temperatura/memória.

---

## 🧠 Módulos de Inteligência e Automação

O backend é composto por mais de 30 Edge Functions que lidam com lógica pesada:

### 1. Inky Intelligence (IA & Insights)
-   **Caminho**: `supabase/functions/inky-insights` e `inky-landing`.
-   **Função**: Processamento de dados de audiência em tempo real e geração de relatórios preditivos.

### 2. Auto-Content Engine
-   **Módulos**: Notícias (NewsData.io), Frases Motivacionais, Curiosidades e Nutrição.
-   **Fluxo**: Jobs agendados via cron no Supabase que buscam dados externos, filtram e cacheiam no banco para os players.
-   **Instagram Fetch**: `supabase/functions/instagram-fetch` para sincronizar feeds de redes sociais.

### 3. Gerador de Propostas (Sales Enablement)
-   **Geração de PDF**: Utiliza Puppeteer em Edge Functions para renderizar propostas comerciais personalizadas a partir de templates React.
-   **Visualização Pública**: `/proposta/:id` renderiza uma versão web otimizada para o cliente final.

---

## 🔗 Integrações & API

A plataforma é altamente integrável através do módulo de **Price Check** e **API Integrations**:

-   **Price Check Proxy**: Localizado em `supabase/functions/price-check-proxy`, permite que telas de varejo busquem preços de ERPs locais com baixa latência.
-   **Canva Integration**: Fluxo OAuth completo (`supabase/functions/canva-auth`) permitindo que usuários criem artes no Canva e as enviem diretamente para as telas da Mupa.
-   **TTS (Text-to-Speech)**: Integração com ElevenLabs para geração de áudio dinâmico em campanhas.

---

## 📊 Analytics & Retail Media

-   **Tracking de Audiência**: Suporte a reconhecimento facial básico via `face-api.js` para métricas de tempo de atenção (OOH Metrics).
-   **Campaign Engine**: Motor de regras para exibição de mídia baseada em horário, tags do dispositivo ou localização geográfica.

---

## 🛠️ Guia de Desenvolvimento

### Comandos Úteis:
- `npm run dev`: Inicia o ambiente de desenvolvimento.
- `supabase functions deploy [nome]`: Publica uma nova lógica de backend.
- `npm run build`: Gera o bundle otimizado para produção.

### Estrutura de Pastas:
- `src/components`: UI Atoms, Molecules e Layouts.
- `src/hooks`: Lógica reutilizável (Sync, Auth, Theme).
- `src/pages/admin`: Interface de gerenciamento (CMS).
- `supabase/functions`: Lógica de servidor escalável.

---

**Mupa: High Performance Digital Signage & Retail Media Platform.**
