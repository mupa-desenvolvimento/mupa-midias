import { useEffect, useRef, useState, ElementType, HTMLAttributes } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  text: string;
  as?: ElementType;
  tooltipDisabled?: boolean;
  className?: string;
}

/**
 * TruncatedText — single-line, ellipsis-truncated text with auto tooltip on overflow.
 * Globally enforces title overflow rules across the system.
 */
export const TruncatedText = ({
  text,
  as: Component = "span",
  tooltipDisabled = false,
  className,
  ...props
}: TruncatedTextProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const content = (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={cn("truncate-title", className)}
      {...props}
    >
      {text}
    </Component>
  );

  if (tooltipDisabled || !isTruncated) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TruncatedText;
