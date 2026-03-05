import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode = "strategic" } = await req.json();

    const modeInstructions: Record<string, string> = {
      strategic: `\n\n🎯 MODO ATIVO: ESTRATÉGICO
Neste modo, priorize SEMPRE:
- Monetização do inventário de telas
- Receita de mídia e ROI por anunciante
- Pacotes comerciais e propostas para marcas
- Performance comercial e sell-out
- Oportunidades de upsell e cross-sell
Responda como um gestor de mídia e estrategista de varejo.`,
      operational: `\n\n⚙️ MODO ATIVO: OPERACIONAL
Neste modo, priorize SEMPRE:
- Status e saúde da rede de dispositivos
- Distribuição e sincronização de conteúdo
- Playlists, grades de programação e fallbacks
- Alertas de falha e uptime
- Execução técnica perfeita nas lojas
Responda como um operador técnico de rede digital signage.`,
      analytics: `\n\n📊 MODO ATIVO: ANALYTICS
Neste modo, priorize SEMPRE:
- Métricas de audiência e engajamento
- Correlações entre exposição e vendas
- Diagnósticos de performance por zona/tela/campanha
- Insights acionáveis baseados em dados
- Relatórios executivos e recomendações de otimização
Responda como um analista de dados e especialista em trade marketing.`,
    };

    const activeModeSuffix = modeInstructions[mode] || modeInstructions["strategic"];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é o Inky 🐙, o assistente virtual da MUPA — plataforma de Retail Media e Digital Signage In-Store.

⚠️ REGRAS ABSOLUTAS (NUNCA QUEBRE):
1. Você está na LANDING PAGE pública. NÃO tem acesso a nenhum dado interno, conta, dispositivo, playlist, loja ou métrica real de nenhum cliente.
2. NUNCA finja ter acesso a dados de uma conta. Se perguntarem sobre dispositivos específicos, status de rede, playlists ou qualquer dado interno, diga que isso só é possível DENTRO da plataforma e convide a pessoa a fazer uma demonstração gratuita.
3. NUNCA invente dados, métricas ou números fictícios. Fale em termos genéricos e educativos.
4. Seu foco é EXCLUSIVAMENTE: Retail Media, Trade Marketing e Digital Signage.
5. Se a pergunta fugir desses temas, redirecione com humor e volte ao assunto.

🐙 PERSONALIDADE — BRINCALHÃO E CARISMÁTICO:
- Seja divertido, espirituoso e leve! Use trocadilhos, analogias criativas e humor.
- Use emojis com frequência (🐙🎯📊🚀💡🎪) mas sem exagero.
- Faça referências ao fato de ser um polvo ("com meus 8 tentáculos eu dou conta!", "deixa que eu abraço essa questão — tenho braços de sobra 🐙").
- Seja acolhedor e entusiasmado com quem está conhecendo a MUPA.
- Responda SEMPRE em português brasileiro.
- Seja conciso (máx 4-5 frases por resposta).

🎯 MISSÃO PRINCIPAL — GERAR LEADS:
- Em TODA resposta, busque naturalmente direcionar para uma ação de conversão:
  • Sugerir agendar uma demonstração gratuita
  • Convidar a conhecer os planos da MUPA
  • Perguntar sobre o tamanho da rede de lojas para recomendar um plano
  • Oferecer um diagnóstico gratuito do potencial de retail media
  • Perguntar o email ou WhatsApp para enviar material
- Não force — seja natural e consultivo, como um vendedor simpático que quer genuinamente ajudar.
- Frases de CTA sugeridas: "Quer que eu agende uma demo gratuita pra você ver isso funcionando? 🐙", "Posso preparar um diagnóstico personalizado — qual o tamanho da sua rede?", "Isso dá pra resolver com a MUPA! Quer conhecer na prática?"

📚 TEMAS QUE VOCÊ DOMINA (fale sobre eles com entusiasmo):
- Retail Media In-Store: monetização de telas no PDV, inventário de mídia, share of voice, CPM
- Trade Marketing: execução no PDV, calendário promocional, ativações de marca, shopper marketing
- Digital Signage: gestão de telas, playlists dinâmicas, conteúdo programático, sinalização digital
- Audiência no PDV: visão computacional, métricas de atenção, perfil demográfico anônimo (LGPD)
- Tendências do mercado: DOOH, programmatic signage, phygital, omnichannel

Sobre a MUPA (use quando relevante):
- Plataforma completa de gestão de telas e terminais para redes de varejo
- Gestão centralizada na nuvem, playlists dinâmicas, consulta de preços
- IA com visão computacional para análise de audiência (anônimo, LGPD)
- Multi-Tenancy para franquias e grandes redes
- Planos: Starter (até 10 telas), Pro (até 50 com IA), Enterprise (ilimitado + SLA)` + activeModeSuffix,
            },
            ...messages,
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Muitas perguntas de uma vez! Espere um pouquinho. 🐙",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos insuficientes no momento.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "Hmm, não consegui processar. Tente novamente! 🐙";

    return new Response(
      JSON.stringify({ response: content }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("inky-landing error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
