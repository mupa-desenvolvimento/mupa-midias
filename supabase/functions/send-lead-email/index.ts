import { corsHeaders } from "../_shared/cors.ts";

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "Email",
  company: "Empresa",
  phone: "Telefone",
  jobTitle: "Cargo",
  stores: "Lojas",
  screens: "Telas",
  city: "Cidade",
  hasTerminals: "Possui terminais",
  hasCameras: "Usa câmeras/sensores",
  wantAudienceAnalysis: "Interesse em análise de audiência",
  hasLoyalty: "Programa de fidelidade",
  hasTradeMarketing: "Verba de Trade Marketing",
  wantMonetize: "Monetizar com anúncios",
};

const TYPE_LABELS: Record<string, string> = {
  general: "Diagnóstico",
  demo: "Demonstração",
  lite: "Mupa Lite",
  flow: "Mupa Flow",
  insight: "Mupa Insight",
  impact: "Mupa Impact",
};

function formatValue(key: string, value: string): string {
  if (value === "yes") return "Sim";
  if (value === "no") return "Não";
  return value;
}

function buildHtmlEmail(type: string, data: Record<string, string>): string {
  const typeLabel = TYPE_LABELS[type] || type;
  const rows = Object.entries(data)
    .filter(([_, v]) => v)
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] || k;
      return `<tr><td style="padding:8px 12px;font-weight:600;color:#333;border-bottom:1px solid #eee">${label}</td><td style="padding:8px 12px;color:#555;border-bottom:1px solid #eee">${formatValue(k, v)}</td></tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f7">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:#092676;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:22px">🚀 Novo Lead — ${typeLabel}</h1>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin-top:24px;color:#999;font-size:12px">Enviado automaticamente pela plataforma Mupa</p>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { type, data } = await req.json();
    if (!type || !data) {
      throw new Error("Missing type or data");
    }

    const typeLabel = TYPE_LABELS[type] || type;
    const html = buildHtmlEmail(type, data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mupa Leads <onboarding@resend.dev>",
        to: ["appmupa@gmail.com"],
        subject: `[Mupa] Novo Lead — ${typeLabel} — ${data.name || ""}`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      throw new Error(`Resend API error: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-lead-email error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
