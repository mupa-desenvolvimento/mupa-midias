import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera as CameraIcon,
  Users,
  Play,
  Square,
  Eye,
  Clock,
  Smile,
  BarChart3,
  Activity,
  Target,
  Zap,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFaceDetection, EmotionType, ActiveFace } from "@/hooks/useFaceDetection";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegistrationDialog } from "@/components/RegistrationDialog";
import { TutorialGuide } from "@/components/TutorialGuide";

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface DetectionRecord {
  id: string;
  timestamp: Date;
  gender: string;
  age: number;
  ageGroup: string;
  emotion: EmotionType;
  emotionConfidence: number;
  attentionDuration: number;
  isRegistered: boolean;
}

interface EmotionStats {
  emotion: EmotionType;
  count: number;
  percentage: number;
}

interface GenderStats {
  gender: string;
  count: number;
  percentage: number;
}

interface AgeStats {
  ageGroup: string;
  count: number;
  percentage: number;
}

const DeviceDemo = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [detectionHistory, setDetectionHistory] = useState<DetectionRecord[]>([]);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousFacesRef = useRef<Set<string>>(new Set());

  const { toast } = useToast();

  const { isModelsLoaded, isLoading, activeFaces, totalLooking } = useFaceDetection(
    videoRef,
    canvasRef,
    isStreaming,
  );

  // Track when faces leave the frame to record them
  useEffect(() => {
    const currentFaceIds = new Set(activeFaces.map((f) => f.trackId));
    const previousFaceIds = previousFacesRef.current;

    previousFaceIds.forEach((trackId) => {
      if (!currentFaceIds.has(trackId)) {
        const face = activeFaces.find((f) => f.trackId === trackId);
        if (face && face.lookingDuration >= 1) {
          const record: DetectionRecord = {
            id: `${trackId}_${Date.now()}`,
            timestamp: new Date(),
            gender: face.gender,
            age: face.age,
            ageGroup: face.ageGroup,
            emotion: face.emotion.emotion,
            emotionConfidence: face.emotion.confidence,
            attentionDuration: face.lookingDuration,
            isRegistered: face.isRegistered,
          };
          setDetectionHistory((prev) => [record, ...prev].slice(0, 50));
        }
      }
    });

    activeFaces.forEach((face) => {
      if (!previousFaceIds.has(face.trackId) && face.lookingDuration >= 0.5) {
        const record: DetectionRecord = {
          id: `${face.trackId}_${Date.now()}`,
          timestamp: new Date(),
          gender: face.gender,
          age: face.age,
          ageGroup: face.ageGroup,
          emotion: face.emotion.emotion,
          emotionConfidence: face.emotion.confidence,
          attentionDuration: face.lookingDuration,
          isRegistered: face.isRegistered,
        };
        setDetectionHistory((prev) => {
          if (prev.some((r) => r.id.startsWith(face.trackId))) return prev;
          return [record, ...prev].slice(0, 50);
        });
      }
    });

    previousFacesRef.current = currentFaceIds;
  }, [activeFaces]);

  // List cameras
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Câmera ${index + 1}`,
          }));

        setCameras(videoInputs);
        if (videoInputs.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error("Erro ao enumerar câmeras:", error);
      }
    };

    enumerateCameras();
  }, []);

  const calculateStats = () => {
    const allRecords = [...detectionHistory];

    activeFaces.forEach((face) => {
      if (!allRecords.some((r) => r.id.startsWith(face.trackId))) {
        allRecords.push({
          id: face.trackId,
          timestamp: new Date(),
          gender: face.gender,
          age: face.age,
          ageGroup: face.ageGroup,
          emotion: face.emotion.emotion,
          emotionConfidence: face.emotion.confidence,
          attentionDuration: face.lookingDuration,
          isRegistered: face.isRegistered,
        });
      }
    });

    if (allRecords.length === 0) {
      return { emotions: [], genders: [], ages: [], avgAttention: 0, totalViews: 0 };
    }

    const emotionCounts: Record<EmotionType, number> = {
      neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0,
    };
    allRecords.forEach((r) => emotionCounts[r.emotion]++);
    const emotions: EmotionStats[] = Object.entries(emotionCounts)
      .filter(([_, count]) => count > 0)
      .map(([emotion, count]) => ({
        emotion: emotion as EmotionType,
        count,
        percentage: (count / allRecords.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const genderCounts: Record<string, number> = { masculino: 0, feminino: 0, indefinido: 0 };
    allRecords.forEach((r) => genderCounts[r.gender]++);
    const genders: GenderStats[] = Object.entries(genderCounts)
      .filter(([_, count]) => count > 0)
      .map(([gender, count]) => ({
        gender,
        count,
        percentage: (count / allRecords.length) * 100,
      }));

    const ageCounts: Record<string, number> = {};
    allRecords.forEach((r) => {
      ageCounts[r.ageGroup] = (ageCounts[r.ageGroup] || 0) + 1;
    });
    const ages: AgeStats[] = Object.entries(ageCounts)
      .map(([ageGroup, count]) => ({
        ageGroup,
        count,
        percentage: (count / allRecords.length) * 100,
      }))
      .sort((a, b) => a.ageGroup.localeCompare(b.ageGroup));

    const avgAttention =
      allRecords.reduce((sum, r) => sum + r.attentionDuration, 0) / allRecords.length;

    return { emotions, genders, ages, avgAttention, totalViews: allRecords.length };
  };

  const stats = calculateStats();

  const startCamera = async (retryCount = 0) => {
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
      const constraints: MediaStreamConstraints = {
        video: {
          width: 1280,
          height: 720,
          ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "user" }),
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setSessionStart(new Date());
        setDetectionHistory([]);

        toast({
          title: "Demo iniciada",
          description: "Sistema de coleta de dados ativo",
        });
      }
    } catch (error: any) {
      console.error("Erro ao acessar câmera:", error);

      if (retryCount < 3 && (error.name === "NotReadableError" || error.name === "TrackStartError")) {
        setTimeout(() => startCamera(retryCount + 1), 500);
        return;
      }

      let errorMessage = "Erro ao acessar a câmera. Verifique as permissões.";
      if (error.name === "NotAllowedError") errorMessage = "Permissão de câmera negada.";
      if (error.name === "NotFoundError") errorMessage = "Câmera não encontrada.";
      if (error.name === "NotReadableError") errorMessage = "A câmera está em uso por outro aplicativo.";

      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);

    toast({
      title: "Demo encerrada",
      description: `${stats.totalViews} visualizações registradas`,
    });
  };

  const getEmotionEmoji = (emotion: EmotionType): string => {
    const emotionEmojis: Record<EmotionType, string> = {
      neutral: "😐", happy: "😊", sad: "😢", angry: "😠",
      fearful: "😨", disgusted: "🤢", surprised: "😲",
    };
    return emotionEmojis[emotion] || "😐";
  };

  const getEmotionLabel = (emotion: EmotionType): string => {
    const emotionLabels: Record<EmotionType, string> = {
      neutral: "Neutro", happy: "Feliz", sad: "Triste", angry: "Irritado",
      fearful: "Medo", disgusted: "Nojo", surprised: "Surpreso",
    };
    return emotionLabels[emotion] || "Neutro";
  };

  const getEmotionColor = (emotion: EmotionType): string => {
    const colors: Record<EmotionType, string> = {
      neutral: "bg-gray-500", happy: "bg-green-500", sad: "bg-blue-500",
      angry: "bg-red-500", fearful: "bg-purple-500", disgusted: "bg-yellow-600",
      surprised: "bg-orange-500",
    };
    return colors[emotion] || "bg-gray-500";
  };

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case "masculino": return "bg-blue-500";
      case "feminino": return "bg-pink-500";
      default: return "bg-gray-500";
    }
  };

  const getAgeGroupColor = (ageGroup: string) => {
    switch (ageGroup) {
      case "0-12": return "bg-green-500";
      case "13-18": return "bg-yellow-500";
      case "19-25": return "bg-orange-500";
      case "26-35": return "bg-red-500";
      case "36-50": return "bg-purple-500";
      case "51+": return "bg-indigo-500";
      default: return "bg-gray-500";
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getSessionDuration = () => {
    if (!sessionStart) return "00:00";
    const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, "0");
    const secs = (diff % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* ===== Header ===== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="w-6 h-6 text-primary" />
            Demo de Coleta de Audiência
          </h1>
          <p className="text-sm text-muted-foreground">
            Demonstração em tempo real do sistema de análise facial e métricas de audiência.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedCameraId}
            onValueChange={setSelectedCameraId}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Selecionar câmera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => {
              if (isStreaming) stopCamera();
              setIsRegistrationOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Cadastrar</span>
          </Button>

          {!isStreaming ? (
            <Button
              onClick={() => startCamera()}
              size="sm"
              className="h-9"
              disabled={isLoading || !isModelsLoaded}
            >
              <Play className="w-4 h-4 mr-2" />
              {isLoading ? "Carregando..." : "Iniciar Demo"}
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={stopCamera} className="h-9">
              <Square className="w-4 h-4 mr-2" />
              Encerrar
            </Button>
          )}
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <section aria-labelledby="kpi-title" className="space-y-3">
        <h2 id="kpi-title" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Resumo da Sessão
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Olhando Agora" value={String(totalLooking)} icon={<Eye className="w-4 h-4" />} accent="text-green-500" />
          <KpiCard label="Total Detectado" value={String(stats.totalViews)} icon={<Users className="w-4 h-4" />} accent="text-blue-500" />
          <KpiCard label="Atenção Média" value={`${stats.avgAttention.toFixed(1)}s`} icon={<Target className="w-4 h-4" />} accent="text-purple-500" />
          <KpiCard label="Duração Sessão" value={getSessionDuration()} icon={<Clock className="w-4 h-4" />} accent="text-orange-500" />
          <KpiCard
            label="Status IA"
            value={isLoading ? "Carregando" : isModelsLoaded ? "Ativo" : "Erro"}
            icon={<Zap className="w-4 h-4" />}
            accent={isModelsLoaded ? "text-cyan-500" : "text-yellow-500"}
          />
        </div>
      </section>

      {/* ===== Main Grid: Camera + Active Faces ===== */}
      <section aria-labelledby="live-title" className="space-y-3">
        <h2 id="live-title" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Captura ao Vivo
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Camera Feed (2/3) */}
          <Card className="lg:col-span-2 overflow-hidden bg-black border-0 relative">
            <CardHeader className="p-3 pb-2 absolute top-0 left-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent">
              <CardTitle className="flex items-center gap-2 text-white text-sm">
                <CameraIcon className="w-4 h-4" />
                Feed da Câmera
                {isStreaming && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px] animate-pulse">
                    AO VIVO
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <div className="relative aspect-video bg-black">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center p-4">
                    <CameraIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{cameraError}</p>
                  </div>
                </div>
              ) : !isStreaming ? (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center p-4">
                    <CameraIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium">Câmera Pausada</p>
                    <p className="text-xs text-white/60 mt-1">Clique em "Iniciar Demo" para começar.</p>
                  </div>
                </div>
              ) : null}
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
            </div>
          </Card>

          {/* Active Faces (1/3) */}
          <Card className="flex flex-col max-h-[500px]">
            <CardHeader className="p-3 pb-2 shrink-0 border-b">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-green-500" />
                Pessoas Detectadas
                <Badge variant="outline" className="h-5 ml-auto">{activeFaces.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              {activeFaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">
                    {isStreaming ? "Aguardando rostos..." : "Inicie a demo para detectar"}
                  </p>
                </div>
              ) : (
                activeFaces.map((face) => (
                  <FaceCard
                    key={face.trackId}
                    face={face}
                    getEmotionEmoji={getEmotionEmoji}
                    getEmotionLabel={getEmotionLabel}
                    getEmotionColor={getEmotionColor}
                    getGenderColor={getGenderColor}
                    getAgeGroupColor={getAgeGroupColor}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== Analytics ===== */}
      <section aria-labelledby="analytics-title" className="space-y-3">
        <h2 id="analytics-title" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Distribuição da Audiência
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DistributionCard title="Emoções" icon={<Smile className="w-4 h-4" />}>
            {stats.emotions.length === 0 ? (
              <EmptyHint text="Sem dados ainda" />
            ) : (
              stats.emotions.map((stat) => (
                <DistributionRow
                  key={stat.emotion}
                  label={`${getEmotionEmoji(stat.emotion)} ${getEmotionLabel(stat.emotion)}`}
                  percentage={stat.percentage}
                  barClass={getEmotionColor(stat.emotion)}
                />
              ))
            )}
          </DistributionCard>

          <DistributionCard title="Gênero" icon={<Users className="w-4 h-4" />}>
            {stats.genders.length === 0 ? (
              <EmptyHint text="Sem dados ainda" />
            ) : (
              stats.genders.map((stat) => (
                <DistributionRow
                  key={stat.gender}
                  label={<span className="capitalize">{stat.gender}</span>}
                  percentage={stat.percentage}
                  barClass={getGenderColor(stat.gender)}
                />
              ))
            )}
          </DistributionCard>

          <DistributionCard title="Idade" icon={<BarChart3 className="w-4 h-4" />}>
            {stats.ages.length === 0 ? (
              <EmptyHint text="Sem dados ainda" />
            ) : (
              stats.ages.map((stat) => (
                <DistributionRow
                  key={stat.ageGroup}
                  label={stat.ageGroup}
                  percentage={stat.percentage}
                  barClass={getAgeGroupColor(stat.ageGroup)}
                />
              ))
            )}
          </DistributionCard>
        </div>
      </section>

      {/* ===== Detection Log ===== */}
      <section aria-labelledby="log-title" className="space-y-3">
        <h2 id="log-title" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Histórico de Detecções
        </h2>
        <Card>
          <CardHeader className="p-3 pb-2 border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4" />
              Log de Detecções
              <Badge variant="outline" className="h-5 ml-auto">{detectionHistory.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Horário</th>
                  <th className="text-left py-2 px-3 font-medium">Gênero</th>
                  <th className="text-left py-2 px-3 font-medium">Idade</th>
                  <th className="text-left py-2 px-3 font-medium">Emoção</th>
                  <th className="text-left py-2 px-3 font-medium">Atenção</th>
                </tr>
              </thead>
              <tbody>
                {detectionHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aguardando detecções...
                    </td>
                  </tr>
                ) : (
                  detectionHistory.slice(0, 50).map((record) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-1.5 px-3">{record.timestamp.toLocaleTimeString("pt-BR")}</td>
                      <td className="py-1.5 px-3">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${getGenderColor(record.gender)}`} />
                        {record.gender}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${getAgeGroupColor(record.ageGroup)}`}>
                          {record.age}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="flex items-center gap-1">
                          <span>{getEmotionEmoji(record.emotion)}</span>
                          <span className="truncate max-w-[80px]">{getEmotionLabel(record.emotion)}</span>
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-medium font-mono text-primary">
                        {formatDuration(record.attentionDuration)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <RegistrationDialog isOpen={isRegistrationOpen} onOpenChange={setIsRegistrationOpen} />
      <TutorialGuide />
    </div>
  );
};

// ============== Subcomponents ==============

const KpiCard = ({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
          {label}
        </span>
        <span className={accent}>{icon}</span>
      </div>
      <span className={`text-xl font-bold leading-none ${accent}`}>{value}</span>
    </CardContent>
  </Card>
);

const DistributionCard = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="p-3 pb-2 border-b">
      <CardTitle className="flex items-center gap-2 text-sm">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-3 space-y-3">{children}</CardContent>
  </Card>
);

const DistributionRow = ({
  label,
  percentage,
  barClass,
}: {
  label: React.ReactNode;
  percentage: number;
  barClass: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center text-xs">
      <span className="flex items-center gap-1">{label}</span>
      <span className="font-medium text-muted-foreground">{percentage.toFixed(0)}%</span>
    </div>
    <Progress value={percentage} className="h-1.5" indicatorClassName={barClass} />
  </div>
);

const EmptyHint = ({ text }: { text: string }) => (
  <p className="text-center text-xs text-muted-foreground py-4">{text}</p>
);

const FaceCard = ({
  face,
  getEmotionEmoji,
  getEmotionLabel,
  getEmotionColor,
  getGenderColor,
  getAgeGroupColor,
}: {
  face: ActiveFace;
  getEmotionEmoji: (e: EmotionType) => string;
  getEmotionLabel: (e: EmotionType) => string;
  getEmotionColor: (e: EmotionType) => string;
  getGenderColor: (g: string) => string;
  getAgeGroupColor: (a: string) => string;
}) => (
  <div className="p-3 bg-muted rounded-lg space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="font-medium text-sm">
          {face.isRegistered ? face.name : "Visitante"}
        </span>
      </div>
      <div className="flex items-center gap-1 text-primary">
        <Clock className="w-3 h-3" />
        <span className="font-bold text-xs">{face.lookingDuration.toFixed(1)}s</span>
      </div>
    </div>

    <div className="flex flex-wrap gap-1">
      <Badge className={`${getGenderColor(face.gender)} text-white border-none text-[10px]`}>
        {face.gender}
      </Badge>
      <Badge className={`${getAgeGroupColor(face.ageGroup)} text-white border-none text-[10px]`}>
        {face.age} anos
      </Badge>
      <Badge className={`${getEmotionColor(face.emotion.emotion)} text-white border-none text-[10px]`}>
        {getEmotionEmoji(face.emotion.emotion)} {getEmotionLabel(face.emotion.emotion)}
      </Badge>
    </div>

    <div className="text-[10px] text-muted-foreground">
      Confiança: {(face.emotion.confidence * 100).toFixed(0)}%
    </div>
  </div>
);

export default DeviceDemo;
