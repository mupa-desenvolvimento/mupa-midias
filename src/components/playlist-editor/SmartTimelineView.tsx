import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  usePlaylistChannels,
  PlaylistChannelItem,
  PlaylistChannel,
} from "@/hooks/usePlaylistChannels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  ZoomIn,
  ZoomOut,
  Calendar as CalendarIcon,
  AlertTriangle,
  RefreshCw,
  Layers,
  Repeat,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Color palette per campaign (HSL via tailwind tokens)
const CAMPAIGN_PALETTE = [
  { bg: "bg-blue-500/80", border: "border-blue-400", text: "text-white", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/80", border: "border-emerald-400", text: "text-white", dot: "bg-emerald-500" },
  { bg: "bg-violet-500/80", border: "border-violet-400", text: "text-white", dot: "bg-violet-500" },
  { bg: "bg-amber-500/80", border: "border-amber-400", text: "text-white", dot: "bg-amber-500" },
  { bg: "bg-rose-500/80", border: "border-rose-400", text: "text-white", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/80", border: "border-cyan-400", text: "text-white", dot: "bg-cyan-500" },
];

interface TimeBlock {
  id: string;
  itemId: string;
  channelId: string;
  channelName: string;
  channelColorIndex: number;
  mediaName: string;
  mediaType: string;
  thumbnail: string | null;
  startSeconds: number; // seconds since 00:00
  durationSeconds: number;
  isLoopRepeat: boolean;
  loopIndex: number;
}

const SECONDS_PER_DAY = 24 * 60 * 60;
const HOUR_MARKS = Array.from({ length: 25 }, (_, i) => i);

const formatTime = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds % SECONDS_PER_DAY));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const SmartTimelineView = () => {
  const navigate = useNavigate();
  const { id: playlistId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { playlists } = usePlaylists();
  const { channelsWithItems, playlistChannels } = usePlaylistChannels(playlistId || null) as any;

  const playlist = playlists.find((p) => p.id === playlistId);

  // View settings
  const [pixelsPerHour, setPixelsPerHour] = useState(120); // zoom
  const [trackMode, setTrackMode] = useState<"single" | "by-campaign">("by-campaign");
  const [windowStartHour, setWindowStartHour] = useState(0);
  const [windowEndHour, setWindowEndHour] = useState(24);
  const [currentTimeSec, setCurrentTimeSec] = useState(() => {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setCurrentTimeSec(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Channels list (with items)
  const channels: (PlaylistChannel & { items?: PlaylistChannelItem[] })[] = useMemo(() => {
    return (channelsWithItems || playlistChannels || []) as any;
  }, [channelsWithItems, playlistChannels]);

  // Build a flat ordered list of items (by global_position then position)
  const flatItems = useMemo(() => {
    const result: { item: PlaylistChannelItem; channel: PlaylistChannel; channelIndex: number }[] = [];
    channels.forEach((channel, channelIndex) => {
      const items = (channel.items || []) as PlaylistChannelItem[];
      items.forEach((item) => {
        result.push({ item, channel, channelIndex });
      });
    });
    result.sort((a, b) => {
      const ga = a.item.global_position ?? a.item.position ?? 0;
      const gb = b.item.global_position ?? b.item.position ?? 0;
      return ga - gb;
    });
    return result;
  }, [channels]);

  // Compute timeline blocks: pack sequentially from windowStart, looping until windowEnd
  const blocks: TimeBlock[] = useMemo(() => {
    if (flatItems.length === 0) return [];
    const startSec = windowStartHour * 3600;
    const endSec = windowEndHour * 3600;
    const result: TimeBlock[] = [];
    let cursor = startSec;
    let loopIndex = 0;
    let safety = 0;

    while (cursor < endSec && safety < 5000) {
      for (const { item, channel, channelIndex } of flatItems) {
        if (cursor >= endSec) break;
        const dur = Math.max(1, item.duration_override || item.media?.duration || 8);
        result.push({
          id: `${item.id}-${loopIndex}`,
          itemId: item.id,
          channelId: channel.id,
          channelName: channel.name,
          channelColorIndex: channelIndex % CAMPAIGN_PALETTE.length,
          mediaName: item.media?.name || "Sem nome",
          mediaType: item.media?.type || "image",
          thumbnail: item.media?.thumbnail_url || item.media?.file_url || null,
          startSeconds: cursor,
          durationSeconds: Math.min(dur, endSec - cursor),
          isLoopRepeat: loopIndex > 0,
          loopIndex,
        });
        cursor += dur;
        safety++;
      }
      loopIndex++;
    }

    return result;
  }, [flatItems, windowStartHour, windowEndHour]);

  // Tracks
  const tracks = useMemo(() => {
    if (trackMode === "single") {
      return [{ id: "all", name: "Linha Principal", colorIndex: 0, blocks }];
    }
    const grouped = new Map<string, { id: string; name: string; colorIndex: number; blocks: TimeBlock[] }>();
    blocks.forEach((b) => {
      if (!grouped.has(b.channelId)) {
        grouped.set(b.channelId, {
          id: b.channelId,
          name: b.channelName,
          colorIndex: b.channelColorIndex,
          blocks: [],
        });
      }
      grouped.get(b.channelId)!.blocks.push(b);
    });
    return Array.from(grouped.values());
  }, [blocks, trackMode]);

  // Conflicts (overlaps within same track)
  const conflicts = useMemo(() => {
    const conflictIds = new Set<string>();
    tracks.forEach((track) => {
      const sorted = [...track.blocks].sort((a, b) => a.startSeconds - b.startSeconds);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.startSeconds < prev.startSeconds + prev.durationSeconds - 0.01) {
          conflictIds.add(prev.id);
          conflictIds.add(cur.id);
        }
      }
    });
    return conflictIds;
  }, [tracks]);

  // Conversions
  const secondsToPx = useCallback(
    (s: number) => ((s - windowStartHour * 3600) / 3600) * pixelsPerHour,
    [pixelsPerHour, windowStartHour]
  );

  const totalWidth = (windowEndHour - windowStartHour) * pixelsPerHour;
  const trackHeight = 80;

  // Auto-scroll to "now" on mount
  useEffect(() => {
    if (scrollRef.current && currentTimeSec >= windowStartHour * 3600 && currentTimeSec <= windowEndHour * 3600) {
      const x = secondsToPx(currentTimeSec);
      scrollRef.current.scrollLeft = Math.max(0, x - 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDurationCovered = blocks.reduce((sum, b) => sum + b.durationSeconds, 0);
  const uniqueItemCount = flatItems.length;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/admin/playlists/${playlistId}/edit`)}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                Timeline Inteligente
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {playlist?.name || "Playlist"}
              </p>
            </div>
            <Badge variant="outline" className="ml-2 gap-1 border-primary/30 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Modo Beta
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => navigate(`/admin/playlists/${playlistId}/edit`)}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao modo tradicional
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() =>
              toast({
                title: "Otimização IA em breve",
                description: "Em breve a IA poderá reorganizar a timeline com base em audiência.",
              })
            }
          >
            <Wand2 className="w-3.5 h-3.5" />
            Otimizar com IA
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Janela:</span>
            <ToggleGroup
              type="single"
              size="sm"
              value={`${windowStartHour}-${windowEndHour}`}
              onValueChange={(v) => {
                if (!v) return;
                const [s, e] = v.split("-").map(Number);
                setWindowStartHour(s);
                setWindowEndHour(e);
              }}
              className="h-7"
            >
              <ToggleGroupItem value="0-24" className="h-7 px-2 text-[11px]">
                24h
              </ToggleGroupItem>
              <ToggleGroupItem value="6-22" className="h-7 px-2 text-[11px]">
                Comercial
              </ToggleGroupItem>
              <ToggleGroupItem value="8-18" className="h-7 px-2 text-[11px]">
                08–18
              </ToggleGroupItem>
              <ToggleGroupItem value="18-24" className="h-7 px-2 text-[11px]">
                Noite
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tracks:</span>
            <ToggleGroup
              type="single"
              size="sm"
              value={trackMode}
              onValueChange={(v: any) => v && setTrackMode(v)}
              className="h-7"
            >
              <ToggleGroupItem value="single" className="h-7 px-2 text-[11px]">
                Única
              </ToggleGroupItem>
              <ToggleGroupItem value="by-campaign" className="h-7 px-2 text-[11px]">
                Por Campanha
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {conflicts.size > 0 && (
            <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              {conflicts.size / 2} conflitos
            </Badge>
          )}
          <div className="text-[11px] text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Repeat className="w-3 h-3" />
              {uniqueItemCount} mídias × loop
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.floor(totalDurationCovered / 60)} min cobertos
            </span>
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2 w-44">
            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
            <Slider
              value={[pixelsPerHour]}
              min={40}
              max={400}
              step={20}
              onValueChange={(v) => setPixelsPerHour(v[0])}
              className="flex-1"
            />
            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const now = new Date();
              const sec = now.getHours() * 3600 + now.getMinutes() * 60;
              if (scrollRef.current) {
                scrollRef.current.scrollLeft = Math.max(0, secondsToPx(sec) - 200);
              }
            }}
            title="Ir para agora"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left labels column */}
        <div className="w-44 shrink-0 border-r bg-card/40 overflow-hidden flex flex-col">
          <div className="h-8 border-b flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Faixas
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                Nenhum conteúdo na playlist.
              </div>
            )}
            {tracks.map((track) => {
              const color = CAMPAIGN_PALETTE[track.colorIndex];
              return (
                <div
                  key={track.id}
                  className="border-b px-3 flex items-center gap-2"
                  style={{ height: trackHeight }}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", color.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {track.blocks.length} blocos
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline scroll area */}
        <div className="flex-1 relative overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef as any}>
            <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Hour ruler */}
              <div className="h-8 border-b sticky top-0 bg-muted/60 backdrop-blur z-10">
                {HOUR_MARKS.filter((h) => h >= windowStartHour && h <= windowEndHour).map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-border/40 flex items-start"
                    style={{ left: secondsToPx(h * 3600) }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground px-1 pt-1">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Tracks */}
              <div className="relative">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="relative border-b border-border/50 bg-card/20 hover:bg-card/40 transition-colors"
                    style={{ height: trackHeight }}
                  >
                    {/* Hour grid lines */}
                    {HOUR_MARKS.filter(
                      (h) => h >= windowStartHour && h <= windowEndHour
                    ).map((h) => (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/20"
                        style={{ left: secondsToPx(h * 3600) }}
                      />
                    ))}

                    {/* Blocks */}
                    {track.blocks.map((block) => {
                      const left = secondsToPx(block.startSeconds);
                      const width = (block.durationSeconds / 3600) * pixelsPerHour;
                      const isConflict = conflicts.has(block.id);
                      const color = CAMPAIGN_PALETTE[block.channelColorIndex];

                      return (
                        <TooltipProvider key={block.id} delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  "absolute top-2 bottom-2 rounded-md overflow-hidden border-2 group transition-all",
                                  "hover:ring-2 hover:ring-primary/40 hover:z-20",
                                  block.isLoopRepeat ? "opacity-60" : "opacity-100",
                                  isConflict
                                    ? "border-destructive ring-2 ring-destructive/40"
                                    : color.border
                                )}
                                style={{ left, width: Math.max(8, width) }}
                                onClick={() =>
                                  toast({
                                    title: block.mediaName,
                                    description: `${formatTime(block.startSeconds)} • ${block.durationSeconds}s`,
                                  })
                                }
                              >
                                <div className={cn("absolute inset-0", color.bg)} />
                                {block.thumbnail && width > 40 && (
                                  <img
                                    src={block.thumbnail}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                                  />
                                )}
                                <div className="absolute inset-0 flex flex-col justify-between p-1.5 text-left">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold truncate",
                                        color.text
                                      )}
                                    >
                                      {block.mediaName}
                                    </span>
                                  </div>
                                  {width > 60 && (
                                    <div className="flex items-center justify-between text-[9px] text-white/90 font-mono">
                                      <span>{block.durationSeconds}s</span>
                                      {block.isLoopRepeat && (
                                        <Repeat className="w-2.5 h-2.5" />
                                      )}
                                    </div>
                                  )}
                                </div>
                                {isConflict && (
                                  <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                  </div>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-0.5">
                                <p className="font-semibold">{block.mediaName}</p>
                                <p className="text-muted-foreground">
                                  {block.channelName}
                                </p>
                                <p className="font-mono">
                                  {formatTime(block.startSeconds)} →{" "}
                                  {formatTime(block.startSeconds + block.durationSeconds)}
                                </p>
                                <p className="text-muted-foreground">
                                  {block.durationSeconds}s
                                  {block.isLoopRepeat &&
                                    ` • Repetição #${block.loopIndex + 1}`}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Current time indicator */}
              {currentTimeSec >= windowStartHour * 3600 &&
                currentTimeSec <= windowEndHour * 3600 && (
                  <div
                    className="absolute top-0 bottom-0 z-30 pointer-events-none"
                    style={{ left: secondsToPx(currentTimeSec) }}
                  >
                    <div className="w-0.5 h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                    <div className="absolute -top-0.5 -left-[18px] bg-primary text-primary-foreground text-[9px] font-mono px-1.5 py-0.5 rounded shadow-md">
                      {formatTime(currentTimeSec).slice(0, 5)}
                    </div>
                  </div>
                )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {/* Footer hint */}
      <div className="h-8 shrink-0 border-t bg-muted/20 flex items-center justify-between px-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-primary" />
            Agora
          </span>
          <span className="flex items-center gap-1">
            <Repeat className="w-3 h-3" />
            Blocos esmaecidos = repetições do loop
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="w-3 h-3" />
            Vermelho = conflito
          </span>
        </div>
        <div>
          Visão temporal sincronizada com a playlist • Alterações futuras refletem nos dispositivos
        </div>
      </div>
    </div>
  );
};
