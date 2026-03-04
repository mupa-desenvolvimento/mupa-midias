import { WeatherLayoutProps } from "./types";
import { Calendar, Clock, Wind, Droplets } from "lucide-react";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { motion } from "framer-motion";

export function AppleWeatherLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  
  // Dynamic gradient based on is_day (from raw_data or icon)
  const isDay = location.weather_icon?.endsWith('d') ?? true;
  
  const getThemeGradient = () => {
    switch (location.theme_color) {
      case 'purple': return "bg-gradient-to-b from-purple-600 to-indigo-900";
      case 'green': return "bg-gradient-to-b from-emerald-500 to-teal-900";
      case 'orange': return "bg-gradient-to-b from-orange-400 to-red-900";
      case 'dark': return "bg-gradient-to-b from-slate-900 to-black";
      case 'blue':
      default:
        return isDay 
          ? "bg-gradient-to-b from-[#3b82f6] to-[#1e3a8a]" // Blue sky
          : "bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a]"; // Night sky
    }
  };

  const bgGradient = getThemeGradient();

  return (
    <div className={`w-full h-full ${bgGradient} text-white p-8 flex flex-col relative overflow-hidden font-sans ${className}`}>
      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col items-center text-center z-10 ${isVertical ? 'mt-12 mb-8' : 'mt-4 mb-4'}`}
      >
        <h2 className="text-3xl font-normal tracking-wide drop-shadow-md">{location.city}</h2>
        <div className="flex flex-col items-center">
          <span className="text-[7rem] leading-none font-light tracking-tighter drop-shadow-xl my-2">
            {Math.round(location.current_temp || 0)}°
          </span>
          <span className="text-xl font-medium capitalize opacity-90 drop-shadow-md">
            {location.weather_description}
          </span>
          <div className="flex gap-3 text-lg font-medium opacity-80 drop-shadow-sm mt-1">
            <span>H: {Math.round(location.daily_forecast?.[0]?.max_temp || 0)}°</span>
            <span>L: {Math.round(location.daily_forecast?.[0]?.min_temp || 0)}°</span>
          </div>
        </div>
      </motion.div>

      <div className={`flex ${isVertical ? 'flex-col gap-6' : 'flex-row gap-8 items-start justify-center flex-1'}`}>
        
        {/* Hourly Forecast */}
        {location.hourly_forecast && location.hourly_forecast.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={`bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 z-10 ${isVertical ? 'w-full' : 'flex-1 max-w-md h-full'}`}
          >
            <div className="flex items-center gap-2 mb-4 opacity-70 border-b border-white/10 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Previsão por hora</span>
            </div>
            <div className={`flex ${isVertical ? 'overflow-x-auto pb-2 gap-6' : 'flex-col gap-4 overflow-y-auto pr-2'} no-scrollbar`}>
              {location.hourly_forecast.slice(0, isVertical ? 24 : 12).map((hour: any, idx: number) => (
                <div key={idx} className={`flex items-center ${isVertical ? 'flex-col min-w-[3.5rem] gap-2' : 'flex-row justify-between w-full'}`}>
                  <span className="text-sm font-medium w-12">
                    {idx === 0 ? "Agora" : new Date(hour.time).getHours() + "h"}
                  </span>
                  <div className="flex flex-col items-center">
                    <WeatherIcon 
                      iconCode={hour.weather_icon} 
                      className="w-8 h-8 opacity-90 mb-2"
                    />
                    {!isVertical && <span className="text-xs opacity-50 capitalize">{hour.weather_description}</span>}
                  </div>
                  <span className="text-lg font-semibold w-12 text-right">{Math.round(hour.temp)}°</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 5-Day Forecast */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className={`bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 z-10 ${isVertical ? 'flex-1' : 'flex-1 max-w-md h-full'}`}
        >
          <div className="flex items-center gap-2 mb-4 opacity-70 border-b border-white/10 pb-2">
             <span className="text-xs font-semibold uppercase tracking-wider">Previsão 5 dias</span>
          </div>
          <div className="flex flex-col gap-3 h-full justify-start">
            {location.daily_forecast?.slice(0, 5).map((day: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <span className="w-24 font-medium text-lg capitalize">
                  {idx === 0 ? "Hoje" : new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </span>
                <img 
                  src={`https://openweathermap.org/img/wn/${day.weather_icon}@2x.png`}
                  className="w-8 h-8"
                  alt=""
                />
                <div className="flex items-center gap-4 w-32 justify-end">
                  <span className="opacity-60 font-medium w-8 text-right">{Math.round(day.min_temp)}°</span>
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative mx-2">
                     <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-blue-300 to-yellow-300 opacity-80" />
                  </div>
                  <span className="font-bold w-8 text-right">{Math.round(day.max_temp)}°</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-white/5 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10000ms]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-black/20 rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
}
