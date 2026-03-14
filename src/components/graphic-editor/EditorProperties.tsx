import { SelectedObjectProps } from "./useFabricCanvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Palette } from "lucide-react";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f59e0b", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9",
];

const FONTS = ["Inter", "Arial", "Georgia", "Courier New", "Verdana", "Times New Roman"];

interface Props {
  selected: SelectedObjectProps | null;
  onUpdate: (prop: string, value: any) => void;
}

export function EditorProperties({ selected, onUpdate }: Props) {
  if (!selected) {
    return (
      <div className="w-[240px] border-l border-border bg-card flex flex-col items-center justify-center shrink-0 h-full">
        <Palette className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Selecione um objeto</p>
        <p className="text-xs text-muted-foreground/60">para editar suas propriedades</p>
      </div>
    );
  }

  const isText = selected.type === "i-text" || selected.type === "text";

  return (
    <div className="w-[240px] border-l border-border bg-card flex flex-col shrink-0 h-full">
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
                  className={`w-6 h-6 rounded-md border transition-all ${
                    selected.fill === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => onUpdate("fill", c)}
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

          {/* Text props */}
          {isText && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Fonte</Label>
                <Select value={selected.fontFamily} onValueChange={(v) => onUpdate("fontFamily", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tamanho da Fonte</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.fontSize || 28]}
                    onValueChange={([v]) => onUpdate("fontSize", v)}
                    min={8} max={120} step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{selected.fontSize}px</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Alinhamento</Label>
                <Select value={selected.textAlign || "left"} onValueChange={(v) => onUpdate("textAlign", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left" className="text-xs">Esquerda</SelectItem>
                    <SelectItem value="center" className="text-xs">Centro</SelectItem>
                    <SelectItem value="right" className="text-xs">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
