import { WeatherLayoutProps } from "./types";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Droplets, Wind, MapPin, Clock } from "lucide-react";

const formatWeekday = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

export function WindowsWeatherLayout({ location, orientation, className }: WeatherLayoutProps) {
  const isVertical = orientation === "vertical";
  const days = location.daily_forecast?.slice(0, 5) || [];
  const hours = location.hourly_forecast?.slice(0, isVertical ? 4 : 6) || [];
  const now = new Date();

  return (
    <div
      className={[
        "w-full h-full min-h-0 text-white font-sans",
        "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700",
        isVertical ? "p-5 sm:p-6" : "p-6 sm:p-8",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div
        className={[
          "w-full h-full min-h-0",
          isVertical ? "flex flex-col gap-5" : "grid grid-cols-12 gap-6",
        ].join(" ")}
      >
        <div className={isVertical ? "w-full flex-none" : "col-span-5"}>
          <div
            className={[
              "rounded-3xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl flex flex-col",
              isVertical ? "" : "h-full min-h-0",
              isVertical ? "p-5" : "p-6",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white/90">
                  <MapPin className="w-4 h-4" />
                  <span className="text-lg font-semibold truncate">{location.city}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/75 mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })} •{" "}
                    {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <WeatherIcon
                  iconCode={location.weather_icon}
                  description={location.weather_description}
                  className={isVertical ? "w-14 h-14" : "w-16 h-16"}
                />
              </div>
            </div>

            <div
              className={[
                isVertical ? "mt-4 flex flex-col gap-4" : "mt-6 flex items-end justify-between gap-6",
              ].join(" ")}
            >
              <div className={isVertical ? "flex items-end justify-between gap-4" : undefined}>
                <div
                  className={[
                    "font-semibold tracking-tighter leading-none",
                    isVertical ? "text-6xl sm:text-7xl" : "text-7xl sm:text-8xl",
                  ].join(" ")}
                >
                  {Math.round(location.current_temp || 0)}°
                </div>
                <div className={isVertical ? "text-right" : undefined}>
                  <div className="mt-2 text-base sm:text-lg capitalize text-white/90">
                    {location.weather_description || "Sem dados"}
                  </div>
                  {days?.[0] && (
                    <div className="mt-2 flex items-center justify-end gap-3 text-sm text-white/80">
                      <span>Máx {Math.round(days[0].max_temp)}°</span>
                      <span className="opacity-40">•</span>
                      <span>Mín {Math.round(days[0].min_temp)}°</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={isVertical ? "grid grid-cols-2 gap-3 w-full" : "flex flex-col gap-3 w-44"}>
                <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Wind className="w-4 h-4" />
                    <span>Vento</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold">{location.wind_speed ?? "--"} km/h</div>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Droplets className="w-4 h-4" />
                    <span>Umidade</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold">{location.humidity ?? "--"}%</div>
                </div>
              </div>
            </div>

            {hours.length > 0 && (
              <div className={isVertical ? "mt-4 rounded-3xl bg-white/10 border border-white/15 p-4" : "mt-6 rounded-3xl bg-white/10 border border-white/15 p-4"}>
                <div className="text-xs uppercase tracking-wider text-white/80 mb-3">Próximas horas</div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                  {hours.map((h: any, idx: number) => (
                    <div
                      key={idx}
                      className={[
                        isVertical ? "min-w-[4.5rem]" : "min-w-[5rem]",
                        "rounded-2xl bg-white/10 border border-white/10 px-3 py-3 flex flex-col items-center gap-2",
                      ].join(" ")}
                    >
                      <div className="text-[11px] text-white/80">
                        {idx === 0 ? "Agora" : new Date(h.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <WeatherIcon iconCode={h.weather_icon} description={h.weather_description} className="w-8 h-8" />
                      <div className="text-base font-semibold">{Math.round(h.temp)}°</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={isVertical ? "w-full flex-1 min-h-0" : "col-span-7"}>
          <div
            className={[
              "h-full min-h-0 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl",
              isVertical ? "p-5 flex flex-col" : "p-6",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/90">Previsão</div>
              <div className="text-xs text-white/70">{location.state}</div>
            </div>

            <div
              className={[
                "mt-5",
                isVertical ? "flex-1 min-h-0 flex flex-col gap-3" : "grid grid-cols-2 gap-3",
              ].join(" ")}
            >
              {days.slice(0, 4).map((day: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/10 border border-white/10 px-4 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <WeatherIcon iconCode={day.weather_icon} description={day.weather_description} className="w-10 h-10" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {idx === 0 ? "Hoje" : formatWeekday(day.date)}
                      </div>
                      <div className="text-xs text-white/70 capitalize truncate">{day.weather_description}</div>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-semibold">{Math.round(day.max_temp)}°</div>
                    <div className="text-sm text-white/70">{Math.round(day.min_temp)}°</div>
                  </div>
                </div>
              ))}
            </div>

            {!isVertical && days.length > 4 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {days.slice(4, 7).map((day: any, idx: number) => (
                  <div key={idx} className="rounded-2xl bg-white/10 border border-white/10 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-white/80">{formatWeekday(day.date)}</div>
                      <WeatherIcon iconCode={day.weather_icon} description={day.weather_description} className="w-8 h-8" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <div className="text-lg font-semibold">{Math.round(day.max_temp)}°</div>
                      <div className="text-sm text-white/70">{Math.round(day.min_temp)}°</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
