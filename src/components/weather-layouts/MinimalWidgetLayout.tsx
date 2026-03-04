import { WeatherLayoutProps } from "./types";
import { WeatherIcon } from "@/components/weather/WeatherIcon";

export function MinimalWidgetLayout({ location, className }: WeatherLayoutProps) {
  const getThemeStyles = () => {
    switch (location.theme_color) {
      case 'purple': return "border-purple-500/30 bg-purple-950/60";
      case 'green': return "border-emerald-500/30 bg-emerald-950/60";
      case 'orange': return "border-orange-500/30 bg-orange-950/60";
      case 'dark': return "border-slate-800/60 bg-black/80";
      case 'blue':
      default: return "border-white/10 bg-black/60";
    }
  };

  return (
    <div className={`flex items-center gap-4 backdrop-blur-md text-white p-6 rounded-2xl shadow-2xl border ${getThemeStyles()} ${className}`}>
      <div className="flex flex-col items-end">
        <span className="text-lg font-medium opacity-90">{location.city}</span>
        <span className="text-4xl font-bold tracking-tight">{Math.round(location.current_temp || 0)}°</span>
        <div className="flex gap-2 text-xs opacity-70 mt-1">
          <span>H: {Math.round(location.daily_forecast?.[0]?.max_temp || 0)}°</span>
          <span>L: {Math.round(location.daily_forecast?.[0]?.min_temp || 0)}°</span>
        </div>
      </div>
      <WeatherIcon 
        iconCode={location.weather_icon} 
        description={location.weather_description}
        className="w-16 h-16 drop-shadow-lg"
      />
    </div>
  );
}
