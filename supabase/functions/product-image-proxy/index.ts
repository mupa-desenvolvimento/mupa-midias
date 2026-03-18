const MUPA_IMAGE_API = "http://srv-mupa.ddns.net:5050/produto-imagem";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ean = url.searchParams.get('ean');

    if (!ean || !/^\d+$/.test(ean)) {
      return new Response(JSON.stringify({ error: 'EAN inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // First try to get JSON with image URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${MUPA_IMAGE_API}/${ean}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Imagem não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = res.headers.get('content-type') || '';

    // If response is an image binary, proxy it directly
    if (contentType.startsWith('image/')) {
      const imageData = await res.arrayBuffer();
      return new Response(imageData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // If response is JSON, extract image URL and fetch the actual image
    const data = await res.json();
    const imageUrl = data.imagem_url || data.image_url || data.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'URL de imagem não encontrada na resposta', data }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the actual image
    const imgController = new AbortController();
    const imgTimeout = setTimeout(() => imgController.abort(), 10000);

    const imgRes = await fetch(imageUrl, { signal: imgController.signal });
    clearTimeout(imgTimeout);

    if (!imgRes.ok) {
      // Return the URL as JSON fallback
      return new Response(JSON.stringify({ image_url: imageUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imgContentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const imgData = await imgRes.arrayBuffer();

    return new Response(imgData, {
      headers: {
        ...corsHeaders,
        'Content-Type': imgContentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[ImageProxy] Error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar imagem' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
