import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Eye, Megaphone, Users, Monitor, Store, MapPin, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f5f3ff", "#ec4899", "#f43f5e", "#f97316"];

const EnterpriseReports = () => {
  const { tenantId } = useUserTenant();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [groupBy, setGroupBy] = useState<string>("campaign");

  // Summary stats
  const { data: stats } = useQuery({
    queryKey: ["enterprise-stats", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impression_logs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .gte("played_at", `${dateFrom}T00:00:00`)
        .lte("played_at", `${dateTo}T23:59:59`);

      const { count: campaignCount } = await supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "active");

      const { count: deviceCount } = await supabase
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("status", "online");

      const { count: advertiserCount } = await supabase
        .from("advertisers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!);

      return {
        totalImpressions: data ? (error ? 0 : (data as any)) : 0,
        activeCampaigns: campaignCount || 0,
        onlineDevices: deviceCount || 0,
        totalAdvertisers: advertiserCount || 0,
      };
    },
    enabled: !!tenantId,
  });

  // Impressions by campaign
  const { data: campaignImpressions = [] } = useQuery({
    queryKey: ["enterprise-campaign-impressions", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impression_logs")
        .select("campaign_id, campaigns(name)")
        .eq("tenant_id", tenantId!)
        .gte("played_at", `${dateFrom}T00:00:00`)
        .lte("played_at", `${dateTo}T23:59:59`)
        .not("campaign_id", "is", null)
        .limit(1000);

      if (error || !data) return [];

      // Group by campaign
      const grouped = new Map<string, { name: string; count: number }>();
      for (const row of data as any[]) {
        const id = row.campaign_id;
        const name = row.campaigns?.name || "Desconhecido";
        if (!grouped.has(id)) grouped.set(id, { name, count: 0 });
        grouped.get(id)!.count++;
      }

      return [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10);
    },
    enabled: !!tenantId,
  });

  // Impressions by advertiser
  const { data: advertiserImpressions = [] } = useQuery({
    queryKey: ["enterprise-advertiser-impressions", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impression_logs")
        .select("advertiser_id, advertisers(name)")
        .eq("tenant_id", tenantId!)
        .gte("played_at", `${dateFrom}T00:00:00`)
        .lte("played_at", `${dateTo}T23:59:59`)
        .not("advertiser_id", "is", null)
        .limit(1000);

      if (error || !data) return [];

      const grouped = new Map<string, { name: string; value: number }>();
      for (const row of data as any[]) {
        const id = row.advertiser_id;
        const name = row.advertisers?.name || "Desconhecido";
        if (!grouped.has(id)) grouped.set(id, { name, value: 0 });
        grouped.get(id)!.value++;
      }

      return [...grouped.values()].sort((a, b) => b.value - a.value).slice(0, 10);
    },
    enabled: !!tenantId,
  });

  // Recent impressions list
  const { data: recentImpressions = [] } = useQuery({
    queryKey: ["enterprise-recent-impressions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impression_logs")
        .select("id, played_at, duration, status, devices(name), campaigns(name), advertisers(name), stores(name), media_items!impression_logs_content_id_fkey(name)")
        .eq("tenant_id", tenantId!)
        .order("played_at", { ascending: false })
        .limit(50);

      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios Enterprise</h1>
        <p className="text-sm text-muted-foreground">Impressões, campanhas e performance por anunciante</p>
      </div>
      {/* Filters */}
      <div className="flex gap-4 items-end mb-6">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats?.totalImpressions || 0}</p>
              <p className="text-xs text-muted-foreground">Impressões</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats?.activeCampaigns || 0}</p>
              <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Monitor className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.onlineDevices || 0}</p>
              <p className="text-xs text-muted-foreground">Dispositivos Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats?.totalAdvertisers || 0}</p>
              <p className="text-xs text-muted-foreground">Anunciantes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impressões por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignImpressions.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignImpressions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados de impressão</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impressões por Anunciante</CardTitle>
          </CardHeader>
          <CardContent>
            {advertiserImpressions.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={advertiserImpressions} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {advertiserImpressions.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados de anunciantes</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent impressions table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Impressões Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Anunciante</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentImpressions.map((imp: any) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-xs">{new Date(imp.played_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{(imp.devices as any)?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{(imp.media_items as any)?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{(imp.campaigns as any)?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{(imp.advertisers as any)?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{(imp.stores as any)?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{imp.duration ? `${imp.duration}s` : "-"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{imp.status}</Badge></TableCell>
                </TableRow>
              ))}
              {recentImpressions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma impressão registrada ainda</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnterpriseReports;
