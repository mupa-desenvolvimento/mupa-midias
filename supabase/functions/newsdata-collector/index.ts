// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

const NEWSDATA_ENDPOINT = "https://newsdata.io/api/1/latest";

const DEFAULT_MAX_FEEDS_PER_RUN = 4;
const DEFAULT_MAX_ITEMS_PER_REQUEST = 10;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_TIMEFRAME_DAYS = 1;
const MAX_RUNTIME_MS = 50000;

type NewsDataResult = {
  article_id?: string;
  title?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  link?: string;
  image_url?: string;
  source_id?: string;
  source_priority?: number;
  country?: string[];
  category?: string[];
  language?: string;
};

type NewsDataResponse = {
  status?: string;
  totalResults?: number;
  results?: NewsDataResult[];
  nextPage?: string;
  error?: string;
  message?: string;
};

function timeExceeded(startTime: number) {
  return Date.now() - startTime >= MAX_RUNTIME_MS;
}

function safeString(input: unknown, maxLen = 255) {
  if (input == null) return "";
  return String(input).replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeIsoDate(input: unknown) {
  const fallback = new Date().toISOString();
  if (!input) return fallback;
  const d = new Date(String(input));
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function sanitizeSlugPart(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

function createSlugFromNewsData(result: NewsDataResult) {
  if (result.article_id) return `newsdata-${sanitizeSlugPart(result.article_id)}`;
  const title = safeString(result.title, 120);
  const pubDate = normalizeIsoDate(result.pubDate).slice(0, 10);
  const link = safeString(result.link, 120);
  return sanitizeSlugPart(`newsdata-${title}-${pubDate}-${link}`);
}

function mapLocalCategoryToNewsData(localCategory: string | null) {
  const c = (localCategory || "").trim().toLowerCase();
  if (!c) return null;

  const mapping: Record<string, string> = {
    geral: "top",
    politica: "politics",
    economia: "business",
    negocios: "business",
    tecnologia: "technology",
    esportes: "sports",
    saude: "health",
    ciencia: "science",
    entretenimento: "entertainment",
    mundo: "world",
    brasil: "top",
    cotidiano: "top",
  };

  return mapping[c] || null;
}

function isMissingColumn(err: any, columnName: string) {
  const msg = (err?.message || "").toString().toLowerCase();
  const details = (err?.details || "").toString().toLowerCase();
  const hint = (err?.hint || "").toString().toLowerCase();
  const code = (err?.code || "").toString();
  const col = columnName.toLowerCase();
  return code === "42703" || (msg.includes(col) && (msg.includes("does not exist") || details.includes("does not exist") || hint.includes("does not exist")));
}

async function fetchJsonWithRetry(url: string, retries: number) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (res.status === 429) {
        throw new Error(`rate_limited (HTTP 429): ${json?.message || json?.error || "NewsData"}`);
      }

      if (!res.ok) {
        throw new Error(`http_error (HTTP ${res.status}): ${json?.message || json?.error || text?.slice(0, 200) || "NewsData"}`);
      }

      return json;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const backoffMs = 300 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("NewsData request failed");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const newsDataApiKey = Deno.env.get("NEWSDATA_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Configuração incompleta (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!newsDataApiKey) {
      return new Response(JSON.stringify({ error: "NEWSDATA_API_KEY não configurada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    let payload: any = {};
    try {
      const rawBody = await req.text();
      if (rawBody) payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    const maxFeeds = Math.max(1, Math.min(Number(payload.maxFeeds) || DEFAULT_MAX_FEEDS_PER_RUN, 50));
    const itemsPerRequest = Math.max(1, Math.min(Number(payload.maxItems) || DEFAULT_MAX_ITEMS_PER_REQUEST, 10));
    const batchSize = Math.max(1, Math.min(Number(payload.batchSize) || DEFAULT_BATCH_SIZE, 50));
    const shouldCleanup = payload.cleanup === true;
    const force = payload.force === true;

    const country = safeString(payload.country || "br", 8).toLowerCase();
    const language = safeString(payload.language || "pt", 8).toLowerCase();
    const timeframe = Math.max(1, Math.min(Number(payload.timeframe) || DEFAULT_TIMEFRAME_DAYS, 30));

    const { count: totalFeeds, error: countError } = await supabaseClient
      .from("news_feeds")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("collector", "newsdata");

    if (countError) {
      if (isMissingColumn(countError, "collector")) {
        return new Response(
          JSON.stringify({
            message: "NewsData.io ainda não está habilitado no banco (faltam colunas em news_feeds).",
            needs_migration: true,
            total_feeds: 0,
            processed_feeds: 0,
            api_requests: 0,
            upsert_attempted: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw countError;
    }

    const total = totalFeeds || 0;
    if (total === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum feed (collector=newsdata) ativo encontrado.", total_feeds: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const providedOffset = Number.isFinite(Number(payload.offset)) ? Number(payload.offset) : null;
    const rotationSeed = Math.floor(Date.now() / 3600000);
    const offset = providedOffset ?? (force ? 0 : ((rotationSeed * maxFeeds) % total));

    const { data: feeds, error: feedsError } = await supabaseClient
      .from("news_feeds")
      .select("id,tenant_id,name,category,query,priority")
      .eq("active", true)
      .eq("collector", "newsdata")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .range(offset, Math.min(offset + maxFeeds - 1, total - 1));

    if (feedsError) {
      if (isMissingColumn(feedsError, "collector") || isMissingColumn(feedsError, "query")) {
        return new Response(
          JSON.stringify({
            message: "NewsData.io ainda não está habilitado no banco (faltam colunas em news_feeds).",
            needs_migration: true,
            total_feeds: total,
            processed_feeds: 0,
            api_requests: 0,
            upsert_attempted: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw feedsError;
    }
    if (!feeds || feeds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum feed no intervalo solicitado.", offset, total_feeds: total }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results: any[] = [];
    let upsertAttempted = 0;
    let apiRequests = 0;

    for (const feed of feeds) {
      if (timeExceeded(startTime)) {
        results.push({ feed: feed.name, status: "skipped", reason: "time_budget_exceeded" });
        break;
      }

      try {
        const apiCategory = mapLocalCategoryToNewsData(feed.category);

        const url = new URL(NEWSDATA_ENDPOINT);
        url.searchParams.set("apikey", newsDataApiKey);
        url.searchParams.set("country", country);
        url.searchParams.set("language", language);
        // timeframe removed - not available on free plan
        url.searchParams.set("size", String(itemsPerRequest));

        if (apiCategory) url.searchParams.set("category", apiCategory);

        const q = safeString(feed.query, 500);
        if (q) url.searchParams.set("q", q);

        const json = (await fetchJsonWithRetry(url.toString(), 2)) as NewsDataResponse;
        apiRequests += 1;

        if (!json || json.status !== "success") {
          throw new Error(json?.message || json?.error || "Resposta inválida do NewsData");
        }

        const items = Array.isArray(json.results) ? json.results : [];
        const articles = items.map((item: NewsDataResult) => {
          const publishedAt = normalizeIsoDate(item.pubDate);
          const slug = createSlugFromNewsData(item);
          const title = safeString(item.title || "Sem título", 255);

          return {
            feed_id: feed.id,
            title,
            description: safeString(item.description, 300),
            content: safeString(item.content, 4000),
            link: safeString(item.link, 2000) || null,
            image_url: safeString(item.image_url, 2000) || null,
            category: safeString(feed.category, 80) || safeString(apiCategory, 80) || "geral",
            source: safeString(item.source_id || feed.name || "newsdata", 120),
            slug,
            published_at: publishedAt,
            active: true,
            api_source: "newsdata",
            api_article_id: item.article_id || null,
            source_priority: Number.isFinite(Number(item.source_priority)) ? Number(item.source_priority) : null,
          };
        });

        for (let i = 0; i < articles.length; i += batchSize) {
          if (timeExceeded(startTime)) break;

          const batch = articles.slice(i, i + batchSize);
          const { error } = await supabaseClient
            .from("news_articles")
            .upsert(batch, { onConflict: "slug", ignoreDuplicates: true });

          if (error) {
            throw error;
          }

          upsertAttempted += batch.length;
        }

        results.push({
          feed: feed.name,
          status: "success",
          items_received: items.length,
          items_upsert_attempted: articles.length,
          api_category: apiCategory,
          q: q || null,
        });
      } catch (err: any) {
        results.push({ feed: feed.name, status: "error", error: err?.message || String(err) });
      }
    }

    if (shouldCleanup && !timeExceeded(startTime)) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabaseClient
        .from("news_articles")
        .delete()
        .lt("published_at", sevenDaysAgo.toISOString());
    }

    const nextOffset = (offset + feeds.length) % total;

    return new Response(
      JSON.stringify({
        message: "Coleta via NewsData.io concluída",
        total_feeds: total,
        processed_feeds: feeds.length,
        offset,
        next_offset: nextOffset,
        api_requests: apiRequests,
        upsert_attempted: upsertAttempted,
        timeframe_days: timeframe,
        params: { country, language },
        time_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
