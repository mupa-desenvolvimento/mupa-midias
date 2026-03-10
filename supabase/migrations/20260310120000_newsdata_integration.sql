-- News module: support non-RSS collectors (e.g., NewsData.io) and preserve compatibility with RSS

ALTER TABLE public.news_feeds
ADD COLUMN IF NOT EXISTS collector text NOT NULL DEFAULT 'rss',
ADD COLUMN IF NOT EXISTS query text;

CREATE INDEX IF NOT EXISTS idx_news_feeds_collector ON public.news_feeds(collector);

ALTER TABLE public.news_articles
ADD COLUMN IF NOT EXISTS api_source text,
ADD COLUMN IF NOT EXISTS api_article_id text,
ADD COLUMN IF NOT EXISTS source_priority integer;

CREATE INDEX IF NOT EXISTS idx_news_articles_api_source ON public.news_articles(api_source);
CREATE INDEX IF NOT EXISTS idx_news_articles_api_article_id ON public.news_articles(api_article_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_news_articles_api_source_article_id
ON public.news_articles(api_source, api_article_id)
WHERE api_source IS NOT NULL AND api_article_id IS NOT NULL;

