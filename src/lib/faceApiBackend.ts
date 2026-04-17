const FACE_API_BACKEND_ERROR_PATTERN = /backend|moveData|runWebGLProgram|webgl|context lost/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

const getTensorflow = (faceapiLib: any) => faceapiLib?.tf as any;

const getCurrentBackendName = (tf: any) => {
  try {
    const backend = tf?.getBackend?.();
    return typeof backend === 'string' && backend.length > 0 ? backend : null;
  } catch {
    return null;
  }
};

const getRegisteredBackendNames = (tf: any) => {
  const registry = tf?.ENV?.registry ?? {};
  const registryFactory = tf?.ENV?.registryFactory ?? {};

  return Array.from(
    new Set([
      ...Object.keys(registryFactory),
      ...Object.keys(registry),
      getCurrentBackendName(tf),
    ].filter((backend): backend is string => typeof backend === 'string' && backend.length > 0)),
  );
};

const canUseBackend = (tf: any, backendName: string) => {
  return getRegisteredBackendNames(tf).includes(backendName);
};

const activateBackend = async (tf: any, backendName: string) => {
  const currentBackend = getCurrentBackendName(tf);

  if (currentBackend !== backendName) {
    await Promise.resolve(tf.setBackend(backendName));
  }

  if (typeof tf.ready === 'function') {
    await tf.ready();
  }

  return getCurrentBackendName(tf) ?? backendName;
};

const warmupBackend = async (faceapiLib: any) => {
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = 20;
  dummyCanvas.height = 20;
  await faceapiLib.detectAllFaces(dummyCanvas, new faceapiLib.TinyFaceDetectorOptions());
};

const tryWarmBackend = async (faceapiLib: any, backendName: string) => {
  const tf = getTensorflow(faceapiLib);

  if (!tf?.setBackend || !canUseBackend(tf, backendName)) {
    return null;
  }

  const activeBackend = await activateBackend(tf, backendName);
  await warmupBackend(faceapiLib);
  return activeBackend;
};

export const initializeFaceApiBackend = async (faceapiLib: any) => {
  const tf = getTensorflow(faceapiLib);

  if (!tf?.setBackend) {
    return 'unknown';
  }

  const currentBackend = getCurrentBackendName(tf);
  const candidates = Array.from(
    new Set(['webgl', currentBackend, 'cpu'].filter((backend): backend is string => !!backend)),
  );

  let lastError: unknown = null;

  for (const backendName of candidates) {
    if (!canUseBackend(tf, backendName)) {
      continue;
    }

    try {
      return (await tryWarmBackend(faceapiLib, backendName)) ?? backendName;
    } catch (error) {
      lastError = error;
      console.warn(`[FaceDetection] Backend "${backendName}" unavailable:`, error);
    }
  }

  try {
    if (typeof tf.ready === 'function') {
      await tf.ready();
    }
    await warmupBackend(faceapiLib);
    return getCurrentBackendName(tf) ?? 'unknown';
  } catch (error) {
    console.warn('[FaceDetection] TensorFlow backend initialization fallback failed:', error ?? lastError);
    return getCurrentBackendName(tf) ?? 'unknown';
  }
};

export const switchFaceApiToCpu = async (faceapiLib: any) => {
  const tf = getTensorflow(faceapiLib);

  if (!tf?.setBackend) {
    return 'unknown';
  }

  try {
    const cpuBackend = await tryWarmBackend(faceapiLib, 'cpu');
    if (cpuBackend) {
      return cpuBackend;
    }
  } catch (error) {
    console.warn('[FaceDetection] Failed to switch to CPU backend:', error);
  }

  return getCurrentBackendName(tf) ?? 'unknown';
};
