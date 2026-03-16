// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FEEDS = 10;
const MAX_ITEMS = 8;
const MAX_RUNTIME_MS = 25000;
const FETCH_TIMEOUT_MS = 5000;

function stripHtml(html: string): string {
  return html ? html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractCData(content: string): string {
  const m = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : content;
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  const rssRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = rssRe.exec(xml)) !== null) items.push(m[0]);
  if (items.length > 0) return items;
  const atomRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  while ((m = atomRe.exec(xml)) !== null) items.push(m[0]);
  return items;
}

function extractImage(itemXml: string): string | null {
  // 1. media:content url (highest quality, often full-size)
  let m = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];

  // 2. media:thumbnail url
  m = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];

  // 3. enclosure with image type (both attribute orders)
  m = itemXml.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]+url=["']([^"']+)["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];
  m = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']*["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];

  // 4. enclosure url only (many feeds use image-only enclosures)
  m = itemXml.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];

  // 5. og:image or image tag in content:encoded / description
  const contentEncoded = extractCData(extractTag(itemXml, "content:encoded") || extractTag(itemXml, "content"));
  if (contentEncoded) {
    m = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && isValidImageUrl(m[1])) return m[1];
  }

  // 6. img in description
  const desc = extractTag(itemXml, "description");
  if (desc) {
    const descContent = extractCData(desc);
    m = descContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && isValidImageUrl(m[1])) return m[1];
  }

  // 7. <image> direct child (some Atom feeds)
  m = itemXml.match(/<image[^>]*>([^<]+)<\/image>/i);
  if (m && isValidImageUrl(m[1].trim())) return m[1].trim();

  // 8. figure > img
  m = itemXml.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (m && isValidImageUrl(m[1])) return m[1];

  return null;
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (!url.startsWith("http")) return false;
  // Skip tiny tracking pixels, spacer gifs, icons
  const lower = url.toLowerCase();
  if (lower.includes("1x1") || lower.includes("spacer") || lower.includes("pixel") || lower.includes("tracking")) return false;
  if (lower.includes("favicon") || lower.includes("icon") || lower.includes("logo") && lower.includes(".ico")) return false;
  return true;
}

function extractLink(itemXml: string): string {
  let m = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (m) return m[1];
  const l = extractTag(itemXml, "link");
  if (l && l.startsWith("http")) return l;
  return "";
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .substring(0, 120);
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
      return new Response(JSON.stringify({ error: "Config missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let payload: any = {};
    try { payload = JSON.parse(await req.text()); } catch { payload = {}; }

    const maxFeeds = Math.min(Number(payload.maxFeeds) || MAX_FEEDS, 50);
    const maxItems = Math.min(Number(payload.maxItems) || MAX_ITEMS, 15);

    // Fetch active RSS feeds (exclude newsdata collector feeds)
    const { data: feeds, error: feedsErr } = await supabase
      .from("news_feeds")
      .select("id,name,category,rss_url")
      .eq("active", true)
      .neq("collector", "newsdata")
      .order("priority", { ascending: false })
      .limit(maxFeeds);

    if (feedsErr) throw feedsErr;
    if (!feeds?.length) {
      return new Response(JSON.stringify({ message: "No active feeds", inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Diversify by category: pick feeds ensuring category variety
    const selectedFeeds: any[] = [];
    const seenCategories = new Set<string>();
    
    // First pass: one feed per category
    for (const feed of feeds) {
      if (selectedFeeds.length >= maxFeeds) break;
      const cat = (feed.category || "geral").toLowerCase().trim();
      if (!seenCategories.has(cat)) {
        selectedFeeds.push(feed);
        seenCategories.add(cat);
      }
    }
    
    // Second pass: fill remaining slots
    for (const feed of feeds) {
      if (selectedFeeds.length >= maxFeeds) break;
      if (!selectedFeeds.includes(feed)) {
        selectedFeeds.push(feed);
      }
    }

    const results: any[] = [];
    let totalInserted = 0;
    const categoriesProcessed = new Set<string>();

    for (const feed of selectedFeeds) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        results.push({ feed: feed.name, status: "skipped", reason: "timeout" });
        break;
      }

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(feed.rss_url, {
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MupaBot/1.0)" },
        });
        clearTimeout(timer);

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const xml = await resp.text();
        const rawItems = extractItems(xml).slice(0, maxItems);
        const category = (feed.category || "geral").toLowerCase().trim();
        categoriesProcessed.add(category);

        const articles = rawItems.map((itemXml) => {
          const title = stripHtml(extractCData(extractTag(itemXml, "title"))).substring(0, 255) || "Sem título";
          const rawDesc = extractTag(itemXml, "description") || extractTag(itemXml, "summary");
          const desc = stripHtml(extractCData(rawDesc)).substring(0, 500);
          const content = stripHtml(extractCData(extractTag(itemXml, "content:encoded") || extractTag(itemXml, "content"))).substring(0, 4000);
          const link = extractLink(itemXml);
          const image = extractImage(itemXml);

          let pubDate: string;
          const raw = extractTag(itemXml, "pubDate") || extractTag(itemXml, "published") || extractTag(itemXml, "updated") || extractTag(itemXml, "dc:date");
          try {
            const d = new Date(raw);
            pubDate = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          } catch {
            pubDate = new Date().toISOString();
          }

          return {
            feed_id: feed.id,
            title,
            description: desc,
            content: content || null,
            link,
            image_url: image,
            category,
            source: feed.name,
            slug: createSlug(`${title}-${pubDate.substring(0, 10)}`),
            published_at: pubDate,
            active: true,
            api_source: "rss",
          };
        });

        if (articles.length === 0) {
          results.push({ feed: feed.name, status: "empty", category });
          continue;
        }

        const slugs = articles.map((a) => a.slug);
        const { data: existing } = await supabase
          .from("news_articles")
          .select("slug")
          .in("slug", slugs);

        const existSet = new Set((existing || []).map((r: any) => r.slug));
        const toInsert = articles.filter((a) => !existSet.has(a.slug));

        if (toInsert.length > 0) {
          const { error } = await supabase
            .from("news_articles")
            .upsert(toInsert, { onConflict: "slug", ignoreDuplicates: true });

          if (error) {
            console.error(`Insert error (${feed.name}):`, error.message);
            results.push({ feed: feed.name, status: "error", error: error.message, category });
          } else {
            totalInserted += toInsert.length;
            results.push({
              feed: feed.name,
              status: "ok",
              inserted: toInsert.length,
              with_images: toInsert.filter(a => a.image_url).length,
              category,
            });
          }
        } else {
          results.push({ feed: feed.name, status: "ok", inserted: 0, category });
        }
      } catch (err: any) {
        console.error(`Feed error (${feed.name}):`, err.message);
        results.push({ feed: feed.name, status: "error", error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Done",
        inserted: totalInserted,
        processed_feeds: selectedFeeds.length,
        categories_processed: Array.from(categoriesProcessed),
        time_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fatal:", error?.message);
    return new Response(JSON.stringify({ error: error?.message || "Unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
