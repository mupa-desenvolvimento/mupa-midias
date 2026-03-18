// Type augmentation for face-api.js to fix missing type definitions
declare module 'face-api.js' {
  interface NeuralNetwork<TNetParams> {
    loadFromUri(uri: string): Promise<void>;
  }
  
  interface FaceDetection {
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    score: number;
  }
}
