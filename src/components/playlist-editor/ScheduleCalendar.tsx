import { useState, useEffect, useRef } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScheduleCalendarProps {
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  onChange: (updates: {
    start_date?: string | null;
    end_date?: string | null;
    start_time?: string;
    end_time?: string;
    days_of_week?: number[];
  }) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom", full: "Domingo" },
  { value: 1, label: "Seg", full: "Segunda" },
  { value: 2, label: "Ter", full: "Terça" },
  { value: 3, label: "Qua", full: "Quarta" },
  { value: 4, label: "Qui", full: "Quinta" },
  { value: 5, label: "Sex", full: "Sexta" },
  { value: 6, label: "Sáb", full: "Sábado" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// iOS-style scroll wheel time picker
const TimeWheel = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [hour, minute] = value.split(":").map(Number);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Snap to nearest 5 min
  const snappedMinute = MINUTES.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev
  );

  useEffect(() => {
    // Center selected hour
    if (hoursRef.current) {
      const itemHeight = 36;
      hoursRef.current.scrollTop = hour * itemHeight;
    }
    if (minutesRef.current) {
      const itemHeight = 36;
      const minIdx = MINUTES.indexOf(snappedMinute);
      minutesRef.current.scrollTop = (minIdx >= 0 ? minIdx : 0) * itemHeight;
    }
  }, []);

  const setHour = (h: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(snappedMinute).padStart(2, "0")}`);
  };

  const setMinute = (m: number) => {
    onChange(`${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="relative h-[180px] w-16 overflow-hidden rounded-lg bg-muted/40 border">
        <div className="absolute top-1/2 left-0 right-0 h-9 -translate-y-1/2 bg-primary/10 border-y border-primary/30 pointer-events-none z-10" />
        <ScrollArea className="h-full">
          <div ref={hoursRef} className="py-[72px]">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setHour(h)}
                className={cn(
                  "w-full h-9 flex items-center justify-center text-sm font-mono transition-all",
                  h === hour
                    ? "text-primary font-bold scale-110"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <span className="text-2xl font-bold text-muted-foreground">:</span>

      <div className="relative h-[180px] w-16 overflow-hidden rounded-lg bg-muted/40 border">
        <div className="absolute top-1/2 left-0 right-0 h-9 -translate-y-1/2 bg-primary/10 border-y border-primary/30 pointer-events-none z-10" />
        <ScrollArea className="h-full">
          <div ref={minutesRef} className="py-[72px]">
            {MINUTES.map((m) => (
              <button
                key={m}
                onClick={() => setMinute(m)}
                className={cn(
                  "w-full h-9 flex items-center justify-center text-sm font-mono transition-all",
                  m === snappedMinute
                    ? "text-primary font-bold scale-110"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

const TimePickerButton = ({
  label,
  value,
  onChange,
  icon: Icon = Clock,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: any;
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex-1 flex flex-col items-start p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-2xl font-bold font-mono tabular-nums">{value}</span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <p className="text-xs font-medium text-center mb-2 text-muted-foreground">
          {label}
        </p>
        <TimeWheel value={value} onChange={onChange} />
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Role para selecionar
        </p>
      </PopoverContent>
    </Popover>
  );
};

export const ScheduleCalendar = ({
  startDate,
  endDate,
  startTime,
  endTime,
  daysOfWeek,
  onChange,
}: ScheduleCalendarProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const range = {
    from: startDate ? parseISO(startDate) : undefined,
    to: endDate ? parseISO(endDate) : undefined,
  };

  const toggleDay = (day: number) => {
    const newDays = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort();
    onChange({ days_of_week: newDays });
  };

  const selectAllDays = () => {
    onChange({ days_of_week: [0, 1, 2, 3, 4, 5, 6] });
  };

  const selectWeekdays = () => {
    onChange({ days_of_week: [1, 2, 3, 4, 5] });
  };

  const selectWeekends = () => {
    onChange({ days_of_week: [0, 6] });
  };

  const clearDateRange = () => {
    onChange({ start_date: null, end_date: null });
  };

  const formatDateRange = () => {
    if (!range.from && !range.to) return "Sempre ativo";
    if (range.from && !range.to) return format(range.from, "dd/MM/yyyy");
    if (range.from && range.to) {
      return `${format(range.from, "dd MMM", { locale: ptBR })} → ${format(
        range.to,
        "dd MMM yyyy",
        { locale: ptBR }
      )}`;
    }
    return "Selecionar datas";
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Período
          </label>
          {(range.from || range.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-muted-foreground"
              onClick={clearDateRange}
            >
              <X className="w-3 h-3" />
              Limpar
            </Button>
          )}
        </div>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start gap-2 h-auto py-3 font-normal",
                !range.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 text-left text-sm">{formatDateRange()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range as any}
              onSelect={(r: any) => {
                onChange({
                  start_date: r?.from ? format(r.from, "yyyy-MM-dd") : null,
                  end_date: r?.to ? format(r.to, "yyyy-MM-dd") : null,
                });
              }}
              numberOfMonths={2}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="border-t p-3 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Selecione um intervalo de datas
              </p>
              <Button
                size="sm"
                variant="default"
                onClick={() => setCalendarOpen(false)}
              >
                Concluir
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Time Pickers */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Horário de Exibição
        </label>
        <div className="flex items-center gap-2">
          <TimePickerButton
            label="Início"
            value={startTime}
            onChange={(v) => onChange({ start_time: v })}
          />
          <div className="text-muted-foreground font-bold">→</div>
          <TimePickerButton
            label="Fim"
            value={endTime}
            onChange={(v) => onChange({ end_time: v })}
          />
        </div>
      </div>

      {/* Days of Week */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dias Ativos
          </label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={selectAllDays}
            >
              Todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={selectWeekdays}
            >
              Úteis
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={selectWeekends}
            >
              Fim de semana
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const isActive = daysOfWeek.includes(day.value);
            return (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                title={day.full}
                className={cn(
                  "h-12 rounded-lg border-2 text-xs font-semibold transition-all",
                  "flex flex-col items-center justify-center gap-0.5",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground"
                )}
              >
                <span className="text-[10px] uppercase opacity-70">{day.label}</span>
                <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-primary-foreground" : "bg-muted-foreground/30")} />
              </button>
            );
          })}
        </div>

        {daysOfWeek.length === 0 && (
          <p className="text-[10px] text-destructive flex items-center gap-1">
            <X className="w-3 h-3" />
            Nenhum dia selecionado — a programação não será exibida
          </p>
        )}
      </div>
    </div>
  );
};
