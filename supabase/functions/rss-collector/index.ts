import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FEEDS = 3;
const MAX_ITEMS = 5;
const MAX_RUNTIME_MS = 20000;
const FETCH_TIMEOUT_MS = 4000;

function stripHtml(html: string): string {
  return html ? html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, attr: string): string {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  // RSS <item>
  const rssRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = rssRe.exec(xml)) !== null) items.push(m[0]);
  if (items.length > 0) return items;
  // Atom <entry>
  const atomRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  while ((m = atomRe.exec(xml)) !== null) items.push(m[0]);
  return items;
}

function extractImage(itemXml: string): string | null {
  // media:content url
  let m = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (m) return m[1];
  // media:thumbnail url
  m = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (m) return m[1];
  // enclosure with image type
  m = itemXml.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]+url=["']([^"']+)["']/i);
  if (m) return m[1];
  m = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']*["']/i);
  if (m) return m[1];
  // img tag in description/content
  m = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  return null;
}

function extractLink(itemXml: string): string {
  // Atom: <link href="..."/>
  let m = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (m) return m[1];
  // RSS: <link>...</link>
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

    const maxFeeds = Math.min(Number(payload.maxFeeds) || MAX_FEEDS, 5);
    const maxItems = Math.min(Number(payload.maxItems) || MAX_ITEMS, 8);

    // Fetch active feeds
    const { data: feeds, error: feedsErr } = await supabase
      .from("news_feeds")
      .select("id,name,category,rss_url")
      .eq("active", true)
      .order("priority", { ascending: false })
      .limit(maxFeeds);

    if (feedsErr) throw feedsErr;
    if (!feeds?.length) {
      return new Response(JSON.stringify({ message: "No active feeds", inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    let totalInserted = 0;

    for (const feed of feeds) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        results.push({ feed: feed.name, status: "skipped", reason: "timeout" });
        break;
      }

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(feed.rss_url, { signal: ctrl.signal });
        clearTimeout(timer);

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const xml = await resp.text();
        const rawItems = extractItems(xml).slice(0, maxItems);
        const category = (feed.category || "geral").toLowerCase().trim();

        const articles = rawItems.map((itemXml) => {
          const title = stripHtml(extractTag(itemXml, "title")).substring(0, 255) || "Sem título";
          const desc = stripHtml(extractTag(itemXml, "description") || extractTag(itemXml, "summary")).substring(0, 300);
          const link = extractLink(itemXml);
          const image = extractImage(itemXml);

          let pubDate: string;
          const raw = extractTag(itemXml, "pubDate") || extractTag(itemXml, "published") || extractTag(itemXml, "updated");
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
            link,
            image_url: image,
            category,
            source: feed.name,
            slug: createSlug(`${title}-${pubDate.substring(0, 10)}`),
            published_at: pubDate,
            active: true,
          };
        });

        if (articles.length === 0) {
          results.push({ feed: feed.name, status: "empty" });
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
            results.push({ feed: feed.name, status: "error", error: error.message });
          } else {
            totalInserted += toInsert.length;
            results.push({ feed: feed.name, status: "ok", inserted: toInsert.length });
          }
        } else {
          results.push({ feed: feed.name, status: "ok", inserted: 0 });
        }
      } catch (err: any) {
        console.error(`Feed error (${feed.name}):`, err.message);
        results.push({ feed: feed.name, status: "error", error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ message: "Done", inserted: totalInserted, time_ms: Date.now() - startTime, results }),
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
