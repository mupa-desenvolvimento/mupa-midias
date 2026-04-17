/**
 * BlazeFace fast pre-detector — currently a no-op stub.
 *
 * The TensorFlow.js BlazeFace integration was rolled back due to bundler
 * conflicts between @tensorflow-models/face-detection (which needs newer
 * tfjs-core/converter) and face-api.js (which pins older versions).
 *
 * This file keeps the same public API so consumers (useFaceDetection) don't
 * change. When `quickDetectFaces` returns `[]` and `ensureBlazeFaceDetector`
 * returns `null`, the consumer falls back to running face-api.js directly
 * — preserving full age/gender/emotion analysis.
 */

export interface BlazeBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export const ensureBlazeFaceDetector = async (): Promise<null> => null;

export const quickDetectFaces = async (
  _input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<BlazeBox[]> => [];

export const disposeBlazeFaceDetector = async () => {
  /* no-op */
};
