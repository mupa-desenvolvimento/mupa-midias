const FACE_API_BACKEND_ERROR_PATTERN = /backend|moveData|runWebGLProgram|webgl|context lost/i;

export const isFaceApiBackendError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`;
  return FACE_API_BACKEND_ERROR_PATTERN.test(text);
};

const warmupBackend = async (faceapiLib: any) => {
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = 20;
  dummyCanvas.height = 20;
  await faceapiLib.detectAllFaces(dummyCanvas, new faceapiLib.TinyFaceDetectorOptions());
};

export const initializeFaceApiBackend = async (faceapiLib: any) => {
  const tf = faceapiLib?.tf as any;

  if (!tf?.setBackend) {
    return 'unknown';
  }

  try {
    await tf.setBackend('webgl');
    if (typeof tf.ready === 'function') {
      await tf.ready();
    }
    await warmupBackend(faceapiLib);
    return tf.getBackend?.() ?? 'webgl';
  } catch (error) {
    console.warn('[FaceDetection] WebGL backend unavailable, switching to CPU:', error);
    await tf.setBackend('cpu');
    if (typeof tf.ready === 'function') {
      await tf.ready();
    }
    await warmupBackend(faceapiLib);
    return tf.getBackend?.() ?? 'cpu';
  }
};

export const switchFaceApiToCpu = async (faceapiLib: any) => {
  const tf = faceapiLib?.tf as any;

  if (!tf?.setBackend) {
    return 'unknown';
  }

  await tf.setBackend('cpu');
  if (typeof tf.ready === 'function') {
    await tf.ready();
  }
  await warmupBackend(faceapiLib);
  return tf.getBackend?.() ?? 'cpu';
};
