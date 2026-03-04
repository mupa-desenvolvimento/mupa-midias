import { WeatherLayoutProps } from "./types";
import { Wind, Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeatherIcon } from "@/components/weather/WeatherIcon";

export function ModernCardLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  
  const getThemeColors = () => {
    switch (location.theme_color) {
      case 'purple': return {
        bg: "bg-slate-950",
        cardBg: "bg-slate-900",
        accent: "text-purple-400",
        glow: "bg-purple-500/20"
      };
      case 'green': return {
        bg: "bg-slate-950",
        cardBg: "bg-slate-900",
        accent: "text-emerald-400",
        glow: "bg-emerald-500/20"
      };
      case 'orange': return {
        bg: "bg-slate-950",
        cardBg: "bg-slate-900",
        accent: "text-orange-400",
        glow: "bg-orange-500/20"
      };
      case 'dark': return {
        bg: "bg-black",
        cardBg: "bg-zinc-900",
        accent: "text-white",
        glow: "bg-white/10"
      };
      case 'blue':
      default: return {
        bg: "bg-slate-950",
        cardBg: "bg-slate-900",
        accent: "text-blue-400",
        glow: "bg-blue-500/20"
      };
    }
  };

  const theme = getThemeColors();

  return (
    <div className={`w-full h-full ${theme.bg} text-white p-8 gap-8 flex ${isVertical ? 'flex-col' : 'flex-row'} ${className}`}>
      
      {/* Main Card */}
      <Card className={`${theme.cardBg} border-slate-800 text-white shadow-2xl ${isVertical ? 'w-full flex-none' : 'w-1/3 flex-none h-full'}`}>
        <CardHeader>
          <CardTitle className="text-2xl font-light text-slate-400">{location.city}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-6">
          <div className="relative">
            <div className={`absolute inset-0 ${theme.glow} blur-[60px] rounded-full`} />
            <WeatherIcon 
              iconCode={location.weather_icon} 
              description={location.weather_description}
              className="w-40 h-40 relative z-10 drop-shadow-2xl"
            />
          </div>
          
          <div className="text-center">
            <span className="text-8xl font-bold tracking-tighter block mb-2">
              {Math.round(location.current_temp || 0)}°
            </span>
            <span className="text-2xl capitalize text-slate-400 font-medium block">
              {location.weather_description}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-8">
            <div className={`flex flex-col items-center ${theme.cardBg}/50 p-4 rounded-2xl border border-slate-800`}>
              <Wind className={`w-6 h-6 mb-2 ${theme.accent}`} />
              <span className="text-xl font-bold">{location.wind_speed}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">km/h Vento</span>
            </div>
            <div className={`flex flex-col items-center ${theme.cardBg}/50 p-4 rounded-2xl border border-slate-800`}>
              <Droplets className={`w-6 h-6 mb-2 ${theme.accent}`} />
              <span className="text-xl font-bold">{location.humidity}%</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Umidade</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Cards Grid */}
      <div className={`flex-1 grid gap-4 ${isVertical ? 'grid-cols-2' : 'grid-cols-3 content-start'}`}>
        {location.daily_forecast?.slice(1, 7).map((day: any, idx: number) => (
          <Card key={idx} className={`${theme.cardBg} border-slate-800 text-white hover:bg-slate-800 transition-all hover:scale-105 duration-300 cursor-default group`}>
            <CardContent className="flex flex-col items-center justify-center p-6 h-full">
              <span className={`text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 group-hover:${theme.accent.replace('text-', 'text-')} transition-colors`}>
                {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
              <WeatherIcon 
                iconCode={day.weather_icon} 
                description={day.weather_description}
                className="w-16 h-16 mb-3 opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{Math.round(day.max_temp)}°</span>
                <span className="text-lg text-slate-600 font-medium">{Math.round(day.min_temp)}°</span>
              </div>
              <span className="text-xs text-slate-600 mt-2 capitalize opacity-0 group-hover:opacity-100 transition-opacity">
                {day.weather_description}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
