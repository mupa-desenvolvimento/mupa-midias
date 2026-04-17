/**
 * Mupa Cache — sistema de cache cache-first para WebView Android/iOS.
 * Inspirado no padrão TerminalPage.tsx.
 *
 * - IndexedDB (mupa-cache) como armazenamento principal de payloads JSON
 * - localStorage como fallback rápido e síncrono
 * - Cache API (caches.open) para arquivos estáticos (imagens/vídeos)
 *
 * API minimalista e segura para WebView (sem APIs experimentais).
 */

const DB_NAME = "mupa-cache";
const STORE = "kv";
const DB_VERSION = 1;
const CACHE_NAME = "mupa-static-v1";
const LS_PREFIX = "mupa-cache:";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

/** Lê do cache: tenta localStorage (rápido e síncrono via Promise) e IndexedDB. */
export async function readCache<T = unknown>(key: string): Promise<T | null> {
  // 1. localStorage (síncrono, mais rápido)
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    /* ignore */
  }

  // 2. IndexedDB
  try {
    const db = await openDB();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Salva em IndexedDB e replica em localStorage para leitura rápida. */
export async function writeCache(key: string, value: unknown): Promise<void> {
  // localStorage (best-effort, pode falhar por quota)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }

  // IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

/** Pré-carrega arquivos estáticos (imagens) no Cache API e via Image. */
export function prefetchAssets(urls: string[]): void {
  if (!urls?.length) return;

  const run = async () => {
    // Cache API (quando disponível)
    if (typeof caches !== "undefined") {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(
          urls.map(async (url) => {
            try {
              const match = await cache.match(url);
              if (!match) {
                await cache.add(url).catch(() => {});
              }
            } catch {
              /* ignore individual failures */
            }
          }),
        );
      } catch {
        /* ignore */
      }
    }

    // Fallback: warm-up via Image (não bloqueia)
    urls.forEach((url) => {
      try {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = url;
      } catch {
        /* ignore */
      }
    });
  };

  // Roda em idle para não bloquear UI/WebView
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run);
  } else {
    setTimeout(run, 0);
  }
}
