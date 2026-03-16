import { useEffect, useMemo, useRef, useState } from "react";
import { SelectedObjectProps } from "./useFabricCanvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Palette, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Strikethrough, Monitor, Upload, Trash2, ChevronsUpDown, Check, Star, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { AlignmentSettings } from "@/editor/alignment-engine";
import { supabase } from "@/integrations/supabase/client";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f59e0b", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9",
  "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#a855f7",
  "#e11d48", "#0d9488", "#7c3aed", "transparent",
];

const BUILTIN_FONTS = [
  "Inter",
  "Arial",
  "Arial Black",
  "Impact",
  "Georgia",
  "Courier New",
  "Verdana",
  "Times New Roman",
  "Helvetica",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Lato",
  "Playfair Display",
  "Oswald",
  "Anton",
  "Bebas Neue",
  "Archivo Black",
  "Teko",
  "League Spartan",
  "Passion One",
  "Rubik",
  "Outfit",
  "Barlow Condensed",
  "Fredoka",
  "Alfa Slab One",
  "Bangers",
  "Luckiest Guy",
];

const GOOGLE_FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Lato",
  "Playfair Display",
  "Oswald",
  "Anton",
  "Bebas Neue",
  "Archivo Black",
  "Teko",
  "League Spartan",
  "Passion One",
  "Rubik",
  "Outfit",
  "Barlow Condensed",
  "Fredoka",
  "Alfa Slab One",
  "Bangers",
  "Luckiest Guy",
];

type UploadedFont = {
  family: string;
  dataUrl: string;
  fileName: string;
};

type SystemFont = {
  id: string;
  family: string;
  fileUrl: string;
  fileName: string;
};

const UPLOADED_FONTS_STORAGE_KEY = "graphic-editor-uploaded-fonts";
const FONT_FAVORITES_STORAGE_KEY = "graphic-editor-font-favorites";
const CANVAS_BG_RECENT_STORAGE_KEY = "graphic-editor-canvas-bg-recent";
const CANVAS_BG_PRESETS_STORAGE_KEY = "graphic-editor-canvas-bg-presets";

const CANVAS_PRESETS = [
  { label: "Full HD (1920×1080)", w: 1920, h: 1080 },
  { label: "HD (1280×720)", w: 1280, h: 720 },
  { label: "Instagram Post (1080×1080)", w: 1080, h: 1080 },
  { label: "Instagram Story (1080×1920)", w: 1080, h: 1920 },
  { label: "Facebook Cover (820×312)", w: 820, h: 312 },
  { label: "YouTube Thumb (1280×720)", w: 1280, h: 720 },
  { label: "TV Portrait (1080×1920)", w: 1080, h: 1920 },
  { label: "TV Landscape (1920×1080)", w: 1920, h: 1080 },
  { label: "Banner (728×90)", w: 728, h: 90 },
  { label: "A4 (2480×3508)", w: 2480, h: 3508 },
  { label: "Personalizado", w: 0, h: 0 },
];

interface Props {
  selected: SelectedObjectProps | null;
  onUpdate: (prop: string, value: any) => void;
  canvasBgColor: string;
  onCanvasBgChange: (color: string) => void;
  canvasWidth: number;
  canvasHeight: number;
  onCanvasResize: (w: number, h: number) => void;
  onCanvasSwapOrientation: () => void;
  alignmentSettings: AlignmentSettings;
  onAlignmentSettingsChange: (updates: Partial<AlignmentSettings>) => void;
}

export function EditorProperties({
  selected,
  onUpdate,
  canvasBgColor,
  onCanvasBgChange,
  canvasWidth,
  canvasHeight,
  onCanvasResize,
  onCanvasSwapOrientation,
  alignmentSettings,
  onAlignmentSettingsChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFonts, setUploadedFonts] = useState<UploadedFont[]>([]);
  const [systemFonts, setSystemFonts] = useState<SystemFont[]>([]);
  const loadedFontFacesRef = useRef<Map<string, FontFace>>(new Map());
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [fontOnlyFavorites, setFontOnlyFavorites] = useState(false);
  const [favoriteFonts, setFavoriteFonts] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FONT_FAVORITES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [recentCanvasBgColors, setRecentCanvasBgColors] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CANVAS_BG_RECENT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [canvasBgPresets, setCanvasBgPresets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CANVAS_BG_PRESETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const existing = document.getElementById("ge-google-fonts");
    if (!existing) {
      const link = document.createElement("link");
      link.id = "ge-google-fonts";
      link.rel = "stylesheet";
      const families = GOOGLE_FONT_FAMILIES.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900`).join("&");
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(
      supabase
        .from("media_items")
        .select("id,name,file_url,metadata,created_at")
        .eq("type", "font")
        .order("created_at", { ascending: false })
    ).then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Falha ao carregar fontes do sistema");
          setSystemFonts([]);
          return;
        }

        const next: SystemFont[] = (data || [])
          .map((row: any) => {
            const rawUrl = typeof row?.file_url === "string" ? row.file_url : null;
            const id = typeof row?.id === "string" ? row.id : null;
            if (!rawUrl || !id) return null;
            const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media?mediaId=${encodeURIComponent(id)}`;
            const name = typeof row?.name === "string" ? row.name : "Fonte";
            const metadata = row?.metadata as any;
            const family =
              typeof metadata?.font_family === "string" && metadata.font_family.trim()
                ? metadata.font_family.trim()
                : name;
            return {
              id,
              family,
              fileUrl,
              fileName: name,
            };
          })
          .filter(Boolean) as SystemFont[];

        setSystemFonts(next);
      }).catch(() => {
        if (cancelled) return;
        toast.error("Falha ao carregar fontes do sistema");
        setSystemFonts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(UPLOADED_FONTS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as UploadedFont[];
      if (!Array.isArray(parsed)) return;
      setUploadedFonts(parsed);
      parsed.forEach((f) => {
        if (loadedFontFacesRef.current.has(f.family)) return;
        const face = new FontFace(f.family, `url(${f.dataUrl})`);
        face.load().then(() => {
          document.fonts.add(face);
          loadedFontFacesRef.current.set(f.family, face);
        }).catch(() => undefined);
      });
    } catch {
      setUploadedFonts([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FONT_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteFonts));
    } catch {
      void 0;
    }
  }, [favoriteFonts]);

  const normalizeCanvasColor = (v: string) => {
    const s = `${v || ""}`.trim().toLowerCase();
    if (s === "transparent") return "transparent";
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    return null;
  };

  const pushRecentCanvasColor = (v: string) => {
    const c = normalizeCanvasColor(v);
    if (!c) return;
    setRecentCanvasBgColors((prev) => {
      const next = [c, ...prev.filter((x) => x !== c)].slice(0, 10);
      return next;
    });
  };

  const presetsSet = useMemo(() => new Set(canvasBgPresets.map((c) => normalizeCanvasColor(c)).filter(Boolean) as string[]), [canvasBgPresets]);

  const toggleCanvasPreset = (v: string) => {
    const c = normalizeCanvasColor(v);
    if (!c) return;
    setCanvasBgPresets((prev) => {
      const set = new Set(prev.map((x) => normalizeCanvasColor(x)).filter(Boolean) as string[]);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 30);
    });
  };

  const removeCanvasPreset = (v: string) => {
    const c = normalizeCanvasColor(v);
    if (!c) return;
    setCanvasBgPresets((prev) => (prev.map((x) => normalizeCanvasColor(x)).filter(Boolean) as string[]).filter((x) => x !== c));
  };

  const applyCanvasBg = (v: string) => {
    const c = normalizeCanvasColor(v);
    if (!c) return;
    onCanvasBgChange(c);
    pushRecentCanvasColor(c);
  };

  useEffect(() => {
    try {
      localStorage.setItem(CANVAS_BG_RECENT_STORAGE_KEY, JSON.stringify(recentCanvasBgColors));
    } catch {
      void 0;
    }
  }, [recentCanvasBgColors]);

  useEffect(() => {
    try {
      localStorage.setItem(CANVAS_BG_PRESETS_STORAGE_KEY, JSON.stringify(canvasBgPresets));
    } catch {
      void 0;
    }
  }, [canvasBgPresets]);

  useEffect(() => {
    if (!canvasBgColor) return;
    pushRecentCanvasColor(canvasBgColor);
  }, [canvasBgColor]);

  const fonts = useMemo(() => {
    const set = new Set<string>();
    BUILTIN_FONTS.forEach((f) => set.add(f));
    systemFonts.forEach((f) => set.add(f.family));
    uploadedFonts.forEach((f) => set.add(f.family));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [uploadedFonts, systemFonts]);

  const uploadedFamilies = useMemo(() => new Set(uploadedFonts.map((f) => f.family)), [uploadedFonts]);
  const systemFamilies = useMemo(() => new Set(systemFonts.map((f) => f.family)), [systemFonts]);
  const systemFamilyToUrl = useMemo(() => new Map(systemFonts.map((f) => [f.family, f.fileUrl])), [systemFonts]);
  const systemFamilyToId = useMemo(() => new Map(systemFonts.map((f) => [f.family, f.id])), [systemFonts]);
  const favoriteSet = useMemo(() => new Set(favoriteFonts), [favoriteFonts]);

  const getFontProxyUrlById = (id: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media?mediaId=${encodeURIComponent(id)}`;

  const toggleFavoriteFont = (family: string) => {
    setFavoriteFonts((prev) => {
      const set = new Set(prev);
      if (set.has(family)) set.delete(family);
      else set.add(family);
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    });
  };

  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    const base = q ? fonts.filter((f) => f.toLowerCase().includes(q)) : fonts;
    return fontOnlyFavorites ? base.filter((f) => favoriteSet.has(f)) : base;
  }, [fonts, fontSearch, fontOnlyFavorites, favoriteSet]);

  const favoriteFontsAvailable = useMemo(
    () => favoriteFonts.filter((f) => fonts.includes(f)),
    [favoriteFonts, fonts]
  );

  useEffect(() => {
    if (!fontPickerOpen) return;
    setFontSearch("");
    setFontOnlyFavorites(false);
  }, [fontPickerOpen]);

  const ensureFontAvailable = async (family: string) => {
    const fam = `${family || ""}`.trim();
    if (!fam) return;
    if (loadedFontFacesRef.current.has(fam)) return;
    const url = systemFamilyToUrl.get(fam);
    if (url) {
      const face = new FontFace(fam, `url(${url})`);
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedFontFacesRef.current.set(fam, loaded);
      return;
    }
    await document.fonts.load(`16px "${fam}"`);
  };

  const handleUploadFont = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isSupported = ext === "ttf" || ext === "otf" || ext === "woff" || ext === "woff2";
    if (!isSupported) {
      toast.error("Formato de fonte inválido. Use .ttf, .otf, .woff ou .woff2");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fonte muito grande. Tamanho máximo: 5MB");
      return;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const sanitized = baseName.replace(/[^a-zA-Z0-9À-ÿ _-]/g, "").trim() || "Fonte";
    let family = sanitized;
    const existing = new Set<string>([...fonts, ...uploadedFamilies, ...systemFamilies]);
    if (existing.has(family)) family = `${family} ${Date.now().toString(36).slice(-4)}`;

    const mime =
      ext === "ttf" ? "font/ttf" :
      ext === "otf" ? "font/otf" :
      ext === "woff" ? "font/woff" :
      "font/woff2";
    const uploadName = `${family}.${ext}`;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado para enviar fontes");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", uploadName);
    formData.append("fileType", mime);
    formData.append("fontFamily", family);

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        typeof result?.error === "string" && result.error.trim()
          ? result.error.trim()
          : "Falha ao enviar fonte";
      const received = typeof result?.received === "string" ? result.received : "";
      const normalized = typeof result?.normalized === "string" ? result.normalized : "";
      const inferred = typeof result?.inferred === "string" ? result.inferred : "";
      const suffix = [received && `recebido: ${received}`, normalized && `normalizado: ${normalized}`, inferred && `inferido: ${inferred}`]
        .filter(Boolean)
        .join(" • ");
      toast.error(suffix ? `${msg} (${suffix})` : msg);
      return;
    }

    const fileUrl = typeof result?.fileUrl === "string" ? result.fileUrl : null;
    const id = typeof result?.mediaItem?.id === "string" ? result.mediaItem.id : null;

    if (!fileUrl || !id) {
      toast.error("Fonte enviada, mas falhou ao registrar no sistema");
      return;
    }

    const proxyUrl = getFontProxyUrlById(id);
    try {
      const face = new FontFace(family, `url(${proxyUrl})`);
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedFontFacesRef.current.set(family, loaded);
    } catch {
      try {
        const face = new FontFace(family, `url(${fileUrl})`);
        const loaded = await face.load();
        document.fonts.add(loaded);
        loadedFontFacesRef.current.set(family, loaded);
      } catch {
        toast.error('Fonte enviada, mas falhou ao carregar no navegador');
      }
    }

    setSystemFonts((prev) => [{ id, family, fileUrl: proxyUrl, fileName: uploadName }, ...prev.filter((f) => f.id !== id)]);
    toast.success(`Fonte "${family}" adicionada no sistema`);
    onUpdate("fontFamily", family);
  };

  const handleRemoveSelectedFont = () => {
    const current = selected?.fontFamily;
    if (!current) return;
    if (!uploadedFamilies.has(current) && !systemFamilies.has(current)) return;

    if (uploadedFamilies.has(current)) {
      const next = uploadedFonts.filter((f) => f.family !== current);
      setUploadedFonts(next);
      localStorage.setItem(UPLOADED_FONTS_STORAGE_KEY, JSON.stringify(next));

      const face = loadedFontFacesRef.current.get(current);
      if (face) {
        try {
          document.fonts.delete(face);
        } catch {
          void 0;
        }
        loadedFontFacesRef.current.delete(current);
      }

      const fallback = fonts.find((f) => f !== current) || "Inter";
      onUpdate("fontFamily", fallback);
      toast.success(`Fonte "${current}" removida`);
      return;
    }

    const id = systemFamilyToId.get(current);
    if (!id) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        toast.error("Você precisa estar autenticado para remover fontes do sistema");
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaId: id }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(body?.error || "Falha ao remover fonte do sistema");
        return;
      }

      setSystemFonts((prev) => prev.filter((f) => f.id !== id));

      const face = loadedFontFacesRef.current.get(current);
      if (face) {
        try {
          document.fonts.delete(face);
        } catch {
          void 0;
        }
        loadedFontFacesRef.current.delete(current);
      }

      const fallback = fonts.find((f) => f !== current) || "Inter";
      onUpdate("fontFamily", fallback);
      toast.success(`Fonte "${current}" removida do sistema`);
    }).catch(() => toast.error("Falha ao remover fonte do sistema"));
  };

  if (!selected) {
    return (
      <div className="w-[360px] border-l border-border bg-card flex flex-col shrink-0 h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div className="flex flex-col items-center justify-center py-6">
              <Palette className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Selecione um objeto</p>
              <p className="text-xs text-muted-foreground/60">para editar propriedades</p>
            </div>

            <Separator />

            {/* Canvas Size */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tamanho do Canvas</Label>
              </div>

              <Select
                value={CANVAS_PRESETS.find(p => p.w === canvasWidth && p.h === canvasHeight)?.label || "Personalizado"}
                onValueChange={(label) => {
                  const preset = CANVAS_PRESETS.find(p => p.label === label);
                  if (preset && preset.w > 0) onCanvasResize(preset.w, preset.h);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANVAS_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Largura</Label>
                  <Input
                    type="number"
                    value={canvasWidth}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0 && v <= 4096) onCanvasResize(v, canvasHeight);
                    }}
                    className="h-7 text-xs"
                    min={100}
                    max={4096}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Altura</Label>
                  <Input
                    type="number"
                    value={canvasHeight}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0 && v <= 4096) onCanvasResize(canvasWidth, v);
                    }}
                    className="h-7 text-xs"
                    min={100}
                    max={4096}
                  />
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 w-full text-xs"
                  onClick={onCanvasSwapOrientation}
                >
                  <RotateCw className="h-3.5 w-3.5 mr-2" />
                  Trocar orientação (mantém proporção)
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground/60">{canvasWidth} × {canvasHeight} px</p>
            </div>

            <Separator />

            {/* Canvas background */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fundo do Canvas</Label>
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/70">Sugestões</p>
                <div className="flex flex-wrap gap-1.5">
                  {["#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#1e293b", "#0f172a", "#000000"].map((c) => (
                    <button
                      key={`suggest-${c}`}
                      className={cn(
                        "w-6 h-6 rounded-md border transition-all",
                        normalizeCanvasColor(canvasBgColor) === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => applyCanvasBg(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/70">Recentes</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentCanvasBgColors.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/60 py-1">Nenhuma cor recente</div>
                  ) : (
                    recentCanvasBgColors.map((c) => (
                      <button
                        key={`recent-${c}`}
                        className={cn(
                          "w-6 h-6 rounded-md border transition-all",
                          normalizeCanvasColor(canvasBgColor) === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                        )}
                        style={{ backgroundColor: c === "transparent" ? "transparent" : c }}
                        onClick={() => applyCanvasBg(c)}
                        title={c}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/70">Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {canvasBgPresets.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/60 py-1">Nenhuma cor salva</div>
                  ) : (
                    canvasBgPresets.map((c) => (
                      <div key={`preset-${c}`} className="relative group">
                        <button
                          className={cn(
                            "w-6 h-6 rounded-md border transition-all",
                            normalizeCanvasColor(canvasBgColor) === normalizeCanvasColor(c) ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                          )}
                          style={{ backgroundColor: c === "transparent" ? "transparent" : c }}
                          onClick={() => applyCanvasBg(c)}
                          title={c}
                        />
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeCanvasPreset(c);
                          }}
                          title="Remover preset"
                        >
                          <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={normalizeCanvasColor(canvasBgColor) === "transparent" ? "#ffffff" : canvasBgColor}
                  onChange={(e) => applyCanvasBg(e.target.value)}
                  className="h-8 flex-1 cursor-pointer"
                />
                <Button
                  type="button"
                  variant={presetsSet.has(normalizeCanvasColor(canvasBgColor) || "") ? "secondary" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleCanvasPreset(canvasBgColor)}
                  title={presetsSet.has(normalizeCanvasColor(canvasBgColor) || "") ? "Remover dos presets" : "Salvar nos presets"}
                >
                  <Star className={cn("h-4 w-4", presetsSet.has(normalizeCanvasColor(canvasBgColor) || "") && "fill-current")} />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alinhamento</Label>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Ativar Smart Guides</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">Guias automáticas ao mover</p>
                </div>
                <Checkbox
                  checked={alignmentSettings.enabled}
                  onCheckedChange={(checked) => onAlignmentSettingsChange({ enabled: !!checked })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Ativar Snap</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">Grudar automaticamente</p>
                </div>
                <Checkbox
                  checked={alignmentSettings.snapEnabled}
                  disabled={!alignmentSettings.enabled}
                  onCheckedChange={(checked) => onAlignmentSettingsChange({ snapEnabled: !!checked })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">Snap no centro</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">Centro do canvas e de objetos</p>
                  </div>
                  <Checkbox
                    checked={alignmentSettings.snapCenter}
                    disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                    onCheckedChange={(checked) => onAlignmentSettingsChange({ snapCenter: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">Snap em objetos</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">Bordas e centros de outros elementos</p>
                  </div>
                  <Checkbox
                    checked={alignmentSettings.snapObjects}
                    disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                    onCheckedChange={(checked) => onAlignmentSettingsChange({ snapObjects: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">Snap em grade</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">Arredondar para múltiplos da grade</p>
                  </div>
                  <Checkbox
                    checked={alignmentSettings.snapGrid}
                    disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                    onCheckedChange={(checked) => onAlignmentSettingsChange({ snapGrid: !!checked })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Snap (px)</Label>
                  <Input
                    type="number"
                    value={alignmentSettings.snapDistancePx}
                    disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) onAlignmentSettingsChange({ snapDistancePx: Math.min(Math.max(v, 1), 50) });
                    }}
                    className="h-7 text-xs"
                    min={1}
                    max={50}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Grade (px)</Label>
                  <Input
                    type="number"
                    value={alignmentSettings.gridSize}
                    disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled || !alignmentSettings.snapGrid}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) onAlignmentSettingsChange({ gridSize: Math.min(Math.max(v, 5), 200) });
                    }}
                    className="h-7 text-xs"
                    min={5}
                    max={200}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const isText = selected.type === "i-text" || selected.type === "text";

  return (
    <div className="w-[360px] border-l border-border bg-card flex flex-col shrink-0 h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</p>

          {/* Fill */}
          <div className="space-y-2">
            <Label className="text-xs">Preenchimento</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded border transition-all ${
                    selected.fill === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border"
                  } ${c === "transparent" ? "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" : ""}`}
                  style={c !== "transparent" ? { backgroundColor: c } : undefined}
                  onClick={() => onUpdate("fill", c)}
                  title={c === "transparent" ? "Transparente" : c}
                />
              ))}
            </div>
            <Input
              type="color"
              value={selected.fill === "transparent" ? "#000000" : selected.fill}
              onChange={(e) => onUpdate("fill", e.target.value)}
              className="h-8 w-full cursor-pointer"
            />
          </div>

          {/* Stroke */}
          <div className="space-y-2">
            <Label className="text-xs">Borda</Label>
            <Input
              type="color"
              value={selected.stroke === "transparent" ? "#000000" : selected.stroke}
              onChange={(e) => onUpdate("stroke", e.target.value)}
              className="h-8 w-full cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Espessura</Label>
              <Slider
                value={[selected.strokeWidth]}
                onValueChange={([v]) => onUpdate("strokeWidth", v)}
                min={0} max={20} step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-6 text-right">{selected.strokeWidth}</span>
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <Label className="text-xs">Opacidade</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[selected.opacity * 100]}
                onValueChange={([v]) => onUpdate("opacity", v / 100)}
                min={0} max={100} step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(selected.opacity * 100)}%</span>
            </div>
          </div>

          {/* Shadow */}
          <div className="space-y-2">
            <Label className="text-xs">Sombra</Label>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Blur</Label>
              <Slider
                value={[selected.shadowBlur || 0]}
                onValueChange={([v]) => onUpdate("shadow", v > 0 ? `rgba(0,0,0,0.3) 4px 4px ${v}px` : null)}
                min={0} max={30} step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-6 text-right">{selected.shadowBlur || 0}</span>
            </div>
          </div>

          {/* Corner Radius for Rect */}
          {(selected.type === "rect") && (
            <div className="space-y-2">
              <Label className="text-xs">Arredondamento</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selected.rx || 0]}
                  onValueChange={([v]) => { onUpdate("rx", v); onUpdate("ry", v); }}
                  min={0} max={50} step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-6 text-right">{selected.rx || 0}</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Text props */}
          {isText && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Texto</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Fonte</Label>
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/font-woff,application/font-woff2"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handleUploadFont(file).catch(() => toast.error("Falha ao carregar a fonte"));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload de fonte"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={!uploadedFamilies.has(selected.fontFamily || "") && !systemFamilies.has(selected.fontFamily || "")}
                      onClick={handleRemoveSelectedFont}
                      title="Remover fonte enviada"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant={favoriteSet.has(selected.fontFamily || "") ? "secondary" : "outline"}
                      size="icon"
                      className="h-7 w-7"
                      disabled={!selected.fontFamily}
                      onClick={() => selected.fontFamily && toggleFavoriteFont(selected.fontFamily)}
                      title={favoriteSet.has(selected.fontFamily || "") ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star className={cn("h-3.5 w-3.5", favoriteSet.has(selected.fontFamily || "") && "fill-current")} />
                    </Button>
                  </div>
                </div>
                <Popover open={fontPickerOpen} onOpenChange={setFontPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={fontPickerOpen}
                      className="w-full justify-between h-8 text-xs font-normal"
                    >
                      <span className={cn("truncate", !selected.fontFamily && "text-muted-foreground")}>
                        {selected.fontFamily || "Escolher fonte..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Pesquisar fonte..."
                        value={fontSearch}
                        onValueChange={setFontSearch}
                      />
                      <div className="flex items-center gap-2 px-2 py-2 border-b">
                        <Button
                          type="button"
                          variant={fontOnlyFavorites ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => setFontOnlyFavorites((v) => !v)}
                        >
                          <Star className={cn("h-3.5 w-3.5", fontOnlyFavorites && "fill-current")} />
                          Favoritas
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => {
                            setFontSearch("");
                            setFontOnlyFavorites(false);
                          }}
                        >
                          Limpar
                        </Button>
                      </div>
                      <CommandList>
                        {filteredFonts.length === 0 && <CommandEmpty>Nenhuma fonte encontrada.</CommandEmpty>}

                        {!fontOnlyFavorites && !fontSearch.trim() && favoriteFontsAvailable.length > 0 && (
                          <CommandGroup heading="Favoritas">
                            {favoriteFontsAvailable.map((f) => (
                              <CommandItem
                                key={`fav-${f}`}
                                value={f}
                                onSelect={() => {
                                  onUpdate("fontFamily", f);
                                  ensureFontAvailable(f).catch(() => void 0);
                                  setFontPickerOpen(false);
                                }}
                                className="text-xs"
                              >
                                <Check className={cn("mr-2 h-4 w-4", selected.fontFamily === f ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate" style={{ fontFamily: f }}>{f}</span>
                                <button
                                  type="button"
                                  className="ml-2 p-1 rounded hover:bg-accent"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFavoriteFont(f);
                                  }}
                                  title={favoriteSet.has(f) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                >
                                  <Star className={cn("h-3.5 w-3.5 text-muted-foreground", favoriteSet.has(f) && "text-primary fill-current")} />
                                </button>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}

                        <CommandGroup heading={fontOnlyFavorites ? "Favoritas" : "Fontes"}>
                          {filteredFonts.map((f) => (
                            <CommandItem
                              key={f}
                              value={f}
                              onSelect={() => {
                                onUpdate("fontFamily", f);
                                ensureFontAvailable(f).catch(() => void 0);
                                setFontPickerOpen(false);
                              }}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-4 w-4", selected.fontFamily === f ? "opacity-100" : "opacity-0")} />
                              <span className="flex-1 truncate" style={{ fontFamily: f }}>{f}</span>
                              <button
                                type="button"
                                className="ml-2 p-1 rounded hover:bg-accent"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleFavoriteFont(f);
                                }}
                                title={favoriteSet.has(f) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                              >
                                <Star className={cn("h-3.5 w-3.5 text-muted-foreground", favoriteSet.has(f) && "text-primary fill-current")} />
                              </button>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tamanho</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.fontSize || 28]}
                    onValueChange={([v]) => onUpdate("fontSize", v)}
                    min={8} max={200} step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={selected.fontSize || 28}
                    onChange={(e) => onUpdate("fontSize", parseInt(e.target.value) || 28)}
                    className="h-7 w-16 text-xs"
                  />
                </div>
              </div>

              {/* Text formatting */}
              <div className="flex gap-1">
                <Button
                  variant={selected.fontWeight === "bold" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("fontWeight", selected.fontWeight === "bold" ? "normal" : "bold")}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.fontStyle === "italic" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("fontStyle", selected.fontStyle === "italic" ? "normal" : "italic")}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.underline ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("underline", !selected.underline)}
                >
                  <Underline className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.linethrough ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("linethrough", !selected.linethrough)}
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Text alignment */}
              <div className="flex gap-1">
                <Button
                  variant={selected.textAlign === "left" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "left")}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.textAlign === "center" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "center")}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={selected.textAlign === "right" ? "secondary" : "outline"}
                  size="icon" className="h-8 w-8"
                  onClick={() => onUpdate("textAlign", "right")}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Line height */}
              <div className="space-y-2">
                <Label className="text-xs">Altura da Linha</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.lineHeight || 1.2]}
                    onValueChange={([v]) => onUpdate("lineHeight", v)}
                    min={0.5} max={3} step={0.1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{(selected.lineHeight || 1.2).toFixed(1)}</span>
                </div>
              </div>

              {/* Char spacing */}
              <div className="space-y-2">
                <Label className="text-xs">Espaçamento</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[selected.charSpacing || 0]}
                    onValueChange={([v]) => onUpdate("charSpacing", v)}
                    min={-100} max={500} step={10}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{selected.charSpacing || 0}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Position & Size */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posição</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">X</Label>
                <Input
                  type="number"
                  value={Math.round(selected.left || 0)}
                  onChange={(e) => onUpdate("left", parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Y</Label>
                <Input
                  type="number"
                  value={Math.round(selected.top || 0)}
                  onChange={(e) => onUpdate("top", parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Rotação</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selected.angle || 0]}
                  onValueChange={([v]) => onUpdate("angle", v)}
                  min={0} max={360} step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(selected.angle || 0)}°</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alinhamento</Label>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">Ativar Smart Guides</p>
                <p className="text-[10px] text-muted-foreground/70 truncate">Guias automáticas ao mover</p>
              </div>
              <Checkbox
                checked={alignmentSettings.enabled}
                onCheckedChange={(checked) => onAlignmentSettingsChange({ enabled: !!checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">Ativar Snap</p>
                <p className="text-[10px] text-muted-foreground/70 truncate">Grudar automaticamente</p>
              </div>
              <Checkbox
                checked={alignmentSettings.snapEnabled}
                disabled={!alignmentSettings.enabled}
                onCheckedChange={(checked) => onAlignmentSettingsChange({ snapEnabled: !!checked })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Snap no centro</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">Centro do canvas e de objetos</p>
                </div>
                <Checkbox
                  checked={alignmentSettings.snapCenter}
                  disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                  onCheckedChange={(checked) => onAlignmentSettingsChange({ snapCenter: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Snap em objetos</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">Bordas e centros de outros elementos</p>
                </div>
                <Checkbox
                  checked={alignmentSettings.snapObjects}
                  disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                  onCheckedChange={(checked) => onAlignmentSettingsChange({ snapObjects: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">Snap em grade</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">Arredondar para múltiplos da grade</p>
                </div>
                <Checkbox
                  checked={alignmentSettings.snapGrid}
                  disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                  onCheckedChange={(checked) => onAlignmentSettingsChange({ snapGrid: !!checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Snap (px)</Label>
                <Input
                  type="number"
                  value={alignmentSettings.snapDistancePx}
                  disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onAlignmentSettingsChange({ snapDistancePx: Math.min(Math.max(v, 1), 50) });
                  }}
                  className="h-7 text-xs"
                  min={1}
                  max={50}
                />
              </div>
              <div>
                <Label className="text-[10px]">Grade (px)</Label>
                <Input
                  type="number"
                  value={alignmentSettings.gridSize}
                  disabled={!alignmentSettings.enabled || !alignmentSettings.snapEnabled || !alignmentSettings.snapGrid}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onAlignmentSettingsChange({ gridSize: Math.min(Math.max(v, 5), 200) });
                  }}
                  className="h-7 text-xs"
                  min={5}
                  max={200}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
