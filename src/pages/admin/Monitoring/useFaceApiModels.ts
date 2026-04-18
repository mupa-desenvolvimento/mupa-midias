import { useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { initTensorFlow } from "@/lib/faceApiBackend";

const MODELS_URL = "/models";

let loadPromise: Promise<void> | null = null;

const loadAll = async () => {
  console.log('[FaceAPI] Initializing TF backend...');
  await initTensorFlow();
  console.log('[FaceAPI] Loading models from', MODELS_URL);
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
    faceapi.nets.ageGenderNet.loadFromUri(MODELS_URL),
  ]);
  console.log('[FaceAPI] ✅ All models loaded');
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
