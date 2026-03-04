
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NewsFeed {
  id: string;
  name: string;
  category: string;
  rss_url: string;
  active: boolean;
  priority: number;
  created_at?: string;
}

export interface NewsArticle {
  id: string;
  feed_id: string;
  title: string;
  description: string;
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
      const { data, error } = await supabase.functions.invoke('rss-collector');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-articles"] });
      toast.success("Coleta de notícias iniciada");
    },
    onError: (err: any) => {
      console.error("News Collection Error:", err);
      const msg = err.message || "Erro desconhecido";
      toast.error(`Erro ao coletar notícias: ${msg}`);
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
    triggerCollection
  };
}
