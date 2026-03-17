import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Camera as CameraIcon, Play, Square, Users, UserCheck, UserX, Settings, ArrowLeft, Maximize, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { usePeopleRegistry } from "@/hooks/usePeopleRegistry";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CameraFullscreen = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { registeredPeople } = usePeopleRegistry();
  
  const { 
    isModelsLoaded, 
    isLoading, 
    activeFaces,
    totalLooking,
    totalSessionsToday
  } = useFaceDetection(videoRef, canvasRef, isStreaming);

  // Enumerar câmeras disponíveis
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        // Solicitar permissão primeiro para obter labels das câmeras
        await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => stream.getTracks().forEach(track => track.stop()));
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        
        // Selecionar a primeira câmera por padrão
        if (videoDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Erro ao enumerar câmeras:", error);
      }
    };
    
    enumerateCameras();
  }, []);

  // Entrar em modo fullscreen com suporte amplo
  const enterFullscreen = async () => {
    try {
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      
      setIsFullscreen(true);
      toast({
        title: "Modo tela cheia",
        description: "Pressione ESC para sair",
      });
    } catch (error) {
      console.error("Erro ao entrar em fullscreen:", error);
      toast({
        title: "Erro",
        description: "Não foi possível entrar em tela cheia",
        variant: "destructive",
      });
    }
  };

  // Monitorar mudanças no estado fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenNow = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFullscreenNow);
    };

    // Adicionar todos os listeners de fullscreen
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);


  // Inicializar câmera
  const startCamera = useCallback(async () => {
    if (!isModelsLoaded) {
      toast({
        title: "Modelos carregando",
        description: "Aguarde o carregamento dos modelos de IA",
        variant: "destructive",
      });
      return;
    }

    try {
      setCameraError(null);
      
      // Verificar se a API de mídia está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("API de câmera não disponível neste navegador");
      }

      // Configurações com deviceId específico se selecionado
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId 
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
          : {
              facingMode: 'user',
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            },
        audio: false
      };

      console.log("Solicitando acesso à câmera:", selectedCameraId || "default");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Stream obtido:", stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Aguardar o vídeo estar pronto antes de marcar como streaming
        videoRef.current.onloadedmetadata = () => {
          console.log("Vídeo metadata carregado");
          videoRef.current?.play()
            .then(() => {
              console.log("Vídeo iniciado com sucesso");
              setIsStreaming(true);
              toast({
                title: "Câmera iniciada",
                description: "Sistema de reconhecimento ativo em tela cheia",
              });
            })
            .catch((playError) => {
              console.error("Erro ao reproduzir vídeo:", playError);
              // Tentar novamente com muted (necessário em alguns navegadores mobile)
              if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play()
                  .then(() => {
                    setIsStreaming(true);
                    toast({
                      title: "Câmera iniciada",
                      description: "Sistema de reconhecimento ativo",
                    });
                  })
                  .catch((e) => {
                    console.error("Falha ao reproduzir mesmo com muted:", e);
                    setCameraError("Não foi possível iniciar o vídeo. Toque na tela para tentar novamente.");
                  });
              }
            });
        };
      }
    } catch (error: any) {
      console.error("Erro ao acessar câmera:", error);
      
      let errorMessage = "Erro ao acessar a câmera.";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Permissão de câmera negada. Verifique as configurações do navegador.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = "Nenhuma câmera encontrada no dispositivo.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = "A câmera está sendo usada por outro aplicativo.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Configurações de câmera não suportadas.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setCameraError(errorMessage);
      
      toast({
        title: "Erro na câmera",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [isModelsLoaded, toast, selectedCameraId]);

  // Parar câmera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    
    toast({
      title: "Câmera parada",
      description: "Sistema de reconhecimento desativado",
    });
  }, [toast]);

  // Iniciar câmera automaticamente quando os modelos estiverem carregados
  useEffect(() => {
    if (isModelsLoaded && !isStreaming && !cameraError) {
      startCamera();
    }
  }, [isModelsLoaded, isStreaming, cameraError, startCamera]);

  const registeredFaces = activeFaces.filter(face => face.isRegistered);
  const unregisteredFaces = activeFaces.filter(face => !face.isRegistered);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      {/* Controles no canto superior esquerdo */}
      <div className="absolute top-4 left-4 z-50 flex space-x-2">
        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
          className="bg-black/50 text-white border-white/20 hover:bg-black/70"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        {/* Seleção de Câmera */}
        {cameras.length > 1 && (
          <Select
            value={selectedCameraId}
            onValueChange={setSelectedCameraId}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-[200px] bg-black/50 text-white border-white/20">
              <CameraIcon className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Selecionar câmera" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-[10000]">
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Câmera ${cameras.indexOf(camera) + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Controle de câmera no canto superior direito */}
      <div className="absolute top-4 right-4 z-50">
        {!isStreaming ? (
          <Button 
            onClick={startCamera} 
            disabled={isLoading || !isModelsLoaded}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            {isLoading ? "Carregando IA..." : "Iniciar Câmera"}
          </Button>
        ) : (
          <Button 
            variant="destructive" 
            onClick={stopCamera}
            className="bg-red-600 hover:bg-red-700"
          >
            <Square className="w-4 h-4 mr-2" />
            Parar Câmera
          </Button>
        )}
      </div>

      {/* Feed da câmera em tela cheia */}
      <div className="relative w-full h-full">
        {cameraError ? (
          <div className="flex items-center justify-center w-full h-full text-white">
            <div className="text-center">
              <CameraIcon className="w-24 h-24 mx-auto mb-8 opacity-50" />
              <h2 className="text-2xl font-bold mb-4">Erro na Câmera</h2>
              <p className="text-lg">{cameraError}</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </>
        )}
      </div>

      {/* Painel de informações no canto inferior direito */}
      {isStreaming && (
        <div className="absolute bottom-4 right-4 z-50 space-y-3 w-80 animate-fade-in">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-black/60 border-white/20">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-green-400">{registeredPeople.length}</div>
                <div className="text-xs text-white/80">Cadastradas</div>
              </CardContent>
            </Card>
            
            <Card className="bg-black/60 border-white/20">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-green-400">{registeredFaces.length}</div>
                <div className="text-xs text-white/80">Reconhecidas</div>
              </CardContent>
            </Card>
            
            <Card className="bg-black/60 border-white/20">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-orange-400">{unregisteredFaces.length}</div>
                <div className="text-xs text-white/80">Não cadastradas</div>
              </CardContent>
            </Card>
          </div>

          {/* Faces reconhecidas */}
          {registeredFaces.length > 0 && (
            <Card className="bg-black/60 border-green-500/30">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <UserCheck className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Reconhecidas</span>
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                    {registeredFaces.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {registeredFaces.slice(0, 3).map((face, index) => (
                    <div key={`reg-${face.trackId}-${index}`} className="text-xs text-white/90">
                      <div className="font-medium text-green-300">{face.name}</div>
                      <div className="text-white/60">
                        {face.cpf} • {(face.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="flex items-center space-x-1 text-yellow-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Olhando há {face.lookingDuration?.toFixed(1) || '0.0'}s</span>
                      </div>
                    </div>
                  ))}
                  {registeredFaces.length > 3 && (
                    <div className="text-xs text-white/60">
                      +{registeredFaces.length - 3} mais...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faces não cadastradas */}
          {unregisteredFaces.length > 0 && (
            <Card className="bg-black/60 border-orange-500/30">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <UserX className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">Não Cadastradas</span>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    {unregisteredFaces.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {unregisteredFaces.slice(0, 3).map((face, index) => (
                    <div key={`unreg-${face.trackId}-${index}`} className="text-xs text-white/90">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                          {face.gender}
                        </Badge>
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                          {face.age} anos
                        </Badge>
                      </div>
                      <div className="text-white/60 mt-1">
                        Confiança: {(face.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="flex items-center space-x-1 text-yellow-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Olhando há {face.lookingDuration?.toFixed(1) || '0.0'}s</span>
                      </div>
                    </div>
                  ))}
                  {unregisteredFaces.length > 3 && (
                    <div className="text-xs text-white/60">
                      +{unregisteredFaces.length - 3} mais...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status geral */}
          <Card className="bg-black/60 border-white/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Sessões hoje:</span>
                <span className="font-bold text-white">{totalSessionsToday}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/80 mt-1">
                <span>Status IA:</span>
                <Badge variant={isModelsLoaded ? "default" : "secondary"} className="text-xs">
                  {isLoading ? "Carregando..." : isModelsLoaded ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instruções quando não está streaming */}
      {!isStreaming && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <CameraIcon className="w-24 h-24 mx-auto mb-8 opacity-50" />
            <h2 className="text-3xl font-bold mb-4">Câmera em Tela Cheia</h2>
            <p className="text-lg text-white/80 mb-8">
              Clique em "Iniciar Câmera" para começar o reconhecimento facial
            </p>
            {isLoading && (
              <div className="text-lg text-yellow-400">
                Carregando modelos de IA...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFullscreen;