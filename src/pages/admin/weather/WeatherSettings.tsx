
import { useWeather, WeatherLocation } from "@/hooks/useWeather";
import { CitySearch } from "./CitySearch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RefreshCw, CloudSun, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { WeatherPreview } from "./WeatherPreview";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WeatherContainer } from "@/components/weather-layouts/WeatherContainer";

export function WeatherSettings() {
  const { locations, isLoading, addLocation, removeLocation, toggleActive, setDefault, forceUpdate, updateSettings } = useWeather();
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const handleAddLocation = (city: any) => {
    addLocation.mutate({
      city: city.name,
      state: city.state || "",
      latitude: city.lat,
      longitude: city.lon,
      openweather_city_id: city.id, // Geo API might not return ID, but that's fine
      is_active: true,
      is_default: locations?.length === 0 // First one is default
    });
  };

  if (isLoading) {
    return <div>Carregando configurações de clima...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="h-5 w-5" />
                Configuração de Clima Tempo
              </CardTitle>
              <CardDescription className="mt-1">
                Gerencie as cidades exibidas no módulo de clima.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "list" | "card")}>
                <ToggleGroupItem value="list" aria-label="Lista">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="card" aria-label="Cards">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Adicionar Nova Cidade</label>
            <CitySearch onSelect={handleAddLocation} />
          </div>

          {locations?.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground border rounded-md mt-4">
               Nenhuma cidade cadastrada. Adicione uma cidade acima.
             </div>
          ) : viewMode === "list" ? (
            <div className="rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Padrão</TableHead>
                    <TableHead>Cidade / Estado</TableHead>
                    <TableHead>Clima Atual</TableHead>
                    <TableHead>Modo de Exibição</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations?.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell>
                        <RadioGroup 
                          value={loc.is_default ? "default" : ""} 
                          onValueChange={() => setDefault.mutate(loc.id)}
                        >
                          <RadioGroupItem value="default" id={`default-${loc.id}`} />
                        </RadioGroup>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{loc.city}</div>
                        <div className="text-xs text-muted-foreground">{loc.state}</div>
                      </TableCell>
                      <TableCell>
                        {loc.current_temp ? (
                          <div className="flex items-center gap-2">
                            {loc.weather_icon && (
                              <img 
                                src={`https://openweathermap.org/img/wn/${loc.weather_icon}@2x.png`} 
                                alt={loc.weather_description}
                                className="w-8 h-8"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold">{Math.round(loc.current_temp)}°C</span>
                              <span className="text-xs text-muted-foreground capitalize">{loc.weather_description}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem dados</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Select
                            value={loc.type_view || "widget"}
                            onValueChange={(value: "widget" | "slide") => 
                              updateSettings.mutate({ 
                                id: loc.id, 
                                type_view: value,
                                layout_type: loc.layout_type
                              })
                            }
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue placeholder="Modo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="widget">Widget (Fixo)</SelectItem>
                              <SelectItem value="slide">Slide (Tela Cheia)</SelectItem>
                            </SelectContent>
                          </Select>

                          {loc.type_view === "slide" && (
                            <div className="flex flex-col gap-2">
                              <Select
                                value={loc.layout_type || "apple"}
                                onValueChange={(value: any) => 
                                  updateSettings.mutate({ 
                                    id: loc.id, 
                                    layout_type: value 
                                  })
                                }
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue placeholder="Layout" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="apple">Apple Style</SelectItem>
                                  <SelectItem value="minimal">Minimal Widget</SelectItem>
                                  <SelectItem value="card">Modern Card</SelectItem>
                                  <SelectItem value="grid">Forecast Grid</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={loc.theme_color || "blue"}
                                onValueChange={(value) => 
                                  updateSettings.mutate({ 
                                    id: loc.id, 
                                    theme_color: value 
                                  })
                                }
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-gray-200"
                                      style={{ 
                                        backgroundColor: 
                                          loc.theme_color === "purple" ? "#7c3aed" :
                                          loc.theme_color === "green" ? "#10b981" :
                                          loc.theme_color === "orange" ? "#f59e0b" :
                                          loc.theme_color === "dark" ? "#1e293b" :
                                          "#3b82f6"
                                      }}
                                    />
                                    <SelectValue placeholder="Cor" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="blue">Azul (Padrão)</SelectItem>
                                  <SelectItem value="purple">Roxo</SelectItem>
                                  <SelectItem value="green">Verde</SelectItem>
                                  <SelectItem value="orange">Laranja</SelectItem>
                                  <SelectItem value="dark">Escuro</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={String(loc.display_time || 10)}
                                onValueChange={(value) => 
                                  updateSettings.mutate({ 
                                    id: loc.id, 
                                    display_time: Number(value) 
                                  })
                                }
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue placeholder="Tempo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5 segundos</SelectItem>
                                  <SelectItem value="10">10 segundos</SelectItem>
                                  <SelectItem value="15">15 segundos</SelectItem>
                                  <SelectItem value="30">30 segundos</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={loc.is_active} 
                          onCheckedChange={(checked) => toggleActive.mutate({ id: loc.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <WeatherPreview location={loc} />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => forceUpdate.mutate(loc.id)}
                            title="Atualizar dados agora"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeLocation.mutate(loc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  }
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {locations?.map((loc) => (
                <Card key={loc.id} className="overflow-hidden relative group">
                  <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <WeatherPreview location={loc} />
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => forceUpdate.mutate(loc.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => removeLocation.mutate(loc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Preview of the actual component */}
                  <div className="aspect-video w-full bg-slate-950 relative overflow-hidden">
                    <WeatherContainer 
                      location={loc} 
                      orientation="horizontal" 
                      className="w-full h-full scale-[0.6] origin-top-left w-[166%] h-[166%]" 
                    />
                  </div>

                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{loc.city}</h3>
                        <p className="text-sm text-muted-foreground">{loc.state}</p>
                      </div>
                      <RadioGroup 
                        value={loc.is_default ? "default" : ""} 
                        onValueChange={() => setDefault.mutate(loc.id)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="default" id={`card-default-${loc.id}`} />
                          <label htmlFor={`card-default-${loc.id}`} className="text-xs cursor-pointer">Padrão</label>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                       <div className="flex items-center gap-2">
                         <Switch 
                            checked={loc.is_active} 
                            onCheckedChange={(checked) => toggleActive.mutate({ id: loc.id, is_active: checked })}
                          />
                          <span className="text-sm">{loc.is_active ? "Ativo" : "Inativo"}</span>
                       </div>
                       
                       <Select
                          value={loc.type_view || "widget"}
                          onValueChange={(value: "widget" | "slide") => 
                            updateSettings.mutate({ 
                              id: loc.id, 
                              type_view: value,
                              layout_type: loc.layout_type
                            })
                          }
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue placeholder="Modo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="widget">Widget</SelectItem>
                            <SelectItem value="slide">Slide</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
