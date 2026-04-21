import * as React from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * AppDrawer — Padrão visual unificado para drawers laterais do sistema.
 *
 * Estrutura obrigatória:
 *   <AppDrawer open={...} onClose={...}>
 *     <AppDrawerHeader title="..." subtitle="..." icon={...} />
 *     <AppDrawerBody>...</AppDrawerBody>
 *     <AppDrawerFooter>...</AppDrawerFooter>
 *   </AppDrawer>
 */

interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  /** Largura máxima em desktop. Default: 520 */
  width?: 420 | 480 | 520 | 640;
  className?: string;
  /** Acessibilidade: descrição opcional do drawer */
  ariaDescription?: string;
}

const widthMap = {
  420: "sm:max-w-[420px]",
  480: "sm:max-w-[480px]",
  520: "sm:max-w-[520px]",
  640: "sm:max-w-[640px]",
};

export const AppDrawer = ({
  open,
  onClose,
  children,
  side = "right",
  width = 520,
  className,
  ariaDescription,
}: AppDrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={side}
        hideDefaultClose
        className={cn(
          "w-full p-0 flex flex-col gap-0 bg-background",
          widthMap[width],
          className
        )}
      >
        {ariaDescription && (
          <SheetDescription className="sr-only">{ariaDescription}</SheetDescription>
        )}
        {children}
      </SheetContent>
    </Sheet>
  );
};

interface AppDrawerHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Conteúdo extra abaixo do título (badges, contadores, etc) */
  meta?: React.ReactNode;
  /** Renderização customizada do bloco de título (sobrescreve title/subtitle) */
  titleSlot?: React.ReactNode;
  onClose: () => void;
  className?: string;
}

export const AppDrawerHeader = ({
  title,
  subtitle,
  icon,
  meta,
  titleSlot,
  onClose,
  className,
}: AppDrawerHeaderProps) => {
  return (
    <header
      className={cn(
        "shrink-0 border-b bg-background",
        "px-6 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {titleSlot ?? (
              <>
                {subtitle && (
                  <SheetTitle asChild>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium leading-tight">
                      {subtitle}
                    </p>
                  </SheetTitle>
                )}
                <h2
                  className="text-base font-semibold text-foreground truncate-title leading-snug mt-0.5"
                  title={title}
                >
                  {title}
                </h2>
                {!subtitle && (
                  <SheetTitle className="sr-only">{title}</SheetTitle>
                )}
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0 h-10 w-10 -mr-2 -mt-1 text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      {meta && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">{meta}</div>
      )}
    </header>
  );
};

interface AppDrawerBodyProps {
  children: React.ReactNode;
  className?: string;
  /** Padding interno. Default: true (p-6) */
  padded?: boolean;
}

export const AppDrawerBody = ({
  children,
  className,
  padded = true,
}: AppDrawerBodyProps) => {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className={cn(padded && "p-6 space-y-6", className)}>{children}</div>
    </ScrollArea>
  );
};

interface AppDrawerSectionProps {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Seção padronizada dentro do body — título + ação + conteúdo */
export const AppDrawerSection = ({
  title,
  icon,
  action,
  children,
  className,
}: AppDrawerSectionProps) => {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              {icon}
              <span className="truncate-title">{title}</span>
            </h3>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};

interface AppDrawerFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const AppDrawerFooter = ({
  children,
  className,
}: AppDrawerFooterProps) => {
  return (
    <footer
      className={cn(
        "shrink-0 border-t bg-background",
        "px-6 py-4",
        "flex items-center justify-end gap-2",
        className
      )}
    >
      {children}
    </footer>
  );
};
