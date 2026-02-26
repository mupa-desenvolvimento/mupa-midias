import { cn } from "@/lib/utils";
import { X, ScanFace, User, Clock, Heart } from "lucide-react";
import { ActiveFace } from "@/hooks/useFaceDetection";

interface FacialRecognitionOverlayProps {
  visible: boolean;
  activeFaces: ActiveFace[];
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onClose: () => void;
  isPortrait?: boolean;
}

const emotionEmoji: Record<string, string> = {
  neutral: "😐",
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fearful: "😨",
  disgusted: "🤢",
  surprised: "😮",
};

const genderIcon: Record<string, string> = {
  masculino: "👨",
  feminino: "👩",
  indefinido: "🧑",
};

export const FacialRecognitionOverlay = ({
  visible,
  activeFaces,
  videoRef,
  canvasRef,
  onClose,
  isPortrait = false,
}: FacialRecognitionOverlayProps) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-purple-400" />
          Reconhecimento Facial
          {activeFaces.length > 0 && (
            <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full">
              {activeFaces.length} rosto{activeFaces.length !== 1 ? "s" : ""}
            </span>
          )}
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className={cn(
          "flex-1 p-4 overflow-hidden",
          isPortrait ? "flex flex-col gap-4" : "flex gap-4"
        )}
      >
        {/* Camera feed */}
        <div
          className={cn(
            "relative rounded-xl overflow-hidden bg-gray-900",
            isPortrait ? "w-full h-1/2" : "flex-1"
          )}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />
          {activeFaces.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/40">
                <ScanFace className="w-16 h-16 mx-auto mb-3 animate-pulse" />
                <p>Aguardando detecção...</p>
              </div>
            </div>
          )}
        </div>

        {/* Face cards */}
        <div
          className={cn(
            "overflow-y-auto space-y-3 custom-scrollbar",
            isPortrait ? "w-full flex-1" : "w-80"
          )}
        >
          {activeFaces.length === 0 ? (
            <div className="text-white/40 text-center py-8">
              <User className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Nenhum rosto detectado</p>
            </div>
          ) : (
            activeFaces.map(face => (
              <div
                key={face.trackId}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  face.isRegistered
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-white/5 border-white/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{genderIcon[face.gender]}</span>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {face.isRegistered ? face.name : "Visitante"}
                      </p>
                      {face.isRegistered && face.cpf && (
                        <p className="text-green-400 text-xs flex items-center gap-1">
                          <Heart className="w-3 h-3" /> Fidelidade
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl">{emotionEmoji[face.emotion.emotion]}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/30 rounded-lg px-2 py-1.5">
                    <p className="text-white/50">Idade</p>
                    <p className="text-white font-medium">{face.age} anos ({face.ageGroup})</p>
                  </div>
                  <div className="bg-black/30 rounded-lg px-2 py-1.5">
                    <p className="text-white/50">Gênero</p>
                    <p className="text-white font-medium capitalize">{face.gender}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg px-2 py-1.5">
                    <p className="text-white/50">Emoção</p>
                    <p className="text-white font-medium capitalize">
                      {face.emotion.emotion} ({(face.emotion.confidence * 100).toFixed(0)}%)
                    </p>
                  </div>
                  <div className="bg-black/30 rounded-lg px-2 py-1.5">
                    <p className="text-white/50">Atenção</p>
                    <p className="text-white font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {face.lookingDuration.toFixed(1)}s
                    </p>
                  </div>
                </div>

                <div className="bg-black/30 rounded-lg px-2 py-1.5">
                  <p className="text-white/50 text-xs">Confiança</p>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                    <div
                      className={cn("h-full rounded-full", face.isRegistered ? "bg-green-500" : "bg-purple-500")}
                      style={{ width: `${(face.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
