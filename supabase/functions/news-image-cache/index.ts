// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RUNTIME_MS = 6000;
const DEFAULT_BATCH = 5;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    const bucketName = Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME");
    const publicBaseUrl = Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL");

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
      return new Response(
        JSON.stringify({ error: "R2 credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    let payload: any = {};
    try {
      const raw = await req.text();
      if (raw) payload = JSON.parse(raw);
    } catch { payload = {}; }

    const batchSize = Math.max(1, Math.min(Number(payload.batch) || DEFAULT_BATCH, 10));

    // Fetch articles with external images that haven't been cached yet
    const { data: articles, error: fetchError } = await supabaseClient
      .from("news_articles")
      .select("id, title, image_url, slug")
      .eq("active", true)
      .eq("image_cached", false)
      .not("image_url", "is", null)
      .order("published_at", { ascending: false })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma imagem pendente para cache", cached: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const results: any[] = [];
    let cached = 0;

    for (const article of articles) {
      if (Date.now() - startTime >= MAX_RUNTIME_MS) {
        results.push({ id: article.id, status: "skipped", reason: "time_budget" });
        break;
      }

      try {
        // Download external image
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const imgResponse = await fetch(article.image_url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MupaBot/1.0)" },
        });
        clearTimeout(timeout);

        if (!imgResponse.ok) {
          // Mark as cached with no image to skip next time
          await supabaseClient
            .from("news_articles")
            .update({ image_cached: true, image_url: null })
            .eq("id", article.id);
          results.push({ id: article.id, status: "failed", error: `HTTP ${imgResponse.status}` });
          continue;
        }

        const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
        const imgBuffer = await imgResponse.arrayBuffer();

        // Skip if too large (> 2MB) or too small (< 1KB)
        if (imgBuffer.byteLength > 2 * 1024 * 1024 || imgBuffer.byteLength < 1024) {
          await supabaseClient
            .from("news_articles")
            .update({ image_cached: true })
            .eq("id", article.id);
          results.push({ id: article.id, status: "skipped", reason: "size", size: imgBuffer.byteLength });
          continue;
        }

        // Determine extension from content type
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const slug = (article.slug || article.id).substring(0, 80);
        const fileKey = `news/${slug}.${ext}`;
        const uploadUrl = `${r2Endpoint}/${bucketName}/${fileKey}`;

        // Upload to R2
        const uploadResponse = await r2.fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "Content-Length": imgBuffer.byteLength.toString(),
          },
          body: imgBuffer,
        });

        if (!uploadResponse.ok) {
          results.push({ id: article.id, status: "upload_failed" });
          continue;
        }

        const publicUrl = `${publicBaseUrl}/${fileKey}`;

        // Update article with cached URL
        await supabaseClient
          .from("news_articles")
          .update({
            image_url: publicUrl,
            image_cached: true,
            image_r2_key: fileKey,
          })
          .eq("id", article.id);

        cached++;
        results.push({ id: article.id, status: "cached", url: publicUrl });
      } catch (err: any) {
        console.error(`Error caching image for ${article.id}:`, err.message);
        // Mark as cached to avoid retrying broken images
        await supabaseClient
          .from("news_articles")
          .update({ image_cached: true })
          .eq("id", article.id);
        results.push({ id: article.id, status: "error", error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Cache de imagens concluído",
        cached,
        total_processed: articles.length,
        time_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Erro fatal:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
