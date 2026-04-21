import { useState, useCallback, useRef, useEffect } from "react";
import { PlaylistChannel } from "@/hooks/usePlaylistChannels";
import { cn } from "@/lib/utils";
import { Clock, Shield, Play, Film, AlertCircle, Pencil, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ResizableChannelBlockProps {
  channel: PlaylistChannel;
  style: {
    left: number;
    width: number;
  };
  colors: {
    bg: string;
    border: string;
    text: string;
    label: string;
  };
  isSelected: boolean;
  isLive: boolean;
  noMedia: boolean;
  onSelect: () => void;
  onResize: (startTime: string, endTime: string) => void;
  containerWidth: number;
}

export const ResizableChannelBlock = ({
  channel,
  style,
  colors,
  isSelected,
  isLive,
  noMedia,
  onSelect,
  onResize,
  containerWidth,
}: ResizableChannelBlockProps) => {
  const [isDragging, setIsDragging] = useState<"left" | "right" | "move" | null>(null);
  const [tempStyle, setTempStyle] = useState(style);
  const blockRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; left: number; width: number }>({ x: 0, left: 0, width: 0 });

  // Reset temp style when prop changes
  useEffect(() => {
    if (!isDragging) {
      setTempStyle(style);
    }
  }, [style, isDragging]);

  // Convert percentage to time string (HH:mm)
  const percentToTime = (percent: number): string => {
    const totalMinutes = Math.round((percent / 100) * 1440);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  // Snap to 15-minute intervals
  const snapToInterval = (percent: number): number => {
    const totalMinutes = (percent / 100) * 1440;
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    return (snappedMinutes / 1440) * 100;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, action: "left" | "right" | "move") => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsDragging(action);
    startPosRef.current = {
      x: e.clientX,
      left: tempStyle.left,
      width: tempStyle.width,
    };
  }, [tempStyle]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || containerWidth === 0) return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaPercent = (deltaX / containerWidth) * 100;

    if (isDragging === "left") {
      let newLeft = snapToInterval(startPosRef.current.left + deltaPercent);
      let newWidth = startPosRef.current.width - (newLeft - startPosRef.current.left);
      
      // Constraints
      newLeft = Math.max(0, Math.min(newLeft, startPosRef.current.left + startPosRef.current.width - 2));
      newWidth = Math.max(2, newWidth);
      
      setTempStyle({ left: newLeft, width: newWidth });
    } else if (isDragging === "right") {
      let newWidth = snapToInterval(startPosRef.current.width + deltaPercent);
      
      // Constraints
      newWidth = Math.max(2, newWidth);
      const maxWidth = 100 - tempStyle.left;
      newWidth = Math.min(newWidth, maxWidth);
      
      setTempStyle(prev => ({ ...prev, width: newWidth }));
    } else if (isDragging === "move") {
      // Move the entire block, keeping the same width
      let newLeft = snapToInterval(startPosRef.current.left + deltaPercent);
      
      // Constraints - keep within 0-100% bounds
      newLeft = Math.max(0, newLeft);
      newLeft = Math.min(100 - startPosRef.current.width, newLeft);
      
      setTempStyle({ left: newLeft, width: startPosRef.current.width });
    }
  }, [isDragging, containerWidth, tempStyle.left]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      const startTime = percentToTime(tempStyle.left);
      const endTime = percentToTime(tempStyle.left + tempStyle.width);
      onResize(startTime, endTime);
    }
    setIsDragging(null);
  }, [isDragging, tempStyle, onResize]);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isDragging === "move" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getStatusIcon = () => {
    if (!channel.is_active) return <AlertCircle className="w-3 h-3" />;
    if (channel.is_fallback) return <Shield className="w-3 h-3" />;
    if (isLive) return <Play className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  const displayStyle = isDragging ? tempStyle : style;
  const displayStartTime = isDragging ? percentToTime(tempStyle.left) : channel.start_time.slice(0, 5);
  const displayEndTime = isDragging ? percentToTime(tempStyle.left + tempStyle.width) : channel.end_time.slice(0, 5);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={blockRef}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 flex items-center overflow-hidden group",
              colors.bg,
              colors.border,
              colors.text,
              isSelected && "ring-2 ring-white ring-offset-2 ring-offset-background shadow-lg",
              isLive && "shadow-[0_0_16px_rgba(34,197,94,0.3)]",
              noMedia && "border-dashed",
              isDragging && "ring-2 ring-primary shadow-xl z-30"
            )}
            style={{
              left: `${displayStyle.left}%`,
              width: `${Math.max(displayStyle.width, 3)}%`,
            }}
          >
            {/* Left resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-10"
              onMouseDown={(e) => handleMouseDown(e, "left")}
            >
              <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
            </div>

            {/* Drag handle for moving */}
            <div
              className="shrink-0 flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors ml-1"
              onMouseDown={(e) => handleMouseDown(e, "move")}
            >
              <GripVertical className="w-3 h-3 opacity-60" />
            </div>

            {/* Status icon */}
            <div className="shrink-0 ml-0.5">
              {getStatusIcon()}
            </div>

            {/* Content */}
            <span className="text-xs font-semibold truncate drop-shadow-sm ml-1.5 flex-1 min-w-0">
              {channel.name}
            </span>
            
            {/* Media count - only show if there's enough space */}
            {displayStyle.width > 8 && (
              <span className="text-[10px] opacity-80 shrink-0 flex items-center gap-0.5 mr-1">
                <Film className="w-3 h-3" />
                {channel.item_count || 0}
              </span>
            )}

            {/* Edit button to enter channel */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                  }}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-white/30 transition-colors mr-1 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Editar conteúdos da campanha
              </TooltipContent>
            </Tooltip>

            {/* Right resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-10"
              onMouseDown={(e) => handleMouseDown(e, "right")}
            >
              <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
            </div>

            {/* Time indicator while dragging */}
            {isDragging && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono px-2 py-0.5 rounded whitespace-nowrap z-40">
                {displayStartTime} – {displayEndTime}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="font-semibold">{channel.name}</p>
            <p className="text-xs text-muted-foreground">
              {channel.start_time.slice(0, 5)} – {channel.end_time.slice(0, 5)}
            </p>
            <p className="text-xs flex items-center gap-1">
              <Film className="w-3 h-3" />
              {channel.item_count || 0} mídias
            </p>
            <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t">
              <p>• Arraste as bordas para ajustar horário</p>
              <p>• Arraste o ícone ⋮⋮ para mover</p>
              <p>• Clique ✏️ para editar conteúdos</p>
            </div>
            {channel.is_fallback && (
              <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                Fallback
              </Badge>
            )}
            {noMedia && (
              <p className="text-xs text-red-500">⚠ Sem mídias configuradas</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
