import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Instagram, RefreshCw, Plus, ExternalLink, Image, Video, LayoutGrid, List, Settings, Eye, Calendar,
} from "lucide-react";

interface InstagramPost {
  id: string;
  instagram_id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface InstagramSettings {
  id: string;
  access_token: string | null;
  username: string | null;
  instagram_user_id: string | null;
  is_active: boolean;
  fetch_days: number;
  last_fetched_at: string | null;
}

export default function InstagramFeedManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [fetching, setFetching] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingSlide, setCreatingSlide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [fetchDays, setFetchDays] = useState("10");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");

  // Fetch settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["instagram-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("instagram_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setFetchDays(String(data.fetch_days || 10));
        setTokenInput(data.access_token ? "••••••••••" : "");
      }
      return data as InstagramSettings | null;
    },
  });

  // Fetch posts
  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["instagram-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("instagram_posts")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as InstagramPost[];
    },
  });

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const token = tokenInput.startsWith("••") ? undefined : tokenInput;
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      const { data, error } = await supabase.functions.invoke("instagram-fetch", {
        body: {
          action: "save-settings",
          tenantId,
          accessToken: token,
          fetchDays: parseInt(fetchDays),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Configurações salvas!",
        description: data?.username ? `Conectado como @${data.username}` : "Token salvo com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["instagram-settings"] });
      setShowSettings(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFetchPosts = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-fetch", {
        body: {
          action: "fetch-posts",
          tenantId: null,
          fetchDays: parseInt(fetchDays),
          sinceDate: customSince || undefined,
          untilDate: customUntil || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Posts importados!",
        description: `${data.total_found} posts encontrados, ${data.inserted} novos salvos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["instagram-posts"] });
    } catch (err: any) {
      toast({ title: "Erro ao buscar posts", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const handleCreateSlide = async () => {
    setCreatingSlide(true);
    try {
      const { error } = await (supabase as any).from("media_items").insert({
        name: `Instagram Feed${settings?.username ? ` - @${settings.username}` : ""}`,
        type: "instagram_slide",
        status: "active",
        duration: 10,
        metadata: {
          auto_content: true,
          instagram_feed: true,
          fetch_days: parseInt(fetchDays),
        },
      });
      if (error) throw error;
      toast({ title: "Slide criado!", description: "Instagram Feed disponível para playlists." });
    } catch (err: any) {
      toast({ title: "Erro ao criar slide", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSlide(false);
    }
  };

  const togglePostActive = async (id: string, is_active: boolean) => {
    await (supabase as any).from("instagram_posts").update({ is_active }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["instagram-posts"] });
  };

  const imageCount = posts.filter(p => p.media_type === "IMAGE" || p.media_type === "CAROUSEL_ALBUM").length;
  const videoCount = posts.filter(p => p.media_type === "VIDEO").length;
  const activeCount = posts.filter(p => p.is_active).length;
  const isConnected = !!settings?.access_token;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Instagram className="w-6 h-6 text-pink-500" />
            Instagram Feed
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Importe posts do Instagram para exibir nas TVs.
            {settings?.username && (
              <span className="ml-2 text-foreground font-medium">@{settings.username}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)} className="gap-2">
            <Settings className="w-4 h-4" />
            Configurar
          </Button>
          {isConnected && (
            <>
              <Button size="sm" variant="outline" onClick={handleCreateSlide} disabled={creatingSlide || posts.length === 0} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Slide
              </Button>
              <Button size="sm" onClick={handleFetchPosts} disabled={fetching} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
                {fetching ? "Buscando..." : "Buscar Posts"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração do Instagram</CardTitle>
            <CardDescription>
              Obtenha um Access Token em{" "}
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                developers.facebook.com
              </a>
              {" "}→ Instagram Graph API → Token de acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Access Token do Instagram</Label>
              <Input
                type="password"
                placeholder="Insira o token de acesso..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Período padrão (dias)</Label>
                <Select value={fetchDays} onValueChange={setFetchDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Últimos 3 dias</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="10">Últimos 10 dias</SelectItem>
                    <SelectItem value="15">Últimos 15 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="60">Últimos 60 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data início (opcional)</Label>
                <Input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data fim (opcional)</Label>
                <Input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveSettings} disabled={savingSettings || !tokenInput} className="gap-2">
                {savingSettings ? "Salvando..." : "Salvar Configuração"}
              </Button>
              <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{posts.length}</p>
            <p className="text-[11px] text-muted-foreground">Total Posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Image className="w-4 h-4 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">{imageCount}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Imagens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Video className="w-4 h-4 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">{videoCount}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Vídeos</p>
          </CardContent>
        </Card>
      </div>

      {/* View toggle */}
      {posts.length > 0 && (
        <div className="flex items-center gap-1 justify-end">
          <Button variant={view === "grid" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("grid")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={view === "list" ? "default" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("list")}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      {loadingPosts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : !isConnected ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Instagram className="w-8 h-8 text-pink-500/60" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Instagram não configurado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Configurar" para adicionar seu Access Token e começar a importar posts.
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowSettings(true)} className="gap-2">
              <Settings className="w-4 h-4" />
              Configurar Instagram
            </Button>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Instagram className="w-8 h-8 text-pink-500/60" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Nenhum post importado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Buscar Posts" para importar os posts dos últimos {fetchDays} dias.
              </p>
            </div>
            <Button onClick={handleFetchPosts} disabled={fetching} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Buscar Posts Agora
            </Button>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden flex flex-col group">
              <div className="relative aspect-square overflow-hidden bg-muted">
                {(post.media_url || post.thumbnail_url) ? (
                  <img
                    src={post.media_type === "VIDEO" ? (post.thumbnail_url || post.media_url || "") : (post.media_url || "")}
                    alt={post.caption?.slice(0, 50) || "Instagram post"}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Instagram className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur">
                    {post.media_type === "VIDEO" ? <Video className="w-3 h-3 mr-1" /> : <Image className="w-3 h-3 mr-1" />}
                    {post.media_type}
                  </Badge>
                </div>
                {post.permalink && (
                  <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <CardContent className="p-3 flex-1 flex flex-col">
                {post.caption && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.posted_at ? new Date(post.posted_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                  <Switch
                    checked={post.is_active}
                    onCheckedChange={(v) => togglePostActive(post.id, v)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Card key={post.id} className="p-3">
              <div className="flex items-center gap-3">
                {(post.media_url || post.thumbnail_url) && (
                  <img
                    src={post.media_type === "VIDEO" ? (post.thumbnail_url || post.media_url || "") : (post.media_url || "")}
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.caption || "Sem legenda"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {post.posted_at ? new Date(post.posted_at).toLocaleDateString("pt-BR") : "—"} • {post.media_type}
                  </p>
                </div>
                <Badge variant={post.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                  {post.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <Switch checked={post.is_active} onCheckedChange={(v) => togglePostActive(post.id, v)} />
                {post.permalink && (
                  <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
