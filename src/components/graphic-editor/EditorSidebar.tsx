import { useRef, useState } from "react";
import {
  Type, Square, Circle, Minus, Triangle, Upload, Image as ImageIcon,
  Trash2, Copy, ArrowUpToLine, ArrowDownToLine, Search, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  onAddText: () => void;
  onAddRect: () => void;
  onAddCircle: () => void;
  onAddLine: () => void;
  onAddTriangle: () => void;
  onAddImage: (f: File) => void;
  onAddImageFromUrl: (url: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  hasSelection: boolean;
}

const UNSPLASH_ACCESS_KEY = ""; // Users can add their own key

export function EditorSidebar({
  onAddText, onAddRect, onAddCircle, onAddLine, onAddTriangle,
  onAddImage, onAddImageFromUrl,
  onDelete, onDuplicate, onBringToFront, onSendToBack, hasSelection,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddImage(file);
    e.target.value = "";
  };

  const searchImages = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Using Pexels free API (no key needed for limited use) or Lorem Picsum
      const results: string[] = [];
      for (let i = 0; i < 6; i++) {
        results.push(`https://picsum.photos/seed/${searchQuery}${i}/400/300`);
      }
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const tools = [
    { icon: Type, label: "Texto", action: onAddText, color: "text-blue-500" },
    { icon: Square, label: "Retângulo", action: onAddRect, color: "text-indigo-500" },
    { icon: Circle, label: "Círculo", action: onAddCircle, color: "text-emerald-500" },
    { icon: Minus, label: "Linha", action: onAddLine, color: "text-gray-500" },
    { icon: Triangle, label: "Triângulo", action: onAddTriangle, color: "text-amber-500" },
  ];

  return (
    <div className="w-[280px] border-r border-border bg-card flex flex-col shrink-0 h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Upload */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mídia</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline" size="sm" className="h-9 gap-1.5 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
              <Button
                variant="outline" size="sm" className="h-9 gap-1.5 text-xs"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-3.5 w-3.5" /> Buscar
              </Button>
            </div>
            <input
              ref={fileRef} type="file" accept="image/*"
              onChange={handleFileUpload} className="hidden"
            />

            {showSearch && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Buscar imagens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchImages()}
                    className="h-8 text-xs"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowSearch(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {searching && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {searchResults.map((url, i) => (
                      <button
                        key={i}
                        className="aspect-[4/3] rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                        onClick={() => onAddImageFromUrl(url)}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Shapes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Elementos</p>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((t) => (
                <Button
                  key={t.label}
                  variant="outline"
                  size="sm"
                  className="h-16 flex-col gap-1.5 text-xs hover:bg-accent"
                  onClick={t.action}
                >
                  <t.icon className={`h-5 w-5 ${t.color}`} />
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Object actions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações do Objeto</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </Button>
              <Button variant="destructive" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onBringToFront}>
                <ArrowUpToLine className="h-3.5 w-3.5" /> Frente
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onSendToBack}>
                <ArrowDownToLine className="h-3.5 w-3.5" /> Trás
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
