import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Image, BarChart3, Clock, RefreshCw, TrendingUp, TrendingDown, Smile, Users } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LivePlayerFeed } from "@/components/dashboard/LivePlayerFeed";
import { LiveAudienceWidget } from "@/components/dashboard/LiveAudienceWidget";

const EMOTION_COLORS: Record<string, string> = {
  'Neutro': '#94a3b8',
  'Feliz': '#22c55e',
  'Triste': '#3b82f6',
  'Raiva': '#ef4444',
  'Medo': '#8b5cf6',
  'Nojo': '#f59e0b',
  'Surpreso': '#ec4899'
};

const Dashboard = () => {
  const {
    stats,
    audienceByHour,
    genderDistribution,
    ageDistribution,
    emotionData,
    topContent,
    isLoading,
    refresh
  } = useDashboardAnalytics();

  const audienceChange = stats.audienceYesterday > 0 
    ? Math.round(((stats.audienceToday - stats.audienceYesterday) / stats.audienceYesterday) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Visão geral da audiência em tempo real</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos Online</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">{stats.devicesOnline}</div>
                <p className="text-xs text-muted-foreground">de {stats.totalDevices} dispositivos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mídias Ativas</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">{stats.activeMedia}</div>
                <p className="text-xs text-muted-foreground">Em {stats.playlistCount} playlists</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Público Hoje</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">{stats.audienceToday.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs">
                  {audienceChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={audienceChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {audienceChange >= 0 ? '+' : ''}{audienceChange}% vs ontem
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">{stats.avgAttentionTime.toFixed(1)}s</div>
                <p className="text-xs text-muted-foreground">Duração da atenção</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audiência ao vivo (broadcast Realtime do /play) */}
      <LiveAudienceWidget />

      {/* Feed ao vivo dos players */}
      <LivePlayerFeed />

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle>Público por Horário</CardTitle>
            <CardDescription>Detecções de pessoas ao longo do dia</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={audienceByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 12 }}
                    interval={2}
                  />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="people" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle>Distribuição por Gênero</CardTitle>
            <CardDescription>Análise demográfica do público</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={genderDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {genderDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center space-x-4 mt-2">
                  {genderDistribution.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-muted-foreground">{item.name}: {item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Faixa etária e Emoções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle>Distribuição por Faixa Etária</CardTitle>
            <CardDescription>Análise de idade do público detectado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smile className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Emoções Detectadas</CardTitle>
            </div>
            <CardDescription>Reações do público ao conteúdo exibido</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : emotionData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma emoção detectada hoje
              </div>
            ) : (
              <div className="space-y-4">
                {emotionData.map((emotion, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{emotion.name}</div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${emotion.percentage}%`,
                          backgroundColor: EMOTION_COLORS[emotion.name] || '#94a3b8'
                        }}
                      />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm font-medium">{emotion.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">({emotion.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Conteúdos */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Conteúdos Mais Vistos</CardTitle>
          </div>
          <CardDescription>Performance de engajamento por conteúdo hoje</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : topContent.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Nenhum dado de conteúdo disponível
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Conteúdo</th>
                    <th className="text-right py-3 px-2 font-medium">Visualizações</th>
                    <th className="text-right py-3 px-2 font-medium">Tempo Médio</th>
                    <th className="text-right py-3 px-2 font-medium">Emoção Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {topContent.map((content, index) => (
                    <tr key={content.contentId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                          <span className="font-medium truncate max-w-[200px]">{content.contentName}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono">{content.views}</td>
                      <td className="text-right py-3 px-2 font-mono">{content.avgAttention.toFixed(1)}s</td>
                      <td className="text-right py-3 px-2">
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: `${EMOTION_COLORS[content.topEmotion] || '#94a3b8'}20`,
                            color: EMOTION_COLORS[content.topEmotion] || '#94a3b8'
                          }}
                        >
                          {content.topEmotion}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
