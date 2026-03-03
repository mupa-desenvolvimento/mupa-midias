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
    <div className={cn("h-full max-h-full overflow-hidden flex flex-col", className)}>
      <div className="shrink-0">
        {header}
      </div>
      {controls && (
        <div className="shrink-0">
          {controls}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {children}
      </div>
      {footer && (
        <div className="shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
};

