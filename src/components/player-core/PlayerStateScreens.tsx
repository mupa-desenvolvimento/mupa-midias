import { Button } from "@/components/ui/button";
import { Monitor, AlertTriangle, Download, Lock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { readCache, writeCache } from "@/lib/mupaCache";

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen = ({ message = "Carregando Player...", subMessage }: LoadingScreenProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="min-h-screen bg-black flex flex-col items-center justify-center text-white"
  >
    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
    <h1 className="text-2xl font-semibold mb-2">{message}</h1>
    {subMessage && <p className="text-white/60">{subMessage}</p>}
  </motion.div>
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
  deviceInfo?: {
    empresa?: string;
    grupo?: string;
    nome?: string;
    android_id?: string;
  };
}

export const DeviceNotFoundScreen = ({ identifier, backTo = "/devices", deviceInfo }: NotFoundScreenProps) => (
  <div className="min-h-screen bg-black flex items-center justify-center text-white p-6">
    <div className="text-center max-w-md w-full">
      <Monitor className="w-16 h-16 mx-auto mb-6 text-primary/40" />
      <h1 className="text-3xl font-bold mb-2">Dispositivo não encontrado</h1>
      <p className="text-white/60 mb-8">Este dispositivo ainda não foi cadastrado ou sincronizado no sistema.</p>
      
      {(identifier || deviceInfo) && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 text-left space-y-4">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Informações do Dispositivo</h2>
          
          <div className="grid gap-3 text-sm">
            {deviceInfo?.nome && (
              <div className="flex flex-col">
                <span className="text-white/40">Nome</span>
                <span className="text-white font-medium">{deviceInfo.nome}</span>
              </div>
            )}
            {deviceInfo?.empresa && (
              <div className="flex flex-col">
                <span className="text-white/40">Empresa</span>
                <span className="text-white font-medium">{deviceInfo.empresa}</span>
              </div>
            )}
            {deviceInfo?.grupo && (
              <div className="flex flex-col">
                <span className="text-white/40">Grupo / Loja</span>
                <span className="text-white font-medium">{deviceInfo.grupo}</span>
              </div>
            )}
            {(identifier || deviceInfo?.android_id) && (
              <div className="flex flex-col">
                <span className="text-white/40">ID (Android)</span>
                <span className="text-mono text-white/80">{identifier || deviceInfo?.android_id}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Link to={backTo}>
        <Button variant="outline" className="w-full py-6 text-lg">
          Voltar aos Dispositivos
        </Button>
      </Link>
      
      <p className="text-white/20 text-[10px] mt-8">
        Se o problema persistir, entre em contato com o administrador.
      </p>
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

type ContentGroup = { title: string; items: string[] };

interface EmptyContentScreenProps {
  deviceName?: string;
  playlistName?: string;
  syncError?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  debugInfo?: string;
  contentGroups?: ContentGroup[];
  /** Chave única para cache (ex: deviceCode). Habilita cache-first. */
  cacheKey?: string;
}

const CONTENT_LIST_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeOut" as const } },
} as const;

export const EmptyContentScreen = ({
  deviceName,
  playlistName,
  syncError,
  onSync,
  isSyncing,
  debugInfo,
  contentGroups,
  cacheKey,
}: EmptyContentScreenProps) => {
  // Cache-first: mostra última lista conhecida imediatamente, atualiza quando chegar
  const [displayGroups, setDisplayGroups] = useState<ContentGroup[] | null>(
    contentGroups && contentGroups.length > 0 ? contentGroups : null,
  );

  // Hidrata do cache na primeira renderização (offline-friendly)
  useEffect(() => {
    if (!cacheKey) return;
    if (displayGroups && displayGroups.length > 0) return;
    let cancelled = false;
    readCache<ContentGroup[]>(`empty-content-groups:${cacheKey}`).then((cached) => {
      if (!cancelled && cached && cached.length > 0) {
        setDisplayGroups(cached);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Atualiza display + persiste em cache quando vierem dados frescos
  useEffect(() => {
    if (!contentGroups || contentGroups.length === 0) return;
    setDisplayGroups(contentGroups);
    if (cacheKey) {
      writeCache(`empty-content-groups:${cacheKey}`, contentGroups);
    }
  }, [contentGroups, cacheKey]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden">
      {/* Header fixo */}
      <header className="flex-shrink-0 px-6 pt-8 pb-4 flex flex-col items-center text-center">
        <Monitor className="w-16 h-16 mb-4 text-white/30" />
        <h1 className="text-2xl font-semibold mb-1">
          {playlistName ? "Nenhuma mídia configurada" : "Aguardando Conteúdo"}
        </h1>
        <p className="text-white/60 text-sm max-w-md">
          {playlistName ? `Playlist: ${playlistName}` : deviceName || "Nenhuma playlist atribuída"}
        </p>

        {syncError && (
          <div className="flex items-center gap-2 text-red-400 mt-3">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{syncError}</span>
          </div>
        )}

        {onSync && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-lg hover:bg-primary/30 transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        )}
      </header>

      {/* Lista de conteúdos: ocupa o restante e é o ÚNICO scroll */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col items-center px-6 pb-6">
        <AnimatePresence mode="wait">
          {displayGroups && displayGroups.length > 0 ? (
            <motion.section
              key="list"
              variants={CONTENT_LIST_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-xl flex-1 min-h-0 flex flex-col"
            >
              <p className="text-white/50 text-xs mb-2 flex-shrink-0">
                Conteúdos para reproduzir
              </p>
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10 bg-white/5 p-3 text-left"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="space-y-3">
                  {displayGroups.map((group, groupIndex) => (
                    <motion.div
                      key={`${groupIndex}-${group.title}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(groupIndex * 0.04, 0.3) }}
                    >
                      <p className="text-white/80 text-xs font-medium">{group.title}</p>
                      <ul className="mt-1 space-y-1">
                        {group.items.map((item, itemIndex) => (
                          <li
                            key={`${groupIndex}-${itemIndex}`}
                            className="text-white/60 text-xs"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-white/40 text-xs mt-4"
            >
              {isSyncing ? "Buscando conteúdos…" : "Nenhum conteúdo disponível ainda."}
            </motion.div>
          )}
        </AnimatePresence>

        {debugInfo && (
          <p className="text-white/30 text-xs mt-4 flex-shrink-0">{debugInfo}</p>
        )}
      </main>
    </div>
  );
};

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
