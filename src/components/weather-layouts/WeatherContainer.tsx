import { WeatherLocation } from "@/hooks/useWeather";
import { WeatherLayoutProps } from "./types";
import { AppleWeatherLayout } from "./AppleWeatherLayout";
import { MinimalWidgetLayout } from "./MinimalWidgetLayout";
import { ModernCardLayout } from "./ModernCardLayout";
import { ForecastGridLayout } from "./ForecastGridLayout";
import { GlassWeatherLayout } from "./GlassWeatherLayout";
import { NeonWeatherLayout } from "./NeonWeatherLayout";

export type WeatherLayoutType = "apple" | "minimal" | "card" | "grid" | "glass" | "neon";

interface WeatherContainerProps extends WeatherLayoutProps {
  layoutOverride?: WeatherLayoutType;
}

export function WeatherContainer({ location, orientation = "horizontal", className, layoutOverride }: WeatherContainerProps) {
  const layout = layoutOverride || location.layout_type || "apple";

  // Enrich location with fallback data from raw_data if columns are missing
  const enrichedLocation = {
    ...location,
    daily_forecast: location.daily_forecast || location.raw_data?.daily_forecast,
    hourly_forecast: location.hourly_forecast || location.raw_data?.hourly_forecast
  };

  const props = { location: enrichedLocation, orientation, className };

  switch (layout) {
    case "minimal":
      return <MinimalWidgetLayout {...props} />;
    case "card":
      return <ModernCardLayout {...props} />;
    case "grid":
      return <ForecastGridLayout {...props} />;
    case "glass":
      return <GlassWeatherLayout {...props} />;
    case "neon":
      return <NeonWeatherLayout {...props} />;
    case "apple":
    default:
      return <AppleWeatherLayout {...props} />;
  }
}
