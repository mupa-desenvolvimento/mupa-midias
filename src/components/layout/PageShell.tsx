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
    <div className={cn("space-y-6 pb-10", className)}>
      <div className="animate-fade-in">
        {header}
      </div>
      {controls && (
        <div>
          {controls}
        </div>
      )}
      <div className="w-full">
        {children}
      </div>
      {footer && (
        <div className="pt-4">
          {footer}
        </div>
      )}
    </div>
  );
};
