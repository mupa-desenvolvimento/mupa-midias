import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BirthdayLayoutType, BirthdayPeriod } from "./types";
import {
  CreditCard, LayoutList, Grid3x3, Monitor, PartyPopper, Check,
  Calendar, CalendarRange, CalendarDays, Layers,
} from "lucide-react";

export type BirthdaySlidePeriod = BirthdayPeriod | "all";

interface BirthdaySlideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (layout: BirthdayLayoutType, period: BirthdaySlidePeriod) => void;
  initialLayout?: BirthdayLayoutType;
  initialPeriod?: BirthdaySlidePeriod;
  mode?: "create" | "edit";
}

const SLIDE_LAYOUTS: {
  value: BirthdayLayoutType;
  label: string;
  description: string;
  icon: typeof CreditCard;
  preview: () => JSX.Element;
}[] = [
  {
    value: "celebration",
    label: "Celebração",
    description: "Card escuro festivo estilo social media com balões e confetti",
    icon: PartyPopper,
    preview: () => (
      <div className="w-full h-full bg-[hsl(220,60%,15%)] rounded-md flex items-center p-2 gap-2 relative overflow-hidden">
        <div className="absolute top-1 left-2 w-2 h-3 rounded-full bg-pink-400/50" />
        <div className="absolute top-0.5 right-3 w-2 h-3 rounded-full bg-cyan-400/50" />
        <div className="absolute top-1.5 left-6 w-1.5 h-2 rounded-full bg-yellow-400/40" />
        <div className="w-8 h-8 rounded border-2 border-cyan-400/50 bg-[hsl(220,50%,20%)] flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-3/4 bg-white/30 rounded" />
          <div className="h-1 w-full bg-white/15 rounded" />
          <div className="h-0.5 w-1/2 bg-cyan-300/20 rounded" />
        </div>
      </div>
    ),
  },
  {
    value: "cards",
    label: "Cards com Foto",
    description: "Cards individuais com foto, nome e data",
    icon: CreditCard,
    preview: () => (
      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 rounded-md flex items-center justify-center gap-1 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 bg-card rounded border shadow-sm p-1 flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 rounded-full bg-primary/20" />
            <div className="w-full h-1 bg-muted rounded" />
            <div className="w-2/3 h-0.5 bg-muted rounded" />
          </div>
        ))}
      </div>
    ),
  },
  {
    value: "list",
    label: "Lista Elegante",
    description: "Lista detalhada com destaque para aniversariantes do dia",
    icon: LayoutList,
    preview: () => (
      <div className="w-full h-full flex flex-col gap-1 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center gap-1.5 p-1 rounded ${i === 1 ? "bg-primary/10 border border-primary/20" : "bg-card border"}`}>
            <div className="w-4 h-4 rounded-full bg-primary/20 flex-shrink-0" />
            <div className="flex-1 space-y-0.5">
              <div className="w-3/4 h-1 bg-muted rounded" />
              <div className="w-1/2 h-0.5 bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    value: "grid",
    label: "Grid Festivo",
    description: "Grid visual com decorações de confetti",
    icon: Grid3x3,
    preview: () => (
      <div className="w-full h-full relative p-2">
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                top: `${20 + i * 15}%`,
                left: `${10 + i * 18}%`,
                backgroundColor: ["#f472b6", "#facc15", "#34d399", "#60a5fa", "#c084fc"][i],
                opacity: 0.5,
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1 relative">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center bg-card/50 rounded p-1 gap-0.5">
              <div className="w-4 h-4 rounded-full bg-primary/15" />
              <div className="w-full h-0.5 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    value: "banner",
    label: "Banner TV",
    description: "Layout horizontal otimizado para telas de TV",
    icon: Monitor,
    preview: () => (
      <div className="w-full h-full flex flex-col p-2 gap-1">
        <div className="bg-primary/80 rounded p-1.5 flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-primary-foreground/30" />
          <div className="h-1 flex-1 bg-primary-foreground/20 rounded" />
        </div>
        <div className="flex gap-1 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 bg-card rounded border flex flex-col items-center justify-center gap-0.5 p-1">
              <div className="w-4 h-4 rounded-full bg-primary/10" />
              <div className="w-2/3 h-0.5 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const PERIOD_OPTIONS: { value: BirthdaySlidePeriod; label: string; icon: typeof Calendar }[] = [
  { value: "day", label: "Hoje", icon: CalendarDays },
  { value: "week", label: "Semana", icon: CalendarRange },
  { value: "month", label: "Mês", icon: Calendar },
  { value: "all", label: "Todos", icon: Layers },
];

export function BirthdaySlideDialog({
  open,
  onOpenChange,
  onSelect,
  initialLayout = "celebration",
  initialPeriod = "month",
  mode = "create",
}: BirthdaySlideDialogProps) {
  const [selectedLayout, setSelectedLayout] = useState<BirthdayLayoutType>(initialLayout);
  const [selectedPeriod, setSelectedPeriod] = useState<BirthdaySlidePeriod>(initialPeriod);

  const handleConfirm = () => {
    onSelect(selectedLayout, selectedPeriod);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-primary" />
            {mode === "create" ? "Criar Slide de Aniversário" : "Alterar Layout do Slide"}
          </DialogTitle>
          <DialogDescription>
            Escolha o período e o layout para exibir os aniversariantes na TV.
          </DialogDescription>
        </DialogHeader>

        {/* Period selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Período dos aniversariantes</label>
          <ToggleGroup
            type="single"
            value={selectedPeriod}
            onValueChange={(v) => v && setSelectedPeriod(v as BirthdaySlidePeriod)}
            className="bg-muted rounded-lg p-1 w-full justify-start"
          >
            {PERIOD_OPTIONS.map((p) => (
              <ToggleGroupItem
                key={p.value}
                value={p.value}
                size="sm"
                className="gap-1.5 text-xs px-3 flex-1"
              >
                <p.icon className="w-3.5 h-3.5" />
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-[11px] text-muted-foreground">
            {selectedPeriod === "day" && "Exibe apenas os aniversariantes do dia atual."}
            {selectedPeriod === "week" && "Exibe os aniversariantes da semana atual."}
            {selectedPeriod === "month" && "Exibe os aniversariantes do mês atual."}
            {selectedPeriod === "all" && "Exibe aniversariantes do dia, semana e mês juntos em seções separadas."}
          </p>
        </div>

        {/* Layout selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Layout de exibição</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SLIDE_LAYOUTS.map((layout) => {
              const isSelected = selectedLayout === layout.value;
              const Icon = layout.icon;
              return (
                <button
                  key={layout.value}
                  onClick={() => setSelectedLayout(layout.value)}
                  className={`group relative flex flex-col rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="w-full aspect-video rounded-md border bg-muted/30 overflow-hidden mb-2">
                    {layout.preview()}
                  </div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{layout.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {layout.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <PartyPopper className="w-4 h-4" />
            {mode === "create" ? "Criar Slide" : "Aplicar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
