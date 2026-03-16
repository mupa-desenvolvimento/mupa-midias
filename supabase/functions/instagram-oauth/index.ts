import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GRAPH_API = "https://graph.facebook.com/v19.0";
const INSTAGRAM_API = "https://graph.instagram.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
  const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return new Response(JSON.stringify({ error: "Facebook App credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);

  // ─── GET /instagram-oauth?action=authorize ───
  // Returns the OAuth URL to redirect the user to
  if (req.method === "GET") {
    const action = url.searchParams.get("action");

    if (action === "authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state") || crypto.randomUUID();

      if (!redirectUri) {
        return new Response(JSON.stringify({ error: "redirect_uri is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build Instagram OAuth URL using Facebook Login
      // Permissions: instagram_basic gives access to profile + media
      const scopes = "instagram_basic,pages_show_list,pages_read_engagement";
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;

      return new Response(JSON.stringify({ url: authUrl, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET /instagram-oauth?action=callback&code=XXX ───
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const redirectUri = url.searchParams.get("redirect_uri");
      const tenantId = url.searchParams.get("tenant_id");

      if (!code || !redirectUri) {
        return new Response(JSON.stringify({ error: "code and redirect_uri are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // 1. Exchange code for short-lived token
        const tokenRes = await fetch(
          `${GRAPH_API}/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
        );
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
          console.error("[instagram-oauth] Token exchange error:", tokenData.error);
          return new Response(JSON.stringify({ error: `Token exchange failed: ${tokenData.error.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange for long-lived token (60 days)
        const longRes = await fetch(
          `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
        );
        const longData = await longRes.json();
        const longLivedToken = longData.access_token || shortLivedToken;

        // 3. Get Facebook Pages (to find the linked Instagram account)
        const pagesRes = await fetch(`${GRAPH_API}/me/accounts?access_token=${longLivedToken}`);
        const pagesData = await pagesRes.json();

        let igUserId = "";
        let igUsername = "";
        let igAccessToken = longLivedToken;

        if (pagesData.data && pagesData.data.length > 0) {
          // Try to find Instagram Business Account linked to the first page
          for (const page of pagesData.data) {
            const igRes = await fetch(
              `${GRAPH_API}/${page.id}?fields=instagram_business_account&access_token=${page.access_token || longLivedToken}`
            );
            const igData = await igRes.json();

            if (igData.instagram_business_account) {
              igUserId = igData.instagram_business_account.id;
              // Use page token for IG requests (more permissions)
              igAccessToken = page.access_token || longLivedToken;

              // Get Instagram username
              const profileRes = await fetch(
                `${GRAPH_API}/${igUserId}?fields=username&access_token=${igAccessToken}`
              );
              const profileData = await profileRes.json();
              igUsername = profileData.username || "";
              break;
            }
          }
        }

        // Fallback: try Basic Display API style
        if (!igUserId) {
          try {
            const meRes = await fetch(`${INSTAGRAM_API}/me?fields=id,username&access_token=${longLivedToken}`);
            if (meRes.ok) {
              const meData = await meRes.json();
              igUserId = meData.id || "";
              igUsername = meData.username || "";
            }
          } catch {
            // Ignore fallback errors
          }
        }

        // 4. Save to database
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const settingsData = {
          tenant_id: tenantId || null,
          access_token: igAccessToken,
          instagram_user_id: igUserId,
          username: igUsername,
          is_active: true,
          fetch_days: 10,
          updated_at: new Date().toISOString(),
        };

        let query = supabaseAdmin.from("instagram_settings").select("id");
        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
        } else {
          query = query.is("tenant_id", null);
        }
        const { data: existing } = await query.maybeSingle();

        if (existing) {
          await supabaseAdmin.from("instagram_settings").update(settingsData).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("instagram_settings").insert(settingsData);
        }

        return new Response(JSON.stringify({
          success: true,
          username: igUsername,
          instagram_user_id: igUserId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("[instagram-oauth] error:", e);
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
