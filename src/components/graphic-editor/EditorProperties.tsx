import { SelectedObjectProps } from "./useFabricCanvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Palette, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Strikethrough, Monitor } from "lucide-react";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f59e0b", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9",
  "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#a855f7",
  "#e11d48", "#0d9488", "#7c3aed", "transparent",
];

const FONTS = [
  "Inter", "Arial", "Georgia", "Courier New", "Verdana",
  "Times New Roman", "Helvetica", "Roboto", "Montserrat",
  "Poppins", "Lato", "Playfair Display", "Oswald",
];

const CANVAS_PRESETS = [
  { label: "Full HD (1920×1080)", w: 1920, h: 1080 },
  { label: "HD (1280×720)", w: 1280, h: 720 },
  { label: "Instagram Post (1080×1080)", w: 1080, h: 1080 },
  { label: "Instagram Story (1080×1920)", w: 1080, h: 1920 },
  { label: "Facebook Cover (820×312)", w: 820, h: 312 },
  { label: "YouTube Thumb (1280×720)", w: 1280, h: 720 },
  { label: "TV Portrait (1080×1920)", w: 1080, h: 1920 },
  { label: "TV Landscape (1920×1080)", w: 1920, h: 1080 },
  { label: "Banner (728×90)", w: 728, h: 90 },
  { label: "A4 (2480×3508)", w: 2480, h: 3508 },
  { label: "Personalizado", w: 0, h: 0 },
];

interface Props {
  selected: SelectedObjectProps | null;
  onUpdate: (prop: string, value: any) => void;
  canvasBgColor: string;
  onCanvasBgChange: (color: string) => void;
  canvasWidth: number;
  canvasHeight: number;
  onCanvasResize: (w: number, h: number) => void;
}

export function EditorProperties({ selected, onUpdate, canvasBgColor, onCanvasBgChange, canvasWidth, canvasHeight, onCanvasResize }: Props) {
  if (!selected) {
    return (
      <div className="w-[260px] border-l border-border bg-card flex flex-col shrink-0 h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div className="flex flex-col items-center justify-center py-6">
              <Palette className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Selecione um objeto</p>
              <p className="text-xs text-muted-foreground/60">para editar propriedades</p>
            </div>

            <Separator />

            {/* Canvas Size */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tamanho do Canvas</Label>
              </div>

              <Select
                value={CANVAS_PRESETS.find(p => p.w === canvasWidth && p.h === canvasHeight)?.label || "Personalizado"}
                onValueChange={(label) => {
                  const preset = CANVAS_PRESETS.find(p => p.label === label);
                  if (preset && preset.w > 0) onCanvasResize(preset.w, preset.h);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANVAS_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Largura</Label>
                  <Input
                    type="number"
                    value={canvasWidth}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0 && v <= 4096) onCanvasResize(v, canvasHeight);
                    }}
                    className="h-7 text-xs"
                    min={100}
                    max={4096}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Altura</Label>
                  <Input
                    type="number"
                    value={canvasHeight}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0 && v <= 4096) onCanvasResize(canvasWidth, v);
                    }}
                    className="h-7 text-xs"
                    min={100}
                    max={4096}
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/60">{canvasWidth} × {canvasHeight} px</p>
            </div>

            <Separator />

            {/* Canvas background */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fundo do Canvas</Label>
              <div className="flex flex-wrap gap-1.5">
                {["#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#1e293b", "#0f172a", "#000000"].map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-md border transition-all ${
                      canvasBgColor === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => onCanvasBgChange(c)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={canvasBgColor}
                onChange={(e) => onCanvasBgChange(e.target.value)}
                className="h-8 w-full cursor-pointer"
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const isText = selected.type === "i-text" || selected.type === "text";

  return (
    <div className="w-[260px] border-l border-border bg-card flex flex-col shrink-0 h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</p>

          {/* Fill */}
          <div className="space-y-2">
            <Label className="text-xs">Preenchimento</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded border transition-all ${
                    selected.fill === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                  } ${c === "transparent" ? "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" : ""}`}
                  style={c !== "transparent" ? { backgroundColor: c } : undefined}
                  onClick={() => onUpdate("fill", c)}
                  title={c === "transparent" ? "Transparente" : c}
                />
              ))}
            </div>
            <Input
              type="color"
              value={selected.fill === "transparent" ? "#000000" : selected.fill}
              onChange={(e) => onUpdate("fill", e.target.value)}
              className="h-8 w-full cursor-pointer"
            />
          </div>

          {/* Stroke */}
          <div className="space-y-2">
            <Label className="text-xs">Borda</Label>
            <Input
              type="color"
              value={selected.stroke === "transparent" ? "#000000" : selected.stroke}
              onChange={(e) => onUpdate("stroke", e.target.value)}
              className="h-8 w-full cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Espessura</Label>
              <Slider
                value={[selected.strokeWidth]}
                onValueChange={([v]) => onUpdate("strokeWidth", v)}
                min={0} max={20} step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-6 text-right">{selected.strokeWidth}</span>
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <Label className="text-xs">Opacidade</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[selected.opacity * 100]}
                onValueChange={([v]) => onUpdate("opacity", v / 100)}
                min={0} max={100} step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(selected.opacity * 100)}%</span>
            </div>
          </div>

          {/* Shadow */}
          <div className="space-y-2">
            <Label className="text-xs">Sombra</Label>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Blur</Label>
              <Slider
                value={[selected.shadowBlur || 0]}
                onValueChange={([v]) => onUpdate("shadow", v > 0 ? `rgba(0,0,0,0.3) 4px 4px ${v}px` : null)}
                min={0} max={30} step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-6 text-right">{selected.shadowBlur || 0}</span>
            </div>
          </div>

          {/* Corner Radius for Rect */}
          {(selected.type === "rect") && (
            <div className="space-y-2">
              <Label className="text-xs">Arredondamento</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selected.rx || 0]}
                  onValueChange={([v]) => { onUpdate("rx", v); onUpdate("ry", v); }}
                  min={0} max={50} step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-6 text-right">{selected.rx || 0}</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Text props */}
          {isText && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Texto</p>

              <div className="space-y-2">
                <Label className="text-xs">Fonte</Label>
                <Select value={selected.fontFamily} onValueChange={(v) => onUpdate("fontFamily", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tamanho</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.fontSize || 28]}
                    onValueChange={([v]) => onUpdate("fontSize", v)}
                    min={8} max={200} step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={selected.fontSize || 28}
                    onChange={(e) => onUpdate("fontSize", parseInt(e.target.value) || 28)}
                    className="h-7 w-16 text-xs"
                  />
                </div>
              </div>

              {/* Text formatting */}
              <div className="flex gap-1">
                <Button
                  variant={selected.fontWeight === "bold" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("fontWeight", selected.fontWeight === "bold" ? "normal" : "bold")}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.fontStyle === "italic" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("fontStyle", selected.fontStyle === "italic" ? "normal" : "italic")}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.underline ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("underline", !selected.underline)}
                >
                  <Underline className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.linethrough ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("linethrough", !selected.linethrough)}
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Text alignment */}
              <div className="flex gap-1">
                <Button
                  variant={selected.textAlign === "left" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "left")}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.textAlign === "center" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "center")}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.textAlign === "right" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "right")}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Line height */}
              <div className="space-y-2">
                <Label className="text-xs">Altura da Linha</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.lineHeight || 1.2]}
                    onValueChange={([v]) => onUpdate("lineHeight", v)}
                    min={0.5} max={3} step={0.1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{(selected.lineHeight || 1.2).toFixed(1)}</span>
                </div>
              </div>

              {/* Char spacing */}
              <div className="space-y-2">
                <Label className="text-xs">Espaçamento</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.charSpacing || 0]}
                    onValueChange={([v]) => onUpdate("charSpacing", v)}
                    min={-100} max={500} step={10}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{selected.charSpacing || 0}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Position & Size */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posição</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">X</Label>
                <Input
                  type="number"
                  value={Math.round(selected.left || 0)}
                  onChange={(e) => onUpdate("left", parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Y</Label>
                <Input
                  type="number"
                  value={Math.round(selected.top || 0)}
                  onChange={(e) => onUpdate("top", parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Rotação</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selected.angle || 0]}
                  onValueChange={([v]) => onUpdate("angle", v)}
                  min={0} max={360} step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(selected.angle || 0)}°</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
