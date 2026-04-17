import { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ListViewportProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const ListViewport = ({
  children,
  className,
  contentClassName,
}: ListViewportProps) => {
  return (
    <div className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar", className)} style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className={cn("p-4", contentClassName)}>
        {children}
      </div>
    </div>
  );
};

