// face-api.js@0.20 imports `@tensorflow/tfjs-core` directly. We must use the
// SAME tfjs-core instance and register a backend on IT, otherwise
// `engine().backend` is undefined and kernels crash with
// "Cannot read properties of undefined (reading 'backend')".
import * as tfCore from '@tensorflow/tfjs-core';
// Importing these packages auto-registers the backends on tfCore.
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';

const tf: any = tfCore;

const FACE_API_BACKEND_ERROR_PATTERN =
  /backend|moveData|runWebGLProgram|webgl|context lost|texture/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

export const isBackendReady = (): boolean => {
  try {
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
    console.log('[TF] Available backends:', Object.keys((tf as any).engine().registryFactory ?? {}));

    // Try WebGL first, fallback to CPU
    let active = '';
    if (await trySetBackend('webgl')) {
      active = 'webgl';
    } else if (await trySetBackend('cpu')) {
      active = 'cpu';
    } else {
      throw new Error('Failed to initialize any TF backend (webgl/cpu)');
    }

    // Warmup
    try {
      const t = tf.tensor1d([1, 2, 3]);
      await t.data();
      t.dispose();
    } catch (err) {
      console.warn('[TF] Warmup failed, falling back to CPU:', err);
      if (active !== 'cpu' && (await trySetBackend('cpu'))) {
        active = 'cpu';
      }
    }

    console.log(`[TF] ✅ Backend ready: ${active}`);
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

export const initializeFaceApiBackend = async (): Promise<string> => initTensorFlow();

export const switchFaceApiToCpu = async (): Promise<string> => {
  await trySetBackend('cpu');
  initPromise = Promise.resolve('cpu');
  console.warn('[TF] 🔁 Switched to CPU backend');
  return 'cpu';
};
