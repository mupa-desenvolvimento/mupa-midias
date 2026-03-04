
-- Tabela de Feeds RSS
CREATE TABLE IF NOT EXISTS public.news_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  rss_url TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de Artigos de Notícias
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES public.news_feeds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  link TEXT,
  image_url TEXT,
  category TEXT,
  source TEXT,
  slug TEXT,
  published_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  active BOOLEAN DEFAULT true,
  UNIQUE(slug)
);

-- Tabela de Configurações de Notícias (por tenant)
CREATE TABLE IF NOT EXISTS public.news_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_categories JSONB DEFAULT '[]'::jsonb,
  type_view TEXT DEFAULT 'list', -- 'list', 'grid', 'ticker'
  display_time INTEGER DEFAULT 10,
  max_items INTEGER DEFAULT 20,
  theme_mode TEXT DEFAULT 'light', -- 'light', 'dark', 'system'
  layout_type TEXT DEFAULT 'modern', -- 'modern', 'classic', 'minimal'
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_news_feeds_tenant_id ON public.news_feeds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_news_feeds_active ON public.news_feeds(active);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed_id ON public.news_articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_slug ON public.news_articles(slug);
CREATE INDEX IF NOT EXISTS idx_news_settings_tenant_id ON public.news_settings(tenant_id);

-- Enable RLS
ALTER TABLE public.news_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_settings ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_news_feeds_updated_at BEFORE UPDATE ON public.news_feeds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_news_settings_updated_at BEFORE UPDATE ON public.news_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies for news_feeds
CREATE POLICY "Tenant users can view news feeds" ON public.news_feeds
  FOR SELECT USING (can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage news feeds" ON public.news_feeds
  FOR ALL USING (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id));

-- Policies for news_articles
-- Articles are accessible if the user can access the feed they belong to
CREATE POLICY "Tenant users can view news articles" ON public.news_articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.news_feeds f
      WHERE f.id = feed_id
      AND can_access_tenant_data(auth.uid(), f.tenant_id)
    )
  );

-- Only system/admin or edge functions should typically insert/update articles, 
-- but tenant admins might want to manually manage them (delete/hide).
CREATE POLICY "Tenant admins can manage news articles" ON public.news_articles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.news_feeds f
      WHERE f.id = feed_id
      AND is_tenant_admin(auth.uid())
      AND can_access_tenant_data(auth.uid(), f.tenant_id)
    )
  );

-- Policies for news_settings
CREATE POLICY "Tenant users can view news settings" ON public.news_settings
  FOR SELECT USING (can_access_tenant_data(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage news settings" ON public.news_settings
  FOR ALL USING (is_tenant_admin(auth.uid()) AND can_access_tenant_data(auth.uid(), tenant_id));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_feeds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_settings;
