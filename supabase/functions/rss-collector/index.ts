// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const MAX_FEEDS_PER_RUN = 8;
const MAX_ITEMS_PER_FEED = 15;
const BATCH_SIZE = 50;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Iniciando coleta RSS...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Configuração incompleta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Parse optional offset for rotating through feeds
    let offset = 0;
    try {
      const body = await req.json();
      offset = body?.offset || 0;
    } catch { /* no body */ }

    // Fetch active feeds with pagination
    const { data: feeds, error: feedsError } = await supabaseClient
      .from("news_feeds")
      .select("*")
      .eq("active", true)
      .order("priority", { ascending: false })
      .range(offset, offset + MAX_FEEDS_PER_RUN - 1);

    if (feedsError) throw feedsError;

    if (!feeds || feeds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum feed para processar neste lote." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Processando ${feeds.length} feeds (offset=${offset})`);

    const results = [];
    const allArticles = [];

    // Process feeds sequentially but collect articles for batch insert
    for (const feed of feeds) {
      try {
        console.log(`Feed: ${feed.name}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(feed.rss_url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const xmlText = await response.text();
        let xmlData: any;
        try {
          xmlData = parse(xmlText);
        } catch (e) {
          throw new Error(`XML parse error`);
        }

        let items = [];
        if (xmlData?.rss?.channel?.item) {
          items = Array.isArray(xmlData.rss.channel.item)
            ? xmlData.rss.channel.item
            : [xmlData.rss.channel.item];
        } else if (xmlData?.feed?.entry) {
          items = Array.isArray(xmlData.feed.entry)
            ? xmlData.feed.entry
            : [xmlData.feed.entry];
        }

        // Limit items per feed
        items = items.slice(0, MAX_ITEMS_PER_FEED);
        console.log(`${items.length} itens de ${feed.name}`);

        for (const item of items) {
          const title = (item.title || "Sem título").substring(0, 255);
          const link = item.link || "";
          const descriptionRaw = item.description || item.summary || item.content || "";
          const description = stripHtml(descriptionRaw).substring(0, 300);

          let pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
          try {
            const d = new Date(pubDate);
            pubDate = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          } catch { pubDate = new Date().toISOString(); }

          let imageUrl = null;
          if (item.enclosure?.["@url"]) {
            imageUrl = item.enclosure["@url"];
          } else if (item["media:content"]?.["@url"]) {
            imageUrl = item["media:content"]["@url"];
          } else if (item["media:group"]?.["media:content"]?.["@url"]) {
            imageUrl = item["media:group"]["media:content"]["@url"];
          } else {
            const imgMatch = descriptionRaw.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];
          }

          const slug = createSlug(`${title}-${pubDate.substring(0, 10)}`);

          allArticles.push({
            feed_id: feed.id,
            title,
            description,
            link: typeof link === "string" ? link : (link["@href"] || link.href || ""),
            image_url: imageUrl,
            category: feed.category || "Geral",
            source: feed.name,
            slug,
            published_at: pubDate,
            active: true,
          });
        }

        results.push({ feed: feed.name, status: "success", items: items.length });
      } catch (err: any) {
        console.error(`Erro ${feed.name}: ${err.message}`);
        results.push({ feed: feed.name, status: "error", error: err.message });
      }
    }

    // Batch upsert all articles
    console.log(`Inserindo ${allArticles.length} artigos em lotes de ${BATCH_SIZE}...`);
    let inserted = 0;
    for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
      const batch = allArticles.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseClient
        .from("news_articles")
        .upsert(batch, { onConflict: "slug", ignoreDuplicates: true });

      if (error) {
        console.error(`Erro batch ${i}:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    // Cleanup old articles (> 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await supabaseClient
      .from("news_articles")
      .delete()
      .lt("published_at", sevenDaysAgo.toISOString());

    return new Response(
      JSON.stringify({ message: "RSS coletado", inserted, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
