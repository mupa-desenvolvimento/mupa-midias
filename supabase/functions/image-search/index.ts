import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, source = 'pexels', page = 1, per_page = 20, orientation, color, locale = 'pt-BR' } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedQuery = query.trim().slice(0, 100);
    let results: { id: string; url: string; thumb: string; source: string; photographer?: string; width?: number; height?: number }[] = [];
    let totalResults = 0;
    let hasMore = false;

    if (source === 'pexels') {
      const apiKey = Deno.env.get('PEXELS_API_KEY');
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Pexels API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const params = new URLSearchParams({
        query: sanitizedQuery,
        per_page: String(Math.min(per_page, 40)),
        page: String(page),
        locale,
      });
      if (orientation && ['landscape', 'portrait', 'square'].includes(orientation)) {
        params.set('orientation', orientation);
      }
      if (color) {
        params.set('color', color);
      }

      const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: apiKey },
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Pexels API error ${res.status}:`, errBody);
        throw new Error(`Pexels API error: ${res.status}`);
      }

      const data = await res.json();
      totalResults = data.total_results || 0;
      hasMore = !!data.next_page;

      results = (data.photos || []).map((photo: any) => ({
        id: `pexels-${photo.id}`,
        url: photo.src.large2x || photo.src.large,
        thumb: photo.src.medium || photo.src.small,
        source: 'Pexels',
        photographer: photo.photographer,
        width: photo.width,
        height: photo.height,
      }));
    } else if (source === 'unsplash') {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(sanitizedQuery)}&per_page=${Math.min(per_page, 30)}&page=${page}${orientation ? `&orientation=${orientation}` : ''}&content_filter=high`,
        {
          headers: {
            'Accept-Version': 'v1',
            'Authorization': 'Client-ID aEWnfJ2nVJQMOQabkvYxjpLsGBkccYLmuCFQcq6NPWQ',
          },
        }
      );

      if (!res.ok) {
        console.error(`Unsplash API error: ${res.status}`);
        // Return empty instead of fake images
        return new Response(JSON.stringify({ results: [], total: 0, hasMore: false, error: 'Unsplash temporarily unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await res.json();
      totalResults = data.total || 0;
      hasMore = page * per_page < totalResults;

      results = (data.results || []).map((photo: any) => ({
        id: `unsplash-${photo.id}`,
        url: photo.urls.regular,
        thumb: photo.urls.small,
        source: 'Unsplash',
        photographer: photo.user?.name,
        width: photo.width,
        height: photo.height,
      }));
    }

    return new Response(JSON.stringify({ results, total: totalResults, hasMore, page }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image search error:', message);
    return new Response(JSON.stringify({ error: 'Failed to search images', results: [], total: 0, hasMore: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
