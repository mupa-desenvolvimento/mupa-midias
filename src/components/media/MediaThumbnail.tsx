import { Globe, Play, Newspaper, CloudSun, MessageCircleHeart, Lightbulb, Cake, Apple, Instagram, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  type: string;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  name?: string;
  className?: string;
  imgClassName?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  webview: Globe,
  video: Play,
  news: Newspaper,
  weather: CloudSun,
  motivational: MessageCircleHeart,
  curiosity: Lightbulb,
  birthday: Cake,
  nutrition: Apple,
  instagram: Instagram,
  campaign: QrCode,
};

const TYPE_COLORS: Record<string, string> = {
  webview: "text-blue-400",
  video: "text-white/70",
  news: "text-orange-400",
  weather: "text-sky-400",
  motivational: "text-pink-400",
  curiosity: "text-yellow-400",
  birthday: "text-purple-400",
  nutrition: "text-green-400",
  instagram: "text-fuchsia-400",
  campaign: "text-emerald-400",
};

/**
 * Universal thumbnail renderer for media items.
 * Handles image, video, webview, and dynamic content types.
 */
export function MediaThumbnail({ type, fileUrl, thumbnailUrl, name, className, imgClassName }: MediaThumbnailProps) {
  const isImage = type === "image" || (fileUrl && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl));

  // Prefer thumbnail_url for non-image types (webview, etc.)
  const displayUrl = thumbnailUrl || (isImage ? fileUrl : null);

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={name || ""}
        className={cn("w-full h-full object-cover", imgClassName, className)}
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  // Fallback: icon for dynamic types
  const Icon = TYPE_ICONS[type] || Play;
  const color = TYPE_COLORS[type] || "text-muted-foreground";

  return (
    <div className={cn("w-full h-full flex flex-col items-center justify-center bg-black/60 gap-1", className)}>
      <Icon className={cn("h-5 w-5", color)} />
      <span className={cn("text-[8px] font-medium uppercase", color)}>{type}</span>
    </div>
  );
}
