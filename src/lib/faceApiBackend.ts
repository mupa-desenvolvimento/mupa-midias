import * as faceapi from 'face-api.js';

const FACE_API_BACKEND_ERROR_PATTERN = /backend|moveData|runWebGLProgram|webgl|context lost/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

const getTf = (): any => (faceapi as any).tf;

const getCurrentBackendName = (tf: any): string | null => {
  try {
    const backend = tf?.getBackend?.();
    return typeof backend === 'string' && backend.length > 0 ? backend : null;
  } catch {
    return null;
  }
};

const getRegisteredBackendNames = (tf: any): string[] => {
  const registry = tf?.ENV?.registry ?? {};
  const registryFactory = tf?.ENV?.registryFactory ?? {};
  return Array.from(
    new Set(
      [
        ...Object.keys(registryFactory),
        ...Object.keys(registry),
        getCurrentBackendName(tf),
      ].filter((b): b is string => typeof b === 'string' && b.length > 0),
    ),
  );
};

const canUseBackend = (tf: any, name: string) => getRegisteredBackendNames(tf).includes(name);

const warmup = async () => {
  const dummy = document.createElement('canvas');
  dummy.width = 20;
  dummy.height = 20;
  await faceapi.detectAllFaces(dummy, new faceapi.TinyFaceDetectorOptions());
};

// ─────────────────────────────────────────────────────────────
// Singleton TF initialization — runs ONCE per app lifetime.
// Must be awaited BEFORE any model.loadFromUri() or detection.
// ─────────────────────────────────────────────────────────────
let initPromise: Promise<string> | null = null;

export const initTensorFlow = async (): Promise<string> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const tf = getTf();
    if (!tf?.setBackend) {
      console.warn('[TF] tfjs not exposed via faceapi.tf — skipping init');
      return 'unknown';
    }

    // Try WebGL first, fall back to CPU
    const candidates = ['webgl', 'cpu'].filter((b) => canUseBackend(tf, b));

    for (const name of candidates) {
      try {
        if (getCurrentBackendName(tf) !== name) {
          await Promise.resolve(tf.setBackend(name));
        }
        await tf.ready();
        const active = getCurrentBackendName(tf) ?? name;
        console.log(`[TF] ✅ Backend ready: ${active}`);
        return active;
      } catch (err) {
        console.warn(`[TF] Backend "${name}" failed, trying next:`, err);
        initPromise = null; // allow retry on next candidate cycle
      }
    }

    // Last-resort: just await ready() with whatever default
    try {
      await tf.ready();
    } catch {
      /* ignore */
    }
    return getCurrentBackendName(tf) ?? 'unknown';
  })();

  return initPromise;
};

// Backwards-compat: existing callers expect this. Now ensures TF is ready
// AND warms up face-api's first inference path.
export const initializeFaceApiBackend = async (_faceapiLib?: any): Promise<string> => {
  const backend = await initTensorFlow();
  try {
    await warmup();
  } catch (err) {
    console.warn('[TF] Warmup failed:', err);
  }
  return backend;
};

export const switchFaceApiToCpu = async (_faceapiLib?: any): Promise<string> => {
  const tf = getTf();
  if (!tf?.setBackend || !canUseBackend(tf, 'cpu')) {
    return getCurrentBackendName(tf) ?? 'unknown';
  }
  try {
    await Promise.resolve(tf.setBackend('cpu'));
    await tf.ready();
    initPromise = Promise.resolve('cpu');
    try {
      await warmup();
    } catch {
      /* ignore warmup errors on cpu */
    }
    console.warn('[TF] 🔁 Switched to CPU backend');
    return 'cpu';
  } catch (err) {
    console.error('[TF] Failed to switch to CPU:', err);
    return getCurrentBackendName(tf) ?? 'unknown';
  }
};
