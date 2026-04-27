import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import * as faceapi from "face-api.js";
import { Loader2, Camera, WifiOff, CheckCircle, AlertCircle } from "lucide-react";
import { initTensorFlow } from "@/lib/faceApiBackend";

const SUPABASE_URL = "https://bgcnvyoseexfmrynqbfb.supabase.co";

interface Detection {
  face_descriptor: number[];
  confidence: number;
  is_facing_camera: boolean;
  detected_at: string;
}

const DeviceDetector = () => {
  const { deviceCode } = useParams<{ deviceCode: string }>();
  const [searchParams] = useSearchParams();
  const deviceNickname = searchParams.get("nickname") || deviceCode;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionBufferRef = useRef<Detection[]>([]);

  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionCount, setDetectionCount] = useState(0);
  const [lastSentCount, setLastSentCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Carregar modelos face-api
  useEffect(() => {
    const loadModels = async () => {
      try {
        // CRITICAL: init TF backend BEFORE loading model weights
        await initTensorFlow();

        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        // Warm-up
        try {
          const dc = document.createElement('canvas'); dc.width = 20; dc.height = 20;
          await faceapi.detectAllFaces(dc, new faceapi.TinyFaceDetectorOptions());
        } catch { void 0; }

        setIsModelsLoaded(true);
        console.log("Modelos carregados com sucesso");
      } catch (error) {
        console.error("Erro ao carregar modelos:", error);
        setCameraError("Erro ao carregar modelos de detecção facial");
      }
    };
    loadModels();
  }, []);

  // Verificar se está olhando para câmera
  const isFacingCamera = (landmarks: faceapi.FaceLandmarks68): boolean => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    const leftEyeCenter = {
      x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
      y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length,
    };
    const rightEyeCenter = {
      x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
      y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length,
    };
    const noseTip = nose[3];
    const eyesMidpoint = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
    };

    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
    const horizontalOffset = Math.abs(noseTip.x - eyesMidpoint.x);
    const horizontalRatio = horizontalOffset / eyeDistance;

    const jawLeft = jaw[0];
    const jawRight = jaw[16];
    const jawWidth = Math.abs(jawRight.x - jawLeft.x);
    const noseToJawLeft = Math.abs(noseTip.x - jawLeft.x);
    const noseToJawRight = Math.abs(noseTip.x - jawRight.x);
    const asymmetry = Math.abs(noseToJawLeft - noseToJawRight) / jawWidth;

    return horizontalRatio < 0.15 && asymmetry < 0.25;
  };

  // Enviar detecções para o servidor
  const sendDetections = useCallback(async () => {
    if (detectionBufferRef.current.length === 0 || !deviceCode) return;

    const detectionsToSend = [...detectionBufferRef.current];
    detectionBufferRef.current = [];

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/device-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_serial: deviceCode,
          device_nickname: deviceNickname,
          detections: detectionsToSend,
        }),
      });

      if (response.ok) {
        setConnectionStatus("connected");
        setLastSentCount((prev) => prev + detectionsToSend.length);
        console.log(`Enviadas ${detectionsToSend.length} detecções`);
      } else {
        let errorMsg = `Status ${response.status}`;
        try {
          const cloned = response.clone();
          errorMsg = await cloned.text();
        } catch { /* body already consumed */ }
        console.error("Erro ao enviar:", errorMsg);
        setConnectionStatus("error");
      }
    } catch (error) {
      console.error("Erro de conexão com Supabase:", error);
      setConnectionStatus("error");
    }
  }, [deviceCode, deviceNickname]);

  // Enviar detecções a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(sendDetections, 5000);
    return () => clearInterval(interval);
  }, [sendDetections]);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Câmera não disponível");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsStreaming(true);
            console.log("Câmera iniciada");
          }).catch(console.error);
        };
      }
    } catch (error: any) {
      console.error("Erro na câmera:", error);
      setCameraError(error.message || "Erro ao acessar câmera");
    }
  }, [facingMode]);

  // Auto-iniciar câmera quando modelos carregarem
  useEffect(() => {
    if (isModelsLoaded && !isStreaming && !cameraError) {
      startCamera();
    }
  }, [isModelsLoaded, isStreaming, cameraError, startCamera]);

  // Detecção de rostos
  useEffect(() => {
    if (!isStreaming || !videoRef.current || !canvasRef.current) return;

    let animationId: number;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const detectFaces = async () => {
      if (!video || video.paused || video.ended) {
        animationId = requestAnimationFrame(detectFaces);
        return;
      }

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const detection of detections) {
          const landmarks = detection.landmarks;
          const facing = isFacingCamera(landmarks);

          if (facing) {
            // Adicionar ao buffer
            detectionBufferRef.current.push({
              face_descriptor: Array.from(detection.descriptor),
              confidence: detection.detection.score,
              is_facing_camera: true,
              detected_at: new Date().toISOString(),
            });
            setDetectionCount((prev) => prev + 1);

            // Desenhar retângulo verde
            const box = detection.detection.box;
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          } else {
            // Desenhar retângulo amarelo para rostos não frontais
            const box = detection.detection.box;
            ctx.strokeStyle = "#eab308";
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          }
        }
      }

      animationId = requestAnimationFrame(detectFaces);
    };

    detectFaces();
    return () => cancelAnimationFrame(animationId);
  }, [isStreaming]);

  // Alternar câmera
  const toggleCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsStreaming(false);
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  if (!deviceCode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center p-6">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-xl font-bold mb-2">Código do dispositivo não informado</h1>
          <p className="text-white/70">Use o formato: /detect/SEU_CODIGO</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Vídeo */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Canvas para desenhar detecções */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Loading */}
      {!isModelsLoaded && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p>Carregando modelos...</p>
          </div>
        </div>
      )}

      {/* Erro */}
      {cameraError && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-white p-6">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="mb-4">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-blue-600 rounded-lg"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <span className="font-medium">{deviceNickname}</span>
            <span className="text-white/50">({deviceCode})</span>
          </div>

          <div className="flex items-center gap-4">
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Conectado</span>
              </div>
            )}
            {connectionStatus === "error" && (
              <div className="flex items-center gap-1 text-red-400">
                <WifiOff className="w-4 h-4" />
                <span>Erro</span>
              </div>
            )}
            {connectionStatus === "connecting" && (
              <div className="flex items-center gap-1 text-yellow-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Conectando</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between text-white">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{detectionCount}</div>
            <div className="text-xs text-white/70">Detecções totais</div>
          </div>

          <button
            onClick={toggleCamera}
            className="p-3 bg-white/20 rounded-full backdrop-blur-sm"
          >
            <Camera className="w-6 h-6" />
          </button>

          <div className="space-y-1 text-right">
            <div className="text-2xl font-bold">{lastSentCount}</div>
            <div className="text-xs text-white/70">Enviadas</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetector;
