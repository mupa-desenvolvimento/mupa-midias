

## Plan: Criar rota `CADASTRO_DISPOSITIVO` (POST) na Edge Function `device-api`

### Objetivo
Adicionar uma nova rota POST `/device-api/cadastro` que aceita os campos especificados e registra/atualiza o dispositivo no sistema.

### Campos de entrada
| Campo | Descrição |
|-------|-----------|
| `codigo_empresa` | Código da empresa (6 chars, ex: 001KNC) |
| `apelido_dispositivo` | Nome amigável do dispositivo |
| `num_filial` | Código da loja/filial |
| `device_name` | Nome técnico do dispositivo |
| `android_id` | ID Android do dispositivo |
| `serial_number` | Número de série (usado como `device_code`) |

### Fluxo da rota
1. Validar campos obrigatórios
2. Buscar empresa pelo `codigo_empresa` na tabela `companies`
3. Buscar loja pelo `num_filial` + `tenant_id` da empresa na tabela `stores`
4. Buscar grupo padrão (`is_default = true`) do tenant
5. Chamar a RPC `register_device` existente com os dados resolvidos, passando `serial_number` como `device_code` e `apelido_dispositivo` como nome
6. Salvar `android_id` no campo `metadata` do dispositivo
7. Retornar `device_token`, `device_id`, `group_id` e dados da empresa/loja

### Arquivo editado
- `supabase/functions/device-api/index.ts` — adicionar bloco `if (path === 'cadastro' && req.method === 'POST')` junto às demais rotas

### Resposta de sucesso (200)
```json
{
  "device_id": "uuid",
  "device_token": "uuid-string",
  "device_code": "serial_number",
  "group_id": "uuid | null",
  "company_name": "Nome da Empresa",
  "store_name": "Nome da Loja"
}
```

### Resposta de erro
- 400: campos obrigatórios ausentes
- 404: empresa ou loja não encontrada

