import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  header?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * When true (default), enforces a strict column layout where only the
   * inner content scrolls and the footer stays pinned. Set to false for
   * legacy pages that need full-page scroll.
   */
  fixedLayout?: boolean;
}

/**
 * PageShell — Standard layout for content pages.
 *
 * Behavior:
 *  - Header + Controls: shrink-0 (always visible at top)
 *  - Children: flex-1, scrolls internally (use <ListViewport/> for tables/lists)
 *  - Footer: shrink-0, pinned at the bottom with a separator shadow
 *
 * Use this for any page with a paginated table/list. For dashboards or
 * free-form pages, render plain content without PageShell so the page
 * scrolls naturally.
 */
export const PageShell = ({
  header,
  controls,
  children,
  footer,
  className,
  fixedLayout = true,
}: PageShellProps) => {
  return (
    <div
      className={cn(
        "flex flex-col flex-1 w-full",
        fixedLayout ? "min-h-0 h-full overflow-hidden" : "min-h-0",
        className
      )}
    >
      {header && (
        <div className="animate-fade-in shrink-0">
          {header}
        </div>
      )}
      {controls && (
        <div className="shrink-0 pb-2">
          {controls}
        </div>
      )}
      <div
        className={cn(
          "flex-1 flex flex-col w-full",
          fixedLayout ? "min-h-0 overflow-hidden" : ""
        )}
      >
        {children}
      </div>
      {footer && (
        <div
          className={cn(
            "shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm",
            "shadow-[0_-4px_12px_-6px_hsl(var(--foreground)/0.08)]",
            "supports-[backdrop-filter]:bg-background/80"
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
