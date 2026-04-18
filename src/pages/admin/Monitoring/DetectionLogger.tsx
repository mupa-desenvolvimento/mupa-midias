import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { DetectionLogEntry } from "./types";

interface Props {
  log: DetectionLogEntry[];
  onClear: () => void;
}

const EMOTION_LABEL: Record<string, string> = {
  neutral: "Neutro",
  happy: "Feliz",
  sad: "Triste",
  angry: "Bravo",
  fearful: "Medo",
  disgusted: "Nojo",
  surprised: "Surpreso",
};

export const DetectionLogger = ({ log, onClear }: Props) => {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Log de detecções ({log.length})</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!log.length}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma detecção registrada
            </p>
          ) : (
            <div className="space-y-1">
              {log
                .slice()
                .reverse()
                .map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-medium">
                      {e.gender === "male" ? "M" : "F"} · {e.age}a ·{" "}
                      {EMOTION_LABEL[e.emotion] ?? e.emotion}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
