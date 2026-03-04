import { WeatherLayoutProps } from "./types";
import { WeatherIcon } from "@/components/weather/WeatherIcon";

export function ForecastGridLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  
  // Use current day + next 6 days = 7 days
  const days = location.daily_forecast?.slice(0, 7) || [];

  const getThemeColors = () => {
    switch (location.theme_color) {
      case 'purple': return {
        bg: "bg-zinc-950",
        activeBg: "bg-purple-600",
        activeShadow: "shadow-purple-900/20",
        inactiveBg: "bg-zinc-900",
        hoverBg: "hover:bg-zinc-800"
      };
      case 'green': return {
        bg: "bg-zinc-950",
        activeBg: "bg-emerald-600",
        activeShadow: "shadow-emerald-900/20",
        inactiveBg: "bg-zinc-900",
        hoverBg: "hover:bg-zinc-800"
      };
      case 'orange': return {
        bg: "bg-zinc-950",
        activeBg: "bg-orange-500",
        activeShadow: "shadow-orange-900/20",
        inactiveBg: "bg-zinc-900",
        hoverBg: "hover:bg-zinc-800"
      };
      case 'dark': return {
        bg: "bg-black",
        activeBg: "bg-white text-black",
        activeShadow: "shadow-white/20",
        inactiveBg: "bg-zinc-900",
        hoverBg: "hover:bg-zinc-800"
      };
      case 'blue':
      default: return {
        bg: "bg-zinc-950",
        activeBg: "bg-blue-600",
        activeShadow: "shadow-blue-900/20",
        inactiveBg: "bg-zinc-900",
        hoverBg: "hover:bg-zinc-800"
      };
    }
  };

  const theme = getThemeColors();

  return (
    <div className={`w-full h-full ${theme.bg} text-white p-8 flex flex-col justify-center items-center font-sans ${className}`}>
      <div className="mb-12 text-center animate-in fade-in slide-in-from-top-8 duration-700">
        <h2 className="text-5xl font-extralight tracking-tight mb-4 text-zinc-100">{location.city}</h2>
        <div className="flex items-center gap-6 justify-center">
          <span className="text-8xl font-bold tracking-tighter text-white">{Math.round(location.current_temp || 0)}°</span>
          <div className="flex flex-col items-start">
            <span className="text-2xl font-medium text-zinc-400 capitalize">{location.weather_description}</span>
            <div className="flex gap-4 text-zinc-500 mt-1">
               <span>V: {location.wind_speed} km/h</span>
               <span>U: {location.humidity}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className={`grid gap-4 w-full max-w-[1600px] ${isVertical ? 'grid-cols-2' : 'grid-cols-7'}`}>
        {days.map((day: any, idx: number) => (
          <div 
            key={idx} 
            className={`
              relative overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-between
              ${idx === 0 ? `${theme.activeBg} ${location.theme_color === 'dark' ? 'text-black' : 'text-white'} shadow-2xl ${theme.activeShadow} scale-105 z-10` : `${theme.inactiveBg} text-zinc-300 border border-zinc-800`}
              transition-all duration-300 hover:scale-105 ${theme.hoverBg} hover:z-10 h-80
            `}
          >
            <span className={`text-sm font-bold uppercase tracking-widest mb-4 ${idx === 0 ? 'opacity-100' : 'opacity-60'}`}>
              {idx === 0 ? "Hoje" : new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'long' })}
            </span>
            
            <WeatherIcon 
              iconCode={day.weather_icon} 
              description={day.weather_description}
              className="w-24 h-24 mb-4 drop-shadow-2xl"
            />
            
            <div className="flex flex-col items-center w-full mt-auto">
              <span className="text-5xl font-bold mb-2 tracking-tighter">{Math.round(day.max_temp)}°</span>
              <span className={`text-2xl font-medium ${idx === 0 ? 'opacity-80' : 'opacity-40'}`}>{Math.round(day.min_temp)}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
