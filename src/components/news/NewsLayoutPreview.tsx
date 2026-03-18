import { NewsArticle } from "@/hooks/useNews";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
// @ts-ignore - JSX component type mismatch
import QRCode from "react-qr-code";

function decodeHtmlEntities(input: string) {
  if (!input) return "";
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
  };

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_m, raw) => {
    const key = String(raw);
    if (key[0] === "#") {
      const isHex = key[1]?.toLowerCase() === "x";
      const num = isHex ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      if (!Number.isFinite(num) || num <= 0) return "";
      try {
        return String.fromCodePoint(num);
      } catch {
        return "";
      }
    }
    const lower = key.toLowerCase();
    return named[lower] ?? `&${key};`;
  });
}

function maybeFixMojibake(input: string) {
  if (!input) return "";
  if (!/(Ã.|Â.)/.test(input)) return input;

  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;

  let decoded = "";
  try {
    decoded = new TextDecoder("utf-8").decode(bytes);
  } catch {
    return input;
  }

  const score = (s: string) => (s.match(/[ÃÂ]/g)?.length ?? 0) + (s.match(/\uFFFD/g)?.length ?? 0);
  return score(decoded) < score(input) ? decoded : input;
}

function normalizeDisplayText(input: string | null | undefined) {
  const base = (input || "").toString();
  const decoded = decodeHtmlEntities(base);
  const fixed = maybeFixMojibake(decoded);
  return fixed.replace(/\s+/g, " ").trim();
}

function ArticleQR({ url, size = 48 }: { url?: string | null; size?: number }) {
  if (!url) return null;
  return (
    <div className="bg-white p-1 rounded shrink-0" style={{ width: size + 8, height: size + 8 }}>
      <QRCode value={url} size={size} level="L" />
    </div>
  );
}

interface LayoutProps {
  articles: NewsArticle[];
  category: string;
  isPortrait?: boolean;
}

function ArticleImage({ url, className }: { url?: string; className?: string }) {
  if (!url) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <Newspaper className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("object-cover", className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ━━━ LAYOUT 1: Destaque Principal (hero + sidebar) ━━━
export function LayoutHeroSidebar({ articles, category, isPortrait }: LayoutProps) {
  const hero = articles[0];
  const side = articles.slice(1, 5);
  if (!hero) return <EmptyState />;

  const heroCategory = normalizeDisplayText(hero.category).toUpperCase();
  const heroTitle = normalizeDisplayText(hero.title);
  const heroDescription = normalizeDisplayText(hero.description);

  return (
    <div className="w-full h-full bg-black text-white overflow-hidden flex flex-col min-h-0">
      <LayoutHeader category={category} />
      <div className={cn("flex-1 flex min-h-0", isPortrait ? "flex-col" : "flex-row")}>
        {/* Hero */}
        <div className={cn("relative overflow-hidden", isPortrait ? "flex-[2]" : "flex-[3]")}>
          <ArticleImage url={hero.image_url} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{heroCategory}</span>
            <h2 className={cn("font-bold leading-tight line-clamp-3", isPortrait ? "text-lg" : "text-sm md:text-base")}>{heroTitle}</h2>
            <p className={cn("text-white/60 line-clamp-2", isPortrait ? "text-xs" : "text-[10px]")}>{heroDescription}</p>
          </div>
          <div className="absolute bottom-3 right-3">
            <ArticleQR url={hero.link} size={40} />
          </div>
        </div>
        {/* Sidebar */}
        <div className={cn(
          "flex min-w-0",
          isPortrait 
            ? "flex-[3] flex-col border-t border-white/10" 
            : "flex-[2] flex-col border-l border-white/10"
        )}>
          {side.map((a, i) => (
            <div key={a.id} className={cn("flex-1 flex gap-2 p-2 min-h-0", i > 0 && "border-t border-white/10")}>
              <ArticleImage url={a.image_url} className={cn("rounded shrink-0", isPortrait ? "w-20 h-full" : "w-16 h-full")} />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-[8px] text-blue-400 uppercase">{normalizeDisplayText(a.category).toUpperCase()}</span>
                <h3 className={cn("font-semibold leading-tight line-clamp-2", isPortrait ? "text-xs" : "text-[10px]")}>{normalizeDisplayText(a.title)}</h3>
                <span className="text-[8px] text-white/40 mt-auto">{normalizeDisplayText(a.source)}</span>
              </div>
              <ArticleQR url={a.link} size={28} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━ LAYOUT 2: Grade de Cards ━━━
export function LayoutGrid({ articles, category, isPortrait }: LayoutProps) {
  const items = articles.slice(0, 6);
  if (items.length === 0) return <EmptyState />;

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden flex flex-col min-h-0">
      <LayoutHeader category={category} />
      <div className={cn(
        "flex-1 grid gap-2 p-3 min-h-0",
        isPortrait ? "grid-cols-2 grid-rows-3" : "grid-cols-3 grid-rows-2"
      )}>
        {items.map((a) => (
          <div key={a.id} className="relative rounded-lg overflow-hidden group">
            <ArticleImage url={a.image_url} className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute top-1 right-1">
              <ArticleQR url={a.link} size={24} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <span className="text-[8px] uppercase text-emerald-400 font-semibold">{normalizeDisplayText(a.category).toUpperCase()}</span>
              <h3 className={cn("font-bold leading-tight line-clamp-2 mt-0.5", isPortrait ? "text-[10px]" : "text-[9px]")}>{normalizeDisplayText(a.title)}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━ LAYOUT 3: Ticker / Lista Horizontal ━━━
export function LayoutTicker({ articles, category, isPortrait }: LayoutProps) {
  const hero = articles[0];
  const ticker = articles.slice(1, 4);
  if (!hero) return <EmptyState />;

  const heroCategory = normalizeDisplayText(hero.category).toUpperCase();
  const heroTitle = normalizeDisplayText(hero.title);
  const heroDescription = normalizeDisplayText(hero.description);

  return (
    <div className="w-full h-full bg-gradient-to-br from-indigo-950 to-slate-900 text-white overflow-hidden flex flex-col min-h-0">
      <LayoutHeader category={category} variant="accent" />
      {/* Main content */}
      <div className="flex-1 flex items-stretch min-h-0">
        <div className="flex-1 relative overflow-hidden">
          <ArticleImage url={hero.image_url} className="absolute inset-0 w-full h-full" />
          <div className={cn("absolute inset-0", isPortrait ? "bg-gradient-to-t from-black/70 via-black/30 to-transparent" : "bg-gradient-to-r from-black/70 via-black/30 to-transparent")} />
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">{heroCategory}</span>
            <h2 className={cn("font-extrabold leading-tight line-clamp-3", isPortrait ? "text-lg" : "text-sm md:text-lg")}>{heroTitle}</h2>
            <p className={cn("text-white/60 line-clamp-2", isPortrait ? "text-xs" : "text-[10px]")}>{heroDescription}</p>
          </div>
          <div className="absolute bottom-3 right-3">
            <ArticleQR url={hero.link} size={40} />
          </div>
        </div>
      </div>
      {/* Bottom ticker */}
      <div className={cn(
        "bg-black/60 backdrop-blur-sm border-t border-white/10",
        isPortrait ? "flex flex-col divide-y divide-white/10" : "h-16 flex items-stretch divide-x divide-white/10"
      )}>
        {ticker.map((a) => (
          <div key={a.id} className={cn("flex items-center gap-2 px-3 min-w-0", isPortrait ? "py-2" : "flex-1")}>
            <ArticleImage url={a.image_url} className="w-10 h-10 rounded shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[9px] font-semibold leading-tight line-clamp-2">{normalizeDisplayText(a.title)}</h3>
              <span className="text-[8px] text-white/40">{normalizeDisplayText(a.source)}</span>
            </div>
            <ArticleQR url={a.link} size={28} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━ LAYOUT 4: Minimalista / Clean ━━━
export function LayoutMinimal({ articles, category, isPortrait }: LayoutProps) {
  const items = articles.slice(0, isPortrait ? 6 : 4);
  if (items.length === 0) return <EmptyState />;

  return (
    <div className="w-full h-full bg-white text-slate-900 overflow-hidden flex flex-col shadow-inner min-h-0">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 bg-red-500 rounded-full" />
          <span className="font-bold text-sm tracking-tight">
            Notícias {category !== "all" && `• ${category}`}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          {format(new Date(), "HH:mm • dd MMM", { locale: ptBR })}
        </span>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-slate-100 overflow-hidden">
        {items.map((a, i) => (
          <div key={a.id} className={cn("flex-1 flex items-center gap-4 px-5 min-h-0", isPortrait && "flex-row-reverse")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold text-red-500 uppercase">{normalizeDisplayText(a.category).toUpperCase()}</span>
                <span className="text-[9px] text-slate-400">{normalizeDisplayText(a.source)}</span>
              </div>
              <h3 className={cn("font-semibold leading-tight line-clamp-2", isPortrait ? "text-sm" : "text-xs")}>{normalizeDisplayText(a.title)}</h3>
              {i === 0 && <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{normalizeDisplayText(a.description)}</p>}
            </div>
            <ArticleImage url={a.image_url} className={cn("rounded-lg shrink-0", isPortrait ? "w-24 h-16" : "w-20 h-14")} />
            <ArticleQR url={a.link} size={32} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━ Shared components ━━━

function LayoutHeader({ category, variant }: { category: string; variant?: "accent" }) {
  return (
    <div className={cn(
      "px-4 py-2 flex items-center justify-between shrink-0",
      variant === "accent" 
        ? "bg-gradient-to-r from-amber-500 to-orange-500" 
        : "bg-white/5 backdrop-blur-sm border-b border-white/10"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full animate-pulse", variant === "accent" ? "bg-white" : "bg-red-500")} />
        <span className={cn(
          "font-bold text-[11px] tracking-wider uppercase",
          variant === "accent" ? "text-white" : "text-white/90"
        )}>
          Notícias {category !== "all" ? `• ${category}` : ""}
        </span>
      </div>
      <span className={cn("text-[10px]", variant === "accent" ? "text-white/70" : "text-white/40")}>
        {format(new Date(), "HH:mm • dd MMM", { locale: ptBR })}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
      <Newspaper className="h-10 w-10 mb-2 opacity-30" />
      <p className="text-sm font-medium">Sem notícias para exibir</p>
      <p className="text-xs">Clique em "Atualizar" para coletar</p>
    </div>
  );
}

export const NEWS_LAYOUTS = [
  { id: "hero-sidebar", label: "Destaque", description: "Notícia principal + lista lateral" },
  { id: "grid", label: "Grade", description: "Cards em grade 3x2" },
  { id: "ticker", label: "Ticker", description: "Destaque + barra inferior" },
  { id: "minimal", label: "Minimalista", description: "Layout limpo e claro" },
] as const;

export type NewsLayoutId = typeof NEWS_LAYOUTS[number]["id"];

export function NewsLayoutRenderer({ layoutId, articles, category, isPortrait = false }: { layoutId: NewsLayoutId; articles: NewsArticle[]; category: string; isPortrait?: boolean }) {
  switch (layoutId) {
    case "hero-sidebar": return <LayoutHeroSidebar articles={articles} category={category} isPortrait={isPortrait} />;
    case "grid": return <LayoutGrid articles={articles} category={category} isPortrait={isPortrait} />;
    case "ticker": return <LayoutTicker articles={articles} category={category} isPortrait={isPortrait} />;
    case "minimal": return <LayoutMinimal articles={articles} category={category} isPortrait={isPortrait} />;
    default: return <LayoutHeroSidebar articles={articles} category={category} isPortrait={isPortrait} />;
  }
}
