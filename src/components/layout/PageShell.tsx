import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  header: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const PageShell = ({
  header,
  controls,
  children,
  footer,
  className,
}: PageShellProps) => {
  return (
    <div className={cn("flex flex-col flex-1 min-h-0 gap-4", className)}>
      <div className="animate-fade-in shrink-0">
        {header}
      </div>
      {controls && (
        <div className="shrink-0">
          {controls}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="pt-4 shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
};
