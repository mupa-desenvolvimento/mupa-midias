// face-api.js@0.20 ships with its OWN nested @tensorflow/tfjs-core@1.0.3
// which bundles CPU + WebGL backends and auto-registers them.
// We must NOT install separate tfjs packages (that creates a duplicate engine).
// We just expose the bundled `tf` and call `tf.ready()`.
import * as faceapi from 'face-api.js';

const tf: any = (faceapi as any).tf;

const FACE_API_BACKEND_ERROR_PATTERN =
  /backend|moveData|runWebGLProgram|webgl|context lost|texture/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

const safeGetBackend = (): string => {
  try {
    return typeof tf?.getBackend === 'function' ? tf.getBackend() || '' : '';
  } catch {
    return '';
  }
};

export const isBackendReady = (): boolean => !!safeGetBackend();

const trySetBackend = async (name: string): Promise<boolean> => {
  try {
    if (typeof tf?.setBackend !== 'function') return false;
    await tf.setBackend(name);
    if (typeof tf.ready === 'function') await tf.ready();
    return safeGetBackend() === name;
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

    // tfjs-core 1.0.3 (bundled with face-api) auto-registers CPU + WebGL.
    // Just wait for it to be ready.
    if (typeof tf.ready === 'function') {
      await tf.ready();
    }

    let active = safeGetBackend();

    // If no backend yet, try webgl then cpu explicitly.
    if (!active) {
      if (await trySetBackend('webgl')) active = 'webgl';
      else if (await trySetBackend('cpu')) active = 'cpu';
    }

    if (!active) {
      throw new Error('No TF backend could be initialized');
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
