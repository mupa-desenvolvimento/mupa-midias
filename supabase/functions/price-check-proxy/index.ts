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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { device_id, barcode, integration_id } = await req.json();

    if (!device_id || !barcode) {
      throw new Error("Missing device_id or barcode");
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

    // 2. Prepare Request
    let url = integration.endpoint_url;
    let body = null;
    let headers = {
      "Content-Type": "application/json",
      ...integration.headers,
    };

    // Auth Headers
    if (integration.auth_type === "api_key") {
      const config = integration.auth_config as any;
      if (config.header_name && config.api_key) {
        headers[config.header_name] = config.api_key;
      }
    } else if (integration.auth_type === "bearer_token") {
      const config = integration.auth_config as any;
      if (config.token) {
        headers["Authorization"] = `Bearer ${config.token}`;
      }
    } else if (integration.auth_type === "basic_auth") {
      const config = integration.auth_config as any;
      if (config.username && config.password) {
        const encoded = btoa(`${config.username}:${config.password}`);
        headers["Authorization"] = `Basic ${encoded}`;
      }
    }
    // OAuth2 would need token refresh logic here, skipping for brevity in V1

    // Barcode Parameter Injection
    if (integration.barcode_param_type === "path_param") {
      url = url.replace("{barcode}", barcode);
    } else if (integration.barcode_param_type === "query_param") {
      const paramName = integration.barcode_param_name || "barcode";
      const urlObj = new URL(url);
      urlObj.searchParams.append(paramName, barcode);
      url = urlObj.toString();
    } else if (integration.barcode_param_type === "body_json") {
      const paramName = integration.barcode_param_name || "barcode";
      body = JSON.stringify({ [paramName]: barcode });
    }

    // 3. Execute Request
    const startTime = Date.now();
    let responseStatus = 0;
    let responseData = null;
    let errorMessage = null;

    try {
      const fetchOptions: RequestInit = {
        method: integration.method,
        headers: headers,
      };
      
      if (integration.method === "POST" && body) {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      responseStatus = response.status;
      
      if (!response.ok) {
        throw new Error(`External API Error: ${response.status} ${response.statusText}`);
      }

      responseData = await response.json();
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
      request_payload: body ? JSON.parse(body) : null,
      response_payload: responseData
    });

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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
