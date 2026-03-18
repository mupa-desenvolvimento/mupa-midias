import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, RotateCcw, CheckCircle2, AlertCircle, User, Sparkles } from 'lucide-react';
// @ts-ignore - face-api.js types
import * as faceapi from 'face-api.js';
import { cn } from '@/lib/utils';

interface FaceCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  onCapture: (captures: FaceCaptureData[]) => void;
  requiredCaptures?: number;
  onQualityChange?: (quality: FaceQuality | null) => void;
  onCountdownChange?: (countdown: number | null) => void;
  onModelLoad?: (loaded: boolean) => void;
}

export interface FaceCaptureData {
  descriptor: Float32Array;
  photoDataUrl: string;
  quality: number;
  age: number;
  gender: string;
  genderConfidence: number;
}

export interface FaceQuality {
  score: number;
  isCentered: boolean;
  isFacingCamera: boolean;
  hasGoodLighting: boolean;
  isCorrectSize: boolean;
}

export const FaceCapture = ({ 
  videoRef, 
  isStreaming, 
  onCapture, 
  requiredCaptures = 3,
  onQualityChange,
  onCountdownChange,
  onModelLoad
}: FaceCaptureProps) => {
  const [captures, setCaptures] = useState<FaceCaptureData[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<FaceQuality | null>(null);
  const [faceInfo, setFaceInfo] = useState<{ age: number; gender: string; confidence: number } | null>(null);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Use CDN for consistency with useFaceDetection
        const modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        const nets = faceapi.nets as any;
        await Promise.all([
          nets.tinyFaceDetector.loadFromUri(modelPath),
          nets.faceLandmark68Net.loadFromUri(modelPath),
          nets.faceRecognitionNet.loadFromUri(modelPath),
          nets.ageGenderNet.loadFromUri(modelPath)
        ]);
        setModelLoaded(true);
        onModelLoad?.(true);
      } catch (error) {
        console.error('Failed to load face-api models:', error);
        setModelError(true);
      }
    };
    loadModels();
  }, [onModelLoad]);

  const analyzeFaceQuality = useCallback((
    detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>,
    videoWidth: number,
    videoHeight: number
  ): FaceQuality => {
    const box = (detection.detection as any).box;
    const landmarks = detection.landmarks;
    
    // Verificar se face está centralizada (centro da face deve estar perto do centro do vídeo)
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const videoCenterX = videoWidth / 2;
    const videoCenterY = videoHeight / 2;
    
    const horizontalOffset = Math.abs(faceCenterX - videoCenterX) / videoWidth;
    const verticalOffset = Math.abs(faceCenterY - videoCenterY) / videoHeight;
    const isCentered = horizontalOffset < 0.2 && verticalOffset < 0.2;
    
    // Verificar tamanho da face (deve ocupar entre 20% e 60% da largura)
    const faceWidthRatio = box.width / videoWidth;
    const isCorrectSize = faceWidthRatio >= 0.15 && faceWidthRatio <= 0.7;
    
    // Verificar se está olhando para frente usando landmarks
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    
    const leftEyeCenter = leftEye.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    leftEyeCenter.x /= leftEye.length;
    leftEyeCenter.y /= leftEye.length;
    
    const rightEyeCenter = rightEye.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    rightEyeCenter.x /= rightEye.length;
    rightEyeCenter.y /= rightEye.length;
    
    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
    const noseToLeftEye = Math.abs(nose[3].x - leftEyeCenter.x);
    const noseToRightEye = Math.abs(nose[3].x - rightEyeCenter.x);
    const noseSymmetry = Math.abs(noseToLeftEye - noseToRightEye) / eyeDistance;
    
    const isFacingCamera = noseSymmetry < 0.3;
    
    // Iluminação baseada no score de detecção
    const detectionScore = (detection.detection as any).score;
    const hasGoodLighting = detectionScore > 0.8;
    
    // Calcular score geral
    let score = 0;
    if (isCentered) score += 25;
    if (isFacingCamera) score += 30;
    if (hasGoodLighting) score += 25;
    if (isCorrectSize) score += 20;
    
    // Ajustar baseado na proximidade dos ideais
    score += (1 - horizontalOffset) * 10;
    score += (1 - noseSymmetry) * 10;
    
    return {
      score: Math.min(100, Math.max(0, score)),
      isCentered,
      isFacingCamera,
      hasGoodLighting,
      isCorrectSize
    };
  }, []);

  // Notificar pai sobre mudanças de qualidade
  useEffect(() => {
    onQualityChange?.(currentQuality);
  }, [currentQuality, onQualityChange]);

  // Notificar pai sobre mudanças de countdown
  useEffect(() => {
    onCountdownChange?.(countdown);
  }, [countdown, onCountdownChange]);

  // Detectar face continuamente
  useEffect(() => {
    if (!isStreaming || !videoRef.current || !modelLoaded) {
      setCurrentQuality(null);
      setFaceInfo(null);
      return;
    }

    let animationId: number;
    let lastDetection = 0;

    const detectFace = async (timestamp: number) => {
      if (!videoRef.current || isDetecting) {
        animationId = requestAnimationFrame(detectFace);
        return;
      }

      // Detectar a cada 200ms
      if (timestamp - lastDetection < 200) {
        animationId = requestAnimationFrame(detectFace);
        return;
      }
      lastDetection = timestamp;

      setIsDetecting(true);
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new (faceapi as any).TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor()
          .withAgeAndGender();

        if (detection) {
          const quality = analyzeFaceQuality(
            detection,
            videoRef.current.videoWidth || 640,
            videoRef.current.videoHeight || 480
          );
          setCurrentQuality(quality);
          
          const detectedGender = detection.gender === 'female' ? 'feminino' : 
                                detection.gender === 'male' ? 'masculino' : 'indefinido';
          
          setFaceInfo({
            age: Math.round(detection.age),
            gender: detectedGender,
            confidence: Math.max(detection.genderProbability, 1 - detection.genderProbability)
          });
        } else {
          setCurrentQuality(null);
          setFaceInfo(null);
        }
      } catch (error) {
        console.error('Erro na detecção:', error);
      } finally {
        setIsDetecting(false);
      }

      animationId = requestAnimationFrame(detectFace);
    };

    animationId = requestAnimationFrame(detectFace);
    return () => cancelAnimationFrame(animationId);
  }, [isStreaming, videoRef, isDetecting, analyzeFaceQuality]);

  // Auto-captura quando qualidade é boa
  useEffect(() => {
    if (!isAutoCapturing || !currentQuality || captures.length >= requiredCaptures) {
      return;
    }

    const now = Date.now();
    // Throttle captures (minimum 800ms between captures)
    if (now - lastCaptureTimeRef.current < 800) return;

    // Se qualidade perfeita (100%), capturar imediatamente
    if (currentQuality.score >= 100) {
      capturePhoto();
      setCountdown(null);
      return;
    }

    // Se qualidade excelente, iniciar countdown curto para estabilização
    // O usuário quer "Posicione e mantenha parado" -> "Perfeito" -> Captura
    if (currentQuality.score >= 80 && countdown === null) {
      setCountdown(2); // 2 segundos de estabilização
    } else if (currentQuality.score < 60) {
      setCountdown(null); // Reset se perder qualidade
    }
  }, [currentQuality, isAutoCapturing, captures.length, requiredCaptures, countdown]);

  // Countdown para captura
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Capturar quando countdown chegar a 0
  useEffect(() => {
    if (countdown === 0) {
      capturePhoto();
      setCountdown(null);
    }
  }, [countdown]);

  const capturePhoto = async () => {
    if (!videoRef.current || !captureCanvasRef.current) return;

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withAgeAndGender();

      if (!detection) return;

      const canvas = captureCanvasRef.current;
      const video = videoRef.current;
      
      // Capturar apenas a região da face com margem
      const box = (detection.detection as any).box;
      const margin = box.width * 0.4;
      const x = Math.max(0, box.x - margin);
      const y = Math.max(0, box.y - margin);
      const width = Math.min(video.videoWidth - x, box.width + margin * 2);
      const height = Math.min(video.videoHeight - y, box.height + margin * 2);
      
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, x, y, width, height, 0, 0, 200, 200);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        const quality = analyzeFaceQuality(
          detection,
          video.videoWidth,
          video.videoHeight
        );

        const detectedGender = detection.gender === 'female' ? 'feminino' : 
                              detection.gender === 'male' ? 'masculino' : 'indefinido';

        const newCapture: FaceCaptureData = {
          descriptor: detection.descriptor,
          photoDataUrl,
          quality: quality.score,
          age: Math.round(detection.age),
          gender: detectedGender,
          genderConfidence: Math.max(detection.genderProbability, 1 - detection.genderProbability)
        };

        const newCaptures = [...captures, newCapture];
        setCaptures(newCaptures);

        if (newCaptures.length >= requiredCaptures || quality.score >= 100) {
          setIsAutoCapturing(false);
          onCapture(newCaptures);
        }
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
    }
  };

  const startAutoCapture = () => {
    setCaptures([]);
    setIsAutoCapturing(true);
  };

  const removeCapture = (index: number) => {
    setCaptures(captures.filter((_, i) => i !== index));
  };

  const resetCaptures = () => {
    setCaptures([]);
    setIsAutoCapturing(false);
    setCountdown(null);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      <canvas ref={captureCanvasRef} className="hidden" />
      
      {/* Fotos capturadas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Capturas: {captures.length} / {requiredCaptures}
          </span>
          {captures.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetCaptures}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reiniciar
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          {Array.from({ length: requiredCaptures }).map((_, index) => (
            <div 
              key={index}
              className={cn(
                "relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all",
                captures[index] 
                  ? "border-green-500" 
                  : index === captures.length && isAutoCapturing
                    ? "border-primary animate-pulse"
                    : "border-dashed border-muted-foreground/30"
              )}
            >
              {captures[index] ? (
                <>
                  <img 
                    src={captures[index].photoDataUrl} 
                    alt={`Captura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeCapture(index)}
                    className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                  >
                    Remover
                  </button>
                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-1",
                    getQualityBgColor(captures[index].quality)
                  )} />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                  <Camera className="w-6 h-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-2">
        {captures.length < requiredCaptures ? (
          isAutoCapturing ? (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setIsAutoCapturing(false)}
            >
              Pausar Captura
            </Button>
          ) : (
            <Button 
              className="flex-1"
              onClick={startAutoCapture}
              disabled={!isStreaming || !currentQuality}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {captures.length === 0 ? 'Iniciar Captura Automática' : 'Continuar Captura'}
            </Button>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Capturas completas!</span>
          </div>
        )}
        
        {!isAutoCapturing && currentQuality && captures.length < requiredCaptures && (
          <Button 
            variant="secondary"
            onClick={capturePhoto}
          >
            <Camera className="w-4 h-4 mr-2" />
            Capturar Manual
          </Button>
        )}
      </div>
    </div>
  );
};
