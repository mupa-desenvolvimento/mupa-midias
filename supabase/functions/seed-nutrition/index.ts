import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  "vitaminas e minerais", "hidratação", "fibras e digestão", "proteínas",
  "gorduras saudáveis", "carboidratos", "superalimentos", "alimentação infantil",
  "emagrecimento saudável", "imunidade",
];

const IMAGE_QUERIES: Record<string, string[]> = {
  "vitaminas e minerais": ["colorful fruits vitamins", "vegetables nutrition healthy"],
  "hidratação": ["water glass fresh", "hydration healthy lifestyle"],
  "fibras e digestão": ["whole grains fiber", "digestive health food"],
  "proteínas": ["protein rich food", "lean meat fish eggs"],
  "gorduras saudáveis": ["avocado nuts healthy fats", "olive oil mediterranean"],
  "carboidratos": ["whole wheat bread grains", "sweet potato complex carbs"],
  "superalimentos": ["superfood acai berries", "chia seeds quinoa bowl"],
  "alimentação infantil": ["kids healthy food colorful", "children eating fruits"],
  "emagrecimento saudável": ["healthy meal prep", "balanced diet plate"],
  "imunidade": ["immune system citrus fruits", "ginger turmeric health"],
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

async function generateNutritionBatch(batchNum: number, count: number, category: string): Promise<{ title: string; content: string }[]> {
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
          content: `Você é um nutricionista especialista em saúde e bem-estar. Gere exatamente ${count} dicas de nutrição sobre "${category}" em português brasileiro. Cada dica deve ser prática, educativa e baseada em ciência. Responda APENAS com um JSON array: [{"title":"Título curto da dica","content":"Explicação prática em 1-2 frases"}]. Sem markdown.`
        },
        {
          role: "user",
          content: `Gere ${count} dicas de nutrição únicas sobre "${category}" (lote ${batchNum + 1}). Seja variado e prático!`
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

async function processNutritionTips(jobId: string, tenantId: string | null) {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let totalInserted = 0;
  const perCategory = 100;
  const batchSize = 20;

  try {
    // Pre-fetch images
    console.log("[nutrition] Pre-fetching images...");
    const allImages: Record<string, string[]> = {};
    for (const category of CATEGORIES) {
      const queries = IMAGE_QUERIES[category] || ["healthy food"];
      const images: string[] = [];
      for (const q of queries) {
        const fetched = await fetchPexelsImages(q, 10);
        images.push(...fetched);
        await new Promise(r => setTimeout(r, 200));
      }
      allImages[category] = images;
    }

    await supabaseAdmin.from("processing_jobs").update({ progress: 10 }).eq("id", jobId);

    for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
      const category = CATEGORIES[catIdx];
      const categoryImages = allImages[category] || [];
      let categoryInserted = 0;

      for (let batch = 0; batch < Math.ceil(perCategory / batchSize); batch++) {
        const remaining = perCategory - categoryInserted;
        const currentBatchSize = Math.min(batchSize, remaining);
        if (currentBatchSize <= 0) break;

        try {
          const tips = await generateNutritionBatch(batch, currentBatchSize, category);
          if (tips.length > 0) {
            const rows = tips.map((t, i) => ({
              title: t.title,
              content: t.content,
              category,
              image_url: categoryImages[(categoryInserted + i) % Math.max(categoryImages.length, 1)] || null,
              tenant_id: tenantId,
              is_active: true,
            }));

            const { data } = await supabaseAdmin
              .from("nutrition_tips")
              .upsert(rows, { onConflict: "nutrition_tips_title_unique", ignoreDuplicates: true })
              .select("id");

            const inserted = data?.length || 0;
            categoryInserted += inserted;
            totalInserted += inserted;
          }
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`[nutrition] Batch error for ${category}:`, e);
        }
      }

      const progress = 10 + Math.round(((catIdx + 1) / CATEGORIES.length) * 85);
      await supabaseAdmin.from("processing_jobs").update({
        progress,
        result: `${totalInserted} dicas geradas...`
      }).eq("id", jobId);

      console.log(`[nutrition] ${category}: ${categoryInserted} inserted. Total: ${totalInserted}`);
    }

    if (totalInserted > 0) {
      await supabaseAdmin.from("media_items").insert({
        name: `Dicas de Nutrição (${totalInserted} dicas)`,
        type: "nutrition_slide",
        status: "active",
        duration: 15,
        metadata: {
          auto_content: true,
          tenant_id: tenantId,
          tip_count: totalInserted,
        },
      });
    }

    await supabaseAdmin.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: `${totalInserted} dicas de nutrição geradas com sucesso!`,
    }).eq("id", jobId);

    console.log(`[nutrition] Job ${jobId} completed: ${totalInserted} tips`);
  } catch (e) {
    console.error(`[nutrition] Job ${jobId} failed:`, e);
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
    const { tenantId = null } = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job, error } = await supabaseAdmin
      .from("processing_jobs")
      .insert({
        task_type: "seed_nutrition",
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

    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processNutritionTips(job.id, tenantId).catch(async (err) => {
        console.error(`Job ${job.id} failed:`, err);
        await supabaseAdmin
          .from("processing_jobs")
          .update({ status: "failed", error: err.message })
          .eq("id", job.id);
      })
    );

    return new Response(
      JSON.stringify({ job_id: job.id, status: "queued", message: "Geração de 1000 dicas de nutrição iniciada!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
