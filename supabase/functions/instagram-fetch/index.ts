import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GRAPH_API_BASE = "https://graph.instagram.com";

interface InstagramMedia {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  permalink?: string;
  timestamp: string;
}

async function fetchAllPosts(accessToken: string, sinceDate: string, untilDate: string): Promise<InstagramMedia[]> {
  const allPosts: InstagramMedia[] = [];
  const fields = "id,media_type,media_url,thumbnail_url,caption,permalink,timestamp";
  let url = `${GRAPH_API_BASE}/me/media?fields=${fields}&access_token=${accessToken}&limit=50`;

  const sinceTs = new Date(sinceDate).getTime() / 1000;
  const untilTs = new Date(untilDate).getTime() / 1000;

  let pages = 0;
  const maxPages = 20;

  while (url && pages < maxPages) {
    await new Promise(r => setTimeout(r, 200));
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error("[instagram] API error:", res.status, errText);
      throw new Error(`Instagram API error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const posts: InstagramMedia[] = data.data || [];

    for (const post of posts) {
      const postTs = new Date(post.timestamp).getTime() / 1000;
      if (postTs >= sinceTs && postTs <= untilTs) {
        allPosts.push(post);
      }
      // Instagram returns newest first; if we're past the date range, stop
      if (postTs < sinceTs) {
        return allPosts;
      }
    }

    url = data.paging?.next || null;
    pages++;
  }

  return allPosts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, settingsId, accessToken, tenantId, fetchDays, sinceDate, untilDate } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: save-settings - Save/update Instagram settings
    if (action === "save-settings") {
      const { data: existing } = await supabaseAdmin
        .from("instagram_settings")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      // Validate token by fetching user info
      let username = "";
      let igUserId = "";
      if (accessToken) {
        const userRes = await fetch(`${GRAPH_API_BASE}/me?fields=id,username&access_token=${accessToken}`);
        if (!userRes.ok) {
          const errText = await userRes.text();
          return new Response(JSON.stringify({ error: `Token inválido: ${errText}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const userData = await userRes.json();
        username = userData.username || "";
        igUserId = userData.id || "";
      }

      const settingsData = {
        tenant_id: tenantId,
        access_token: accessToken,
        instagram_user_id: igUserId,
        username,
        is_active: !!accessToken,
        fetch_days: fetchDays || 10,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabaseAdmin.from("instagram_settings").update(settingsData).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("instagram_settings").insert(settingsData);
      }

      return new Response(JSON.stringify({ success: true, username, instagram_user_id: igUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch-posts - Fetch posts from Instagram and save
    if (action === "fetch-posts") {
      // Get settings
      const { data: settings } = await supabaseAdmin
        .from("instagram_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (!settings?.access_token) {
        return new Response(JSON.stringify({ error: "Token não configurado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const days = fetchDays || settings.fetch_days || 10;
      const now = new Date();
      const since = sinceDate || new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const until = untilDate || now.toISOString();

      console.log(`[instagram] Fetching posts from ${since} to ${until}`);

      const posts = await fetchAllPosts(settings.access_token, since, until);
      console.log(`[instagram] Found ${posts.length} posts`);

      // Upsert posts
      let inserted = 0;
      for (const post of posts) {
        const row = {
          tenant_id: tenantId,
          instagram_id: post.id,
          media_type: post.media_type,
          media_url: post.media_url || null,
          thumbnail_url: post.thumbnail_url || null,
          caption: post.caption || null,
          permalink: post.permalink || null,
          posted_at: post.timestamp,
          is_active: true,
        };

        const { error } = await supabaseAdmin
          .from("instagram_posts")
          .upsert(row, { onConflict: "instagram_posts_ig_id_unique", ignoreDuplicates: true });

        if (!error) inserted++;
      }

      // Update last_fetched_at
      await supabaseAdmin
        .from("instagram_settings")
        .update({ last_fetched_at: now.toISOString() })
        .eq("tenant_id", tenantId);

      return new Response(JSON.stringify({
        success: true,
        total_found: posts.length,
        inserted,
        since,
        until,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[instagram] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
