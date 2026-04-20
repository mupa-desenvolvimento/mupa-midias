import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, LayoutGrid, X } from "lucide-react";
import { ListState, ViewMode } from "@/hooks/useListState";
import { cn } from "@/lib/utils";

interface ListControlsProps<F> {
  state: ListState<F>;
  onSearchChange: (value: string) => void;
  onViewChange: (view: ViewMode) => void;
  onClearFilters: () => void;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const ListControls = <F,>({
  state,
  onSearchChange,
  onViewChange,
  onClearFilters,
  children,
  actions,
  className,
}: ListControlsProps<F>) => {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", className)}>
      <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="w-full md:max-w-sm">
          <Input
            placeholder="Buscar..."
            value={state.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-full md:w-auto md:mt-0"
          onClick={onClearFilters}
        >
          <X className="w-4 h-4 mr-1" />
          Limpar filtros
        </Button>
      </div>
      <div className="flex items-center justify-end">
        <ToggleGroup
          type="single"
          value={state.view}
          onValueChange={(value) => {
            if (value === "list" || value === "grid") {
              onViewChange(value);
            }
          }}
          aria-label="Alternar visualização"
        >
          <ToggleGroupItem value="list" aria-label="Visualização em lista">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Visualização em grid">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};
