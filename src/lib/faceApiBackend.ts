import * as faceapi from 'face-api.js';

const FACE_API_BACKEND_ERROR_PATTERN = /backend|moveData|runWebGLProgram|webgl|context lost/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

const getTf = (): any => (faceapi as any).tf;

const waitForBackendStabilization = async (tf: any) => {
  if (typeof tf?.ready === 'function') {
    await tf.ready();
    return;
  }

  if (typeof tf?.nextFrame === 'function') {
    await tf.nextFrame();
    return;
  }

  await Promise.resolve();
};

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
  const tf = getTf();
  if (tf?.tensor1d) {
    // Use a simple TF operation instead of face-api detection to avoid "model not loaded" error
    // but still force backend initialization and context creation.
    const t = tf.tensor1d([1, 2, 3]);
    await t.data();
    t.dispose();
    console.log('[TF] Warmup successful');
  }
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

    // Set engine flags for stability
    if (tf.env) {
      tf.env().set('WEBGL_CPU_FORWARD', false);
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }

    const candidates = ['webgl', 'cpu'].filter((b) => canUseBackend(tf, b));

    for (const name of candidates) {
      try {
        if (getCurrentBackendName(tf) !== name) {
          await Promise.resolve(tf.setBackend(name));
        }

        // tf.ready() is more reliable for checking backend availability
        if (typeof tf.ready === 'function') {
          await tf.ready();
        } else {
          await waitForBackendStabilization(tf);
        }

        await warmup();

        const active = getCurrentBackendName(tf) ?? name;
        console.log(`[TF] ✅ Backend ready: ${active}`);
        return active;
      } catch (err) {
        console.warn(`[TF] Backend "${name}" failed, trying next:`, err);
      }
    }

    const fallback = getCurrentBackendName(tf) ?? 'unknown';
    console.warn(`[TF] ⚠️ Falling back to current backend: ${fallback}`);
    return fallback;
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
    await waitForBackendStabilization(tf);
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
