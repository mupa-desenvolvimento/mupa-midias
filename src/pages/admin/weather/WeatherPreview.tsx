import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Monitor, Smartphone } from "lucide-react";
import { WeatherLocation } from "@/hooks/useWeather";
import { WeatherContainer, WeatherLayoutType } from "@/components/weather-layouts/WeatherContainer";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeather } from "@/hooks/useWeather";

interface WeatherPreviewProps {
  location: WeatherLocation;
}

export function WeatherPreview({ location }: WeatherPreviewProps) {
  const { updateSettings } = useWeather();
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [layout, setLayout] = useState<WeatherLayoutType>((location.layout_type || "apple") as WeatherLayoutType);
  const isWidget = location.type_view === "widget";
  const displayTime = location.display_time || 10;

  useEffect(() => {
    setLayout((location.layout_type || "apple") as WeatherLayoutType);
  }, [location.layout_type]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Visualizar como ficará na tela">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-0 gap-0 bg-slate-950 border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <DialogTitle className="text-slate-200 flex items-center gap-2">
            Preview: {location.city}
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              {isWidget ? "Widget" : `Slide (${displayTime}s)`}
            </span>
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full capitalize">
              Layout: {layout}
            </span>
          </DialogTitle>

          <div className="flex items-center gap-3">
            <Select
              value={layout}
              onValueChange={(value) => {
                const next = value as WeatherLayoutType;
                setLayout(next);
                updateSettings.mutate({ id: location.id, layout_type: next });
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apple">Apple Style</SelectItem>
                <SelectItem value="minimal">Minimal Widget</SelectItem>
                <SelectItem value="card">Modern Card</SelectItem>
                <SelectItem value="grid">Forecast Grid</SelectItem>
                <SelectItem value="glass">Glassmorphism</SelectItem>
                <SelectItem value="neon">Neon / Cyber</SelectItem>
                <SelectItem value="windows">Windows Clean</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={orientation} onValueChange={(v) => setOrientation(v as "horizontal" | "vertical")}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="horizontal" className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Horizontal (16:9)
                </TabsTrigger>
                <TabsTrigger value="vertical" className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> Vertical (9:16)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Screen Simulator Container */}
        <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex items-center justify-center p-8">
          
          {/* Device Frame */}
          <div 
            className={`relative bg-black shadow-2xl transition-all duration-500 flex overflow-hidden border-4 border-slate-800 rounded-lg ${
              orientation === "horizontal" 
                ? "w-full max-w-[1280px] aspect-video" 
                : "h-full max-h-[800px] aspect-[9/16]"
            }`}
          >
            {/* Content Background Simulation */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 pointer-events-none z-0">
              <span className="text-muted-foreground/25 text-4xl font-bold uppercase tracking-widest rotate-[-15deg]">
                Conteúdo da TV
              </span>
            </div>

            {/* Weather Component */}
            <div className="relative z-10 w-full h-full">
              <WeatherContainer 
                location={location} 
                orientation={orientation} 
                layoutOverride={layout}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
