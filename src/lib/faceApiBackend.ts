import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';

// CRITICAL: face-api.js@0.20 ships an ancient tfjs-core (~1.7) that frequently
// leaves `engine().backend === undefined` on modern Chrome. We replace its
// internal tf reference with a modern tfjs build BEFORE any model load/inference.
// See: https://github.com/justadudewhohacks/face-api.js/issues/737
try {
  // @ts-expect-error - intentional monkey-patch
  if (faceapi.tf !== tf) {
    // @ts-expect-error
    faceapi.tf = tf;
  }
} catch (err) {
  console.warn('[TF] Could not patch faceapi.tf:', err);
}

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

let initPromise: Promise<string> | null = null;

export const initTensorFlow = async (): Promise<string> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Try webgl first, fall back to cpu
    for (const name of ['webgl', 'cpu']) {
      try {
        await tf.setBackend(name);
        await tf.ready();
        // Warmup with a tiny op to force backend init
        const t = tf.tensor1d([1, 2, 3]);
        await t.data();
        t.dispose();
        const active = tf.getBackend();
        console.log(`[TF] ✅ Backend ready: ${active}`);
        return active;
      } catch (err) {
        console.warn(`[TF] Backend "${name}" failed:`, err);
      }
    }
    throw new Error('No TF backend available');
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

export const initializeFaceApiBackend = async (): Promise<string> => {
  return initTensorFlow();
};

export const switchFaceApiToCpu = async (): Promise<string> => {
  try {
    await tf.setBackend('cpu');
    await tf.ready();
    initPromise = Promise.resolve('cpu');
    console.warn('[TF] 🔁 Switched to CPU backend');
    return 'cpu';
  } catch (err) {
    console.error('[TF] Failed to switch to CPU:', err);
    return tf.getBackend() ?? 'unknown';
  }
};
