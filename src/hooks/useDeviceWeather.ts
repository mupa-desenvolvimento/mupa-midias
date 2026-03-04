import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherLocation } from "./useWeather";

export function useDeviceWeather(deviceCode: string) {
  const [weatherSettings, setWeatherSettings] = useState<WeatherLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceCode) return;

    const fetchWeatherSettings = async () => {
      try {
        // @ts-ignore - RPC function added via migration but types not yet generated
        const { data, error } = await supabase.rpc('get_device_weather_settings' as any, {
          p_device_code: deviceCode
        });

        if (error) {
          console.error("Error fetching device weather settings:", error);
          return;
        }

        if (data) {
          // Parse JSONB result if needed, or if it's already an object
          // RPC returns jsonb which supabase-js usually parses to object/array
          setWeatherSettings(data as unknown as WeatherLocation[]);
        }
      } catch (e) {
        console.error("Error in fetchWeatherSettings:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeatherSettings();

    // Optional: Set up realtime subscription for weather_locations changes
    // This requires knowing the tenant_id, which we don't have easily here without another call.
    // For now, we fetch once on load. Polling could be added if needed.
    const interval = setInterval(fetchWeatherSettings, 5 * 60 * 1000); // Poll every 5 minutes

    return () => clearInterval(interval);
  }, [deviceCode]);

  return { weatherSettings, isLoading };
}
