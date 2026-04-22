import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ListViewportProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * ListViewport — The internal scroll surface for list/table pages.
 *
 * Designed to be a direct child of <PageShell/>. It owns the ONLY scroll
 * inside the page body, which keeps the page header, filters and footer
 * (pagination) fixed in place.
 */
export const ListViewport = ({
  children,
  className,
  contentClassName,
}: ListViewportProps) => {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </div>
  );
};
