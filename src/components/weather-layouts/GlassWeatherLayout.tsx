import { WeatherLayoutProps } from "./types";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Wind, Droplets, Eye, Thermometer } from "lucide-react";
import { motion } from "framer-motion";

export function GlassWeatherLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  const days = location.daily_forecast?.slice(0, 5) || [];
  const hours = location.hourly_forecast?.slice(0, 8) || [];

  return (
    <div 
      className={`w-full h-full relative overflow-hidden flex flex-col text-white font-sans ${className}`}
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)"
      }}
    >
      {/* Floating blurred orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-violet-500/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[100px]" />
      <div className="absolute top-[40%] right-[20%] w-[200px] h-[200px] bg-cyan-400/15 rounded-full blur-[80px]" />

      {/* Main content */}
      <div className={`relative z-10 flex-1 flex ${isVertical ? 'flex-col' : 'flex-row'} p-8 gap-6`}>
        
        {/* Left: Main weather */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex flex-col justify-center ${isVertical ? 'items-center text-center' : 'items-start w-2/5'}`}
        >
          <h2 className="text-2xl font-light tracking-widest uppercase opacity-70 mb-1">{location.city}</h2>
          <p className="text-sm opacity-50 mb-4">{location.state}</p>
          
          <div className="flex items-center gap-4 mb-6">
            <WeatherIcon 
              iconCode={location.weather_icon} 
              description={location.weather_description}
              className="w-28 h-28 drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
            />
            <div>
              <span className="text-8xl font-extralight tracking-tighter">
                {Math.round(location.current_temp || 0)}°
              </span>
            </div>
          </div>

          <p className="text-xl capitalize opacity-80 font-light mb-6">{location.weather_description}</p>

          {/* Stats glass cards */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            {[
              { icon: Wind, label: "Vento", value: `${location.wind_speed} km/h` },
              { icon: Droplets, label: "Umidade", value: `${location.humidity}%` },
              { icon: Thermometer, label: "Máx", value: `${Math.round(days[0]?.max_temp || 0)}°` },
              { icon: Eye, label: "Mín", value: `${Math.round(days[0]?.min_temp || 0)}°` },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-xl p-3 flex items-center gap-3"
              >
                <stat.icon className="w-4 h-4 opacity-60" />
                <div>
                  <p className="text-xs opacity-50">{stat.label}</p>
                  <p className="text-sm font-semibold">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Forecasts */}
        <div className={`flex-1 flex flex-col gap-4 ${isVertical ? '' : 'justify-center'}`}>
          
          {/* Hourly */}
          {hours.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-5"
            >
              <p className="text-xs uppercase tracking-widest opacity-40 mb-4">Próximas horas</p>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                {hours.map((hour: any, idx: number) => (
                  <div key={idx} className="flex flex-col items-center min-w-[4rem] gap-2">
                    <span className="text-xs opacity-60">
                      {idx === 0 ? "Agora" : new Date(hour.time).getHours() + "h"}
                    </span>
                    <WeatherIcon iconCode={hour.weather_icon} className="w-8 h-8 opacity-80" />
                    <span className="text-sm font-semibold">{Math.round(hour.temp)}°</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Daily */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-5 flex-1"
          >
            <p className="text-xs uppercase tracking-widest opacity-40 mb-4">Previsão semanal</p>
            <div className="flex flex-col gap-3">
              {days.map((day: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="w-20 text-sm font-medium opacity-80">
                    {idx === 0 ? "Hoje" : new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                  <WeatherIcon iconCode={day.weather_icon} className="w-7 h-7 opacity-70" />
                  <div className="flex items-center gap-2 w-28">
                    <span className="text-xs opacity-40 w-8 text-right">{Math.round(day.min_temp)}°</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-blue-400/80 to-violet-400/80"
                        style={{ width: `${Math.min(100, ((day.max_temp - day.min_temp) / 15) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-8">{Math.round(day.max_temp)}°</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
