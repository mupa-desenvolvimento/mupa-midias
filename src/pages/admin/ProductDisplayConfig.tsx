import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Layout, Palette, Type, Image, Monitor, Loader2, CheckCircle2, Eye } from "lucide-react";
import { useProductDisplaySettings, layoutPresets, defaultSettings, ProductDisplaySettings } from "@/hooks/useProductDisplaySettings";
import { useCompanies } from "@/hooks/useCompanies";
import { cn } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";

const ProductDisplayConfig = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { companies } = useCompanies();
  const { settings, isLoading, saveSettings, isSaving } = useProductDisplaySettings(companyId);

  const [localSettings, setLocalSettings] = useState<Partial<ProductDisplaySettings>>({});

  const company = companies?.find((c) => c.id === companyId);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateSetting = <K extends keyof ProductDisplaySettings>(key: K, value: ProductDisplaySettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetId: number) => {
    const preset = layoutPresets.find((p) => p.id === presetId);
    if (preset) {
      setLocalSettings((prev) => ({
        ...prev,
        layout_preset: presetId,
        ...preset.settings,
      }));
    }
  };

  const handleSave = () => {
    if (companyId) {
      saveSettings({ ...localSettings, company_id: companyId } as ProductDisplaySettings & { company_id: string });
    }
  };

  const getContrastColor = (hexColor: string): string => {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/admin/tenants")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Configuração da Tela de Consulta</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {company?.name || "Empresa"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Preset: {layoutPresets.find((p) => p.id === localSettings.layout_preset)?.name || "Personalizado"}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Settings Panel */}
          <div className="xl:col-span-2 space-y-4 order-2 xl:order-1">
            <Tabs defaultValue="presets" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="presets" className="flex items-center gap-1.5 text-xs">
                  <Layout className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Presets</span>
                </TabsTrigger>
                <TabsTrigger value="fonts" className="flex items-center gap-1.5 text-xs">
                  <Type className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fontes</span>
                </TabsTrigger>
                <TabsTrigger value="colors" className="flex items-center gap-1.5 text-xs">
                  <Palette className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cores</span>
                </TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-1.5 text-xs">
                  <Image className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Imagem</span>
                </TabsTrigger>
              </TabsList>

              {/* Presets Tab */}
              <TabsContent value="presets" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Layouts Predefinidos</CardTitle>
                    <CardDescription className="text-xs">Escolha um layout base e personalize</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3">
                      {layoutPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset.id)}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all hover:border-primary/60 hover:bg-primary/5 group",
                            localSettings.layout_preset === preset.id
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{preset.name}</div>
                            {localSettings.layout_preset === preset.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Position Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Posições</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Posição da Imagem</Label>
                        <Select
                          value={localSettings.image_position || "right"}
                          onValueChange={(v) => updateSetting("image_position", v as "left" | "right")}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Esquerda</SelectItem>
                            <SelectItem value="right">Direita</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Posição do Preço</Label>
                        <Select
                          value={localSettings.price_position || "bottom"}
                          onValueChange={(v) => updateSetting("price_position", v as "top" | "center" | "bottom")}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">Topo</SelectItem>
                            <SelectItem value="center">Centro</SelectItem>
                            <SelectItem value="bottom">Inferior</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Fonts Tab */}
              <TabsContent value="fonts" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tamanhos de Fonte</CardTitle>
                    <CardDescription className="text-xs">Ajuste os tamanhos em pixels</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {[
                      { label: "Título Principal", key: "title_font_size" as const, def: 48, min: 24, max: 80, step: 2 },
                      { label: "Subtítulo", key: "subtitle_font_size" as const, def: 24, min: 12, max: 48, step: 2 },
                      { label: "Preço Principal", key: "price_font_size" as const, def: 96, min: 48, max: 160, step: 4 },
                      { label: "Preço Original (De:)", key: "original_price_font_size" as const, def: 36, min: 18, max: 64, step: 2 },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs">{item.label}</Label>
                          <Badge variant="outline" className="text-xs font-mono tabular-nums">
                            {(localSettings[item.key] as number) || item.def}px
                          </Badge>
                        </div>
                        <Slider
                          value={[(localSettings[item.key] as number) || item.def]}
                          onValueChange={([v]) => updateSetting(item.key, v)}
                          min={item.min}
                          max={item.max}
                          step={item.step}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Colors Tab */}
              <TabsContent value="colors" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Extração de Cores</CardTitle>
                    <CardDescription className="text-xs">
                      Cores extraídas automaticamente da imagem do produto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Extração Automática</Label>
                        <p className="text-xs text-muted-foreground">
                          Usa cores dominantes da imagem
                        </p>
                      </div>
                      <Switch
                        checked={localSettings.enable_color_extraction ?? true}
                        onCheckedChange={(v) => updateSetting("enable_color_extraction", v)}
                      />
                    </div>

                    {!localSettings.enable_color_extraction && (
                      <div className="space-y-4 pt-3 border-t">
                        {[
                          { label: "Cor Primária do Container", key: "container_primary_color" as const, def: "#1E3A5F" },
                          { label: "Cor Secundária", key: "container_secondary_color" as const, def: "#2D4A6F" },
                          { label: "Cor de Destaque", key: "accent_color" as const, def: "#3B82F6" },
                        ].map((item) => (
                          <div key={item.key} className="space-y-2">
                            <Label className="text-xs">{item.label}</Label>
                            <div className="flex gap-2">
                              <div className="relative">
                                <Input
                                  type="color"
                                  value={(localSettings[item.key] as string) || item.def}
                                  onChange={(e) => updateSetting(item.key, e.target.value)}
                                  className="w-10 h-9 p-0.5 cursor-pointer border-2 rounded-md"
                                />
                              </div>
                              <Input
                                value={(localSettings[item.key] as string) || item.def}
                                onChange={(e) => updateSetting(item.key, e.target.value)}
                                className="flex-1 font-mono text-xs h-9"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Image Tab */}
              <TabsContent value="image" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configurações da Imagem</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Remover Fundo</Label>
                        <p className="text-xs text-muted-foreground">
                          Exibe sem o fundo original
                        </p>
                      </div>
                      <Switch
                        checked={localSettings.remove_image_background ?? false}
                        onCheckedChange={(v) => updateSetting("remove_image_background", v)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cor de Fundo da Área da Imagem</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={localSettings.image_background_color || "#FFFFFF"}
                          onChange={(e) => updateSetting("image_background_color", e.target.value)}
                          className="w-10 h-9 p-0.5 cursor-pointer border-2 rounded-md"
                        />
                        <Input
                          value={localSettings.image_background_color || "#FFFFFF"}
                          onChange={(e) => updateSetting("image_background_color", e.target.value)}
                          className="flex-1 font-mono text-xs h-9"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="xl:col-span-3 order-1 xl:order-2">
            <Card className="sticky top-6 overflow-hidden">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Preview em Tempo Real</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {layoutPresets.find((p) => p.id === localSettings.layout_preset)?.name || "Personalizado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {/* Preview */}
                <div
                  className="w-full rounded-lg overflow-hidden border border-border shadow-sm flex"
                  style={{
                    aspectRatio: "16/9",
                    flexDirection: localSettings.image_position === "left" ? "row-reverse" : "row",
                  }}
                >
                  {/* Info side */}
                  <div
                    className="w-1/2 p-6 flex flex-col relative overflow-hidden"
                    style={{
                      backgroundColor: localSettings.enable_color_extraction
                        ? "#1E3A5F"
                        : localSettings.container_primary_color || "#1E3A5F",
                      justifyContent:
                        localSettings.price_position === "top"
                          ? "flex-start"
                          : localSettings.price_position === "center"
                          ? "center"
                          : "flex-end",
                    }}
                  >
                    {/* Product name banner */}
                    <div
                      className="absolute top-0 left-0 right-0 px-4 py-3"
                      style={{
                        backgroundColor: localSettings.enable_color_extraction
                          ? "rgba(59, 130, 246, 0.95)"
                          : `${localSettings.accent_color || "#3B82F6"}F2`,
                      }}
                    >
                      <div
                        className="font-black uppercase tracking-wide"
                        style={{
                          fontSize: `${Math.max(12, (localSettings.title_font_size || 48) / 4)}px`,
                          color: localSettings.enable_color_extraction
                            ? "#FFFFFF"
                            : getContrastColor(localSettings.accent_color || "#3B82F6"),
                        }}
                      >
                        NOME DO PRODUTO
                      </div>
                      <div
                        className="font-light"
                        style={{
                          fontSize: `${Math.max(8, (localSettings.subtitle_font_size || 24) / 3)}px`,
                          color: localSettings.enable_color_extraction
                            ? "rgba(255,255,255,0.8)"
                            : getContrastColor(localSettings.accent_color || "#3B82F6"),
                        }}
                      >
                        Descrição adicional do produto
                      </div>
                    </div>

                    {/* Price section */}
                    <div className="mt-auto">
                      <div
                        className="line-through opacity-60"
                        style={{
                          fontSize: `${Math.max(10, (localSettings.original_price_font_size || 36) / 3)}px`,
                          color: localSettings.enable_color_extraction
                            ? "#FFFFFF"
                            : getContrastColor(localSettings.container_primary_color || "#1E3A5F"),
                        }}
                      >
                        De: R$ 12,99
                      </div>
                      <div
                        className="font-bold leading-none"
                        style={{
                          fontSize: `${Math.max(24, (localSettings.price_font_size || 96) / 3)}px`,
                          color: localSettings.enable_color_extraction
                            ? "#FFFFFF"
                            : getContrastColor(localSettings.container_primary_color || "#1E3A5F"),
                        }}
                      >
                        R$ 9,99
                      </div>
                    </div>
                  </div>

                  {/* Image side */}
                  <div
                    className="w-1/2 flex items-center justify-center p-4"
                    style={{
                      backgroundColor: localSettings.image_background_color || "#FFFFFF",
                    }}
                  >
                    <div className="w-32 h-32 rounded-lg bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center shadow-lg">
                      <Image className="w-16 h-16 text-muted-foreground/40" />
                    </div>
                  </div>
                </div>

                {/* Settings summary */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="font-medium text-muted-foreground mb-1.5 text-xs flex items-center gap-1.5">
                      <Type className="h-3 w-3" /> Fontes
                    </div>
                    <div className="space-y-0.5 text-xs text-foreground/80">
                      <div>Título: <span className="font-mono">{localSettings.title_font_size || 48}px</span></div>
                      <div>Subtítulo: <span className="font-mono">{localSettings.subtitle_font_size || 24}px</span></div>
                      <div>Preço: <span className="font-mono">{localSettings.price_font_size || 96}px</span></div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="font-medium text-muted-foreground mb-1.5 text-xs flex items-center gap-1.5">
                      <Palette className="h-3 w-3" /> Layout
                    </div>
                    <div className="space-y-0.5 text-xs text-foreground/80">
                      <div>{localSettings.enable_color_extraction ? "✓ Cor automática" : "✗ Cor manual"}</div>
                      <div>Imagem: {localSettings.image_position === "left" ? "Esquerda" : "Direita"}</div>
                      <div>Preço: {localSettings.price_position === "top" ? "Topo" : localSettings.price_position === "center" ? "Centro" : "Inferior"}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProductDisplayConfig;
