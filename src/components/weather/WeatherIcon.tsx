
import { useState } from "react";
import { 
  Sun, Moon, CloudSun, CloudMoon, Cloud, 
  CloudRain, CloudLightning, CloudSnow, CloudFog 
} from "lucide-react";

interface WeatherIconProps {
  iconCode?: string;
  description?: string;
  className?: string;
}

export function WeatherIcon({ iconCode, description, className }: WeatherIconProps) {
  const [imageError, setImageError] = useState(false);

  if (!iconCode) return <Cloud className={className} />;

  // Map OpenWeather icon codes to Lucide icons as fallback
  const getFallbackIcon = () => {
    const code = iconCode.replace('n', 'd'); // Normalize to day for simpler mapping if needed, but we handle night
    
    switch (iconCode) {
      case '01d': return <Sun className={className} />;
      case '01n': return <Moon className={className} />;
      case '02d': return <CloudSun className={className} />;
      case '02n': return <CloudMoon className={className} />;
      case '03d': 
      case '03n':
      case '04d':
      case '04n': return <Cloud className={className} />;
      case '09d':
      case '09n':
      case '10d':
      case '10n': return <CloudRain className={className} />;
      case '11d':
      case '11n': return <CloudLightning className={className} />;
      case '13d':
      case '13n': return <CloudSnow className={className} />;
      case '50d':
      case '50n': return <CloudFog className={className} />;
      default: return <Cloud className={className} />;
    }
  };

  if (imageError) {
    return getFallbackIcon();
  }

  return (
    <img 
      src={`https://openweathermap.org/img/wn/${iconCode}@2x.png`} 
      alt={description || "Weather icon"}
      className={className}
      onError={() => setImageError(true)}
    />
  );
}
