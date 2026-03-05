import { WeatherLayoutProps } from "./types";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Wind, Droplets } from "lucide-react";
import { motion } from "framer-motion";

export function NeonWeatherLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  const days = location.daily_forecast?.slice(0, 7) || [];
  const hours = location.hourly_forecast?.slice(0, 6) || [];

  const neonColor = (() => {
    switch (location.theme_color) {
      case 'purple': return { glow: "#a855f7", rgb: "168, 85, 247" };
      case 'green': return { glow: "#22c55e", rgb: "34, 197, 94" };
      case 'orange': return { glow: "#f97316", rgb: "249, 115, 22" };
      case 'dark': return { glow: "#ffffff", rgb: "255, 255, 255" };
      case 'blue':
      default: return { glow: "#06b6d4", rgb: "6, 182, 212" };
    }
  })();

  return (
    <div className={`w-full h-full bg-[#0a0a0a] text-white font-mono overflow-hidden relative ${className}`}>
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(${neonColor.rgb}, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(${neonColor.rgb}, 0.5) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }}
      />
      
      {/* Neon glow line at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ 
          background: `linear-gradient(90deg, transparent, ${neonColor.glow}, transparent)`,
          boxShadow: `0 0 20px ${neonColor.glow}, 0 0 60px ${neonColor.glow}40`
        }}
      />

      <div className={`relative z-10 flex ${isVertical ? 'flex-col' : 'flex-row'} h-full p-8 gap-8`}>
        
        {/* Main display */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex flex-col ${isVertical ? 'items-center' : 'items-start justify-center w-2/5'}`}
        >
          {/* City name with neon effect */}
          <h2 
            className="text-3xl font-bold tracking-[0.3em] uppercase mb-2"
            style={{ 
              color: neonColor.glow,
              textShadow: `0 0 10px ${neonColor.glow}, 0 0 40px ${neonColor.glow}60`
            }}
          >
            {location.city}
          </h2>
          <p className="text-xs tracking-[0.5em] uppercase opacity-30 mb-8">{location.state}</p>

          {/* Temperature */}
          <div className="flex items-end gap-4 mb-4">
            <motion.span 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-[8rem] leading-none font-black tracking-tighter"
              style={{
                color: "white",
                textShadow: `0 0 30px ${neonColor.glow}40`
              }}
            >
              {Math.round(location.current_temp || 0)}°
            </motion.span>
            <WeatherIcon 
              iconCode={location.weather_icon}
              className="w-20 h-20 mb-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            />
          </div>

          <p 
            className="text-lg uppercase tracking-[0.2em] font-light capitalize mb-8"
            style={{ color: `rgba(${neonColor.rgb}, 0.7)` }}
          >
            {location.weather_description}
          </p>

          {/* Stats row */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4" style={{ color: neonColor.glow }} />
              <span className="text-sm opacity-70">{location.wind_speed} km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4" style={{ color: neonColor.glow }} />
              <span className="text-sm opacity-70">{location.humidity}%</span>
            </div>
          </div>
        </motion.div>

        {/* Right panel */}
        <div className={`flex-1 flex flex-col gap-6 ${isVertical ? '' : 'justify-center'}`}>
          
          {/* Hourly ticker */}
          {hours.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="border rounded-lg p-4"
              style={{ borderColor: `rgba(${neonColor.rgb}, 0.15)` }}
            >
              <div 
                className="text-[10px] uppercase tracking-[0.4em] mb-4 font-bold"
                style={{ color: `rgba(${neonColor.rgb}, 0.5)` }}
              >
                ▸ Horas
              </div>
              <div className="flex gap-6 overflow-x-auto no-scrollbar">
                {hours.map((hour: any, idx: number) => (
                  <div key={idx} className="flex flex-col items-center min-w-[3rem] gap-2">
                    <span className="text-[10px] opacity-40 font-mono">
                      {idx === 0 ? "NOW" : new Date(hour.time).getHours() + ":00"}
                    </span>
                    <WeatherIcon iconCode={hour.weather_icon} className="w-7 h-7 opacity-70" />
                    <span 
                      className="text-lg font-bold"
                      style={idx === 0 ? { color: neonColor.glow, textShadow: `0 0 10px ${neonColor.glow}60` } : {}}
                    >
                      {Math.round(hour.temp)}°
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Daily forecast - cyberpunk bars */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="border rounded-lg p-4 flex-1"
            style={{ borderColor: `rgba(${neonColor.rgb}, 0.15)` }}
          >
            <div 
              className="text-[10px] uppercase tracking-[0.4em] mb-4 font-bold"
              style={{ color: `rgba(${neonColor.rgb}, 0.5)` }}
            >
              ▸ Previsão
            </div>
            <div className="flex flex-col gap-3">
              {days.slice(0, 5).map((day: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="w-16 text-xs font-mono opacity-40 uppercase">
                    {idx === 0 ? "HOJE" : new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                  </span>
                  <WeatherIcon iconCode={day.weather_icon} className="w-6 h-6 opacity-60" />
                  <span className="w-8 text-right text-xs opacity-30">{Math.round(day.min_temp)}°</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, ((day.max_temp - day.min_temp + 5) / 20) * 100)}%` }}
                      transition={{ delay: 0.4 + idx * 0.1, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ 
                        background: `linear-gradient(90deg, ${neonColor.glow}40, ${neonColor.glow})`,
                        boxShadow: `0 0 8px ${neonColor.glow}60`
                      }}
                    />
                  </div>
                  <span 
                    className="w-8 text-sm font-bold"
                    style={{ color: neonColor.glow }}
                  >
                    {Math.round(day.max_temp)}°
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom neon line */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ 
          background: `linear-gradient(90deg, transparent, ${neonColor.glow}60, transparent)`,
          boxShadow: `0 0 10px ${neonColor.glow}40`
        }}
      />
    </div>
  );
}
