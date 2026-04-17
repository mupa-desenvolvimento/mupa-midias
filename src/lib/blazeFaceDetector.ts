/**
 * BlazeFace fast pre-detector built on @tensorflow-models/face-detection
 * (MediaPipe runtime). Used as a lightweight gating step before running the
 * heavier face-api.js pipeline (landmarks + age/gender/emotion/descriptor).
 *
 * Public API is intentionally minimal so it can be swapped or removed without
 * touching consumers:
 *   - ensureBlazeFaceDetector(): Promise<Detector | null>
 *   - quickDetectFaces(input): Promise<BlazeBox[]>  (returns [] on any failure)
 */
import * as faceDetection from '@tensorflow-models/face-detection';

export interface BlazeBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

type Detector = faceDetection.FaceDetector;

let detectorPromise: Promise<Detector | null> | null = null;
let lastFailureAt = 0;
const FAILURE_COOLDOWN_MS = 30_000;

export const ensureBlazeFaceDetector = async (): Promise<Detector | null> => {
  // If we recently failed (e.g. mediapipe assets blocked), back off for a bit.
  if (!detectorPromise && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return null;
  }

  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        // Use tfjs runtime (no @mediapipe/face_detection npm dep required;
        // model assets are fetched from tfhub at runtime).
        const detector = await faceDetection.createDetector(model, {
          runtime: 'tfjs',
          modelType: 'short',
          maxFaces: 5,
        });
        return detector;
      } catch (error) {
        console.warn('[BlazeFace] Failed to initialize, falling back silently:', error);
        lastFailureAt = Date.now();
        detectorPromise = null;
        return null;
      }
    })();
  }

  return detectorPromise;
};

export const quickDetectFaces = async (
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<BlazeBox[]> => {
  const detector = await ensureBlazeFaceDetector();
  if (!detector) return [];

  try {
    const faces = await detector.estimateFaces(input, { flipHorizontal: false });
    return faces.map((f) => ({
      x: f.box.xMin,
      y: f.box.yMin,
      width: f.box.width,
      height: f.box.height,
      score: (f as any).score?.[0] ?? undefined,
    }));
  } catch (error) {
    console.warn('[BlazeFace] estimateFaces failed:', error);
    return [];
  }
};

export const disposeBlazeFaceDetector = async () => {
  if (!detectorPromise) return;
  try {
    const detector = await detectorPromise;
    detector?.dispose();
  } catch {
    // ignore
  }
  detectorPromise = null;
};
