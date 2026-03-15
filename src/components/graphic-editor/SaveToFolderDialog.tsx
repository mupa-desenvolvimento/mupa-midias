import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder as FolderIcon, FolderPlus, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { useFolders, type Folder } from "@/hooks/useFolders";

interface Props {
  open: boolean;
  onClose: () => void;
  projectName: string;
  onSave: (folderId: string | null, fileName: string) => Promise<void>;
}

export function SaveToFolderDialog({ open, onClose, projectName, onSave }: Props) {
  const { folders, isLoading, createFolder } = useFolders(null, { fetchAll: true });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [fileName, setFileName] = useState(projectName);
  const [saving, setSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedFolderId, fileName || projectName);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const result = await createFolder.mutateAsync({ name: newFolderName.trim() });
      setSelectedFolderId(result.id);
      setShowNewFolder(false);
      setNewFolderName("");
    } catch {
      return;
    }
  };

  // Organize: root folders only for simplicity
  const rootFolders = folders.filter((f) => !f.parent_id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Salvar na Galeria
          </DialogTitle>
          <DialogDescription>
            Escolha uma pasta para salvar sua criação como mídia
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File name */}
          <div className="space-y-2">
            <Label className="text-xs">Nome do arquivo</Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nome do arquivo"
              className="h-9"
            />
          </div>

          {/* Folder selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pasta de destino</Label>
              <Button
                variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => setShowNewFolder(!showNewFolder)}
              >
                <FolderPlus className="h-3 w-3" /> Nova pasta
              </Button>
            </div>

            {showNewFolder && (
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta"
                  className="h-8 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleCreateFolder} disabled={createFolder.isPending}>
                  Criar
                </Button>
              </div>
            )}

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {/* Root option */}
                <button
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolderId === null
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedFolderId(null)}
                >
                  <FolderIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate">Raiz (sem pasta)</span>
                  {selectedFolderId === null && <Check className="h-4 w-4 shrink-0" />}
                </button>

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  rootFolders.map((folder) => (
                    <button
                      key={folder.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedFolderId === folder.id
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <FolderIcon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{folder.name}</span>
                      {selectedFolderId === folder.id && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
              </>
            ) : (
              "Salvar na Galeria"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
