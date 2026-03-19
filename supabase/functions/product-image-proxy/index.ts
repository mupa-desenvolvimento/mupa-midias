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

    console.log(`[ImageProxy] Fetching image for EAN: ${ean}`);

    // Fetch from Mupa API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(`${MUPA_IMAGE_API}/${ean}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error(`[ImageProxy] Fetch failed for ${ean}:`, fetchErr);
      return new Response(JSON.stringify({ error: 'Timeout ou erro de rede ao buscar imagem' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!res.ok) {
      console.warn(`[ImageProxy] Mupa API returned ${res.status} for ${ean}`);
      return new Response(JSON.stringify({ error: 'Imagem não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = res.headers.get('content-type') || '';
    console.log(`[ImageProxy] Response content-type: ${contentType}`);

    // If response is an image binary, proxy it directly
    if (contentType.startsWith('image/')) {
      const imageData = await res.arrayBuffer();
      console.log(`[ImageProxy] Direct image for ${ean}, size: ${imageData.byteLength}`);
      return new Response(imageData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // If response is JSON, extract image URL and fetch the actual image
    let data: any;
    try {
      data = await res.json();
    } catch {
      console.error(`[ImageProxy] Failed to parse JSON response for ${ean}`);
      return new Response(JSON.stringify({ error: 'Resposta inválida da API' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageUrl = data.imagem_url || data.image_url || data.url;
    console.log(`[ImageProxy] Extracted image URL for ${ean}: ${imageUrl}`);

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'URL de imagem não encontrada na resposta', data }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the actual image from the resolved URL
    const imgController = new AbortController();
    const imgTimeout = setTimeout(() => imgController.abort(), 10000);

    let imgRes: Response;
    try {
      imgRes = await fetch(imageUrl, { signal: imgController.signal });
      clearTimeout(imgTimeout);
    } catch (imgErr) {
      clearTimeout(imgTimeout);
      console.error(`[ImageProxy] Failed to fetch actual image from ${imageUrl}:`, imgErr);
      // Return the URL as JSON fallback
      return new Response(JSON.stringify({ image_url: imageUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!imgRes.ok) {
      console.warn(`[ImageProxy] Image fetch returned ${imgRes.status} from ${imageUrl}`);
      return new Response(JSON.stringify({ image_url: imageUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imgContentType = imgRes.headers.get('content-type') || 'image/png';
    const imgData = await imgRes.arrayBuffer();
    console.log(`[ImageProxy] Success for ${ean}, size: ${imgData.byteLength}, type: ${imgContentType}`);

    return new Response(imgData, {
      headers: {
        ...corsHeaders,
        'Content-Type': imgContentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[ImageProxy] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar imagem' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
