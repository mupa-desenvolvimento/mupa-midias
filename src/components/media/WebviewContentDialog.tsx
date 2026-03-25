import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { generateWebviewThumbnail, dataUrlToBlob } from "@/utils/webviewThumbnail";

interface WebviewContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  folderId?: string | null;
}

export function WebviewContentDialog({ open, onOpenChange, onSuccess, folderId }: WebviewContentDialogProps) {
  const { toast } = useToast();
  const { tenantId } = useUserTenant();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [duration, setDuration] = useState(15);
  const [isSaving, setIsSaving] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setUrl("");
    setThumbnailUrl("");
    setDuration(15);
    setPreviewDataUrl(null);
  };

  // Generate preview when URL changes
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    try {
      new URL(newUrl);
      setPreviewDataUrl(generateWebviewThumbnail(newUrl));
    } catch {
      setPreviewDataUrl(null);
    }
  };

  const uploadThumbnail = async (webviewUrl: string): Promise<string | null> => {
    try {
      const dataUrl = generateWebviewThumbnail(webviewUrl);
      const blob = dataUrlToBlob(dataUrl);
      const fileName = `webview-thumb-${Date.now()}.png`;
      const filePath = `thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, blob, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.warn("Thumbnail upload failed, using inline:", uploadError);
        return dataUrl; // fallback to data URL
      }

      const { data: publicData } = supabase.storage.from("media").getPublicUrl(filePath);
      return publicData?.publicUrl || dataUrl;
    } catch (err) {
      console.warn("Thumbnail generation failed:", err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      toast({ title: "Preencha o nome e a URL", variant: "destructive" });
      return;
    }

    try {
      new URL(url);
    } catch {
      toast({ title: "URL inválida", description: "Informe uma URL válida (ex: https://exemplo.com)", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // Use custom thumbnail if provided, otherwise auto-generate
      let finalThumbnail = thumbnailUrl.trim() || null;
      if (!finalThumbnail) {
        finalThumbnail = await uploadThumbnail(url.trim());
      }

      const { error } = await supabase.from("media_items").insert({
        name: name.trim(),
        type: "webview",
        file_url: url.trim(),
        thumbnail_url: finalThumbnail,
        duration,
        status: "active",
        folder_id: folderId || null,
        tenant_id: tenantId || null,
        metadata: {
          webview_url: url.trim(),
          thumbnail_url: finalThumbnail,
        },
      });

      if (error) throw error;

      toast({ title: "Conteúdo WebView adicionado com sucesso" });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error saving webview content:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const showPreview = thumbnailUrl || previewDataUrl;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Adicionar Conteúdo WebView
          </DialogTitle>
          <DialogDescription>
            Insira uma URL de página web para exibir como conteúdo no player.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="webview-name">Nome do conteúdo</Label>
            <Input
              id="webview-name"
              placeholder="Ex: Página promocional"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webview-url">URL da página</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="webview-url"
                placeholder="https://exemplo.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Auto-generated or custom thumbnail preview */}
          {showPreview && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {thumbnailUrl ? "Thumbnail customizada" : "Thumbnail auto-gerada"}
              </Label>
              <div className="rounded-md overflow-hidden border bg-muted/30 aspect-video flex items-center justify-center">
                <img
                  src={thumbnailUrl || previewDataUrl!}
                  alt="Thumbnail preview"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="webview-thumbnail" className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              Thumbnail personalizada (opcional)
            </Label>
            <Input
              id="webview-thumbnail"
              placeholder="https://exemplo.com/imagem.jpg"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webview-duration">Duração (segundos)</Label>
            <Input
              id="webview-duration"
              type="number"
              min={5}
              max={300}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
