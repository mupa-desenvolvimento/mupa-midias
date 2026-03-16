import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Package, TrendingUp, Calendar, BarChart3, History, Trophy, Users, Smile } from "lucide-react";

interface ProductAnalyticsData {
  id: string;
  ean: string;
  product_name: string | null;
  store_code: string | null;
  gender: string | null;
  age_group: string | null;
  emotion: string | null;
  lookup_count: number;
  lookup_date: string;
  ai_category: string | null;
  ai_enriched: boolean;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const genderLabels: Record<string, string> = {
  male: 'Masculino',
  female: 'Feminino',
  unknown: 'Não identificado',
};

const ageGroupLabels: Record<string, string> = {
  child: 'Criança',
  teen: 'Adolescente',
  adult: 'Adulto',
  senior: 'Idoso',
};

const emotionLabels: Record<string, string> = {
  happy: 'Feliz',
  neutral: 'Neutro',
  sad: 'Triste',
  angry: 'Irritado',
  surprised: 'Surpreso',
  fearful: 'Temeroso',
  disgusted: 'Enojado',
};

export default function ProductAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['product-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lookup_analytics')
        .select('*')
        .order('last_lookup_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ProductAnalyticsData[];
    },
  });

  const stats = {
    totalLookups: analytics?.reduce((sum, a) => sum + (a.lookup_count || 1), 0) || 0,
    uniqueProducts: new Set(analytics?.map(a => a.ean)).size,
    uniqueDays: new Set(analytics?.map(a => a.lookup_date)).size,
    enrichedCount: analytics?.filter(a => a.ai_enriched).length || 0,
  };

  const genderData = analytics?.reduce((acc, a) => {
    const gender = a.gender || 'unknown';
    const existing = acc.find(item => item.name === gender);
    if (existing) existing.value += a.lookup_count || 1;
    else acc.push({ name: gender, label: genderLabels[gender] || gender, value: a.lookup_count || 1 });
    return acc;
  }, [] as { name: string; label: string; value: number }[]) || [];

  const ageData = analytics?.reduce((acc, a) => {
    const age = a.age_group || 'unknown';
    const existing = acc.find(item => item.name === age);
    if (existing) existing.value += a.lookup_count || 1;
    else acc.push({ name: age, label: ageGroupLabels[age] || age, value: a.lookup_count || 1 });
    return acc;
  }, [] as { name: string; label: string; value: number }[]) || [];

  const emotionData = analytics?.reduce((acc, a) => {
    const emotion = a.emotion || 'unknown';
    const existing = acc.find(item => item.name === emotion);
    if (existing) existing.value += a.lookup_count || 1;
    else acc.push({ name: emotion, label: emotionLabels[emotion] || emotion, value: a.lookup_count || 1 });
    return acc;
  }, [] as { name: string; label: string; value: number }[]) || [];

  const topProducts = analytics?.reduce((acc, a) => {
    const existing = acc.find(item => item.ean === a.ean);
    if (existing) existing.count += a.lookup_count || 1;
    else acc.push({ ean: a.ean, name: a.product_name || a.ean, count: a.lookup_count || 1, category: a.ai_category });
    return acc;
  }, [] as { ean: string; name: string; count: number; category: string | null }[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) || [];

  const StatCard = ({ title, value, icon: Icon, subtitle }: { title: string; value: number | string; icon: any; subtitle?: string }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Analytics de Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Análise demográfica e produtos mais consultados
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de Consultas" value={stats.totalLookups} icon={TrendingUp} />
          <StatCard title="Produtos Únicos" value={stats.uniqueProducts} icon={Package} />
          <StatCard title="Dias Ativos" value={stats.uniqueDays} icon={Calendar} />
          <StatCard title="Enriquecidos por IA" value={stats.enrichedCount} icon={Smile} subtitle={`de ${analytics?.length || 0} registros`} />
        </div>

        {/* Tabs for Charts and Tables */}
        <Tabs defaultValue="demographics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="demographics" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Demografia
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Demographics Tab */}
          <TabsContent value="demographics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Por Gênero</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : genderData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {genderData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="Sem dados de gênero" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Por Faixa Etária</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : ageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={ageData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" fontSize={11} className="fill-muted-foreground" />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="Sem dados de idade" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Por Emoção</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : emotionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={emotionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {emotionData.map((_, index) => (
                            <Cell key={`cell-e-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="Sem dados de emoção" />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ranking Tab */}
          <TabsContent value="ranking">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Produtos Mais Consultados
                </CardTitle>
                <CardDescription className="text-xs">Top 10 produtos por número de consultas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : topProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>EAN</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Consultas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, index) => (
                        <TableRow key={product.ean}>
                          <TableCell>
                            <Badge variant={index < 3 ? "default" : "outline"} className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                              {index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate font-medium text-sm">{product.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{product.ean}</TableCell>
                          <TableCell>
                            {product.category ? (
                              <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">{product.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="Nenhuma consulta registrada" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Consultas Recentes
                </CardTitle>
                <CardDescription className="text-xs">Últimas 20 consultas realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : analytics && analytics.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead>Gênero</TableHead>
                          <TableHead>Idade</TableHead>
                          <TableHead>Emoção</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.slice(0, 20).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(item.lookup_date), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm">
                              {item.product_name || item.ean}
                            </TableCell>
                            <TableCell className="text-xs">{item.store_code || '—'}</TableCell>
                            <TableCell>
                              {item.gender ? (
                                <Badge variant="secondary" className="text-xs">
                                  {genderLabels[item.gender] || item.gender}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              {item.age_group ? (
                                <Badge variant="outline" className="text-xs">
                                  {ageGroupLabels[item.age_group] || item.age_group}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              {item.emotion ? (
                                <Badge variant="outline" className="text-xs">
                                  {emotionLabels[item.emotion] || item.emotion}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState message="Nenhuma consulta registrada" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
