import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_QUERIES = [
  "inspirational nature landscape", "sunrise mountain peak", "ocean calm peaceful waves",
  "forest light rays morning", "starry night sky milky way", "waterfall tropical lush",
  "desert sunset golden dunes", "autumn leaves colorful path", "northern lights aurora",
  "zen garden peaceful stones", "misty mountains valley", "lavender field purple",
  "cherry blossom spring", "lake reflection mirror calm", "snowy peaks winter",
  "tropical beach palm trees", "meadow wildflowers sunshine", "canyon dramatic red rocks",
  "rainforest green canopy", "countryside rolling hills",
];

async function fetchPexelsImages(query: string, perPage = 15): Promise<string[]> {
  const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    return (data.photos || []).map((p: any) => p.src.landscape || p.src.large2x || p.src.large);
  } catch (e) {
    console.error("[seed] Pexels error:", e);
    return [];
  }
}

async function generateQuotesWithAI(batchNum: number, count: number): Promise<{ quote: string; author: string }[]> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const themes = [
    "superação e resiliência", "gratidão e felicidade", "liderança e trabalho em equipe",
    "foco e determinação", "amor próprio e autoestima", "criatividade e inovação",
    "paciência e perseverança", "coragem e mudança", "sabedoria e aprendizado",
    "sucesso e conquistas",
  ];
  const theme = themes[batchNum % themes.length];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: `Gere exatamente ${count} frases motivacionais ÚNICAS e ORIGINAIS em português brasileiro sobre o tema "${theme}". 
Cada frase deve ser curta (máximo 2 linhas), impactante e inspiradora.
Atribua cada frase a um autor real famoso (filósofo, escritor, líder, cientista) — pode ser uma citação real ou uma atribuição plausível.

Responda APENAS com um JSON array, sem markdown, sem explicação:
[{"quote":"frase aqui","author":"Autor Aqui"},...]

NÃO repita frases. Cada uma deve ser diferente.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[seed] AI error batch ${batchNum}:`, err);
    return [];
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.filter((q: any) => q.quote && q.author);
  } catch (e) {
    console.error(`[seed] Parse error batch ${batchNum}:`, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await adminClient.rpc("is_tenant_admin", { check_user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantId } = await adminClient.rpc("get_user_tenant_id_strict", { check_user_id: user.id });

    let targetCount = 200;
    try {
      const body = await req.json();
      if (body.count) targetCount = Math.min(Math.max(body.count, 10), 200);
    } catch { /* defaults */ }

    console.log(`[seed] Generating ${targetCount} quotes for tenant ${tenantId}`);

    // 1. Get existing quotes to avoid duplicates
    const { data: existing } = await adminClient
      .from("motivational_quotes")
      .select("quote")
      .eq("tenant_id", tenantId || "");
    const existingSet = new Set((existing || []).map((e: any) => e.quote));

    // 2. Generate quotes via AI in batches of 25
    const BATCH_SIZE = 25;
    const numBatches = Math.ceil(targetCount / BATCH_SIZE);
    let allQuotes: { quote: string; author: string }[] = [];

    for (let i = 0; i < numBatches && allQuotes.length < targetCount; i++) {
      const remaining = targetCount - allQuotes.length;
      const batchCount = Math.min(BATCH_SIZE, remaining);
      console.log(`[seed] AI batch ${i + 1}/${numBatches} (${batchCount} quotes)...`);
      const batch = await generateQuotesWithAI(i, batchCount);
      // Filter duplicates
      const newOnes = batch.filter((q) => !existingSet.has(q.quote) && !allQuotes.some((e) => e.quote === q.quote));
      allQuotes = allQuotes.concat(newOnes);
      console.log(`[seed] Batch ${i + 1}: got ${batch.length}, new: ${newOnes.length}, total: ${allQuotes.length}`);
    }

    allQuotes = allQuotes.slice(0, targetCount);

    if (allQuotes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhuma frase nova gerada", inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch images from Pexels (multiple queries for variety)
    console.log("[seed] Fetching images from Pexels...");
    let allImages: string[] = [];
    const numImageQueries = Math.min(IMAGE_QUERIES.length, Math.ceil(allQuotes.length / 10));
    const shuffledQueries = IMAGE_QUERIES.sort(() => Math.random() - 0.5).slice(0, numImageQueries);

    for (const q of shuffledQueries) {
      if (allImages.length >= allQuotes.length) break;
      const imgs = await fetchPexelsImages(q, 15);
      allImages = allImages.concat(imgs);
    }
    console.log(`[seed] Got ${allImages.length} images`);

    // 4. Insert into motivational_quotes
    const records = allQuotes.map((q, i) => ({
      tenant_id: tenantId,
      quote: q.quote,
      author: q.author,
      image_url: allImages[i % Math.max(allImages.length, 1)] || null,
      image_orientation: "landscape",
      source: "ai-generated",
      is_active: true,
      used: false,
    }));

    let inserted = 0;
    const DB_BATCH = 25;
    for (let i = 0; i < records.length; i += DB_BATCH) {
      const batch = records.slice(i, i + DB_BATCH);
      const { data, error } = await adminClient
        .from("motivational_quotes")
        .insert(batch)
        .select("id");

      if (error) {
        console.error(`[seed] Insert error at batch ${i}:`, error.message);
      } else {
        inserted += (data || []).length;
      }
    }

    // 5. Create a media_item for the motivational slide (for playlists)
    const { error: mediaError } = await adminClient.from("media_items").insert({
      name: `Frases Motivacionais (${inserted} frases)`,
      type: "motivational_slide",
      status: "active",
      duration: 25,
      metadata: {
        auto_content: true,
        tenant_id: tenantId,
        quote_count: inserted,
        generated_at: new Date().toISOString(),
      },
    });

    if (mediaError) {
      console.error("[seed] Media item creation error:", mediaError.message);
    }

    console.log(`[seed] Done! Inserted ${inserted} quotes`);

    return new Response(JSON.stringify({
      success: true,
      message: `${inserted} frases motivacionais geradas com sucesso`,
      inserted,
      total_generated: allQuotes.length,
      images_fetched: allImages.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[seed] Fatal error:", msg);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar frases", details: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
