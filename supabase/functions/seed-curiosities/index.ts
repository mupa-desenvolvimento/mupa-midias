import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  "ciência", "história", "natureza", "tecnologia", "corpo humano",
  "espaço", "animais", "geografia", "cultura", "alimentação",
];

const IMAGE_QUERIES: Record<string, string[]> = {
  "ciência": ["science lab experiment", "chemistry colorful", "physics abstract"],
  "história": ["ancient ruins civilization", "historical monument", "medieval castle"],
  "natureza": ["nature landscape beautiful", "tropical rainforest", "ocean underwater coral"],
  "tecnologia": ["futuristic technology", "artificial intelligence robot", "digital innovation"],
  "corpo humano": ["human anatomy art", "medical science body", "brain neuroscience"],
  "espaço": ["space nebula galaxy", "astronaut earth view", "planets solar system"],
  "animais": ["wildlife animal photography", "exotic animals tropical", "marine life ocean"],
  "geografia": ["world landmarks travel", "mountain landscape scenic", "desert oasis beautiful"],
  "cultura": ["world culture diversity", "traditional art festival", "music instruments global"],
  "alimentação": ["healthy food colorful", "exotic fruits tropical", "gourmet cooking art"],
};

async function fetchPexelsImages(query: string, perPage = 10): Promise<string[]> {
  const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: any) => p.src.landscape || p.src.large2x || p.src.large);
  } catch {
    return [];
  }
}

async function generateCuriositiesBatch(batchNum: number, count: number, category: string): Promise<{ title: string; content: string }[]> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
          role: "system",
          content: `Você é um gerador de curiosidades fascinantes em português brasileiro. Gere exatamente ${count} curiosidades sobre o tema "${category}". Cada curiosidade deve ser única, surpreendente e educativa. Responda APENAS com um JSON array no formato: [{"title":"Título curto","content":"Texto da curiosidade em 1-2 frases"}]. Sem markdown, sem explicações.`
        },
        {
          role: "user",
          content: `Gere ${count} curiosidades diferentes sobre "${category}" (lote ${batchNum + 1}). Variedade máxima!`
        }
      ],
      temperature: 1.0,
    }),
  });

  if (!res.ok) {
    console.error(`AI error for ${category}:`, await res.text());
    return [];
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "[]";
  
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.filter((c: any) => c.title && c.content) : [];
  } catch {
    console.error(`Parse error for ${category}`);
    return [];
  }
}

async function processCuriosities(jobId: string, tenantId: string | null) {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let totalInserted = 0;
  const targetTotal = 1000;
  const perCategory = 100; // 10 categories × 100 = 1000
  const batchSize = 20; // Generate 20 at a time to avoid timeouts

  try {
    // Pre-fetch all images
    console.log("[curiosities] Pre-fetching images...");
    const allImages: Record<string, string[]> = {};
    for (const category of CATEGORIES) {
      const queries = IMAGE_QUERIES[category] || ["nature beautiful"];
      const images: string[] = [];
      for (const q of queries) {
        const fetched = await fetchPexelsImages(q, 10);
        images.push(...fetched);
        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      }
      allImages[category] = images;
    }

    await supabaseAdmin.from("processing_jobs").update({ progress: 10 }).eq("id", jobId);

    // Generate curiosities per category
    for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
      const category = CATEGORIES[catIdx];
      const categoryImages = allImages[category] || [];
      let categoryInserted = 0;

      // Generate in batches of 20
      for (let batch = 0; batch < Math.ceil(perCategory / batchSize); batch++) {
        const remaining = perCategory - categoryInserted;
        const currentBatchSize = Math.min(batchSize, remaining);
        if (currentBatchSize <= 0) break;

        try {
          const curiosities = await generateCuriositiesBatch(batch, currentBatchSize, category);
          
          if (curiosities.length > 0) {
            const rows = curiosities.map((c, i) => ({
              title: c.title,
              content: c.content,
              category,
              image_url: categoryImages[(categoryInserted + i) % Math.max(categoryImages.length, 1)] || null,
              tenant_id: tenantId,
              is_active: true,
            }));

            const { error, data } = await supabaseAdmin
              .from("curiosities")
              .upsert(rows, { onConflict: "curiosities_title_unique", ignoreDuplicates: true })
              .select("id");

            const inserted = data?.length || 0;
            categoryInserted += inserted;
            totalInserted += inserted;
          }

          // Small delay between AI calls
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`[curiosities] Batch error for ${category}:`, e);
        }
      }

      // Update progress (10% for images + 90% for generation)
      const progress = 10 + Math.round(((catIdx + 1) / CATEGORIES.length) * 85);
      await supabaseAdmin.from("processing_jobs").update({ 
        progress,
        result: `${totalInserted} curiosidades geradas...`
      }).eq("id", jobId);

      console.log(`[curiosities] ${category}: ${categoryInserted} inserted. Total: ${totalInserted}`);
    }

    // Create media_item for playlist usage
    if (totalInserted > 0) {
      await supabaseAdmin.from("media_items").insert({
        name: `Curiosidades (${totalInserted} items)`,
        type: "curiosity_slide",
        status: "active",
        duration: 15,
        metadata: {
          auto_content: true,
          tenant_id: tenantId,
          curiosity_count: totalInserted,
        },
      });
    }

    await supabaseAdmin.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: `${totalInserted} curiosidades geradas com sucesso!`,
    }).eq("id", jobId);

    console.log(`[curiosities] Job ${jobId} completed: ${totalInserted} curiosities`);
  } catch (e) {
    console.error(`[curiosities] Job ${jobId} failed:`, e);
    await supabaseAdmin.from("processing_jobs").update({
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error",
    }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId = null, action = "generate" } = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "status") {
      const { jobId } = await req.json().catch(() => ({}));
      // This won't work since we already consumed the body, handle via query
    }

    // Create job record
    const { data: job, error } = await supabaseAdmin
      .from("processing_jobs")
      .insert({
        task_type: "seed_curiosities",
        status: "processing",
        progress: 0,
        metadata: { tenant_id: tenantId },
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to create job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start background processing
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processCuriosities(job.id, tenantId).catch(async (err) => {
        console.error(`Job ${job.id} failed:`, err);
        await supabaseAdmin
          .from("processing_jobs")
          .update({ status: "failed", error: err.message })
          .eq("id", job.id);
      })
    );

    return new Response(
      JSON.stringify({ job_id: job.id, status: "queued", message: "Geração de 1000 curiosidades iniciada!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[seed-curiosities] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
