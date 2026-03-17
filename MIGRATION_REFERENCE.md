# 📦 MUPA Display – Referência Completa para Migração Kotlin Nativo

> Documento gerado automaticamente com todo o código-fonte e lógica necessária para migrar o app React+Capacitor para Kotlin+Jetpack Compose puro.

---

## 📋 Índice

1. [Visão Geral da Arquitetura Atual](#1-visão-geral)
2. [Supabase – Endpoints e RPCs](#2-supabase)
3. [Tipos de Dados (TypeScript → Kotlin)](#3-tipos)
4. [NativeRouteHandler – Lógica de Navegação](#4-navegação)
5. [DeviceSetup – Tela de Configuração](#5-setup)
6. [useOfflinePlayer – Lógica Central do Player](#6-player-logic)
7. [MediaRenderer – Renderização de Mídia](#7-media-renderer)
8. [MediaCacheService – Cache de Arquivos](#8-cache)
9. [Content Types – Tipos de Conteúdo](#9-content-types)
10. [Realtime – Atualizações em Tempo Real](#10-realtime)
11. [OfflinePlayer – Tela Principal do Player](#11-offline-player)
12. [MainActivity – Configuração Android Atual](#12-mainactivity)
13. [Capacitor Config](#13-capacitor)
14. [Supabase Config](#14-supabase-config)

---

## 1. Visão Geral da Arquitetura Atual <a name="1-visão-geral"></a>

```
┌─────────────────────────────────────────────┐
│                  App Flow                    │
├─────────────────────────────────────────────┤
│  App Start                                   │
│  └─ NativeRouteHandler                       │
│     ├─ mupa_device_code exists?              │
│     │  ├─ YES → /play/{deviceCode}           │
│     │  └─ NO  → /setup/new                   │
│                                              │
│  /setup/{deviceId}  → DeviceSetup            │
│    1. Input company code (3num+3let)         │
│    2. Select store                           │
│    3. Select device group                    │
│    4. register_device() RPC                  │
│    5. Save mupa_device_code + device_token   │
│    6. Navigate to /play/{deviceCode}         │
│                                              │
│  /play/{deviceCode} → OfflinePlayer          │
│    1. Load local cache (localStorage)        │
│    2. syncWithServer()                       │
│    3. Download media (IndexedDB/Filesystem)  │
│    4. Start rotation loop                    │
│    5. Subscribe Realtime                     │
│    6. Heartbeat every 30s                    │
│    7. Full sync every 5min                   │
└─────────────────────────────────────────────┘
```

**Supabase Project:**
- URL: Usa `import.meta.env.VITE_SUPABASE_URL`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY252eW9zZWV4Zm1yeW5xYmZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTg0MjksImV4cCI6MjA4MTEzNDQyOX0.u8Y37eaVlNA74Th8pZE7Td6qVnZaqW5tbDkD45867Lc`
- Project ID: `bgcnvyoseexfmrynqbfb`

---

## 2. API REST – Endpoints <a name="2-supabase"></a>

### ⭐ ENDPOINT PRINCIPAL: Conteúdo do Dispositivo (substitui múltiplas chamadas RPC)

O app nativo deve consumir **um único endpoint REST** que retorna toda a programação consolidada:

```
GET https://bgcnvyoseexfmrynqbfb.supabase.co/functions/v1/device-api/content?device_code={DEVICE_CODE}&token={DEVICE_TOKEN}
```

**Parâmetros:**
| Param | Obrigatório | Descrição |
|-------|-------------|-----------|
| `device_code` | ✅ | Código do dispositivo (8 caracteres) |
| `token` | ❌ | Device token — se enviado, faz heartbeat automático |

**Response (200):**
```json
{
  "version": 1,
  "generated_at": "2026-03-17T12:00:00.000Z",
  "device": {
    "id": "uuid",
    "device_code": "ABCD1234",
    "name": "Terminal 01",
    "store_id": "uuid|null",
    "company_id": "uuid|null",
    "company_slug": "string|null",
    "store_code": "string|null",
    "camera_enabled": false,
    "is_blocked": false,
    "blocked_message": "string|null",
    "last_sync_requested_at": "iso-datetime|null"
  },
  "override_media": {
    "id": "uuid",
    "name": "Promo Urgente",
    "type": "video",
    "file_url": "https://...",
    "duration": 30,
    "expires_at": "iso-datetime"
  },
  "playlists": [{
    "id": "uuid",
    "name": "Playlist Principal",
    "description": "string|null",
    "is_active": true,
    "has_channels": true,
    "start_date": "YYYY-MM-DD|null",
    "end_date": "YYYY-MM-DD|null",
    "days_of_week": [0,1,2,3,4,5,6],
    "start_time": "HH:MM|null",
    "end_time": "HH:MM|null",
    "priority": 10,
    "content_scale": "string|null",
    "items": [{
      "id": "uuid",
      "media_id": "uuid",
      "position": 0,
      "duration_override": null,
      "start_date": "YYYY-MM-DD|null",
      "end_date": "YYYY-MM-DD|null",
      "start_time": "HH:MM|null",
      "end_time": "HH:MM|null",
      "days_of_week": null,
      "media": {
        "id": "uuid",
        "name": "Banner.jpg",
        "type": "image",
        "file_url": "https://...",
        "duration": 10,
        "metadata": {}
      }
    }],
    "channels": [{
      "id": "uuid",
      "name": "Canal Manhã",
      "is_active": true,
      "is_fallback": false,
      "position": 0,
      "start_date": null,
      "end_date": null,
      "start_time": "06:00",
      "end_time": "12:00",
      "days_of_week": null,
      "items": [/* mesma estrutura dos items acima */]
    }]
  }]
}
```

**Erros:**
- `400` → `{ "error": "device_code é obrigatório" }`
- `404` → `{ "error": "Dispositivo \"XXX\" não encontrado" }`

### Kotlin — Como consumir:
```kotlin
// Usando Ktor ou OkHttp:
val BASE_URL = "https://bgcnvyoseexfmrynqbfb.supabase.co/functions/v1/device-api"

suspend fun fetchContent(deviceCode: String, token: String?): ContentResponse {
    val url = "$BASE_URL/content?device_code=$deviceCode" +
        (token?.let { "&token=$it" } ?: "")
    val response = httpClient.get(url)
    return json.decodeFromString<ContentResponse>(response.bodyAsText())
}
```

### Endpoints auxiliares (Setup do dispositivo):

| Método | Endpoint | Body/Params | Retorno |
|--------|----------|-------------|---------|
| `POST` | `/device-api/validate-company` | `{ "cod_user": "123ABC" }` | `{ "company_id", "company_name" }` |
| `POST` | `/device-api/stores` | `{ "company_id": "uuid" }` | `[{ "id", "code", "name" }]` |
| `POST` | `/device-api/groups` | `{ "store_id": "uuid", "tenant_id": "uuid" }` | `[{ "id", "name", "description" }]` |
| `POST` | `/device-api/register` | `{ "device_code", "name", "store_id", "company_id", "group_id", "store_code" }` | `{ "device_id", "device_token" }` |
| `POST` | `/device-api/heartbeat` | `{ "device_token", "status", "current_playlist_id?" }` | `{ "success": true }` |

### Fluxo simplificado no app nativo:
```
1. App abre → verifica DataStore por device_code
2. Se não tem → Tela Setup (usa endpoints auxiliares acima)
3. Se tem → GET /device-api/content?device_code=XXX&token=YYY
4. Processa resposta → filtra playlists/channels ativos → reproduz
5. A cada 5 min → repete GET /content (sync + heartbeat automático)
6. Realtime (opcional) → websocket para atualizações instantâneas
```

> **IMPORTANTE:** O endpoint `/content` já faz toda a resolução de grupos, canais e playlists no servidor. O app nativo **NÃO precisa** fazer múltiplas queries separadas como o app React fazia.

---

## 3. Tipos de Dados <a name="3-tipos"></a>

```typescript
// ===== TIPOS PRINCIPAIS (converter para data classes Kotlin) =====

interface CachedMedia {
  id: string;
  name: string;
  type: string;          // "image"|"video"|"weather"|"news"|"motivational"|"curiosity"|"birthday"|"nutrition"|"instagram"|"campaign"
  file_url: string | null;
  duration: number;       // segundos
  metadata?: any;         // JSONB do Supabase
  blob_url?: string;      // URL local (blob: ou file://) — em Kotlin será o path no filesystem
  cached_at: number;      // timestamp
}

interface CachedPlaylistItem {
  id: string;
  media_id: string;
  position: number;
  duration_override: number | null;
  media: CachedMedia;
  start_date?: string | null;   // "YYYY-MM-DD"
  end_date?: string | null;
  start_time?: string | null;   // "HH:MM"
  end_time?: string | null;
  days_of_week?: number[] | null; // [0=domingo, 1=segunda, ..., 6=sábado]
}

interface CachedChannel {
  id: string;
  name: string;
  is_active: boolean;
  is_fallback: boolean;
  position: number;
  start_date: string | null;
  end_date: string | null;
  start_time: string;      // "HH:MM"
  end_time: string;         // "HH:MM"
  days_of_week: number[] | null;
  items: CachedPlaylistItem[];
}

interface CachedPlaylist {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  has_channels: boolean;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  items: CachedPlaylistItem[];
  channels: CachedChannel[];
  synced_at: number;
  content_scale?: string | null;
}

interface OverrideMedia {
  id: string;
  name: string;
  type: string;
  file_url: string;
  duration: number;
  blob_url?: string;
  expires_at: string;  // ISO datetime
}

interface DeviceState {
  device_code: string;
  device_id: string | null;
  device_name: string | null;
  store_id: string | null;
  company_id: string | null;
  company_slug: string | null;
  playlists: CachedPlaylist[];
  last_sync: number;        // timestamp
  is_online: boolean;
  is_blocked: boolean;
  blocked_message: string | null;
  override_media: OverrideMedia | null;
  last_sync_requested_at: string | null;
  camera_enabled: boolean;
  store_code?: string | null;
  device_token?: string | null;
}
```

---

## 4. NativeRouteHandler – Lógica de Navegação <a name="4-navegação"></a>

```typescript
// Em Kotlin: fazer isso na MainActivity ou no NavHost inicial
const NativeRouteHandler = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const storedCode = localStorage.getItem("mupa_device_code");
    // Em Kotlin: DataStore ou SharedPreferences
    
    if (path.startsWith("/play/") || path.startsWith("/setup/")) return;
    
    if (!storedCode) {
      navigate("/setup/new");  // → DeviceSetupScreen
      return;
    }
    
    navigate(`/play/${storedCode}`);  // → OfflinePlayerScreen
  }, []);
};
```

**Kotlin equivalente:**
```kotlin
// No NavHost:
val deviceCode = dataStore.getDeviceCode()
if (deviceCode == null) {
    navController.navigate("setup")
} else {
    navController.navigate("player/$deviceCode")
}
```

---

## 5. DeviceSetup – Fluxo de Configuração <a name="5-setup"></a>

### Fluxo:
1. **Step "login"**: Usuário digita código da empresa (formato `123ABC` - 3 números + 3 letras)
2. **Validação**: `supabase.from("companies").select().eq("code", code).eq("is_active", true).single()`
3. **Step "store"**: Lista lojas filtradas por `tenant_id` da empresa
4. **Step "group"**: Lista grupos de dispositivos filtrados por `store_id` ou `store_id IS NULL` e `tenant_id`
5. **Step "complete"**: Registra dispositivo via RPC `register_device`

### Geração do Device Code:
```typescript
const generateDeviceCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};
```

### Após registro bem-sucedido:
```typescript
localStorage.setItem('mupa_device_code', deviceId);  // → DataStore em Kotlin
localStorage.setItem(`device_token_${deviceId}`, result.device_token); // → DataStore
navigate(`/play/${deviceId}`);
```

---

## 6. useOfflinePlayer – Lógica Central <a name="6-player-logic"></a>

### Constantes:
```typescript
const SYNC_INTERVAL = 5 * 60 * 1000;       // 5 minutos entre syncs completos
const CONTROL_CHECK_INTERVAL = 30 * 1000;    // 30 segundos entre heartbeats
```

### isPlaylistActiveNow(playlist):
```typescript
const isPlaylistActiveNow = (playlist: CachedPlaylist): boolean => {
  if (!playlist.is_active) return false;
  const now = new Date();
  const currentDay = now.getDay();        // 0=domingo
  const currentTime = now.toTimeString().slice(0, 5);  // "HH:MM"
  
  if (playlist.days_of_week?.length > 0) {
    if (!playlist.days_of_week.includes(currentDay)) return false;
  }
  if (playlist.start_date) {
    if (now < new Date(playlist.start_date)) return false;
  }
  if (playlist.end_date) {
    const endDate = new Date(playlist.end_date);
    endDate.setHours(23, 59, 59);
    if (now > endDate) return false;
  }
  if (playlist.start_time && currentTime < playlist.start_time) return false;
  if (playlist.end_time && currentTime > playlist.end_time) return false;
  return true;
};
```

### isChannelActiveNow(channel):
```typescript
// Mesma lógica, mas canais fallback SEMPRE retornam true
const isChannelActiveNow = (channel: CachedChannel): boolean => {
  if (!channel.is_active) return false;
  if (channel.is_fallback) return true;
  // ... mesma lógica de data/hora/dias
};
```

### getActivePlaylist():
```typescript
const getActivePlaylist = (): CachedPlaylist | null => {
  return deviceState.playlists
    .filter(isPlaylistActiveNow)
    .sort((a, b) => b.priority - a.priority)[0] || null;
};
```

### getActiveChannel(playlist):
```typescript
const getActiveChannel = (playlist): CachedChannel | null => {
  if (!playlist.has_channels || !playlist.channels?.length) return null;
  const activeChannels = playlist.channels.filter(isChannelActiveNow);
  const normal = activeChannels.filter(c => !c.is_fallback);
  const fallback = activeChannels.filter(c => c.is_fallback);
  if (normal.length > 0) return normal.sort((a, b) => a.position - b.position)[0];
  if (fallback.length > 0) return fallback.sort((a, b) => a.position - b.position)[0];
  return null;
};
```

### getActiveItems():
```typescript
const getActiveItems = (): CachedPlaylistItem[] => {
  const playlist = getActivePlaylist();
  if (!playlist) return [];
  if (playlist.has_channels) {
    const channel = getActiveChannel(playlist);
    return channel?.items || [];
  }
  return playlist.items;
};
```

### syncWithServer() – Fluxo Completo:
```
1. get_public_device_info(deviceCode) → device info
2. Check override_media (se expires_at > now)
3. device_group_members.select(device_id=device.id) → group_ids
4. device_group_channels.select(group_id IN group_ids) → channel_ids
5. get_public_playlists_data(playlist_ids, channel_ids) → playlists com itens
6. Para cada item com type != "news"/"weather" e file_url != null:
   - Adiciona à lista de download
7. Monta CachedPlaylist[] com items e channels
8. Download de cada mídia (IndexedDB/Filesystem)
   - Injeta blob_url em cada item
9. Download override_media se existir
10. Cleanup arquivos antigos
11. Salva DeviceState no localStorage
12. Heartbeat via device_heartbeat RPC
```

### Heartbeat:
```typescript
// A cada 30 segundos via checkControlCommands():
supabase.rpc('device_heartbeat', {
  p_device_token: savedToken,
  p_status: 'online',
  p_current_playlist_id: null,
});

// Também verifica mudanças comparando:
// - is_blocked
// - blocked_message  
// - override_media_id
// - camera_enabled
// - last_sync_requested_at (força re-sync se mudou)
```

---

## 7. MediaRenderer – Tipos de Renderização <a name="7-media-renderer"></a>

| Tipo | Renderização | Fonte |
|------|-------------|-------|
| `video` | `<video>` nativo (ExoPlayer em Kotlin) | `file_url` ou `blob_url` |
| `image` | `<img>` (Coil em Kotlin) | `file_url` ou `blob_url` |
| `news` | Componente `NewsPlayerSlide` (HTML/CSS) | Dados do banco `news_articles` |
| `weather` | Componente `WeatherContainer` | Dados do banco `weather_locations` via RPC `get_device_weather_settings` |
| `motivational`/`curiosity`/`birthday`/`nutrition` | Card com texto | `media.metadata.content`, `media.metadata.author` |
| `campaign` | Imagem QR | `metadata.campaign_url` ou `metadata.qr_url` |
| `instagram` | iframe | `metadata.instagram_url` |

### Lógica de URL:
```typescript
// Prioridade de URL para reprodução:
const url = media.blob_url || media.file_url;
// Em Kotlin: localPath (cache) || remoteUrl
```

---

## 8. MediaCacheService – Cache Nativo <a name="8-cache"></a>

```typescript
// Em Capacitor usa @capacitor/filesystem
// Em Kotlin puro: usar File API + OkHttp para download

const MediaCacheService = {
  // Diretório: Directory.Data + "media-cache/"
  
  init(): cria diretório se não existir
  
  isCached(url): verifica se arquivo existe pelo nome extraído da URL
    → getFileName(url) = última parte do path da URL
    → Filesystem.stat({path: "media-cache/{fileName}"})
    → retorna Capacitor.convertFileSrc(uri)
  
  downloadFile(url):
    → fetch(url) → blob → base64
    → Filesystem.writeFile({path, data: base64})
    → retorna convertFileSrc(uri)
  
  cleanupOldFiles(activeUrls):
    → lista arquivos em "media-cache/"
    → deleta os que NÃO estão na lista de URLs ativas
  
  getFileName(url): extrai nome do arquivo da URL
    → new URL(url).pathname.split('/').pop()
};
```

**Em Kotlin nativo:**
```kotlin
// Usar:
// - OkHttp para download
// - File(context.filesDir, "media-cache/") para armazenamento
// - ExoPlayer CacheDataSource para cache de vídeo
// - Coil DiskCache para cache de imagens
```

---

## 9. Content Types <a name="9-content-types"></a>

```typescript
const CONTENT_TYPES = [
  'image',        // Arquivo de imagem (file_url obrigatório)
  'video',        // Arquivo de vídeo (file_url obrigatório)
  'weather',      // Slide dinâmico de clima (sem file_url)
  'news',         // Slide dinâmico de notícias (sem file_url)
  'motivational', // Frase motivacional (sem file_url, usa metadata)
  'curiosity',    // Curiosidade (sem file_url, usa metadata)
  'birthday',     // Aniversariante (sem file_url, usa metadata)
  'nutrition',    // Dica de nutrição (sem file_url, usa metadata)
  'instagram',    // Post do Instagram (sem file_url, usa metadata.instagram_url)
  'campaign',     // QR Code de campanha (sem file_url, usa metadata.campaign_url)
];

// Tipos com arquivo: image, video
// Tipos dinâmicos (sem arquivo): weather, news, motivational, curiosity, birthday, nutrition, instagram, campaign
```

---

## 10. Realtime <a name="10-realtime"></a>

```typescript
// Canal único por dispositivo
supabase.channel(`device-updates-${deviceCode}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter: `device_code=eq.${deviceCode}` }, syncWithServer)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, syncWithServer)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_items' }, syncWithServer)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_channel_items' }, syncWithServer)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_channels' }, syncWithServer)
  .subscribe();
```

**Em Kotlin:** usar `io.github.jan-tennert.supabase:realtime-kt` ou WebSocket direto.

---

## 11. OfflinePlayer – Lógica de Rotação <a name="11-offline-player"></a>

### Sistema A/B de Slots:
O player usa dois slots (A e B) para transições suaves:

```
Slot A: videoARef + imgARef
Slot B: videoBRef + imgBRef

1. Reproduz item no Slot A
2. 3 segundos antes do fim → pré-carrega próximo item no Slot B
3. Ao terminar → ativa Slot B, começa reprodução
4. 3 segundos antes do fim do Slot B → pré-carrega no Slot A
5. Loop infinito
```

### Lógica de duração:
```typescript
const getDurationForIndex = (idx) => {
  const item = items[idx];
  if (item.media.type === "video") {
    return item.duration_override || 0; // 0 = usa duração do vídeo
  }
  return item.duration_override || item.media.duration || 10;
};
```

### Timer de imagens:
```typescript
// Para imagens/slides:
// 1. Seta timeRemaining = duration * 1000
// 2. setInterval 100ms decrementando
// 3. Ao chegar em 0 → goToNext()
// 4. 3s antes do fim → preloadIntoSlot(nextSlot, nextIndex)
```

### Timer de vídeos:
```typescript
// Para vídeos:
// 1. Escuta evento "timeupdate" do <video>
// 2. Calcula remaining = video.duration - video.currentTime
// 3. Quando remaining <= 3s → preload próximo
// 4. Quando remaining <= 0.05s → troca de slot
```

### Estados da tela:
- **Loading**: `isLoading && !deviceState` → tela de carregamento
- **Blocked**: `deviceState.is_blocked` → tela de bloqueio
- **Empty**: sem playlist/itens ativos → tela sem conteúdo
- **Playing**: reprodução normal com rotação

### Override Media:
```typescript
// Se deviceState.override_media existe e expires_at > now:
// - Substitui o item ativo pelo override_media
// - Quando expira, volta para a playlist normal
```

---

## 12. MainActivity Atual <a name="12-mainactivity"></a>

```java
// Configurações obrigatórias para Kotlin:
// - FLAG_KEEP_SCREEN_ON
// - FLAG_HARDWARE_ACCELERATED
// - Immersive mode (hide status bar + navigation bar)
// - BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
// - Re-apply immersive on focus change and system UI change
```

---

## 13. Capacitor Config <a name="13-capacitor"></a>

```typescript
const config = {
  appId: 'io.audient.display',
  appName: 'AudientDisplay',
  webDir: 'dist'
};
```

---

## 14. Configuração Supabase <a name="14-supabase-config"></a>

```kotlin
// Para supabase-kt:
val supabase = createSupabaseClient(
    supabaseUrl = "https://bgcnvyoseexfmrynqbfb.supabase.co",
    supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY252eW9zZWV4Zm1yeW5xYmZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTg0MjksImV4cCI6MjA4MTEzNDQyOX0.u8Y37eaVlNA74Th8pZE7Td6qVnZaqW5tbDkD45867Lc"
) {
    install(Postgrest)
    install(Realtime)
}
```

---

## 📝 Notas para a Migração

### Persistência (localStorage → DataStore):
| Key atual | Uso |
|-----------|-----|
| `mupa_device_code` | Código do dispositivo ativo |
| `device_token_{code}` | Token para heartbeat |
| `device_player_state_{code}` | Estado completo (JSON) |
| `media_manifest_{code}` | Lista de mídias para download |
| `terminal_theme_{code}` | Tema do terminal |

### Dependências Kotlin sugeridas:
```kotlin
// Supabase
implementation("io.github.jan-tennert.supabase:postgrest-kt:3.x")
implementation("io.github.jan-tennert.supabase:realtime-kt:3.x")
implementation("io.ktor:ktor-client-okhttp:3.x")

// ExoPlayer
implementation("androidx.media3:media3-exoplayer:1.x")
implementation("androidx.media3:media3-ui:1.x")
implementation("androidx.media3:media3-datasource-okhttp:1.x")

// Cache/Storage
implementation("androidx.room:room-runtime:2.x")
implementation("androidx.datastore:datastore-preferences:1.x")

// Images
implementation("io.coil-kt:coil-compose:3.x")

// DI
implementation("com.google.dagger:hilt-android:2.x")

// WorkManager
implementation("androidx.work:work-runtime-ktx:2.x")

// Compose
implementation("androidx.compose.ui:ui")
implementation("androidx.navigation:navigation-compose:2.x")
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.x")
```

### Performance para TV Box X96 (Android 9, low-end):
1. Use `LazyColumn` com `key` estável para evitar recomposições
2. ExoPlayer com `SimpleCache` e `CacheDataSource.Factory`
3. Coil com `diskCachePolicy(CachePolicy.ENABLED)` e tamanho limitado
4. Evite animações pesadas em Compose
5. Use `remember` e `derivedStateOf` agressivamente
6. WorkManager para downloads em background
7. Room com `Flow` para observação reativa de dados locais
