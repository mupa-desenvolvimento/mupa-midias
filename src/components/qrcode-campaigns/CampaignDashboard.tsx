import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Eye, QrCode, TrendingUp } from "lucide-react";
import type { QRCodeCampaign } from "@/hooks/useQRCodeCampaigns";

interface Props {
  campaigns: QRCodeCampaign[];
}

export function CampaignDashboard({ campaigns }: Props) {
  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.is_active).length;
    const totalScans = campaigns.reduce((sum, c) => sum + (c.scans_count || 0), 0);
    const topCampaign = campaigns.reduce((top, c) => (c.scans_count > (top?.scans_count || 0) ? c : top), campaigns[0]);
    return { total, active, totalScans, topCampaign };
  }, [campaigns]);

  const cards = [
    { title: "Total Campanhas", value: stats.total, icon: QrCode, color: "text-primary" },
    { title: "Ativas", value: stats.active, icon: Eye, color: "text-green-500" },
    { title: "Total de Scans", value: stats.totalScans, icon: BarChart3, color: "text-blue-500" },
    { title: "Top Campanha", value: stats.topCampaign?.title || "—", icon: TrendingUp, color: "text-amber-500", sub: stats.topCampaign ? `${stats.topCampaign.scans_count} scans` : undefined },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{card.value}</div>
            {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
