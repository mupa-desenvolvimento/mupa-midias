// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// @ts-ignore
import { get } from "https://esm.sh/lodash@4.17.21";
// @ts-ignore
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

type TokenCache = {
  access_token: string;
  expires_at: string;
};

type StandardPriceResponse = {
  name: string;
  price: number;
  promo_price: number;
  image: string;
  barcode: string;
  store: string;
};

const getTokenPreview = (token: string) => {
  if (!token) return "";
  if (token.length <= 16) return token;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
};

const isCacheValid = (cache: any) => {
  const token = cache?.access_token;
  const expiresAt = cache?.expires_at;
  if (!token || !expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return false;
  return Date.now() < ms - 30_000;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const normalizeMethod = (value: any, fallback: HttpMethod): HttpMethod => {
  const m = String(value || "").toUpperCase();
  if (m === "GET" || m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") return m;
  return fallback;
};

const buildUrl = (baseUrl: string | null | undefined, urlOrPath: string) => {
  const trimmed = String(urlOrPath || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = String(baseUrl || "").trim();
  if (!base) return trimmed;
  return `${base.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
};

const interpolateString = (value: string, context: Record<string, string>) => {
  return value.replace(/\{(\w+)\}/g, (_, key) => (context[key] ?? `{${key}}`));
};

const interpolateJson = (value: any, context: Record<string, string>): any => {
  if (value == null) return value;
  if (typeof value === "string") return interpolateString(value, context);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => interpolateJson(v, context));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolateJson(v, context);
    }
    return out;
  }
  return String(value);
};

const safeJsonParse = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
};

const mapToStandardResponse = (
  raw: any,
  mapping: any,
  barcode: string,
  store: string,
): StandardPriceResponse => {
  const mappingObj = mapping && typeof mapping === "object" ? mapping : {};
  const getPath = (key: keyof StandardPriceResponse) => {
    const path = mappingObj[key];
    if (!path) return undefined;
    if (typeof path === "string") return get(raw, path);
    return undefined;
  };

  const name = getPath("name");
  const price = getPath("price");
  const promoPrice = getPath("promo_price");
  const image = getPath("image");

  const standard: StandardPriceResponse = {
    name: typeof name === "string" ? name : "",
    price: typeof price === "number" ? price : Number(price || 0) || 0,
    promo_price: typeof promoPrice === "number" ? promoPrice : Number(promoPrice || 0) || 0,
    image: typeof image === "string" ? image : "",
    barcode,
    store,
  };

  return standard;
};

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const ensureSuperAdmin = async (supabaseAdmin: any, req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false as const, userId: null, error: "Não autorizado" };
  }
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return { ok: false as const, userId: null, error: "Token inválido" };
  }
  const userId = userData.user.id;
  const { data: isSuperAdmin } = await supabaseAdmin.rpc("is_super_admin", { check_user_id: userId });
  if (!isSuperAdmin) {
    return { ok: false as const, userId, error: "Sem permissão" };
  }
  return { ok: true as const, userId, error: null };
};

const getOrFetchToken = async (supabaseAdmin: any, integration: any) => {
  const authUrl = integration.auth_url ? String(integration.auth_url) : "";
  if (!authUrl) return { token: "", tokenPreview: "", expiresAt: "" };

  const cached = integration.token_cache as any;
  if (isCacheValid(cached)) {
    return { token: String(cached.access_token), tokenPreview: getTokenPreview(String(cached.access_token)), expiresAt: String(cached.expires_at) };
  }

  const method = normalizeMethod(integration.auth_method, "POST");

  const headersJson =
    integration.auth_headers_json && typeof integration.auth_headers_json === "object"
      ? integration.auth_headers_json
      : {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersJson)) {
    const name = String(k).trim();
    if (!name) continue;
    headers[name] = String(v ?? "");
  }

  const queryJson =
    integration.auth_query_params_json && typeof integration.auth_query_params_json === "object"
      ? integration.auth_query_params_json
      : {};
  const legacyBodyJson =
    integration.auth_body_json && typeof integration.auth_body_json === "object"
      ? integration.auth_body_json
      : {};
  const bodyText = integration.auth_body_text != null ? String(integration.auth_body_text) : "";

  let body: string | undefined;
  let url = authUrl;

  if (method === "GET") {
    const u = new URL(authUrl);
    for (const [k, v] of Object.entries({ ...(legacyBodyJson || {}), ...(queryJson || {}) })) {
      u.searchParams.set(String(k), String(v ?? ""));
    }
    url = u.toString();
  } else if (bodyText.trim()) {
    body = bodyText;
  } else {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    body = JSON.stringify(legacyBodyJson);
  }

  const res = await fetch(url, { method, headers, body });
  const json = await safeJsonParse(res);

  const tokenPath = integration.auth_token_path ? String(integration.auth_token_path) : "";
  const token =
    (tokenPath ? get(json, tokenPath) : undefined) ??
    (json && (json.token ?? json.access_token ?? json.data?.token));

  if (!token || typeof token !== "string") {
    throw new Error("Token não encontrado na resposta de autenticação");
  }

  const ttlSeconds = integration.token_expiration_seconds ? Number(integration.token_expiration_seconds) : 0;
  const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : new Date(Date.now() + 55 * 60 * 1000).toISOString();

  const cache: TokenCache = { access_token: token, expires_at: expiresAt };

  await supabaseAdmin
    .from("api_integrations")
    .update({ token_cache: cache as any, token_expires_at: expiresAt })
    .eq("id", integration.id);

  return { token, tokenPreview: getTokenPreview(token), expiresAt };
};

const executeIntegration = async (
  integration: any,
  barcode: string,
  store: string,
  opts?: { includeRaw?: boolean; includeTokenPreview?: boolean },
) => {
  const baseUrl = integration.base_url ? String(integration.base_url) : "";
  const requestUrl = integration.request_url ? String(integration.request_url) : "";
  const url = buildUrl(baseUrl, requestUrl);
  if (!url) {
    throw new Error("request_url não configurada");
  }

  const requestMethod = normalizeMethod(integration.request_method, "GET");
  const mapping = integration.response_mapping_json;

  const tokenResult = await getOrFetchToken(getSupabaseAdmin(), integration);
  const token = tokenResult.token;

  const context = {
    token,
    barcode,
    store,
  };

  const headersJson =
    integration.request_headers_json && typeof integration.request_headers_json === "object"
      ? integration.request_headers_json
      : {};
  const interpolatedHeaders = interpolateJson(headersJson, context);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(interpolatedHeaders || {})) {
    const name = String(k).trim();
    if (!name) continue;
    headers[name] = String(v ?? "");
  }
  const hasBodyMethod = requestMethod !== "GET" && requestMethod !== "DELETE";

  const legacyParamsJson =
    integration.request_params_json && typeof integration.request_params_json === "object"
      ? integration.request_params_json
      : {};
  const queryParamsJson =
    integration.request_query_params_json && typeof integration.request_query_params_json === "object"
      ? integration.request_query_params_json
      : {};

  let queryParams = interpolateJson(queryParamsJson, context);
  if (!queryParams || typeof queryParams !== "object" || Array.isArray(queryParams)) queryParams = {};

  let legacyParams = interpolateJson(legacyParamsJson, context);
  if (!legacyParams || typeof legacyParams !== "object" || Array.isArray(legacyParams)) legacyParams = {};

  const barcodeName = integration.barcode_param_name ? String(integration.barcode_param_name) : "";
  const storeName = integration.store_param_name ? String(integration.store_param_name) : "";

  if (barcodeName) {
    if (requestMethod === "GET") {
      if (queryParams[barcodeName] == null && legacyParams[barcodeName] == null) queryParams[barcodeName] = barcode;
    } else {
      if (legacyParams[barcodeName] == null) legacyParams[barcodeName] = barcode;
    }
  }
  if (storeName) {
    if (requestMethod === "GET") {
      if (queryParams[storeName] == null && legacyParams[storeName] == null) queryParams[storeName] = store;
    } else {
      if (legacyParams[storeName] == null) legacyParams[storeName] = store;
    }
  }

  let finalUrl = url;
  const u = new URL(url);
  const queryMerged = requestMethod === "GET" ? { ...legacyParams, ...queryParams } : { ...queryParams };
  for (const [k, v] of Object.entries(queryMerged)) {
    u.searchParams.set(String(k), String(v ?? ""));
  }
  finalUrl = u.toString();

  const requestBodyJson =
    integration.request_body_json && typeof integration.request_body_json === "object" && !Array.isArray(integration.request_body_json)
      ? integration.request_body_json
      : {};
  const requestBodyText = integration.request_body_text != null ? String(integration.request_body_text) : "";

  let body: string | undefined;
  if (hasBodyMethod) {
    if (requestBodyText.trim()) {
      body = interpolateString(requestBodyText, context);
    } else if (requestBodyJson && Object.keys(requestBodyJson).length > 0) {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(interpolateJson(requestBodyJson, context));
    } else {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(legacyParams);
    }
  }

  const res = await fetch(finalUrl, { method: requestMethod, headers, body });
  const raw = await safeJsonParse(res);

  const mapped = mapToStandardResponse(raw, mapping, barcode, store);

  return {
    status: res.status,
    raw: opts?.includeRaw ? raw : undefined,
    mapped,
    token_preview: opts?.includeTokenPreview ? tokenResult.tokenPreview : undefined,
    token_expires_at: opts?.includeTokenPreview ? tokenResult.expiresAt : undefined,
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastTwo = pathParts.slice(-2).join("/");

    if (req.method === "GET" && lastTwo === "device/price") {
      const integrationId = url.searchParams.get("integration_id") || "";
      const barcode = url.searchParams.get("barcode") || "";
      const store = url.searchParams.get("store") || "";

      if (!integrationId || !barcode || !store) {
        return new Response(JSON.stringify({ error: true, message: "Missing: integration_id, barcode, store" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: integration, error } = await supabaseAdmin
        .from("api_integrations")
        .select("*")
        .eq("id", integrationId)
        .maybeSingle();

      if (error || !integration) {
        return new Response(JSON.stringify({ error: true, message: "Integration not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!integration.is_active) {
        return new Response(JSON.stringify({ error: true, message: "Integration is inactive" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await executeIntegration(integration, barcode, store, { includeRaw: false, includeTokenPreview: false });
        return new Response(JSON.stringify(result.mapped), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e?.message || "Product not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String((body as any)?.action || "");

    if (action === "test_by_id") {
      const auth = await ensureSuperAdmin(supabaseAdmin, req);
      if (!auth.ok) {
        return new Response(JSON.stringify({ success: false, error: auth.error }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const integrationId = String((body as any)?.integration_id || "");
      const barcode = String((body as any)?.barcode || "");
      const store = String((body as any)?.store || "");

      if (!integrationId || !barcode || !store) {
        return new Response(JSON.stringify({ success: false, error: "Missing: integration_id, barcode, store" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: integration, error } = await supabaseAdmin
        .from("api_integrations")
        .select("*")
        .eq("id", integrationId)
        .maybeSingle();

      if (error || !integration) {
        return new Response(JSON.stringify({ success: false, error: "Integration not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await executeIntegration(integration, barcode, store, { includeRaw: true, includeTokenPreview: true });
        return new Response(JSON.stringify({ success: true, status: result.status, mapped: result.mapped, raw: result.raw, token_preview: result.token_preview, token_expires_at: result.token_expires_at }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e?.message || "Erro ao testar integração" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "test_direct") {
      const auth = await ensureSuperAdmin(supabaseAdmin, req);
      if (!auth.ok) {
        return new Response(JSON.stringify({ success: false, error: auth.error }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = (body as any)?.config || {};
      const barcode = String((body as any)?.barcode || "");
      const store = String((body as any)?.store || "");

      if (!barcode || !store) {
        return new Response(JSON.stringify({ success: false, error: "Missing: barcode, store" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const integration = {
        id: "00000000-0000-0000-0000-000000000000",
        base_url: config.base_url,
        auth_url: config.auth_url,
        auth_method: config.auth_method,
        auth_body_json: config.auth_body_json,
        auth_token_path: config.auth_token_path,
        token_expiration_seconds: config.token_expiration_seconds,
        token_cache: {},
        request_url: config.request_url,
        request_method: config.request_method,
        request_headers_json: config.request_headers_json,
        request_params_json: config.request_params_json,
        barcode_param_name: config.barcode_param_name,
        store_param_name: config.store_param_name,
        response_mapping_json: config.response_mapping_json,
      };

      try {
        const result = await executeIntegration(integration, barcode, store, { includeRaw: true, includeTokenPreview: true });
        return new Response(JSON.stringify({ success: true, status: result.status, mapped: result.mapped, raw: result.raw, token_preview: result.token_preview, token_expires_at: result.token_expires_at }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e?.message || "Erro ao testar integração" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "Erro interno" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
