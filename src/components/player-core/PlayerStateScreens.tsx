import { Button } from "@/components/ui/button";
import { Monitor, AlertTriangle, Loader2, Download, Lock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen = ({ message = "Carregando Player...", subMessage }: LoadingScreenProps) => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
    <h1 className="text-2xl font-semibold mb-2">{message}</h1>
    {subMessage && <p className="text-white/60">{subMessage}</p>}
  </div>
);

interface ErrorScreenProps {
  message: string;
  backTo?: string;
}

export const ErrorScreen = ({ message, backTo = "/devices" }: ErrorScreenProps) => (
  <div className="min-h-screen bg-black flex items-center justify-center text-white">
    <div className="text-center">
      <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
      <h1 className="text-2xl mb-2">Erro ao carregar</h1>
      <p className="text-white/70 mb-4">{message}</p>
      <Link to={backTo}>
        <Button variant="outline">Voltar</Button>
      </Link>
    </div>
  </div>
);

interface NotFoundScreenProps {
  identifier?: string;
  backTo?: string;
}

export const DeviceNotFoundScreen = ({ identifier, backTo = "/devices" }: NotFoundScreenProps) => (
  <div className="min-h-screen bg-black flex items-center justify-center text-white">
    <div className="text-center">
      <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
      <h1 className="text-2xl mb-2">Dispositivo não encontrado</h1>
      {identifier && <p className="text-white/70 mb-4">Código: {identifier}</p>}
      <Link to={backTo}>
        <Button variant="outline">Voltar aos Dispositivos</Button>
      </Link>
    </div>
  </div>
);

interface BlockedScreenProps {
  message?: string;
  deviceName?: string;
  onCheckStatus?: () => void;
  isChecking?: boolean;
}

export const BlockedScreen = ({ message, deviceName, onCheckStatus, isChecking }: BlockedScreenProps) => (
  <div className="min-h-screen bg-gradient-to-br from-red-950 via-black to-red-950 flex flex-col items-center justify-center text-white p-8">
    <div className="bg-red-500/20 p-8 rounded-full mb-8 animate-pulse">
      <Lock className="w-24 h-24 text-red-500" />
    </div>
    <h1 className="text-4xl font-bold mb-4 text-red-400">Dispositivo Bloqueado</h1>
    <p className="text-xl text-white/80 text-center max-w-lg mb-6">
      {message || "Este dispositivo foi bloqueado pelo administrador."}
    </p>
    {deviceName && (
      <div className="text-white/40 text-sm mt-4 flex items-center gap-2">
        <Monitor className="w-4 h-4" />
        <span>{deviceName}</span>
      </div>
    )}
    <p className="text-white/30 text-xs mt-2">
      Entre em contato com o suporte para mais informações
    </p>
    {onCheckStatus && (
      <button
        onClick={onCheckStatus}
        disabled={isChecking}
        className="mt-8 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-white/50"
      >
        <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
        {isChecking ? "Verificando..." : "Verificar status"}
      </button>
    )}
  </div>
);

interface EmptyContentScreenProps {
  deviceName?: string;
  playlistName?: string;
  syncError?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  debugInfo?: string;
}

export const EmptyContentScreen = ({
  deviceName,
  playlistName,
  syncError,
  onSync,
  isSyncing,
  debugInfo,
}: EmptyContentScreenProps) => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-8">
    <Monitor className="w-20 h-20 mb-6 text-white/30" />
    <h1 className="text-2xl font-semibold mb-2">
      {playlistName ? "Nenhuma mídia configurada" : "Aguardando Conteúdo"}
    </h1>
    <p className="text-white/60 mb-4 text-center max-w-md">
      {playlistName ? `Playlist: ${playlistName}` : deviceName || "Nenhuma playlist atribuída"}
    </p>
    {syncError && (
      <div className="flex items-center gap-2 text-red-400 mb-4">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">{syncError}</span>
      </div>
    )}
    {onSync && (
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-lg hover:bg-primary/30 transition-colors"
      >
        <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
        {isSyncing ? "Sincronizando..." : "Sincronizar"}
      </button>
    )}
    {debugInfo && (
      <p className="text-white/30 text-xs mt-6">{debugInfo}</p>
    )}
  </div>
);

interface DownloadScreenProps {
  downloaded: number;
  total: number;
  current?: string;
}

export const DownloadScreen = ({ downloaded, total, current }: DownloadScreenProps) => {
  const percent = total > 0 ? (downloaded / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-8">
      <Download className="w-16 h-16 mb-6 text-primary animate-bounce" />
      <h1 className="text-2xl font-semibold mb-2">Baixando Conteúdos</h1>
      <p className="text-white/60 mb-6 text-center">
        {current || "Preparando arquivos..."}
      </p>
      <div className="w-full max-w-md">
        <Progress value={percent} className="h-2" />
        <p className="text-center text-sm mt-2 text-white/60">
          {downloaded} de {total} arquivos
        </p>
      </div>
    </div>
  );
};

interface ActiveSessionScreenProps {
  deviceName?: string | null;
  message?: string | null;
}

export const ActiveSessionScreen = ({ deviceName, message }: ActiveSessionScreenProps) => (
  <div className="min-h-screen bg-gradient-to-br from-yellow-950 via-black to-yellow-950 flex flex-col items-center justify-center text-white p-8">
    <div className="bg-yellow-500/20 p-8 rounded-full mb-8 animate-pulse">
      <Monitor className="w-24 h-24 text-yellow-500" />
    </div>
    <h1 className="text-4xl font-bold mb-4 text-yellow-400">Dispositivo em Uso</h1>
    <p className="text-xl text-white/80 text-center max-w-lg mb-6">
      {message || "Este dispositivo já está reproduzindo conteúdo em outra sessão."}
    </p>
    {deviceName && (
      <div className="text-white/40 text-sm mt-4 flex items-center gap-2">
        <Monitor className="w-4 h-4" />
        <span>{deviceName}</span>
      </div>
    )}
    <p className="text-white/30 text-xs mt-2">
      Feche a outra sessão para acessar este dispositivo
    </p>
  </div>
);
