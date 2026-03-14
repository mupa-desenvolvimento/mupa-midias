import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  Sparkles,
  Send,
  Heart,
  ShoppingBag,
  Monitor,
  Tv,
  Loader2,
  Eye,
  Clock,
  Zap,
  Activity,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import inkyAvatar from "@/assets/inky-avatar.png";

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1200, suffix = "", prefix = "" }: { value: number; duration?: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{prefix}{display.toLocaleString("pt-BR")}{suffix}</span>;
}

// ─── Mini Bar Chart (CSS-only) ───────────────────────────────────────────────
function MiniBarChart({ data, color = "bg-primary" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${color} transition-all duration-700 ease-out`}
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value > 0 ? 4 : 0,
              animationDelay: `${i * 60}ms`,
            }}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut Ring (SVG) ────────────────────────────────────────────────────────
function DonutRing({ segments, size = 100 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = 36;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" opacity="0.3" />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-semibold ml-auto">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar ──────────────────────────────────────────────────────────
function HorizontalBar({ label, value, max, color, delay = 0 }: { label: string; value: number; max: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / (max || 1)) * 100), 100 + delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-muted/40 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data, color = "hsl(var(--primary))", height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const width = 120;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4)}`).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        opacity="0.1"
      />
    </svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type InsightSection = "full-analysis" | "audience" | "recommendations" | "segmentation" | "trade-marketing" | "monetization";

const SECTIONS: { id: InsightSection; label: string; icon: React.ElementType; description: string; gradient: string }[] = [
  { id: "full-analysis", label: "Visão Geral", icon: Brain, description: "Análise completa com IA", gradient: "from-purple-500 to-indigo-600" },
  { id: "audience", label: "Audiência", icon: Users, description: "Perfil demográfico", gradient: "from-blue-500 to-cyan-500" },
  { id: "recommendations", label: "Recomendações", icon: ShoppingBag, description: "Cross-sell inteligente", gradient: "from-green-500 to-emerald-500" },
  { id: "segmentation", label: "Segmentação", icon: Target, description: "Conteúdo por perfil", gradient: "from-orange-500 to-amber-500" },
  { id: "trade-marketing", label: "Trade Marketing", icon: BarChart3, description: "Audiência por campanha", gradient: "from-cyan-500 to-blue-500" },
  { id: "monetization", label: "Monetização", icon: DollarSign, description: "Valoração de tela", gradient: "from-yellow-500 to-orange-500" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inky-insights`;

const EMOTION_COLORS: Record<string, string> = {
  Neutro: "#94a3b8",
  Feliz: "#22c55e",
  Triste: "#3b82f6",
  Raiva: "#ef4444",
  Medo: "#a855f7",
  Nojo: "#f97316",
  Surpreso: "#eab308",
};

// ─── Page ────────────────────────────────────────────────────────────────────
const InkyIntelligence = () => {
  const [activeTab, setActiveTab] = useState<InsightSection>("full-analysis");
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const { toast } = useToast();

  const {
    stats,
    audienceByHour,
    genderDistribution,
    ageDistribution,
    emotionData,
    topContent,
    isLoading: metricsLoading,
  } = useDashboardAnalytics();

  // ─── AI Stream ──────────────────────────────────────────────────────────────
  const streamInsight = useCallback(
    async (section: InsightSection, customQuestion?: string) => {
      setLoadingSection(section);
      setInsights((prev) => ({ ...prev, [section]: "" }));

      try {
        const resp = await fetch(`${CHAT_URL}?action=${section}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ question: customQuestion || "" }),
        });

        if (!resp.ok) {
          if (resp.status === 429) { toast({ title: "Limite excedido", description: "Tente novamente em instantes.", variant: "destructive" }); return; }
          if (resp.status === 402) { toast({ title: "Créditos insuficientes", variant: "destructive" }); return; }
          throw new Error("Erro ao gerar insights");
        }
        if (!resp.body) throw new Error("No stream");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                setInsights((prev) => ({ ...prev, [section]: accumulated }));
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
        // flush
        if (buffer.trim()) {
          for (let raw of buffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) { accumulated += content; setInsights((prev) => ({ ...prev, [section]: accumulated })); }
            } catch { continue; }
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        toast({ title: "Erro", description: "Falha ao gerar análise.", variant: "destructive" });
      } finally {
        setLoadingSection(null);
      }
    },
    [toast]
  );

  const handleAskQuestion = () => {
    if (!question.trim()) return;
    streamInsight(activeTab, question);
    setQuestion("");
  };

  const audienceChange = stats.audienceYesterday > 0
    ? Math.round(((stats.audienceToday - stats.audienceYesterday) / stats.audienceYesterday) * 100)
    : 0;

  const hourlyValues = audienceByHour.map(h => h.people);
  const peakHour = audienceByHour.reduce((max, h) => h.people > max.people ? h : max, { hour: "--", people: 0 });

  const currentSection = SECTIONS.find((s) => s.id === activeTab)!;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-500/20">
            <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
        </div>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            Inky Intelligence
            <Badge variant="outline" className="text-[10px] font-normal">AI-Powered</Badge>
          </h1>
          <p className="text-xs text-muted-foreground">Dados em tempo real • Atualizado a cada 30s</p>
        </div>
      </div>

      {/* ── KPI Cards Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Audience Today */}
        <Card className="overflow-hidden animate-scale-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Audiência Hoje</p>
                <p className="text-2xl font-bold mt-1">
                  <AnimatedCounter value={stats.audienceToday} />
                </p>
                <div className={`flex items-center gap-1 mt-1 text-[11px] font-medium ${audienceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {audienceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {audienceChange >= 0 ? "+" : ""}{audienceChange}% vs ontem
                </div>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-3">
              <Sparkline data={hourlyValues} color="hsl(217, 91%, 60%)" />
            </div>
          </CardContent>
        </Card>

        {/* Devices Online */}
        <Card className="overflow-hidden animate-scale-in" style={{ animationDelay: "80ms" }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dispositivos</p>
                <p className="text-2xl font-bold mt-1">
                  <AnimatedCounter value={stats.devicesOnline} />
                  <span className="text-sm font-normal text-muted-foreground">/{stats.totalDevices}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Online agora</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Monitor className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={stats.totalDevices > 0 ? (stats.devicesOnline / stats.totalDevices) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Attention */}
        <Card className="overflow-hidden animate-scale-in" style={{ animationDelay: "160ms" }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Atenção Média</p>
                <p className="text-2xl font-bold mt-1">
                  <AnimatedCounter value={Math.round(stats.avgAttentionTime)} suffix="s" />
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Pico às {peakHour.hour}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-3">
              <Sparkline data={hourlyValues} color="hsl(270, 70%, 60%)" />
            </div>
          </CardContent>
        </Card>

        {/* Active Content */}
        <Card className="overflow-hidden animate-scale-in" style={{ animationDelay: "240ms" }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Conteúdo Ativo</p>
                <p className="text-2xl font-bold mt-1">
                  <AnimatedCounter value={stats.activeMedia} />
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{stats.playlistCount} playlists</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Tv className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={Math.min(stats.activeMedia * 2, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Visual Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gender Donut */}
        <Card className="animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Gênero
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <DonutRing
              segments={genderDistribution.map(g => ({
                value: g.value,
                color: g.color,
                label: g.name,
              }))}
            />
          </CardContent>
        </Card>

        {/* Age Distribution Bars */}
        <Card className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Faixa Etária
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {ageDistribution.map((age, i) => (
              <HorizontalBar
                key={age.range}
                label={age.range}
                value={age.count}
                max={Math.max(...ageDistribution.map(a => a.count), 1)}
                color={["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"][i] || "#94a3b8"}
                delay={i * 100}
              />
            ))}
          </CardContent>
        </Card>

        {/* Emotions */}
        <Card className="animate-fade-in" style={{ animationDelay: "500ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Emoções
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {emotionData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados de emoções hoje</p>
            ) : (
              emotionData.slice(0, 5).map((em, i) => (
                <HorizontalBar
                  key={em.name}
                  label={em.name}
                  value={em.count}
                  max={Math.max(...emotionData.map(e => e.count), 1)}
                  color={EMOTION_COLORS[em.name] || "#94a3b8"}
                  delay={i * 100}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Hourly Audience + Top Content ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hourly */}
        <Card className="animate-fade-in" style={{ animationDelay: "600ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
              Audiência por Hora
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <MiniBarChart
              data={audienceByHour.filter((_, i) => i >= 6 && i <= 22).map(h => ({
                label: h.hour.replace(":00", "h"),
                value: h.people,
              }))}
              color="bg-cyan-500"
            />
          </CardContent>
        </Card>

        {/* Top Content */}
        <Card className="animate-fade-in" style={{ animationDelay: "700ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Top Conteúdos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {topContent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados de conteúdo hoje</p>
            ) : (
              <div className="space-y-2.5">
                {topContent.map((c, i) => (
                  <div key={c.contentId} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${800 + i * 80}ms` }}>
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.contentName}</p>
                      <p className="text-[10px] text-muted-foreground">{c.views} views • {c.avgAttention.toFixed(1)}s atenção • {c.topEmotion}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.views}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── AI Analysis Section ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section pills */}
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const hasContent = !!insights[section.id];
            const isActive = activeTab === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-r ${section.gradient} text-white shadow-lg scale-105`
                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {section.label}
                {hasContent && !isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              </button>
            );
          })}
        </div>

        {/* AI Content Card */}
        <Card className="border-purple-500/10 overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${currentSection.gradient}`} />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${currentSection.gradient} text-white`}>
                  <currentSection.icon className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{currentSection.label}</CardTitle>
                  <CardDescription className="text-xs">{currentSection.description}</CardDescription>
                </div>
              </div>
              <Button
                onClick={() => streamInsight(activeTab)}
                disabled={loadingSection === activeTab}
                size="sm"
                className={`bg-gradient-to-r ${currentSection.gradient} hover:opacity-90 text-white`}
              >
                {loadingSection === activeTab ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analisando</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" />{insights[activeTab] ? "Reanalisar" : "Gerar Análise"}</>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Question input */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Pergunte algo específico ao Inky..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAskQuestion(); }}
                disabled={loadingSection !== null}
                className="text-sm h-9"
              />
              <Button onClick={handleAskQuestion} disabled={!question.trim() || loadingSection !== null} size="icon" variant="outline" className="h-9 w-9 shrink-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Insight content */}
            <ScrollArea className="h-[400px]">
              {loadingSection === activeTab && !insights[activeTab] ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/50">
                      <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Analisando dados...</p>
                    <p className="text-xs text-muted-foreground mt-1">Processando padrões e insights</p>
                  </div>
                </div>
              ) : insights[activeTab] ? (
                <div className="prose prose-sm dark:prose-invert max-w-none
                  [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:pb-1 [&>h2]:border-b [&>h2]:border-border
                  [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-3
                  [&>table]:w-full [&>table]:text-xs [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_th]:bg-muted/50 [&_tr]:border-b [&_tr]:border-border
                  [&>ul]:text-sm [&>ol]:text-sm [&>p]:text-sm
                  [&_strong]:text-foreground
                ">
                  <ReactMarkdown>{insights[activeTab]}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-muted opacity-40">
                    <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Clique em "Gerar Análise" para insights de IA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Os gráficos acima mostram dados em tempo real
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InkyIntelligence;
