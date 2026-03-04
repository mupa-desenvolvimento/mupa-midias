import { WeatherLocation } from "@/hooks/useWeather";
import { WeatherLayoutProps } from "./types";
import { AppleWeatherLayout } from "./AppleWeatherLayout";
import { MinimalWidgetLayout } from "./MinimalWidgetLayout";
import { ModernCardLayout } from "./ModernCardLayout";
import { ForecastGridLayout } from "./ForecastGridLayout";

interface WeatherContainerProps extends WeatherLayoutProps {
  layoutOverride?: "apple" | "minimal" | "card" | "grid";
}

export function WeatherContainer({ location, orientation = "horizontal", className, layoutOverride }: WeatherContainerProps) {
  const layout = layoutOverride || location.layout_type || "apple";

  // Enrich location with fallback data from raw_data if columns are missing
  const enrichedLocation = {
    ...location,
    daily_forecast: location.daily_forecast || location.raw_data?.daily_forecast,
    hourly_forecast: location.hourly_forecast || location.raw_data?.hourly_forecast
  };

  // Widget mode always uses Minimal for now, unless overridden
  if (location.type_view === "widget" && !layoutOverride) {
    return <MinimalWidgetLayout location={enrichedLocation} orientation={orientation} className={className} />;
  }

  switch (layout) {
    case "minimal":
      return <MinimalWidgetLayout location={enrichedLocation} orientation={orientation} className={className} />;
    case "card":
      return <ModernCardLayout location={enrichedLocation} orientation={orientation} className={className} />;
    case "grid":
      return <ForecastGridLayout location={enrichedLocation} orientation={orientation} className={className} />;
    case "apple":
    default:
      return <AppleWeatherLayout location={enrichedLocation} orientation={orientation} className={className} />;
  }
}
