// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limpa HTML da descrição
function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "").trim();
}

// Cria slug a partir do título
function createSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Iniciando coleta RSS...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas.");
      return new Response(
        JSON.stringify({ error: "Configuração de servidor incompleta (chaves ausentes)." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar feeds ativos
    const { data: feeds, error: feedsError } = await supabaseClient
      .from("news_feeds")
      .select("*")
      .eq("active", true);

    if (feedsError) {
      console.error("Erro ao buscar feeds:", feedsError);
      throw feedsError;
    }

    if (!feeds || feeds.length === 0) {
      console.log("Nenhum feed ativo encontrado.");
      return new Response(
        JSON.stringify({ message: "Nenhum feed ativo encontrado." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];

    // 2. Processar cada feed
    for (const feed of feeds) {
      try {
        console.log(`Processando feed: ${feed.name} (${feed.rss_url})`);
        
        // Fetch RSS XML
        const response = await fetch(feed.rss_url);
        if (!response.ok) {
          throw new Error(`Falha ao buscar RSS: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        let xmlData: any;
        try {
          xmlData = parse(xmlText);
        } catch (e) {
          throw new Error(`Erro ao fazer parse do XML: ${e.message}`);
        }
        
        // Navegar até os items (pode variar dependendo da estrutura do RSS/Atom)
        let items = [];
        if (xmlData?.rss?.channel?.item) {
          items = Array.isArray(xmlData.rss.channel.item) 
            ? xmlData.rss.channel.item 
            : [xmlData.rss.channel.item];
        } else if (xmlData?.feed?.entry) {
          // Atom support
          items = Array.isArray(xmlData.feed.entry) 
            ? xmlData.feed.entry 
            : [xmlData.feed.entry];
        } else {
           console.log(`Estrutura XML desconhecida para o feed ${feed.name}`, Object.keys(xmlData || {}));
        }

        console.log(`Encontrados ${items.length} itens no feed ${feed.name}`);

        let newArticlesCount = 0;

        // 3. Processar itens
        for (const item of items) {
          const title = item.title || "Sem título";
          const link = item.link || ""; // Atom uses link object usually
          
          // Tentar pegar descrição de vários campos comuns
          const descriptionRaw = item.description || item.summary || item.content || "";
          const description = stripHtml(descriptionRaw).substring(0, 300); // Limite 300 chars
          
          // Data de publicação
          let pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
          try {
            const parsedDate = new Date(pubDate);
            if (isNaN(parsedDate.getTime())) {
                pubDate = new Date().toISOString();
            } else {
                pubDate = parsedDate.toISOString();
            }
          } catch (e) {
            pubDate = new Date().toISOString();
          }

          // Tentar extrair imagem
          let imageUrl = null;
          if (item.enclosure && item.enclosure["@url"]) {
            imageUrl = item.enclosure["@url"];
          } else if (item["media:content"] && item["media:content"]["@url"]) {
            imageUrl = item["media:content"]["@url"];
          } else if (item["media:group"] && item["media:group"]["media:content"] && item["media:group"]["media:content"]["@url"]) {
             imageUrl = item["media:group"]["media:content"]["@url"];
          } else {
            // Tentar extrair do HTML da descrição (tag img)
            const imgMatch = descriptionRaw.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
              imageUrl = imgMatch[1];
            }
          }

          const slug = createSlug(`${title}-${pubDate.substring(0, 10)}`); // Slug único com data

          // 4. Inserir no banco (ignorar duplicatas)
          const articleData = {
            feed_id: feed.id,
            title,
            description,
            link: typeof link === 'string' ? link : (link['@href'] || link.href || ''),
            image_url: imageUrl,
            category: feed.category || "Geral",
            source: feed.name,
            slug: slug,
            published_at: pubDate,
            active: true,
          };

          const { error: insertError } = await supabaseClient
            .from("news_articles")
            .upsert(articleData, { onConflict: "slug", ignoreDuplicates: true });

          if (!insertError) {
             newArticlesCount++;
          } else {
             console.error(`Erro ao inserir artigo ${slug}:`, insertError);
          }
        }

        results.push({
          feed: feed.name,
          status: "success",
          items_found: items.length,
          new_articles_processed: newArticlesCount
        });

      } catch (err: any) {
        console.error(`Erro no feed ${feed.name}:`, err);
        results.push({
          feed: feed.name,
          status: "error",
          error: err.message || "Unknown error"
        });
      }
    }

    // 5. Limpeza de notícias antigas ( > 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await supabaseClient
      .from("news_articles")
      .delete()
      .lt("published_at", sevenDaysAgo.toISOString());

    return new Response(
      JSON.stringify({ 
        message: "Coleta de RSS finalizada", 
        results 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Erro fatal na função rss-collector:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
