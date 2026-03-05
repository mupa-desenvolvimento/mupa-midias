// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MAX_FEEDS_PER_RUN = 5;
const DEFAULT_MAX_ITEMS_PER_FEED = 5;
const DEFAULT_BATCH_SIZE = 5;
const MAX_RUNTIME_MS = 6000;

function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "").trim();
}

function createSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .substring(0, 120);
}

function timeExceeded(startTime: number) {
  return Date.now() - startTime >= MAX_RUNTIME_MS;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Configuração incompleta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    let payload: any = {};
    try {
      const rawBody = await req.text();
      if (rawBody) payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    const maxFeeds = Math.max(1, Math.min(Number(payload.maxFeeds) || DEFAULT_MAX_FEEDS_PER_RUN, 10));
    const maxItems = Math.max(1, Math.min(Number(payload.maxItems) || DEFAULT_MAX_ITEMS_PER_FEED, 10));
    const batchSize = Math.max(1, Math.min(Number(payload.batchSize) || DEFAULT_BATCH_SIZE, 20));
    const shouldCleanup = payload.cleanup === true;

    const { count: totalFeeds, error: countError } = await supabaseClient
      .from("news_feeds")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    if (countError) throw countError;

    const total = totalFeeds || 0;
    if (total === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum feed ativo encontrado.", total_feeds: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const providedOffset = Number.isFinite(Number(payload.offset)) ? Number(payload.offset) : null;
    const rotationSeed = Math.floor(Date.now() / 3600000); // rotates each hour
    const offset = providedOffset ?? ((rotationSeed * maxFeeds) % total);

    const { data: feeds, error: feedsError } = await supabaseClient
      .from("news_feeds")
      .select("id,name,category,rss_url")
      .eq("active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .range(offset, Math.min(offset + maxFeeds - 1, total - 1));

    if (feedsError) throw feedsError;

    if (!feeds || feeds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum feed no intervalo solicitado.", offset, total_feeds: total }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results: any[] = [];
    let inserted = 0;

    for (const feed of feeds) {
      if (timeExceeded(startTime)) {
        results.push({ feed: feed.name, status: "skipped", reason: "time_budget_exceeded" });
        break;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(feed.rss_url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const xmlText = await response.text();
        const xmlData = parse(xmlText);

        let items: any[] = [];
        if (xmlData?.rss?.channel?.item) {
          items = Array.isArray(xmlData.rss.channel.item)
            ? xmlData.rss.channel.item
            : [xmlData.rss.channel.item];
        } else if (xmlData?.feed?.entry) {
          items = Array.isArray(xmlData.feed.entry)
            ? xmlData.feed.entry
            : [xmlData.feed.entry];
        }

        const limitedItems = items.slice(0, maxItems);

        const articles = limitedItems.map((item: any) => {
          const title = (item.title || "Sem título").toString().substring(0, 255);
          const linkRaw = item.link || "";
          const descriptionRaw = (item.description || item.summary || item.content || "").toString();

          let pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
          try {
            const d = new Date(pubDate);
            pubDate = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          } catch {
            pubDate = new Date().toISOString();
          }

          let imageUrl = null;
          if (item.enclosure?.["@url"]) {
            imageUrl = item.enclosure["@url"];
          } else if (item["media:content"]?.["@url"]) {
            imageUrl = item["media:content"]["@url"];
          } else {
            const imgMatch = descriptionRaw.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];
          }

          return {
            feed_id: feed.id,
            title,
            description: stripHtml(descriptionRaw).substring(0, 300),
            link: typeof linkRaw === "string" ? linkRaw : (linkRaw["@href"] || linkRaw.href || ""),
            image_url: imageUrl,
            category: feed.category || "Geral",
            source: feed.name,
            slug: createSlug(`${title}-${pubDate.substring(0, 10)}`),
            published_at: pubDate,
            active: true,
          };
        });

        for (let i = 0; i < articles.length; i += batchSize) {
          if (timeExceeded(startTime)) break;

          const batch = articles.slice(i, i + batchSize);
          const { error } = await supabaseClient
            .from("news_articles")
            .upsert(batch, { onConflict: "slug", ignoreDuplicates: true });

          if (!error) {
            inserted += batch.length;
          } else {
            console.error(`Erro ao inserir lote (${feed.name}):`, error.message);
          }
        }

        results.push({ feed: feed.name, status: "success", items_processed: articles.length });
      } catch (err: any) {
        console.error(`Erro no feed ${feed.name}:`, err.message);
        results.push({ feed: feed.name, status: "error", error: err.message });
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
        message: "Coleta de RSS concluída",
        total_feeds: total,
        processed_feeds: feeds.length,
        inserted,
        offset,
        next_offset: nextOffset,
        time_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Erro fatal na função rss-collector:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
