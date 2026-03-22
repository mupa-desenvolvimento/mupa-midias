# MUPA Enterprise V2 — Database Schema

## Status: ✅ Fase 1 Completa (Database)

---

## Hierarquia Completa

```
Empresa (companies) ← já existia
  └── Estado (states) ← já existia
       └── Região (regions) ← já existia
            └── Cidade (cities) ← já existia
                 └── Loja (stores) ← já existia
                      └── Setor (sectors) 🆕
                           └── Zona (zones) 🆕
                                └── Tipo de Dispositivo (device_types) 🆕
                                     └── Dispositivo (devices) ← expandido
```

## Novas Tabelas Criadas

### Hierarquia Expandida
| Tabela | Descrição |
|--------|-----------|
| `sectors` | Setores dentro de uma loja (Hortifruti, Açougue, Padaria...) |
| `zones` | Zonas dentro de um setor (Entrada, Checkout, Corredor...) |
| `device_types` | Tipos de dispositivo (TV, LED, TOTEM, CONSULTA_PRECO...) |

### Sistema de Tags
| Tabela | Descrição |
|--------|-----------|
| `tags` | Tags para segmentação dinâmica (litoral, capital, loja_grande...) |
| `device_tags` | Associação dispositivo ↔ tag |
| `store_tags` | Associação loja ↔ tag |

### Engine de Campanhas & Retail Media
| Tabela | Descrição |
|--------|-----------|
| `advertisers` | Anunciantes para retail media |
| `contracts` | Contratos de anunciantes |
| `campaigns` | Campanhas com prioridade, peso, agendamento |
| `campaign_contents` | Conteúdos de mídia por campanha |
| `campaign_targets` | Targeting multicamada (estado, cidade, loja, setor, zona, tag...) |

### Logs & Impressões
| Tabela | Descrição |
|--------|-----------|
| `impression_logs` | Log completo de cada exibição com rastreabilidade total |

## Colunas Adicionadas em `devices`
- `sector_id` → Referência ao setor
- `zone_id` → Referência à zona
- `device_type_id` → Referência ao tipo de dispositivo

## Funções Criadas
- `register_impression()` — Registra impressão com contexto geográfico completo e incrementa contadores

## Prioridade de Conteúdo (Engine)
1. Campanhas pagas (advertiser ≠ null)
2. Campanhas regionais
3. Campanhas rede
4. Campanhas loja
5. Institucional
6. Fallback

## Próximas Fases
- [ ] Fase 2: Edge Function para playlist dinâmica com targeting
- [ ] Fase 3: Interface em árvore hierárquica na sidebar
- [ ] Fase 4: Páginas de CRUD (Setores, Zonas, Tags, Campanhas, Anunciantes)
- [ ] Fase 5: Dashboard de relatórios por campanha/anunciante/loja
- [ ] Fase 6: Seed de device_types e zonas padrão
