import { cn } from "@/lib/utils";
import { X, Users, TrendingUp, Clock, Eye } from "lucide-react";
import { ActiveFace } from "@/hooks/useFaceDetection";

interface PeopleCounterOverlayProps {
  visible: boolean;
  count: number;
  todayCount: number;
  activeFaces: ActiveFace[];
  onClose: () => void;
  isPortrait?: boolean;
}

export const PeopleCounterOverlay = ({
  visible,
  count,
  todayCount,
  activeFaces,
  onClose,
  isPortrait = false,
}: PeopleCounterOverlayProps) => {
  if (!visible) return null;

  const maleCount = activeFaces.filter(f => f.gender === "masculino").length;
  const femaleCount = activeFaces.filter(f => f.gender === "feminino").length;
  const avgAge = activeFaces.length > 0
    ? Math.round(activeFaces.reduce((a, f) => a + f.age, 0) / activeFaces.length)
    : 0;

  return (
    <div className="absolute inset-0 z-40 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" />
          Contador de Pessoas
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className={cn(
          "flex-1 p-6",
          isPortrait ? "flex flex-col gap-8 items-center" : "flex flex-col items-center justify-center gap-8"
        )}
      >
        {/* Main counter */}
        <div className="text-center">
          <div className="relative">
            <div className="w-48 h-48 rounded-full border-4 border-yellow-400/30 flex items-center justify-center bg-yellow-400/5">
              <div>
                <p className="text-yellow-400 text-7xl font-bold">{todayCount}</p>
                <p className="text-white/50 text-sm">pessoas hoje</p>
              </div>
            </div>
            {activeFaces.length > 0 && (
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                <Eye className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Current stats */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-blue-400 text-3xl font-bold">{activeFaces.length}</p>
            <p className="text-white/50 text-xs mt-1">Agora</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-white text-3xl font-bold">{avgAge || "—"}</p>
            <p className="text-white/50 text-xs mt-1">Idade Média</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="flex justify-center gap-2">
              <span className="text-blue-400 font-bold">{maleCount}👨</span>
              <span className="text-pink-400 font-bold">{femaleCount}👩</span>
            </div>
            <p className="text-white/50 text-xs mt-1">Gênero</p>
          </div>
        </div>

        {/* Live faces */}
        {activeFaces.length > 0 && (
          <div className="w-full max-w-lg space-y-2">
            <h4 className="text-white/60 text-sm">Pessoas detectadas agora:</h4>
            {activeFaces.map(face => (
              <div key={face.trackId} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <span className="text-lg">{face.gender === "masculino" ? "👨" : face.gender === "feminino" ? "👩" : "🧑"}</span>
                <div className="flex-1">
                  <p className="text-white text-sm">
                    {face.isRegistered ? face.name : `Visitante`} • {face.age} anos
                  </p>
                </div>
                <span className="text-white/40 text-xs">{face.lookingDuration.toFixed(0)}s</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
