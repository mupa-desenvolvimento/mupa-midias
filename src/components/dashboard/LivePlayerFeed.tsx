import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Eye, Play, Wifi, WifiOff, Megaphone, Radio } from "lucide-react";
import { useDevicePlayerStream, type PlayerEvent } from "@/hooks/useDevicePlayerStream";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_META: Record<
  PlayerEvent["type"],
  { label: string; icon: typeof Activity; color: string }
> = {
  detection: { label: "Detecção", icon: Eye, color: "text-purple-500" },
  play: { label: "Reprodução", icon: Play, color: "text-blue-500" },
  status: { label: "Status", icon: Wifi, color: "text-green-500" },
  impression: { label: "Impressão", icon: Megaphone, color: "text-orange-500" },
};

function describe(event: PlayerEvent): string {
  switch (event.type) {
    case "detection":
      return [
        event.gender && `${event.gender}`,
        event.age && `${event.age}a`,
        event.emotion && `${event.emotion}`,
        event.content_name && `· assistindo "${event.content_name}"`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "play":
      return `Reproduziu mídia ${event.media_id?.slice(0, 8) ?? ""}${
        event.duration ? ` por ${event.duration}s` : ""
      }`;
    case "status":
      return `${event.old_status ?? "—"} → ${event.new_status}`;
    case "impression":
      return `Conteúdo ${event.content_id?.slice(0, 8) ?? ""}${
        event.duration ? ` (${event.duration}s)` : ""
      }`;
  }
}

export const LivePlayerFeed = () => {
  const { events, counters, isConnected } = useDevicePlayerStream();

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${isConnected ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
              <CardTitle>Eventos do Player ao Vivo</CardTitle>
            </div>
            <CardDescription>
              Dados enviados em tempo real pelos dispositivos /play
            </CardDescription>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500" : ""}>
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                AO VIVO
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Conectando...
              </>
            )}
          </Badge>
        </div>

        {/* Counters last 5min */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">Detecções (5m)</div>
            <div className="text-lg font-bold text-purple-500">{counters.detectionsLast5m}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">Reproduções (5m)</div>
            <div className="text-lg font-bold text-blue-500">{counters.playsLast5m}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">Mudanças de status (5m)</div>
            <div className="text-lg font-bold text-green-500">{counters.statusChangesLast5m}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">Impressões (5m)</div>
            <div className="text-lg font-bold text-orange-500">{counters.impressionsLast5m}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-50" />
              <p className="text-sm">Aguardando eventos dos players...</p>
              <p className="text-xs">Os eventos aparecerão aqui assim que um dispositivo /play enviar dados.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => {
                const meta = TYPE_META[event.type];
                const Icon = meta.icon;
                return (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors animate-fade-in"
                  >
                    <div className={`mt-0.5 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {meta.label}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {event.device_name ?? event.device_code ?? "Dispositivo desconhecido"}
                        </span>
                        {event.device_code && event.device_name && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {event.device_code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{describe(event)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: ptBR })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
