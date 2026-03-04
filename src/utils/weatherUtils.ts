
// Utility to fetch weather data from OpenMeteo (Open Source API)
// This avoids the need for a backend proxy and API keys for basic weather data.

export interface WeatherData {
  current_temp: number;
  weather_description: string;
  weather_icon: string; // Mapped to OpenWeather icon names for compatibility
  humidity: number;
  wind_speed: number;
  raw_data: any;
  daily_forecast?: {
    date: string;
    max_temp: number;
    min_temp: number;
    weather_icon: string;
    weather_description: string;
  }[];
  hourly_forecast?: {
    time: string;
    temp: number;
    weather_icon: string;
    weather_description: string;
  }[];
}

// Map WMO codes to OpenWeather icon names and descriptions
const weatherCodeMap: Record<number, { icon: string; description: string }> = {
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

export async function fetchWeatherFromOpenMeteo(lat: number, lon: number): Promise<WeatherData> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );

    if (!response.ok) {
      throw new Error("Falha ao buscar dados do OpenMeteo");
    }

    const data = await response.json();
    const current = data.current;
    const weatherInfo = weatherCodeMap[current.weather_code] || { icon: "03d", description: "Desconhecido" };

    // Adjust icon for night if needed (OpenMeteo returns is_day: 0 for night)
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
        const time = data.hourly.time[i];
        const code = data.hourly.weather_code[i];
        const isDay = data.hourly.is_day[i];
        const temp = data.hourly.temperature_2m[i];
        
        const info = weatherCodeMap[code] || { icon: "03d", description: "Desconhecido" };
        let hIcon = info.icon;
        
        if (isDay === 0 && hIcon.endsWith("d")) {
          hIcon = hIcon.replace("d", "n");
        }
        
        hourlyForecast.push({
          time,
          temp,
          weather_icon: hIcon,
          weather_description: info.description
        });
      }
    }

    return {
      current_temp: current.temperature_2m,
      weather_description: weatherInfo.description,
      weather_icon: icon,
      humidity: current.relative_humidity_2m,
      wind_speed: current.wind_speed_10m,
      raw_data: data,
      daily_forecast: dailyForecast,
      hourly_forecast: hourlyForecast
    };
  } catch (error) {
    console.error("Erro ao buscar clima:", error);
    throw error;
  }
}
