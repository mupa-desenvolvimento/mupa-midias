import * as faceapi from 'face-api.js';
import * as tfNs from '@tensorflow/tfjs';

// face-api.js@0.20 ships its own ancient tfjs-core (~1.7) bundled internally.
// On modern Chrome the WebGL backend frequently leaves `engine().backend`
// undefined, causing "Cannot read properties of undefined (reading 'backend')"
// inside moveData/runWebGLProgram. The fix: force CPU backend on BOTH the
// modern tfjs we imported AND on face-api's internal tf instance.
const tf: any = tfNs;
const faceapiTf: any = (faceapi as any).tf;

// Expose modern tf to face-api (best-effort; some bundles still use internal tf)
try {
  if (faceapiTf !== tf) {
    (faceapi as any).tf = tf;
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

const setBackendOn = async (instance: any, name: string) => {
  if (!instance?.setBackend) return false;
  try {
    await instance.setBackend(name);
    if (typeof instance.ready === 'function') await instance.ready();
    return instance.getBackend?.() === name;
  } catch (err) {
    console.warn(`[TF] setBackend(${name}) failed on instance:`, err);
    return false;
  }
};

let initPromise: Promise<string> | null = null;

export const initTensorFlow = async (): Promise<string> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Force CPU on BOTH instances. CPU is slower but reliable and avoids
    // the broken WebGL kernels in face-api's bundled tfjs-core@1.7.
    // Modern tfjs CPU is fast enough for ~5fps face detection.
    const backend = 'cpu';

    const okModern = await setBackendOn(tf, backend);
    if (faceapiTf && faceapiTf !== tf) {
      await setBackendOn(faceapiTf, backend);
    }

    if (!okModern) {
      throw new Error('Failed to initialize TF backend');
    }

    // Warmup
    try {
      const t = tf.tensor1d([1, 2, 3]);
      await t.data();
      t.dispose();
    } catch (err) {
      console.warn('[TF] Warmup failed:', err);
    }

    const active = tf.getBackend();
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
  await setBackendOn(tf, 'cpu');
  if (faceapiTf && faceapiTf !== tf) await setBackendOn(faceapiTf, 'cpu');
  initPromise = Promise.resolve('cpu');
  console.warn('[TF] 🔁 Switched to CPU backend');
  return 'cpu';
};
