import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, source = 'pexels', page = 1, per_page = 12 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedQuery = query.trim().slice(0, 100);
    let results: { id: string; url: string; thumb: string; source: string; photographer?: string }[] = [];

    if (source === 'pexels') {
      const apiKey = Deno.env.get('PEXELS_API_KEY');
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Pexels API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(sanitizedQuery)}&per_page=${per_page}&page=${page}`,
        { headers: { Authorization: apiKey } }
      );

      if (!res.ok) {
        throw new Error(`Pexels API error: ${res.status}`);
      }

      const data = await res.json();
      results = (data.photos || []).map((photo: any) => ({
        id: `pexels-${photo.id}`,
        url: photo.src.large2x || photo.src.large,
        thumb: photo.src.medium || photo.src.small,
        source: 'Pexels',
        photographer: photo.photographer,
      }));
    } else if (source === 'unsplash') {
      // Use Unsplash API (demo rate limit: 50 req/hr without key)
      // If no key, use source.unsplash.com alternative
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(sanitizedQuery)}&per_page=${per_page}&page=${page}`,
        {
          headers: {
            'Accept-Version': 'v1',
            'Authorization': 'Client-ID aEWnfJ2nVJQMOQabkvYxjpLsGBkccYLmuCFQcq6NPWQ',
          },
        }
      );

      if (!res.ok) {
        // Fallback: generate URLs with loremflickr
        for (let i = 0; i < per_page; i++) {
          results.push({
            id: `flickr-${i}-${page}`,
            url: `https://loremflickr.com/800/600/${encodeURIComponent(sanitizedQuery)}?lock=${i + (page - 1) * per_page}`,
            thumb: `https://loremflickr.com/300/200/${encodeURIComponent(sanitizedQuery)}?lock=${i + (page - 1) * per_page}`,
            source: 'LoremFlickr',
          });
        }
      } else {
        const data = await res.json();
        results = (data.results || []).map((photo: any) => ({
          id: `unsplash-${photo.id}`,
          url: photo.urls.regular,
          thumb: photo.urls.small,
          source: 'Unsplash',
          photographer: photo.user?.name,
        }));
      }
    } else if (source === 'pixabay') {
      // Free pixabay alternative using loremflickr (keyword-based)
      for (let i = 0; i < per_page; i++) {
        results.push({
          id: `flickr-${i}-${page}`,
          url: `https://loremflickr.com/800/600/${encodeURIComponent(sanitizedQuery)}?lock=${i + (page - 1) * per_page}`,
          thumb: `https://loremflickr.com/300/200/${encodeURIComponent(sanitizedQuery)}?lock=${i + (page - 1) * per_page}`,
          source: 'Imagens Livres',
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image search error:', message);
    return new Response(JSON.stringify({ error: 'Failed to search images' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
