import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Smile, Radio, Eye, Clock, Tv } from "lucide-react";
import { useLiveAudience } from "@/hooks/useLiveAudience";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const EMOTION_LABELS: Record<string, string> = {
  happy: "Feliz",
  sad: "Triste",
  angry: "Bravo",
  surprised: "Surpreso",
  fearful: "Receoso",
  disgusted: "Incomodado",
  neutral: "Neutro",
};

const formatMs = (ms: number) => {
  if (!ms) return "0s";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const AudienceLive = () => {
  const { aggregate, devices, isConnected } = useLiveAudience();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audiência ao Vivo</h1>
          <p className="text-sm text-muted-foreground">
            Dados em tempo real coletados pelos players via reconhecimento facial.
          </p>
        </div>
        <Badge
          variant="outline"
          className={`gap-1 ${isConnected ? "text-green-500 border-green-500/30" : "text-muted-foreground"}`}
        >
          <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse" : ""}`} />
          {isConnected ? "Conectado" : "Conectando…"}
        </Badge>
      </div>

      {/* KPIs globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Pessoas agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{aggregate.totalPeople}</div>
            <p className="text-xs text-muted-foreground">
              em {aggregate.activeDevices} dispositivos com público
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Idade média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {aggregate.avgAge > 0 ? `${aggregate.avgAge}a` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smile className="h-4 w-4 text-primary" /> Emoção dominante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {EMOTION_LABELS[aggregate.dominantEmotion] ?? aggregate.dominantEmotion}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3 text-sm">
              <span>
                <span className="text-muted-foreground">M:</span>{" "}
                <strong>{aggregate.genderDistribution.male}</strong>
              </span>
              <span>
                <span className="text-muted-foreground">F:</span>{" "}
                <strong>{aggregate.genderDistribution.female}</strong>
              </span>
              <span>
                <span className="text-muted-foreground">N/I:</span>{" "}
                <strong>{aggregate.genderDistribution.unknown}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de dispositivos */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Dispositivos transmitindo ({devices.length})
        </h2>
        {devices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Tv className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum dispositivo está enviando dados de audiência.</p>
              <p className="text-xs mt-1">
                Ative a câmera nos players (/play) para começar a coletar dados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((d) => (
              <Card key={d.deviceCode} className="hover:shadow-md transition">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-mono">
                        {d.deviceCode}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(d.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={d.metrics.people > 0 ? "default" : "secondary"}
                      className="gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {d.metrics.people}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {d.media.contentName && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Exibindo: </span>
                      <span className="font-medium truncate">
                        {d.media.contentName}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Idade</div>
                      <div className="font-semibold">
                        {d.metrics.avgAge > 0 ? `${d.metrics.avgAge}a` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Smile className="h-3 w-3" /> Emoção
                      </div>
                      <div className="font-semibold capitalize">
                        {EMOTION_LABELS[d.metrics.dominantEmotion] ??
                          d.metrics.dominantEmotion}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Atenção
                      </div>
                      <div className="font-semibold">
                        {formatMs(d.metrics.avgAttentionMs)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">M</span>
                      <strong>{d.metrics.genderDistribution.male}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">F</span>
                      <strong>{d.metrics.genderDistribution.female}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">N/I</span>
                      <strong>{d.metrics.genderDistribution.unknown}</strong>
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      pico {formatMs(d.metrics.maxAttentionMs)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudienceLive;
