
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WeatherLocation {
  id: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  openweather_city_id?: string;
  is_active: boolean;
  is_default: boolean;
  last_updated_at?: string;
  current_temp?: number;
  weather_description?: string;
  weather_icon?: string;
  humidity?: number;
  wind_speed?: number;
  raw_data?: any;
  daily_forecast?: any;
  hourly_forecast?: any;
  type_view?: "widget" | "slide";
  layout_type?: "apple" | "minimal" | "card" | "grid";
  display_time?: number;
  theme_color?: string;
  created_at?: string;
  updated_at?: string;
}

import { fetchWeatherFromOpenMeteo } from "@/utils/weatherUtils";

export function useWeather() {
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["weather-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_locations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar locais de clima");
        throw error;
      }

      return data as WeatherLocation[];
    },
  });

  const searchCities = async (query: string) => {
    if (!query || query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.map((item: any) => ({
        name: item.address.city || item.address.town || item.address.village || item.address.municipality || item.name,
        state: item.address.state,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        country: 'BR'
      })).filter((item: any) => item.name && item.state);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  };

  const addLocation = useMutation({
    mutationFn: async (location: Partial<WeatherLocation>) => {
      // Get current user's tenant_id
      const { data: tenantId, error: tenantError } = await supabase.rpc('get_user_tenant_id_strict');
      
      if (tenantError) throw tenantError;
      if (!tenantId) throw new Error("Usuário não vinculado a um tenant");

      const { data, error } = await supabase
        .from("weather_locations")
        .insert({
          tenant_id: tenantId,
          city: location.city,
          state: location.state,
          latitude: location.latitude,
          longitude: location.longitude,
          openweather_city_id: location.openweather_city_id,
          is_active: true,
          is_default: location.is_default || false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
      toast.success("Local adicionado com sucesso");
      if (data?.id) {
        forceUpdate.mutate(data.id);
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar local");
    },
  });

  const removeLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weather_locations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
      toast.success("Local removido");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("weather_locations")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      // First unset all defaults
      await supabase
        .from("weather_locations")
        .update({ is_default: false })
        .neq("id", id); // This might need RLS policy allowing mass update or loop

      // Set new default
      const { error } = await supabase
        .from("weather_locations")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
      toast.success("Local padrão definido");
    },
  });

  const forceUpdate = useMutation({
    mutationFn: async (id: string) => {
      // 1. Get location coordinates
      const { data: location, error: locError } = await supabase
        .from("weather_locations")
        .select("latitude, longitude")
        .eq("id", id)
        .single();
      
      if (locError) throw locError;
      if (!location) throw new Error("Local não encontrado");

      // 2. Fetch weather from OpenMeteo
      const weatherData = await fetchWeatherFromOpenMeteo(location.latitude, location.longitude);

      // 3. Update location in DB
      const enrichedRawData = {
        ...weatherData.raw_data,
        daily_forecast: weatherData.daily_forecast,
        hourly_forecast: weatherData.hourly_forecast
      };

      // Try update with all fields (including new hourly_forecast)
      const { error: updateError } = await supabase
        .from("weather_locations")
        .update({
          current_temp: weatherData.current_temp,
          weather_description: weatherData.weather_description,
          weather_icon: weatherData.weather_icon,
          humidity: weatherData.humidity,
          wind_speed: weatherData.wind_speed,
          raw_data: enrichedRawData,
          daily_forecast: weatherData.daily_forecast,
          hourly_forecast: weatherData.hourly_forecast,
          last_updated_at: new Date().toISOString()
        })
        .eq("id", id);

      // If update fails (likely due to missing column), try fallback without hourly_forecast
      if (updateError) {
        console.warn("Update with hourly_forecast failed, retrying without it:", updateError);
        
        const { error: fallbackError } = await supabase
          .from("weather_locations")
          .update({
            current_temp: weatherData.current_temp,
            weather_description: weatherData.weather_description,
            weather_icon: weatherData.weather_icon,
            humidity: weatherData.humidity,
            wind_speed: weatherData.wind_speed,
            raw_data: enrichedRawData,
            daily_forecast: weatherData.daily_forecast,
            last_updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (fallbackError) throw fallbackError;
      }
      
      return weatherData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
      toast.success("Dados de clima atualizados");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Falha ao atualizar clima. Verifique a conexão.");
    }
  });

  const updateSettings = useMutation({
    mutationFn: async (params: { 
      id: string; 
      type_view?: "widget" | "slide"; 
      display_time?: number; 
      layout_type?: "apple" | "minimal" | "card" | "grid";
      theme_color?: string;
    }) => {
      const updateData: any = {};
      if (params.type_view) {
        updateData.type_view = params.type_view;
        if (params.type_view === "slide" && !params.display_time) updateData.display_time = 10;
        if (params.type_view === "widget") updateData.display_time = null;
      }
      if (params.layout_type) updateData.layout_type = params.layout_type;
      if (params.display_time !== undefined) updateData.display_time = params.display_time;
      if (params.theme_color !== undefined) updateData.theme_color = params.theme_color;

      const { error } = await supabase
        .from("weather_locations")
        .update(updateData)
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-locations"] });
      toast.success("Configurações atualizadas");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao atualizar configurações");
    }
  });

  return {
    locations,
    isLoading,
    searchCities,
    addLocation,
    removeLocation,
    toggleActive,
    setDefault,
    forceUpdate,
    updateSettings
  };
}
