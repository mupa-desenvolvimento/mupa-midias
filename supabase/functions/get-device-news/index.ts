// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let deviceCode = url.searchParams.get("device_code") || url.searchParams.get("device_id");

    if (!deviceCode && req.method === "POST") {
      try {
        const body = await req.json();
        deviceCode = body.deviceCode || body.deviceId;
      } catch (e) {}
    }

    if (!deviceCode) {
      throw new Error("Device code or ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get device with company -> tenant_id
    let { data: device } = await supabase
      .from("devices")
      .select("id, company_id, companies(tenant_id)")
      .eq("device_code", deviceCode)
      .single();

    if (!device) {
      // Try by UUID
      const { data: deviceById } = await supabase
        .from("devices")
        .select("id, company_id, companies(tenant_id)")
        .eq("id", deviceCode)
        .single();
      
      if (!deviceById) throw new Error("Device not found");
      device = deviceById;
    }

    const tenantId = device.companies?.tenant_id;

    if (!tenantId) {
      throw new Error("Device has no tenant assigned");
    }

    // Get News Settings
    const { data: settings } = await supabase
      .from("news_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    const newsSettings = settings || {
      active_categories: [],
      max_items: 5,
      display_time: 10,
      type_view: "list",
      theme_mode: "system",
      layout_type: "modern"
    };

    // Get Active Feeds for this tenant
    const { data: feeds, error: feedsError } = await supabase
      .from("news_feeds")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("active", true);

    if (feedsError) throw feedsError;

    const feedIds = (feeds || []).map((f: any) => f.id);

    if (feedIds.length === 0) {
      return new Response(
        JSON.stringify({ settings: newsSettings, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedCategories =
      Array.isArray(newsSettings.active_categories) && newsSettings.active_categories.length > 0
        ? newsSettings.active_categories
        : null;

    const perCategory = Math.max(1, Math.min(Number(newsSettings.max_items) || 5, 50));
    const categoriesCount = allowedCategories?.length || 10;
    const prefetchLimit = Math.min(1000, Math.max(200, perCategory * categoriesCount * 6));

    let articlesQuery = supabase
      .from("news_articles")
      .select("*")
      .in("feed_id", feedIds)
      .eq("active", true)
      .order("published_at", { ascending: false })
      .limit(prefetchLimit);

    if (allowedCategories) {
      articlesQuery = articlesQuery.in("category", allowedCategories);
    }

    const { data: rawArticles, error: articlesError } = await articlesQuery;
    if (articlesError) throw articlesError;

    const picked: any[] = [];
    const countsByCategory = new Map<string, number>();

    for (const article of rawArticles || []) {
      const category = article.category || "geral";
      const count = countsByCategory.get(category) ?? 0;
      if (count >= perCategory) continue;

      picked.push(article);
      countsByCategory.set(category, count + 1);
    }

    return new Response(
      JSON.stringify({ settings: newsSettings, articles: picked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
