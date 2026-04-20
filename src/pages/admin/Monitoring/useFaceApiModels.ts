import { useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { initTensorFlow } from "@/lib/faceApiBackend";

const MODELS_URL = "/models";

let loadPromise: Promise<void> | null = null;

const loadAll = async () => {
  console.log('[FaceAPI] Initializing TF backend...');
  await initTensorFlow();
  
  const nets = faceapi.nets as any;
  const loaders: Promise<unknown>[] = [];
  
  if (!nets.tinyFaceDetector?.params) loaders.push(nets.tinyFaceDetector.loadFromUri(MODELS_URL));
  if (!nets.faceLandmark68Net?.params) loaders.push(nets.faceLandmark68Net.loadFromUri(MODELS_URL));
  if (!nets.faceExpressionNet?.params) loaders.push(nets.faceExpressionNet.loadFromUri(MODELS_URL));
  if (!nets.ageGenderNet?.params) loaders.push(nets.ageGenderNet.loadFromUri(MODELS_URL));

  if (loaders.length > 0) {
    console.log(`[FaceAPI] Loading ${loaders.length} models from ${MODELS_URL}`);
    await Promise.all(loaders);
    console.log('[FaceAPI] ✅ Models loaded');
  } else {
    console.log('[FaceAPI] ✅ Models already loaded');
  }
};

export const useFaceApiModels = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!loadPromise) loadPromise = loadAll();

    loadPromise
      .then(() => !cancelled && setReady(true))
      .catch((err) => {
        console.error("[Monitoring] failed to load models", err);
        if (!cancelled) setError(err?.message ?? "Falha ao carregar modelos");
        loadPromise = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
};
