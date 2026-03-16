import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, RefreshCw, Tv, Eye, LayoutGrid, List, Lightbulb, Plus, Filter,
} from "lucide-react";

interface Curiosity {
  id: string;
  title: string;
  content: string | null;
  category: string;
  image_url: string | null;
  is_active: boolean;
  used: boolean;
  created_at: string;
}

const CATEGORIES = [
  "ciência", "história", "natureza", "tecnologia", "corpo humano",
  "espaço", "animais", "geografia", "cultura", "alimentação",
];

export default function CuriositiesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [creatingSlide, setCreatingSlide] = useState(false);

  const { data: curiosities = [], isLoading } = useQuery({
    queryKey: ["curiosities", categoryFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("curiosities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Curiosity[];
    },
  });

  // Poll job status
  React.useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const { data } = await (supabase as any)
        .from("processing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (data) {
        setProgress(data.progress || 0);
        setProgressText(data.result || `Processando... ${data.progress}%`);
        if (data.status === "completed") {
          clearInterval(interval);
          setGenerating(false);
          setJobId(null);
          setProgress(100);
          toast({ title: "Curiosidades geradas!", description: data.result });
          queryClient.invalidateQueries({ queryKey: ["curiosities"] });
        } else if (data.status === "failed") {
          clearInterval(interval);
          setGenerating(false);
          setJobId(null);
          toast({ title: "Erro na geração", description: data.error, variant: "destructive" });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, toast, queryClient]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setProgressText("Iniciando geração de 1000 curiosidades...");
    try {
      const { data, error } = await supabase.functions.invoke("seed-curiosities", {
        body: { tenantId: null },
      });
      if (error) throw error;
      if (data?.job_id) {
        setJobId(data.job_id);
        toast({ title: "Geração iniciada!", description: "1000 curiosidades estão sendo geradas em segundo plano." });
      }
    } catch (err: any) {
      setGenerating(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateSlide = async (category: string) => {
    setCreatingSlide(true);
    try {
      const catLabel = category === "all" ? "Todas as categorias" : category;
      const { error } = await (supabase as any).from("media_items").insert({
        name: `Curiosidades - ${catLabel}`,
        type: "curiosity_slide",
        status: "active",
        duration: 15,
        metadata: {
          auto_content: true,
          curiosity_category: category === "all" ? null : category,
        },
      });
      if (error) throw error;
      toast({ title: "Slide criado!", description: `"Curiosidades - ${catLabel}" disponível para playlists.` });
    } catch (err: any) {
      toast({ title: "Erro ao criar slide", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSlide(false);
    }
  };

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("curiosities")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["curiosities"] }),
  });

  const activeCount = curiosities.filter((c) => c.is_active).length;
  const totalCount = curiosities.length;
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = curiosities.filter((c) => c.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-primary" />
            Curiosidades
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gere e gerencie curiosidades para exibição nas TVs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleCreateSlide(categoryFilter)} disabled={creatingSlide || totalCount === 0} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Slide
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {generating ? "Gerando..." : "Gerar 1000 Curiosidades"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {generating && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {progressText}
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setCategoryFilter("all")}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        {CATEGORIES.slice(0, 4).map((cat) => (
          <Card key={cat} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setCategoryFilter(cat)}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{categoryCounts[cat] || 0}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{cat}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant={view === "grid" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("grid")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={view === "list" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("list")}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-primary/60" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Nenhuma curiosidade gerada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Gerar 1000 Curiosidades" para criar conteúdo automaticamente com IA.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Gerar Curiosidades
            </Button>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {curiosities.map((c) => (
            <Card key={c.id} className="overflow-hidden flex flex-col group">
              {c.image_url && (
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={c.image_url}
                    alt={c.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <Badge className="absolute top-2 right-2 capitalize text-[10px]">{c.category}</Badge>
                </div>
              )}
              <CardContent className="p-3 flex-1 flex flex-col">
                <h4 className="font-semibold text-sm leading-tight">{c.title}</h4>
                {c.content && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{c.content}</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  {!c.image_url && <Badge variant="outline" className="capitalize text-[10px]">{c.category}</Badge>}
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: c.id, is_active: v })}
                    className="ml-auto"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {curiosities.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-center gap-3">
                {c.image_url && (
                  <img src={c.image_url} alt="" className="w-16 h-10 object-cover rounded" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{c.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{c.content}</p>
                </div>
                <Badge variant="outline" className="capitalize text-[10px] shrink-0">{c.category}</Badge>
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(v) => toggleActive.mutate({ id: c.id, is_active: v })}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
