
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NewsFeed {
  id: string;
  name: string;
  category: string;
  rss_url: string;
  collector?: string;
  query?: string | null;
  active: boolean;
  priority: number;
  created_at?: string;
}

export interface NewsArticle {
  id: string;
  feed_id: string;
  title: string;
  description: string;
  link?: string;
  image_url?: string;
  source: string;
  category: string;
  published_at: string;
  active: boolean;
}

export interface NewsSettings {
  id: string;
  active_categories: string[];
  type_view: "list" | "grid" | "ticker";
  display_time: number;
  max_items: number;
  theme_mode: "light" | "dark" | "system";
  layout_type: "modern" | "classic" | "minimal";
}

export function useNews() {
  const queryClient = useQueryClient();
  const formatInvokeError = (err: any) => {
    const status = err?.context?.status;
    if (status === 404) return "Função não encontrada";
    if (status === 401 || status === 403) return "Sem permissão para executar a função";
    return err?.message || "Erro desconhecido";
  };

  // --- Feeds ---
  const { data: feeds, isLoading: isLoadingFeeds } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_feeds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar feeds de notícias");
        throw error;
      }
      return data as NewsFeed[];
    },
  });

  const addFeed = useMutation({
    mutationFn: async (feed: Partial<NewsFeed>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      if (!tenantId) throw new Error("Usuário sem tenant");

      const { data, error } = await supabase
        .from("news_feeds")
        .insert({
          tenant_id: tenantId,
          name: feed.name,
          category: feed.category || "Geral",
          rss_url: feed.rss_url,
          active: true,
          priority: feed.priority || 1
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      toast.success("Feed adicionado com sucesso");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao adicionar feed");
    }
  });

  const updateFeed = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NewsFeed> & { id: string }) => {
      const { error } = await supabase
        .from("news_feeds")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      toast.success("Feed atualizado");
    },
    onError: () => toast.error("Erro ao atualizar feed")
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("news_feeds")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      toast.success("Feed removido");
    },
    onError: () => toast.error("Erro ao remover feed")
  });

  // --- Categories ---
  const { data: categories } = useQuery({
    queryKey: ["news-categories"],
    queryFn: async () => {
      // Fetch distinct categories from active feeds
      const { data, error } = await supabase
        .from("news_feeds")
        .select("category")
        .eq("active", true);

      if (error) {
        console.error("Error fetching categories:", error);
        return [];
      }
      
      // Get unique values
      const uniqueCategories = Array.from(new Set(data.map(f => f.category).filter(Boolean)));
      return uniqueCategories as string[];
    },
  });

  // --- Articles ---
  const { data: articles, isLoading: isLoadingArticles } = useQuery({
    queryKey: ["news-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("active", true)
        .order("published_at", { ascending: false })
        .limit(50); // Initial limit

      if (error) throw error;
      return data as NewsArticle[];
    },
  });

  // --- Settings ---
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["news-settings"],
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("news_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error(error);
      }
      
      // Return default if not found
      if (!data) return {
        type_view: "list",
        display_time: 10,
        max_items: 20,
        theme_mode: "light",
        layout_type: "modern",
        active_categories: []
      } as NewsSettings;

      return data as NewsSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<NewsSettings>) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      if (!tenantId) throw new Error("Usuário sem tenant");

      // Check if exists
      const { data: existing } = await supabase
        .from("news_settings")
        .select("id")
        .eq("tenant_id", tenantId)
        .single();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from("news_settings")
          .update(newSettings)
          .eq("id", existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("news_settings")
          .insert({
            tenant_id: tenantId,
            ...newSettings
          });
        error = insertError;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-settings"] });
      toast.success("Configurações salvas");
    },
    onError: () => toast.error("Erro ao salvar configurações")
  });

  // --- Edge Function Trigger ---
  const triggerCollection = useMutation({
    mutationFn: async () => {
      const [rss, newsdata] = await Promise.all([
        supabase.functions.invoke('rss-collector', {
          body: { maxFeeds: 3, maxItems: 5, batchSize: 10, force: true },
        }),
        supabase.functions.invoke('newsdata-collector', {
          body: { maxFeeds: 4, maxItems: 10, batchSize: 20, force: true, timeframe: 1, country: "br", language: "pt" },
        }),
      ]);

      return {
        rss: rss.data ?? null,
        rss_error: rss.error ? formatInvokeError(rss.error) : null,
        newsdata: newsdata.data ?? null,
        newsdata_error: newsdata.error ? formatInvokeError(newsdata.error) : null,
      };
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["news-articles"] });
      const rssProcessed = data?.rss?.processed_feeds ?? 0;
      const newsdataProcessed = data?.newsdata?.processed_feeds ?? 0;
      const newsdataReqs = data?.newsdata?.api_requests ?? 0;

      if (data?.rss_error && data?.newsdata_error) {
        toast.error("Erro ao coletar notícias (RSS e NewsData)");
      } else if (data?.rss_error) {
        toast.error(`RSS: erro • NewsData: ${newsdataProcessed} feeds (${newsdataReqs} req)`);
      } else if (data?.newsdata_error) {
        toast.success(`RSS: ${rssProcessed} feeds processados • NewsData: erro`);
      } else if (data?.newsdata?.needs_migration) {
        toast.success(`RSS: ${rssProcessed} feeds processados • NewsData: precisa migração`);
      } else {
        toast.success(`RSS: ${rssProcessed} feeds • NewsData: ${newsdataProcessed} feeds (${newsdataReqs} req)`);
      }
      // Auto-trigger image cache after collection
      try {
        await supabase.functions.invoke('news-image-cache', { body: { batch: 5 } });
        queryClient.invalidateQueries({ queryKey: ["news-articles"] });
      } catch { /* silent */ }
    },
    onError: (err: any) => {
      console.error("News Collection Error:", err);
      toast.error(`Erro ao coletar notícias: ${err.message || "Erro desconhecido"}`);
    }
  });

  // --- Image Cache Trigger ---
  const triggerImageCache = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('news-image-cache', {
        body: { batch: 5 }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["news-articles"] });
      toast.success(`Cache de imagens: ${data?.cached ?? 0} imagens salvas`);
    },
    onError: (err: any) => {
      console.error("Image Cache Error:", err);
      toast.error(`Erro ao cachear imagens: ${err.message || "Erro desconhecido"}`);
    }
  });

  return {
    feeds,
    articles,
    categories,
    settings,
    isLoading: isLoadingFeeds || isLoadingArticles || isLoadingSettings,
    addFeed,
    updateFeed,
    deleteFeed,
    updateSettings,
    triggerCollection,
    triggerImageCache
  };
}
