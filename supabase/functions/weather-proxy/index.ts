// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map WMO codes to OpenWeather icon names and descriptions
const weatherCodeMap: any = {
  0: { icon: "01d", description: "Céu limpo" },
  1: { icon: "02d", description: "Predominantemente limpo" },
  2: { icon: "03d", description: "Parcialmente nublado" },
  3: { icon: "04d", description: "Nublado" },
  45: { icon: "50d", description: "Neblina" },
  48: { icon: "50d", description: "Nevoeiro com geada" },
  51: { icon: "09d", description: "Garoa leve" },
  53: { icon: "09d", description: "Garoa moderada" },
  55: { icon: "09d", description: "Garoa intensa" },
  56: { icon: "09d", description: "Garoa congelante leve" },
  57: { icon: "09d", description: "Garoa congelante densa" },
  61: { icon: "10d", description: "Chuva leve" },
  63: { icon: "10d", description: "Chuva moderada" },
  65: { icon: "10d", description: "Chuva forte" },
  66: { icon: "13d", description: "Chuva congelante leve" },
  67: { icon: "13d", description: "Chuva congelante forte" },
  71: { icon: "13d", description: "Neve leve" },
  73: { icon: "13d", description: "Neve moderada" },
  75: { icon: "13d", description: "Neve forte" },
  77: { icon: "13d", description: "Grãos de neve" },
  80: { icon: "09d", description: "Pancadas de chuva leves" },
  81: { icon: "09d", description: "Pancadas de chuva moderadas" },
  82: { icon: "09d", description: "Pancadas de chuva violentas" },
  85: { icon: "13d", description: "Pancadas de neve leves" },
  86: { icon: "13d", description: "Pancadas de neve fortes" },
  95: { icon: "11d", description: "Tempestade" },
  96: { icon: "11d", description: "Tempestade com granizo leve" },
  99: { icon: "11d", description: "Tempestade com granizo forte" },
};

declare const Deno: any;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let action: string | null = null;
    let id: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        action = body.action;
        id = body.id;
      } catch {
        // Body might be empty
      }
    }

    // Fallback to URL params if not found in body
    const url = new URL(req.url);
    if (!action) action = url.searchParams.get("action");
    if (!id) id = url.searchParams.get("id");

    // Default to update-all if no action is specified (e.g. cron job)
    if (!action && !id) {
      action = "update-all";
    }

    if (action === "update" && id) {
      // Update specific location
      const { data: location, error: locError } = await supabaseClient
        .from("weather_locations")
        .select("*")
        .eq("id", id)
        .single();

      if (locError || !location) throw new Error("Location not found");

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error("Failed to fetch weather data from OpenMeteo");

      const data = await weatherRes.json();
      const current = data.current;
      const weatherInfo = weatherCodeMap[current.weather_code] || { icon: "03d", description: "Desconhecido" };

      // Adjust icon for night
      let icon = weatherInfo.icon;
      if (current.is_day === 0 && icon.endsWith("d")) {
        icon = icon.replace("d", "n");
      }

      // Process daily forecast
      const dailyForecast = data.daily?.time.map((time: string, index: number) => {
        const code = data.daily.weather_code[index];
        const info = weatherCodeMap[code] || { icon: "03d", description: "Desconhecido" };
        return {
          date: time,
          max_temp: data.daily.temperature_2m_max[index],
          min_temp: data.daily.temperature_2m_min[index],
          weather_icon: info.icon,
          weather_description: info.description
        };
      }) || [];

      // Process hourly forecast (next 24 hours)
      // Adjust current time to location's timezone to match API response
      const utcOffsetSeconds = data.utc_offset_seconds || 0;
      const utcNow = new Date().getTime();
      const localNow = new Date(utcNow + utcOffsetSeconds * 1000);
      const currentHour = localNow.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"

      const hourlyForecast = [];
      
      if (data.hourly?.time) {
        const startIndex = data.hourly.time.findIndex((t: string) => t.startsWith(currentHour));
        const start = startIndex >= 0 ? startIndex : 0;
        
        for (let i = start; i < start + 24 && i < data.hourly.time.length; i++) {
          const code = data.hourly.weather_code[i];
          const info = weatherCodeMap[code] || { icon: "03d", description: "Desconhecido" };
          let hourIcon = info.icon;
          if (data.hourly.is_day[i] === 0 && hourIcon.endsWith("d")) {
            hourIcon = hourIcon.replace("d", "n");
          }
          
          hourlyForecast.push({
            time: data.hourly.time[i],
            temp: data.hourly.temperature_2m[i],
            weather_icon: hourIcon,
            weather_description: info.description
          });
        }
      }
      
      // Add formatted forecasts to raw_data as fallback
          const enrichedRawData = {
            ...data,
            daily_forecast: dailyForecast,
            hourly_forecast: hourlyForecast
          };

          const updateData = {
            last_updated_at: new Date().toISOString(),
            current_temp: current.temperature_2m,
            weather_description: weatherInfo.description,
            weather_icon: icon,
            humidity: current.relative_humidity_2m,
            wind_speed: current.wind_speed_10m,
            raw_data: enrichedRawData,
            daily_forecast: dailyForecast,
            hourly_forecast: hourlyForecast
          };

      const { error: updateError } = await supabaseClient
        .from("weather_locations")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, data: updateData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-all") {
      // Update all active locations (for cron job)
      const { data: locations, error: locsError } = await supabaseClient
        .from("weather_locations")
        .select("*")
        .eq("is_active", true);

      if (locsError) throw locsError;

      const results = [];
      for (const location of locations) {
        try {
          // Check if updated recently (e.g., last hour)
          const lastUpdated = location.last_updated_at ? new Date(location.last_updated_at) : new Date(0);
          const now = new Date();
          const diffMs = now.getTime() - lastUpdated.getTime();
          const diffMins = Math.round(diffMs / 60000);

          if (diffMins < 50) {
            results.push({ id: location.id, status: "skipped", reason: "recently updated" });
            continue;
          }

          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
          const weatherRes = await fetch(weatherUrl);
          if (!weatherRes.ok) {
            results.push({ id: location.id, status: "error", error: "api error" });
            continue;
          }

          const data = await weatherRes.json();
          const current = data.current;
          const weatherInfo = weatherCodeMap[current.weather_code] || { icon: "03d", description: "Desconhecido" };

          let icon = weatherInfo.icon;
          if (current.is_day === 0 && icon.endsWith("d")) {
            icon = icon.replace("d", "n");
          }

          // Process daily forecast
          const dailyForecast = data.daily?.time.map((time: string, index: number) => {
            const code = data.daily.weather_code[index];
            const info = weatherCodeMap[code] || { icon: "03d", description: "Desconhecido" };
            return {
              date: time,
              max_temp: data.daily.temperature_2m_max[index],
              min_temp: data.daily.temperature_2m_min[index],
              weather_icon: info.icon,
              weather_description: info.description
            };
          }) || [];

          // Process hourly forecast (next 24 hours)
          const currentHour = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
          const hourlyForecast = [];
          
          if (data.hourly?.time) {
            const startIndex = data.hourly.time.findIndex((t: string) => t.startsWith(currentHour));
            const start = startIndex >= 0 ? startIndex : 0;
            
            for (let i = start; i < start + 24 && i < data.hourly.time.length; i++) {
              const code = data.hourly.weather_code[i];
              const info = weatherCodeMap[code] || { icon: "03d", description: "Desconhecido" };
              let hourIcon = info.icon;
              if (data.hourly.is_day[i] === 0 && hourIcon.endsWith("d")) {
                hourIcon = hourIcon.replace("d", "n");
              }
              
              hourlyForecast.push({
                time: data.hourly.time[i],
                temp: data.hourly.temperature_2m[i],
                weather_icon: hourIcon,
                weather_description: info.description
              });
            }
          }
          
          // Add formatted forecasts to raw_data as fallback
          const enrichedRawData = {
            ...data,
            daily_forecast: dailyForecast,
            hourly_forecast: hourlyForecast
          };

          const updateData = {
            last_updated_at: now.toISOString(),
            current_temp: current.temperature_2m,
            weather_description: weatherInfo.description,
            weather_icon: icon,
            humidity: current.relative_humidity_2m,
            wind_speed: current.wind_speed_10m,
            raw_data: enrichedRawData,
            daily_forecast: dailyForecast,
            hourly_forecast: hourlyForecast
          };

          await supabaseClient
            .from("weather_locations")
            .update(updateData)
            .eq("id", location.id);
          
          results.push({ id: location.id, status: "updated" });
        } catch (err: any) {
          results.push({ id: location.id, status: "error", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("weather-proxy error:", msg);
    return new Response(JSON.stringify({ error: "Erro ao buscar dados meteorológicos" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
