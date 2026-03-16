import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  List,
  RefreshCw,
  Tv,
  Trash2,
  Eye,
  LayoutGrid,
  Quote,
} from "lucide-react";

interface MotivationalQuote {
  id: string;
  quote: string;
  author: string;
  image_url: string | null;
  is_active: boolean;
  used: boolean;
  created_at: string;
}

export default function MotivationalQuotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [seeding, setSeeding] = useState(false);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["motivational-quotes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("motivational_quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MotivationalQuote[];
    },
  });

  const activeCount = quotes.filter((q) => q.is_active).length;
  const usedCount = quotes.filter((q) => q.used).length;

  const seedMutation = useMutation({
    mutationFn: async () => {
      setSeeding(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-motivational`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ count: 200 }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao gerar frases");
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["motivational-quotes"] });
      toast({ title: `✨ ${data.inserted} frases geradas com sucesso` });
      setSeeding(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setSeeding(false);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("motivational_quotes")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivational-quotes"] });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("motivational_quotes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivational-quotes"] });
      toast({ title: "Frase removida" });
    },
  });

  const resetUsed = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("motivational_quotes")
        .update({ used: false, used_at: null })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivational-quotes"] });
      toast({ title: "Contador de uso resetado" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frases Motivacionais</h1>
        <p className="text-sm text-muted-foreground">Gerencie frases inspiradoras para exibição nas TVs</p>
      </div>
      {/* Stats + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Quote className="w-3.5 h-3.5 mr-1.5" />
            {quotes.length} frases
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 text-green-600 border-green-300">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {activeCount} ativas
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 text-amber-600 border-amber-300">
            <Tv className="w-3.5 h-3.5 mr-1.5" />
            {usedCount} exibidas
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetUsed.mutate()}
            disabled={usedCount === 0}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Resetar uso
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </Button>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seeding}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
          >
            {seeding ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1.5" />
            )}
            Gerar novas frases
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(`/motivational-tv`, "_blank")}
          >
            <Tv className="w-4 h-4 mr-1.5" />
            Abrir TV
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && quotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma frase ainda</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Clique em "Gerar novas frases" para buscar frases motivacionais da ZenQuotes API com imagens de fundo.
          </p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seeding}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Gerar frases
          </Button>
        </div>
      )}

      {/* Grid view */}
      {!isLoading && quotes.length > 0 && view === "grid" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <Card
              key={q.id}
              className={`group overflow-hidden animate-fade-in relative ${
                !q.is_active ? "opacity-50" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Background image */}
              {q.image_url && (
                <div className="absolute inset-0">
                  <img
                    src={q.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
                </div>
              )}
              <CardContent className="relative z-10 p-5 flex flex-col justify-between min-h-[200px]">
                <div>
                  <p className="text-white font-semibold text-sm leading-relaxed line-clamp-4 drop-shadow-lg">
                    "{q.quote}"
                  </p>
                  <p className="text-white/70 text-xs mt-2 drop-shadow">— {q.author}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={q.is_active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: q.id, is_active: checked })
                      }
                    />
                    <span className="text-white/60 text-xs">
                      {q.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {q.used && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 bg-white/20 text-white border-0">
                        Exibida
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/60 hover:text-red-400 hover:bg-white/10"
                      onClick={() => deleteQuote.mutate(q.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List view */}
      {!isLoading && quotes.length > 0 && view === "list" && (
        <div className="space-y-2">
          {quotes.map((q, i) => (
            <div
              key={q.id}
              className={`flex items-center gap-4 p-3 rounded-lg border bg-card animate-fade-in ${
                !q.is_active ? "opacity-50" : ""
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {q.image_url && (
                <img
                  src={q.image_url}
                  alt=""
                  className="w-16 h-12 object-cover rounded-md flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">"{q.quote}"</p>
                <p className="text-xs text-muted-foreground">— {q.author}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {q.used && (
                  <Badge variant="outline" className="text-[10px]">Exibida</Badge>
                )}
                <Switch
                  checked={q.is_active}
                  onCheckedChange={(checked) =>
                    toggleActive.mutate({ id: q.id, is_active: checked })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteQuote.mutate(q.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attribution */}
      <p className="text-[10px] text-muted-foreground text-center mt-8">
        Frases por ZenQuotes.io | Imagens por Pexels / Unsplash
      </p>
    </div>
  );
}
