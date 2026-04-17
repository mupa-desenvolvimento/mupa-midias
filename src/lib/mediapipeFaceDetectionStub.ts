// Empty stub for @mediapipe/face_detection.
// The package ships only a UMD bundle without ESM exports, which breaks
// rolldown/Vite. We don't use the mediapipe runtime (we use 'tfjs'), so this
// stub is aliased in vite.config.ts to satisfy the static import inside
// @tensorflow-models/face-detection.
export class FaceDetection {
  constructor(..._args: unknown[]) {
    throw new Error('[stub] @mediapipe/face_detection is not bundled; use runtime: "tfjs"');
  }
}
export default {};
