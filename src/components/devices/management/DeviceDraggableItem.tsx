import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Monitor, CircleDot, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { TruncatedText } from "@/components/ui/truncated-text";
import { Checkbox } from "@/components/ui/checkbox";

interface DeviceDraggableItemProps {
  device: {
    id: string;
    name: string;
    device_code: string;
    status: string;
    is_active: boolean;
  };
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  className?: string;
  isDraggingInTree?: boolean;
}

export const DeviceDraggableItem = ({
  device,
  isSelected,
  onToggleSelect,
  className,
  isDraggingInTree = false,
}: DeviceDraggableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `device-${device.id}`,
    data: {
      type: "device",
      device,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5",
        "transition-colors hover:border-primary/40",
        isSelected && "border-primary bg-primary/5",
        isDragging && "cursor-grabbing",
        className
      )}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {onToggleSelect && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(device.id)}
          className="h-4 w-4"
        />
      )}

      <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <TruncatedText
          text={device.name}
          className="text-xs font-medium leading-tight"
        />
        <TruncatedText
          text={device.device_code}
          className="text-[10px] text-muted-foreground leading-tight"
        />
      </div>
      <CircleDot
        className={cn(
          "h-3 w-3 shrink-0",
          device.status === "online" && device.is_active
            ? "text-emerald-500"
            : "text-muted-foreground/40"
        )}
      />
    </div>
  );
};
