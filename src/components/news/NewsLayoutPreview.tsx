import { NewsArticle } from "@/hooks/useNews";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  articles: NewsArticle[];
  category: string;
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
export function LayoutHeroSidebar({ articles, category }: LayoutProps) {
  const hero = articles[0];
  const side = articles.slice(1, 5);
  if (!hero) return <EmptyState />;

  return (
    <div className="aspect-video bg-black text-white rounded-lg overflow-hidden flex flex-col">
      <LayoutHeader category={category} />
      <div className="flex-1 flex min-h-0">
        {/* Hero */}
        <div className="flex-[3] relative overflow-hidden">
          <ArticleImage url={hero.image_url} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{hero.category}</span>
            <h2 className="text-sm md:text-base font-bold leading-tight line-clamp-3">{hero.title}</h2>
            <p className="text-[10px] text-white/60 line-clamp-2">{hero.description}</p>
          </div>
        </div>
        {/* Sidebar */}
        <div className="flex-[2] flex flex-col border-l border-white/10 min-w-0">
          {side.map((a, i) => (
            <div key={a.id} className={cn("flex-1 flex gap-2 p-2 min-h-0", i > 0 && "border-t border-white/10")}>
              <ArticleImage url={a.image_url} className="w-16 h-full rounded shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-[8px] text-blue-400 uppercase">{a.category}</span>
                <h3 className="text-[10px] font-semibold leading-tight line-clamp-2">{a.title}</h3>
                <span className="text-[8px] text-white/40 mt-auto">{a.source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━ LAYOUT 2: Grade de Cards ━━━
export function LayoutGrid({ articles, category }: LayoutProps) {
  const items = articles.slice(0, 6);
  if (items.length === 0) return <EmptyState />;

  return (
    <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg overflow-hidden flex flex-col">
      <LayoutHeader category={category} />
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 p-3 min-h-0">
        {items.map((a) => (
          <div key={a.id} className="relative rounded-lg overflow-hidden group">
            <ArticleImage url={a.image_url} className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <span className="text-[8px] uppercase text-emerald-400 font-semibold">{a.category}</span>
              <h3 className="text-[9px] font-bold leading-tight line-clamp-2 mt-0.5">{a.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━ LAYOUT 3: Ticker / Lista Horizontal ━━━
export function LayoutTicker({ articles, category }: LayoutProps) {
  const hero = articles[0];
  const ticker = articles.slice(1, 4);
  if (!hero) return <EmptyState />;

  return (
    <div className="aspect-video bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-lg overflow-hidden flex flex-col">
      <LayoutHeader category={category} variant="accent" />
      {/* Main content */}
      <div className="flex-1 flex items-stretch min-h-0">
        <div className="flex-1 relative overflow-hidden">
          <ArticleImage url={hero.image_url} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">{hero.category}</span>
            <h2 className="text-sm md:text-lg font-extrabold leading-tight line-clamp-3">{hero.title}</h2>
            <p className="text-[10px] text-white/60 line-clamp-2">{hero.description}</p>
          </div>
        </div>
      </div>
      {/* Bottom ticker */}
      <div className="h-16 bg-black/60 backdrop-blur-sm border-t border-white/10 flex items-stretch divide-x divide-white/10">
        {ticker.map((a) => (
          <div key={a.id} className="flex-1 flex items-center gap-2 px-3 min-w-0">
            <ArticleImage url={a.image_url} className="w-10 h-10 rounded shrink-0" />
            <div className="min-w-0">
              <h3 className="text-[9px] font-semibold leading-tight line-clamp-2">{a.title}</h3>
              <span className="text-[8px] text-white/40">{a.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━ LAYOUT 4: Minimalista / Clean ━━━
export function LayoutMinimal({ articles, category }: LayoutProps) {
  const items = articles.slice(0, 4);
  if (items.length === 0) return <EmptyState />;

  return (
    <div className="aspect-video bg-white text-slate-900 rounded-lg overflow-hidden flex flex-col shadow-inner">
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
          <div key={a.id} className="flex-1 flex items-center gap-4 px-5 min-h-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold text-red-500 uppercase">{a.category}</span>
                <span className="text-[9px] text-slate-400">{a.source}</span>
              </div>
              <h3 className="text-xs font-semibold leading-tight line-clamp-2">{a.title}</h3>
              {i === 0 && <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{a.description}</p>}
            </div>
            <ArticleImage url={a.image_url} className="w-20 h-14 rounded-lg shrink-0" />
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
    <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground">
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

export function NewsLayoutRenderer({ layoutId, articles, category }: { layoutId: NewsLayoutId; articles: NewsArticle[]; category: string }) {
  switch (layoutId) {
    case "hero-sidebar": return <LayoutHeroSidebar articles={articles} category={category} />;
    case "grid": return <LayoutGrid articles={articles} category={category} />;
    case "ticker": return <LayoutTicker articles={articles} category={category} />;
    case "minimal": return <LayoutMinimal articles={articles} category={category} />;
    default: return <LayoutHeroSidebar articles={articles} category={category} />;
  }
}
