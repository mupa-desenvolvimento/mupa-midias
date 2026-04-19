// face-api.js@0.20 bundles its OWN copy of @tensorflow/tfjs-core. Importing
// a separate @tensorflow/tfjs-core (or backends) creates a DIFFERENT engine,
// and any backend we register goes to the wrong instance — face-api ends up
// with `engine().backend === undefined` and crashes on moveData/runWebGLProgram.
//
// Solution: use ONLY the `tf` instance that face-api ships with (`faceapi.tf`).
// face-api includes the CPU backend by default, so it just works.
import * as faceapi from 'face-api.js';

const tf: any = (faceapi as any).tf;

const FACE_API_BACKEND_ERROR_PATTERN =
  /backend|moveData|runWebGLProgram|webgl|context lost|texture/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

export const isBackendReady = (): boolean => {
  try {
    if (!tf?.engine) return false;
    const engine = tf.engine();
    return !!engine?.backend && !!tf.getBackend();
  } catch {
    return false;
  }
};

const trySetBackend = async (name: string): Promise<boolean> => {
  try {
    const ok = await tf.setBackend(name);
    if (!ok) return false;
    await tf.ready();
    return tf.getBackend() === name;
  } catch (err) {
    console.warn(`[TF] setBackend(${name}) failed:`, err);
    return false;
  }
};

let initPromise: Promise<string> | null = null;

export const initTensorFlow = async (): Promise<string> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!tf) {
      throw new Error('face-api.js did not expose its bundled tf instance');
    }

    const registry = (tf as any).engine().registryFactory ?? {};
    const available = Object.keys(registry);
    console.log('[TF] face-api bundled backends available:', available);

    // Try webgl first if available, fallback to cpu (always present in face-api).
    let active = '';
    if (available.includes('webgl') && (await trySetBackend('webgl'))) {
      active = 'webgl';
    } else if (await trySetBackend('cpu')) {
      active = 'cpu';
    } else {
      // Last resort — wait for tf to be ready and use whatever backend it has
      await tf.ready();
      active = tf.getBackend() || '';
      if (!active) throw new Error('No TF backend could be initialized');
    }

    // Warmup
    try {
      const t = tf.tensor1d([1, 2, 3]);
      await t.data();
      t.dispose();
    } catch (err) {
      console.warn('[TF] Warmup failed, retrying CPU:', err);
      if (active !== 'cpu' && (await trySetBackend('cpu'))) active = 'cpu';
    }

    console.log(`[TF] ✅ face-api backend ready: ${active}`);
    return active;
  })();

  return initPromise.catch((err) => {
    initPromise = null;
    throw err;
  });
};

export const ensureBackendReady = async (): Promise<boolean> => {
  if (isBackendReady()) return true;
  try {
    initPromise = null;
    await initTensorFlow();
    return isBackendReady();
  } catch (err) {
    console.error('[TF] ensureBackendReady failed:', err);
    return false;
  }
};

export const initializeFaceApiBackend = async (_faceapi?: unknown): Promise<string> => initTensorFlow();

export const switchFaceApiToCpu = async (_faceapi?: unknown): Promise<string> => {
  await trySetBackend('cpu');
  initPromise = Promise.resolve('cpu');
  console.warn('[TF] 🔁 Switched face-api to CPU backend');
  return 'cpu';
};
