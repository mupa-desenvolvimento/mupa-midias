import { WeatherLocation } from "@/hooks/useWeather";

export interface WeatherLayoutProps {
  location: WeatherLocation;
  orientation?: "horizontal" | "vertical";
  className?: string;
}
