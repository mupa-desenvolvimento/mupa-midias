import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

export const UniversalPagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) => {
  const safePage = page < 1 ? 1 : page;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(start + pageSize - 1, total);

  const handlePrevious = () => {
    if (safePage > 1) {
      onPageChange(safePage - 1);
    }
  };

  const handleNext = () => {
    if (safePage < totalPages) {
      onPageChange(safePage + 1);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}–{end}</span> de{" "}
        <span className="font-medium text-foreground">{total}</span>
      </div>
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Itens por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const nextSize = Number(value);
              if (!Number.isNaN(nextSize)) {
                onPageSizeChange(nextSize);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={safePage <= 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={safePage >= totalPages}
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
};

