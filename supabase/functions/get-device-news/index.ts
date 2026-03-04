// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from get-device-news!");

serve(async (req) => {
  // Handle CORS preflight requests
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
      } catch (e) {
        // Body might be empty or invalid JSON
      }
    }

    if (!deviceCode) {
      throw new Error("Device code or ID is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Get Device Info (to get tenant_id)
    // Try to find by code first (short code)
    let { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, tenant_id")
      .eq("code", deviceCode)
      .single();

    if (deviceError || !device) {
      // Try to find by id (uuid)
      const { data: deviceById, error: deviceByIdError } = await supabase
        .from("devices")
        .select("id, tenant_id")
        .eq("id", deviceCode)
        .single();
      
      if (deviceByIdError || !deviceById) {
        throw new Error("Device not found");
      }
      device = deviceById;
    }

    const tenantId = device.tenant_id;

    if (!tenantId) {
      throw new Error("Device has no tenant assigned");
    }

    // 2. Get News Settings for this tenant
    const { data: settings, error: settingsError } = await supabase
      .from("news_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    // Default settings if not found
    const newsSettings = settings || {
      active_categories: [], // Empty means all? Or none? Let's assume all if empty or handle in frontend
      max_items: 20,
      display_time: 10,
      type_view: "list",
      theme_mode: "system",
      layout_type: "modern"
    };

    // 3. Get Active Feeds for this tenant
    const { data: feeds, error: feedsError } = await supabase
      .from("news_feeds")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("active", true);

    if (feedsError) throw feedsError;

    const feedIds = feeds.map((f: any) => f.id);

    if (feedIds.length === 0) {
       return new Response(
        JSON.stringify({ 
          settings: newsSettings,
          articles: [] 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 4. Get Latest Articles from these feeds
    let articlesQuery = supabase
      .from("news_articles")
      .select("*")
      .in("feed_id", feedIds)
      .eq("active", true)
      .order("published_at", { ascending: false })
      .limit(newsSettings.max_items || 20);

    // Filter articles by category if settings specify them
    // Note: If active_categories is empty, we show ALL categories (standard behavior)
    if (newsSettings.active_categories && Array.isArray(newsSettings.active_categories) && newsSettings.active_categories.length > 0) {
      articlesQuery = articlesQuery.in("category", newsSettings.active_categories);
    }

    const { data: articles, error: articlesError } = await articlesQuery;

    if (articlesError) throw articlesError;

    return new Response(
      JSON.stringify({ 
        settings: newsSettings,
        articles: articles 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
