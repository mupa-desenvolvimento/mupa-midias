// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// @ts-ignore
import { get } from "https://esm.sh/lodash@4.17.21";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TokenCache = {
  access_token: string;
  expires_at: string;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const normalizeMethod = (value: any, fallback: HttpMethod): HttpMethod => {
  const m = String(value || "").toUpperCase();
  if (m === "GET" || m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") return m;
  return fallback;
};

const isJwtLike = (value: string) => {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((p) => p.length >= 10);
};

const interpolateString = (value: string, context: Record<string, string>) => {
  return String(value ?? "").replace(/\{(\w+)\}/g, (_, key) => (context[key] ?? `{${key}}`));
};

const interpolateJson = (value: any, context: Record<string, string>): any => {
  if (value == null) return value;
  if (typeof value === "string") return interpolateString(value, context);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => interpolateJson(v, context));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[interpolateString(String(k), context)] = interpolateJson(v, context);
    }
    return out;
  }
  return String(value);
};

const safeParseJsonValue = (text: string) => {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const safeReadResponse = async (response: Response) => {
  const text = await response.text();
  const json = safeParseJsonValue(text);
  return { text, json };
};

const getUrlWithQuery = (baseUrl: string, query: any) => {
  const url = String(baseUrl ?? "").trim();
  if (!url) return url;
  const q = query && typeof query === "object" && !Array.isArray(query) ? query : {};
  const u = new URL(url);
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) {
      v.forEach((vv) => u.searchParams.append(String(k), String(vv ?? "")));
    } else {
      u.searchParams.set(String(k), String(v ?? ""));
    }
  }
  return u.toString();
};

const normalizeHeaders = (raw: any) => {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return raw.reduce((acc: Record<string, string>, item: any) => {
      const name = String(item?.name || item?.key || "").trim();
      const value = String(item?.value ?? "").trim();
      if (!name) return acc;
      acc[name] = value;
      return acc;
    }, {});
  }
  if (typeof raw === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const name = String(k).trim();
      if (!name) continue;
      out[name] = String(v ?? "");
    }
    return out;
  }
  return {};
};

const sanitizeForUi = (value: any, depth = 0): any => {
  if (depth > 6) return "[TRUNCATED]";
  if (value == null) return value;

  if (typeof value === "string") {
    if (isJwtLike(value)) return getTokenPreview(value);
    if (value.length > 5000) return `${value.slice(0, 5000)}...[TRUNCATED]`;
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForUi(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, any> = {};
    const entries = Object.entries(value).slice(0, 50);
    for (const [k, v] of entries) {
      if (/(password|senha|secret|client_secret)/i.test(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      if (/token/i.test(k) && typeof v === "string") {
        out[k] = getTokenPreview(v);
        continue;
      }
      out[k] = sanitizeForUi(v, depth + 1);
    }
    return out;
  }

  return String(value);
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
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  return Date.now() < expiresAtMs - 30_000;
};

const fetchCurlToken = async (supabaseClient: any, integration: any) => {
  const authUrl = integration.auth_url ? String(integration.auth_url) : "";
  if (!authUrl) {
    return { token: "", expiresAt: "" };
  }

  const tokenCache = integration.token_cache as any;
  if (isCacheValid(tokenCache)) {
    return { token: String(tokenCache.access_token), expiresAt: String(tokenCache.expires_at) };
  }

  const method = normalizeMethod(integration.auth_method, "POST");
  const headers = normalizeHeaders(integration.auth_headers_json);
  const queryParams = integration.auth_query_params_json;
  const bodyJson = integration.auth_body_json;
  const bodyText = integration.auth_body_text != null ? String(integration.auth_body_text) : "";

  const url = getUrlWithQuery(authUrl, queryParams);

  let body: string | undefined = undefined;
  if (method !== "GET") {
    if (bodyText.trim()) {
      body = bodyText;
    } else if (bodyJson && typeof bodyJson === "object") {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(bodyJson);
    }
  }

  const response = await fetch(url, { method, headers, body: method === "GET" ? undefined : body });
  const { text, json } = await safeReadResponse(response);

  if (!response.ok) {
    throw new Error(`Erro ao obter token: ${response.status} ${response.statusText}`);
  }

  const tokenPath = integration.auth_token_path ? String(integration.auth_token_path) : "";
  const token =
    (json && tokenPath ? get(json, tokenPath) : undefined) ??
    (json ? json?.token ?? json?.access_token : undefined);

  if (!token || typeof token !== "string") {
    throw new Error("Resposta de token inválida (token não encontrado)");
  }

  const expiresIn =
    (json && typeof json?.expires_in === "number" ? json.expires_in : undefined) ??
    (typeof integration.token_expiration_seconds === "number" ? integration.token_expiration_seconds : undefined) ??
    (typeof integration.token_expiration_seconds === "string" && String(integration.token_expiration_seconds).trim()
      ? Number(integration.token_expiration_seconds)
      : undefined) ??
    3600;

  const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
  const newCache: TokenCache = { access_token: token, expires_at: expiresAt };

  await supabaseClient
    .from("price_check_integrations")
    .update({ token_cache: newCache })
    .eq("id", integration.id);

  return { token, expiresAt };
};

const buildTokenRequest = (config: any) => {
  const headers: Record<string, string> = {
    ...normalizeHeaders(config.token_headers),
  };

  let body: string | null = null;

  if (config.usuario && config.password) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      usuario: config.usuario,
      password: config.password,
    });
  } else if (config.client_id && config.client_secret) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    params.set("grant_type", "client_credentials");
    params.set("client_id", String(config.client_id));
    params.set("client_secret", String(config.client_secret));
    if (config.scope) params.set("scope", String(config.scope));
    body = params.toString();
  } else if (config.body_json && typeof config.body_json === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(config.body_json);
  } else {
    throw new Error("OAuth2 não configurado: informe usuario/password ou client_id/client_secret");
  }

  return {
    method: config.token_method || "POST",
    headers,
    body,
  };
};

const fetchOAuthToken = async (supabaseClient: any, integration: any) => {
  const config = (integration.auth_config || {}) as any;
  const tokenUrl = config.token_url;
  if (!tokenUrl) {
    throw new Error("OAuth2 token_url não configurada");
  }

  const tokenCache = integration.token_cache as any;
  if (isCacheValid(tokenCache)) {
    return tokenCache as TokenCache;
  }

  const requestConfig = buildTokenRequest(config);

  const response = await fetch(tokenUrl, {
    method: requestConfig.method,
    headers: requestConfig.headers,
    body: requestConfig.body,
  });

  if (!response.ok) {
    throw new Error(`Erro ao obter token: ${response.status} ${response.statusText}`);
  }

  const tokenResponse = await response.json();
  const tokenPath = config.token_json_path ? String(config.token_json_path) : "";
  const token =
    (tokenPath ? get(tokenResponse, tokenPath) : undefined) ??
    tokenResponse?.token ??
    tokenResponse?.access_token;

  if (!token || typeof token !== "string") {
    throw new Error("Resposta de token inválida (token não encontrado)");
  }

  const expiresIn =
    (typeof tokenResponse?.expires_in === "number" ? tokenResponse.expires_in : undefined) ??
    (typeof config.expires_in_seconds === "number"
      ? config.expires_in_seconds
      : (typeof config.expires_in_seconds === "string" && config.expires_in_seconds.trim()
        ? Number(config.expires_in_seconds)
        : undefined)) ??
    3600;

  const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
  const newCache: TokenCache = { access_token: token, expires_at: expiresAt };

  await supabaseClient
    .from("price_check_integrations")
    .update({ token_cache: newCache })
    .eq("id", integration.id);

  return newCache;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let actionName = "";

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const reqBody = await req.json();
    const { device_id, barcode, integration_id, action } = reqBody;
    actionName = typeof action === "string" ? action : "";

    if (
      action !== "auth_test" &&
      action !== "auth_endpoint_test" &&
      action !== "auth_body_test" &&
      action !== "auth_body_test_direct" &&
      action !== "request_test" &&
      action !== "raw_test" &&
      (!device_id || !barcode)
    ) {
      throw new Error("Missing device_id or barcode");
    }

    if (action === "request_test") {
      if (!barcode) throw new Error("Missing barcode");
      if (!integration_id && !device_id) {
        throw new Error("Missing integration_id or device_id");
      }
    }

    // Raw test: execute a parsed CURL directly without needing a saved integration
    if (action === "raw_test") {
      const rawUrl = String(reqBody?.url || "");
      const rawMethod = normalizeMethod(reqBody?.method, "GET");
      const rawHeaders = normalizeHeaders(reqBody?.headers);
      const rawBody = reqBody?.body;
      const variables = reqBody?.variables || {};

      if (!rawUrl) throw new Error("URL é obrigatória");

      // Interpolate variables in URL, headers and body
      const finalUrl = interpolateString(rawUrl, variables);
      const finalHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        finalHeaders[k] = interpolateString(String(v), variables);
      }

      let finalBody: string | undefined = undefined;
      if (rawMethod !== "GET" && rawBody) {
        if (typeof rawBody === "string") {
          finalBody = interpolateString(rawBody, variables);
        } else if (typeof rawBody === "object") {
          if (!finalHeaders["Content-Type"] && !finalHeaders["content-type"]) {
            finalHeaders["Content-Type"] = "application/json";
          }
          finalBody = JSON.stringify(interpolateJson(rawBody, variables));
        }
      }

      const startTime = Date.now();
      const response = await fetch(finalUrl, {
        method: rawMethod,
        headers: finalHeaders,
        body: rawMethod === "GET" ? undefined : finalBody,
      });
      const responseTimeMs = Date.now() - startTime;
      const { text, json } = await safeReadResponse(response);

      return new Response(JSON.stringify({
        success: response.ok,
        status: response.status,
        response_time_ms: responseTimeMs,
        response: json ? sanitizeForUi(json) : text,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "auth_body_test_direct") {
      const url = reqBody?.test_endpoint_url;
      if (!url) throw new Error("URL do endpoint de teste não configurada");

      const headers: Record<string, string> = {
        ...normalizeHeaders(reqBody?.test_headers),
      };

      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }

      const usuario = reqBody?.usuario ?? reqBody?.username;
      const password = reqBody?.password;
      if (!usuario || !password) {
        throw new Error("Usuário e senha são obrigatórios para testar");
      }

      const method = String(reqBody?.test_method || "POST").toUpperCase();
      const requestBody = JSON.stringify({ usuario, password });

      const response = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : requestBody,
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      const tokenPath = reqBody?.test_token_json_path ? String(reqBody.test_token_json_path) : "";
      const token =
        (responseJson && tokenPath ? get(responseJson, tokenPath) : undefined) ??
        responseJson?.token ??
        responseJson?.access_token;

      return new Response(JSON.stringify({
        success: response.ok,
        status: response.status,
        response: responseJson ? sanitizeForUi(responseJson) : sanitizeForUi(responseText),
        token_preview: typeof token === "string" && token ? getTokenPreview(token) : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 1. Get Integration Config
    let integrationId = integration_id;

    if (!integrationId) {
      // First check if device has a specific integration linked
      const { data: deviceData, error: deviceError } = await supabaseClient
        .from("devices")
        .select("price_integration_id, company_id")
        .eq("id", device_id)
        .single();

      if (deviceError) throw new Error("Device not found");

      if (deviceData.price_integration_id) {
        integrationId = deviceData.price_integration_id;
      } else if (deviceData.company_id) {
        // Fallback to company default integration
        const { data: companyIntegration } = await supabaseClient
          .from("price_check_integrations")
          .select("id")
          .eq("company_id", deviceData.company_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        
        if (companyIntegration) {
          integrationId = companyIntegration.id;
        }
      }
    }

    if (!integrationId) {
       // Fallback to a global integration if needed, or error
       throw new Error("No active price check integration found for this device");
    }

    const { data: integration, error: intError } = await supabaseClient
      .from("price_check_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (intError || !integration) throw new Error("Integration not found");

    if (action === "auth_test") {
      if (integration.auth_url) {
        const r = await fetchCurlToken(supabaseClient, integration);
        return new Response(JSON.stringify({
          success: true,
          auth_type: integration.auth_type,
          token_preview: r.token ? getTokenPreview(r.token) : "",
          expires_at: r.expiresAt || "",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (integration.auth_type === "oauth2") {
        const tokenCache = await fetchOAuthToken(supabaseClient, integration);
        return new Response(JSON.stringify({
          success: true,
          auth_type: integration.auth_type,
          token_preview: getTokenPreview(tokenCache.access_token),
          expires_at: tokenCache.expires_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        auth_type: integration.auth_type,
        message: "Autenticação não requer token dinâmico para este tipo",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "auth_endpoint_test") {
      if (integration.auth_url) {
        const authUrl = String(integration.auth_url || "");
        const method = normalizeMethod(integration.auth_method, "POST");
        const headers = normalizeHeaders(integration.auth_headers_json);
        const queryParams = integration.auth_query_params_json;
        const bodyJson = integration.auth_body_json;
        const bodyText = integration.auth_body_text != null ? String(integration.auth_body_text) : "";

        const url = getUrlWithQuery(authUrl, queryParams);

        let body: string | undefined = undefined;
        if (method !== "GET") {
          if (bodyText.trim()) {
            body = bodyText;
          } else if (bodyJson && typeof bodyJson === "object") {
            if (!headers["Content-Type"] && !headers["content-type"]) {
              headers["Content-Type"] = "application/json";
            }
            body = JSON.stringify(bodyJson);
          }
        }

        const response = await fetch(url, { method, headers, body: method === "GET" ? undefined : body });
        const { text, json } = await safeReadResponse(response);

        const tokenPath = integration.auth_token_path ? String(integration.auth_token_path) : "";
        const token =
          (json && tokenPath ? get(json, tokenPath) : undefined) ??
          (json ? json?.token ?? json?.access_token : undefined);

        let tokenPreview: string | undefined = undefined;
        let expiresAt: string | undefined = undefined;

        if (typeof token === "string" && token) {
          tokenPreview = getTokenPreview(token);
          const expiresIn =
            (json && typeof json?.expires_in === "number" ? json.expires_in : undefined) ??
            (typeof integration.token_expiration_seconds === "number" ? integration.token_expiration_seconds : undefined) ??
            (typeof integration.token_expiration_seconds === "string" && String(integration.token_expiration_seconds).trim()
              ? Number(integration.token_expiration_seconds)
              : undefined) ??
            3600;
          expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
          const newCache: TokenCache = { access_token: token, expires_at: expiresAt };
          await supabaseClient
            .from("price_check_integrations")
            .update({ token_cache: newCache })
            .eq("id", integration.id);
        }

        return new Response(JSON.stringify({
          success: response.ok,
          auth_type: integration.auth_type,
          status: response.status,
          response: sanitizeForUi(json ?? text),
          token_preview: tokenPreview,
          expires_at: expiresAt,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (integration.auth_type !== "oauth2") {
        return new Response(JSON.stringify({
          success: true,
          auth_type: integration.auth_type,
          message: "Este tipo de autenticação não usa endpoint de token",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const config = (integration.auth_config || {}) as any;
      const tokenUrl = config.token_url;
      if (!tokenUrl) {
        throw new Error("OAuth2 token_url não configurada");
      }

      const requestConfig = buildTokenRequest(config);
      const response = await fetch(tokenUrl, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.body,
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      const tokenPath = config.token_json_path ? String(config.token_json_path) : "";
      const token =
        (responseJson && tokenPath ? get(responseJson, tokenPath) : undefined) ??
        responseJson?.token ??
        responseJson?.access_token;

      let tokenPreview: string | undefined = undefined;
      let expiresAt: string | undefined = undefined;

      if (typeof token === "string" && token) {
        tokenPreview = getTokenPreview(token);

        const expiresIn =
          (typeof responseJson?.expires_in === "number" ? responseJson.expires_in : undefined) ??
          (typeof config.expires_in_seconds === "number"
            ? config.expires_in_seconds
            : (typeof config.expires_in_seconds === "string" && config.expires_in_seconds.trim()
              ? Number(config.expires_in_seconds)
              : undefined)) ??
          3600;

        expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
        const newCache: TokenCache = { access_token: token, expires_at: expiresAt };
        await supabaseClient
          .from("price_check_integrations")
          .update({ token_cache: newCache })
          .eq("id", integration.id);
      }

      return new Response(JSON.stringify({
        success: response.ok,
        auth_type: integration.auth_type,
        status: response.status,
        response: responseJson ? sanitizeForUi(responseJson) : sanitizeForUi(responseText),
        token_preview: tokenPreview,
        expires_at: expiresAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "auth_body_test") {
      const config = (integration.auth_config || {}) as any;
      const url = config.test_endpoint_url;
      if (!url) {
        throw new Error("URL do endpoint de teste não configurada");
      }

      const headers: Record<string, string> = {
        ...normalizeHeaders(config.test_headers),
      };

      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }

      const usuario = config.username ?? config.usuario;
      const password = config.password;
      if (!usuario || !password) {
        throw new Error("Usuário e senha são obrigatórios para testar");
      }

      const method = String(config.test_method || "POST").toUpperCase();
      const body = JSON.stringify({ usuario, password });

      const response = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : body,
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      const tokenPath = config.test_token_json_path ? String(config.test_token_json_path) : (config.token_json_path ? String(config.token_json_path) : "");
      const token =
        (responseJson && tokenPath ? get(responseJson, tokenPath) : undefined) ??
        responseJson?.token ??
        responseJson?.access_token;

      return new Response(JSON.stringify({
        success: response.ok,
        auth_type: integration.auth_type,
        status: response.status,
        response: responseJson ? sanitizeForUi(responseJson) : sanitizeForUi(responseText),
        token_preview: typeof token === "string" && token ? getTokenPreview(token) : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Prepare Request
    const requestUrlBase = integration.request_url ? String(integration.request_url) : String(integration.endpoint_url || "");
    const requestMethod = normalizeMethod(integration.request_method ?? integration.method, "GET");
    let url = requestUrlBase;
    let body: string | null = null;

    const headers = {
      ...normalizeHeaders(integration.headers),
      ...normalizeHeaders(integration.request_headers_json),
    } as Record<string, string>;

    // Auth Headers
    let token = "";
    if (integration.auth_url) {
      const r = await fetchCurlToken(supabaseClient, integration);
      token = r.token || "";
    } else if (integration.auth_type === "api_key") {
      const config = integration.auth_config as any;
      if (config.header_name && config.api_key) {
        headers[String(config.header_name)] = String(config.api_key);
      }
    } else if (integration.auth_type === "bearer_token") {
      const config = integration.auth_config as any;
      if (config.token) {
        headers["Authorization"] = `Bearer ${String(config.token)}`;
      }
    } else if (integration.auth_type === "basic_auth") {
      const config = integration.auth_config as any;
      if (config.username && config.password) {
        const encoded = btoa(`${String(config.username)}:${String(config.password)}`);
        headers["Authorization"] = `Basic ${encoded}`;
      }
    } else if (integration.auth_type === "oauth2") {
      const tokenCache = await fetchOAuthToken(supabaseClient, integration);
      token = tokenCache.access_token;
    }

    const storeCode = reqBody?.store ?? reqBody?.store_code ?? reqBody?.storeCode ?? "";
    const context: Record<string, string> = {
      barcode: String(barcode ?? ""),
      ean: String(barcode ?? ""),
      gtin: String(barcode ?? ""),
      store: String(storeCode ?? ""),
      store_code: String(storeCode ?? ""),
      token,
    };

    url = interpolateString(url, context);
    for (const [k, v] of Object.entries(headers)) {
      const nk = interpolateString(String(k), context);
      const nv = interpolateString(String(v ?? ""), context);
      if (nk !== k) {
        delete headers[k];
        headers[nk] = nv;
      } else {
        headers[k] = nv;
      }
    }

    const queryParams = interpolateJson(integration.request_query_params_json, context);
    url = getUrlWithQuery(url, queryParams);

    const hasBodyMethod = requestMethod !== "GET" && requestMethod !== "DELETE";
    if (hasBodyMethod) {
      const rawText = integration.request_body_text != null ? String(integration.request_body_text) : "";
      const rawJson = integration.request_body_json;

      if (rawText.trim()) {
        body = interpolateString(rawText, context);
      } else if (rawJson && typeof rawJson === "object" && Object.keys(rawJson).length > 0) {
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
        body = JSON.stringify(interpolateJson(rawJson, context));
      }
    }

    if (!body) {
      if (integration.barcode_param_type === "path_param") {
        url = url.replace("{barcode}", String(barcode));
      } else if (integration.barcode_param_type === "query_param") {
        const paramName = integration.barcode_param_name || "barcode";
        const urlObj = new URL(url);
        urlObj.searchParams.append(paramName, String(barcode));
        url = urlObj.toString();
      } else if (integration.barcode_param_type === "body_json") {
        const paramName = integration.barcode_param_name || "barcode";
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
        body = JSON.stringify({ [paramName]: String(barcode) });
      }
    }

    // 3. Execute Request
    const startTime = Date.now();
    let responseStatus = 0;
    let responseData = null;
    let errorMessage = null;

    try {
      const fetchOptions: RequestInit = {
        method: requestMethod,
        headers: headers,
      };
      
      if (hasBodyMethod && body) {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      responseStatus = response.status;
      
      if (!response.ok) {
        throw new Error(`External API Error: ${response.status} ${response.statusText}`);
      }

      const { text, json } = await safeReadResponse(response);
      responseData = json ?? text;
    } catch (reqError: any) {
      errorMessage = reqError.message;
      if (!responseStatus) responseStatus = 500;
    }

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 4. Log Transaction
    await supabaseClient.from("price_check_logs").insert({
      integration_id: integrationId,
      device_id: device_id,
      barcode: barcode,
      status_code: responseStatus,
      response_time_ms: responseTime,
      error_message: errorMessage,
      request_payload: body ? (safeParseJsonValue(body) ?? body) : null,
      response_payload: responseData
    });

    if (action === "request_test") {
      const config = integration.mapping_config as any;
      const mapping = config?.fields || config || {};
      const resolveValue = (obj: any, path: string, defaultValue: any = undefined) => {
        if (!path) return defaultValue;
        const val = get(obj, path);
        return val !== undefined ? val : defaultValue;
      };

      const normalizedProduct = {
        barcode: resolveValue(responseData, mapping.barcode, barcode),
        internal_code: resolveValue(responseData, mapping.internal_code, ""),
        description: resolveValue(responseData, mapping.description, "Produto sem descrição"),
        image: resolveValue(responseData, mapping.image, ""),
        unit: resolveValue(responseData, mapping.unit, "UN"),
        price_current: Number(resolveValue(responseData, mapping.price_current, 0)) || 0,
        price_original: mapping.price_original ? Number(resolveValue(responseData, mapping.price_original)) : null,
        prices: [] as any[]
      };

      if (mapping.prices && Array.isArray(mapping.prices)) {
        normalizedProduct.prices = mapping.prices.map((p: any) => ({
          label: p.label,
          value: Number(get(responseData, p.path)) || 0
        }));
      }

      return new Response(JSON.stringify({
        success: !errorMessage && responseStatus >= 200 && responseStatus < 300,
        status: responseStatus,
        error: errorMessage,
        request: {
          url,
          method: requestMethod,
          headers: sanitizeForUi(headers),
          body: body ? (safeParseJsonValue(body) ?? body) : null,
        },
        response: sanitizeForUi(responseData),
        product: normalizedProduct,
        response_time_ms: responseTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    // 5. Map Response (Normalization)
    const config = integration.mapping_config as any;
    const mapping = config?.fields || config || {};
    
    // Helper for value resolution
    const resolveValue = (obj: any, path: string, defaultValue: any = undefined) => {
      if (!path) return defaultValue;
      const val = get(obj, path);
      // If val is undefined and path doesn't contain dots, maybe it's a static value?
      // For now, strict path mapping or return undefined
      return val !== undefined ? val : defaultValue;
    };

    // Default fallback values
    const normalizedProduct = {
      barcode: resolveValue(responseData, mapping.barcode, barcode),
      internal_code: resolveValue(responseData, mapping.internal_code, ""),
      description: resolveValue(responseData, mapping.description, "Produto sem descrição"),
      image: resolveValue(responseData, mapping.image, ""),
      unit: resolveValue(responseData, mapping.unit, "UN"),
      price_current: Number(resolveValue(responseData, mapping.price_current, 0)) || 0,
      price_original: mapping.price_original ? Number(resolveValue(responseData, mapping.price_original)) : null,
      prices: [] as any[]
    };

    // Map Prices (Legacy/List support)
    if (mapping.prices && Array.isArray(mapping.prices)) {
      normalizedProduct.prices = mapping.prices.map((p: any) => ({
        label: p.label,
        value: Number(get(responseData, p.path)) || 0
      }));
    }

    // Construct Final Mupa Response
    const mupaResponse = {
      success: true,
      product: normalizedProduct
    };

    return new Response(JSON.stringify(mupaResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    const isAuthTest = actionName.startsWith("auth_");
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuthTest ? 200 : 400,
    });
  }
});
