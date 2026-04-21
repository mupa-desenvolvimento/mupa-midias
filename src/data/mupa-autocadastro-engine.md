# MUPA – Autocadastro de Dispositivos + Engine de Distribuição

## 🎯 Objetivo

Implementar um sistema inteligente de autocadastro de dispositivos e uma engine de distribuição escalável baseada na hierarquia:

Empresa → Região → Loja → Grupo → Campanha → Playlist → Dispositivo

O dispositivo deve ser passivo e herdar automaticamente sua configuração.

---

# 📐 Arquitetura Geral

## Hierarquia Oficial

Empresa
→ Região
→ Loja
→ Grupo
→ Campanha
→ Playlist
→ Dispositivo

---

# 🚀 1️⃣ Autocadastro Inteligente

## 📲 Fluxo no Dispositivo

### Primeiro Boot

1. Inserir `cod-user` da empresa
2. Validar empresa via API
3. Selecionar Loja
4. Selecionar Grupo
5. Sistema registra dispositivo
6. Recebe `device_token`
7. Inicia sincronização automática

---

## 🔁 Fluxo Técnico
