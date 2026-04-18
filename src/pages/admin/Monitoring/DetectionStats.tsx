import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Smile, User2 } from "lucide-react";
import type { DetectedFace } from "./types";

const EMOTION_LABEL: Record<string, string> = {
  neutral: "Neutro",
  happy: "Feliz",
  sad: "Triste",
  angry: "Bravo",
  fearful: "Medo",
  disgusted: "Nojo",
  surprised: "Surpreso",
};

interface Props {
  faces: DetectedFace[];
}

export const DetectionStats = ({ faces }: Props) => {
  const total = faces.length;
  const avgAge =
    total > 0 ? Math.round(faces.reduce((s, f) => s + f.age, 0) / total) : 0;
  const males = faces.filter((f) => f.gender === "male").length;
  const females = total - males;

  const emotionCounts = faces.reduce<Record<string, number>>((acc, f) => {
    acc[f.emotion] = (acc[f.emotion] ?? 0) + 1;
    return acc;
  }, {});
  const sortedEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Rostos" value={total} />
        <StatCard icon={<User2 className="w-4 h-4" />} label="Idade média" value={avgAge ? `${avgAge}a` : "—"} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gênero</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Bar label="Masculino" value={males} total={total} color="hsl(217 91% 60%)" />
          <Bar label="Feminino" value={females} total={total} color="hsl(330 81% 60%)" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smile className="w-4 h-4" /> Emoções
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedEmotions.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma emoção detectada</p>
          )}
          {sortedEmotions.map(([emo, count]) => (
            <Bar
              key={emo}
              label={EMOTION_LABEL[emo] ?? emo}
              value={count}
              total={total}
              color="hsl(160 84% 45%)"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </CardContent>
  </Card>
);

const Bar = ({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};
