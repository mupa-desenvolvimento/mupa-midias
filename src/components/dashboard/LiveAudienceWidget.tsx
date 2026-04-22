import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Smile, Radio, ArrowRight } from "lucide-react";
import { useLiveAudience } from "@/hooks/useLiveAudience";

const EMOTION_LABELS: Record<string, string> = {
  happy: "Feliz",
  sad: "Triste",
  angry: "Bravo",
  surprised: "Surpreso",
  fearful: "Receoso",
  disgusted: "Incomodado",
  neutral: "Neutro",
  "—": "—",
};

export const LiveAudienceWidget = () => {
  const { aggregate, devices, isConnected } = useLiveAudience();

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Audiência ao Vivo</CardTitle>
            <Badge
              variant="outline"
              className={`gap-1 ${isConnected ? "text-green-500 border-green-500/30" : "text-muted-foreground"}`}
            >
              <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse" : ""}`} />
              {isConnected ? "Tempo real" : "Conectando…"}
            </Badge>
          </div>
          <Button asChild size="sm" variant="ghost" className="gap-1">
            <Link to="/admin/dashboard/audiencia-live">
              Detalhar <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Pessoas agora
            </div>
            <div className="text-2xl font-bold mt-1">{aggregate.totalPeople}</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="text-xs text-muted-foreground">Idade média</div>
            <div className="text-2xl font-bold mt-1">
              {aggregate.avgAge > 0 ? `${aggregate.avgAge}a` : "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Smile className="h-3.5 w-3.5" /> Emoção
            </div>
            <div className="text-lg font-semibold mt-1 capitalize">
              {EMOTION_LABELS[aggregate.dominantEmotion] ?? aggregate.dominantEmotion}
            </div>
          </div>
          <div className="rounded-lg border bg-card/50 p-3">
            <div className="text-xs text-muted-foreground">Telas com público</div>
            <div className="text-2xl font-bold mt-1">{aggregate.activeDevices}</div>
            <div className="text-xs text-muted-foreground">de {devices.length} ativas</div>
          </div>
        </div>

        {devices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados de dispositivos…
          </p>
        ) : (
          <div className="grid grid-cols-3 text-xs gap-3 pt-1">
            <div>
              <div className="text-muted-foreground">Masc.</div>
              <div className="font-medium">{aggregate.genderDistribution.male}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fem.</div>
              <div className="font-medium">{aggregate.genderDistribution.female}</div>
            </div>
            <div>
              <div className="text-muted-foreground">N/I</div>
              <div className="font-medium">{aggregate.genderDistribution.unknown}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
