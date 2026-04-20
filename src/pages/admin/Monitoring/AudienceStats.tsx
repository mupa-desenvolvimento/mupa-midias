import { Users, Clock, Smile, TrendingUp, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudienceMetrics } from "./types";

interface Props {
  metrics: AudienceMetrics;
}

export const AudienceStats = ({ metrics }: Props) => {
  const formatMs = (ms: number) => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const stats = [
    {
      label: "Pessoas Únicas",
      value: metrics.totalUniquePeople,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Tempo Médio",
      value: formatMs(metrics.averageAttentionTimeMs),
      icon: Clock,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total Atenção",
      value: formatMs(metrics.totalAudienceTimeMs),
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Emoção Dominante",
      value: metrics.dominantEmotion === "none" ? "..." : metrics.dominantEmotion,
      icon: Smile,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="overflow-hidden border-none bg-muted/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-muted/30 border-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Distribuição por Gênero
            </h4>
            <div className="text-xs text-muted-foreground">
              {metrics.genderDistribution.male}M / {metrics.genderDistribution.female}F
            </div>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
            {metrics.totalUniquePeople > 0 ? (
              <>
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${(metrics.genderDistribution.male / metrics.totalUniquePeople) * 100}%` }} 
                />
                <div 
                  className="h-full bg-pink-500 transition-all duration-500" 
                  style={{ width: `${(metrics.genderDistribution.female / metrics.totalUniquePeople) * 100}%` }} 
                />
              </>
            ) : (
              <div className="h-full bg-muted w-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
