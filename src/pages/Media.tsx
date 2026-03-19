import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useTenantLicense } from "@/hooks/useTenantLicense";
import { FolderPlus, ChevronLeft, ChevronRight, Folder as FolderIcon, HardDrive, Plus, Image as ImageIcon, Video, Clock, Grid2x2, Loader2, Play, Eye, MoreVertical, Pencil, Trash2, LayoutGrid, LayoutList, AlertTriangle, Upload, Filter, SortAsc, SortDesc, Globe } from "lucide-react";
import { useFolders, Folder as FolderType } from "@/hooks/useFolders";
import { FolderSidebar } from "@/components/media/FolderSidebar";
import { DraggableMediaWrapper } from "@/components/media/DraggableMediaWrapper";
import { DraggableMediaRow } from "@/components/media/DraggableMediaRow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMediaItems, MediaItem } from "@/hooks/useMediaItems";
import { MediaUploadDialog } from "@/components/media/MediaUploadDialog";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { MediaEditDialog } from "@/components/media/MediaEditDialog";
import { MediaDeleteDialog } from "@/components/media/MediaDeleteDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const Media = () => {
  const { toast } = useToast();
  const { isLite } = useTenantLicense();
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  
  // New state for view mode and selection
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Filter and Sort state
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "size">("newest");

  // Folder state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{id: string, name: string}[]>([]);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [activeDragItem, setActiveDragItem] = useState<MediaItem | null>(null);

  const { folders, createFolder, deleteFolder, renameFolder } = useFolders(currentFolderId);
  const { mediaItems, isLoading: loadingMedia, updateMediaItem, deleteMediaItem, moveMediaItem, moveMediaItems, refetch } = useMediaItems(currentFolderId);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'media') {
      const media = event.active.data.current.media;
      setActiveDragItem(media);

      // Logic for selection during drag
      // If dragging an item that is NOT in the selection, clear selection and select ONLY the dragged item
      // This mimics standard OS file manager behavior
      if (!selectedMediaIds.has(media.id)) {
        setSelectedMediaIds(new Set([media.id]));
      }
      // If dragging an item that IS in the selection, keep the selection (allows dragging the group)
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Determine target folder ID
    let targetFolderId: string | null = null;
    
    if (overId === 'root') {
        targetFolderId = null;
    } else if (over.data.current?.type === 'folder') {
        targetFolderId = overId;
    } else {
        // Dropped somewhere else (not a folder)
        return;
    }

    // Check if dragging a media item
    if (active.data.current?.type === 'media') {
        // If multiple items are selected AND the dragged item is one of them
        if (selectedMediaIds.has(activeId) && selectedMediaIds.size > 1) {
             // Move all selected items using bulk mutation
             moveMediaItems.mutate({ 
               mediaIds: Array.from(selectedMediaIds), 
               folderId: targetFolderId 
             });
             
             // Clear selection after move to avoid confusion
             setSelectedMediaIds(new Set());
             toast({ title: `${selectedMediaIds.size} itens movidos com sucesso` });
        } else {
             // Move single item
             moveMediaItem.mutate({ mediaId: activeId, folderId: targetFolderId });
        }
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate({
      name: newFolderName,
      parent_id: currentFolderId
    }, {
      onSuccess: () => {
        setCreateFolderOpen(false);
        setNewFolderName("");
      }
    });
  };

  const navigateUp = () => {
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length-1].id : null);
  };
  
  const queryClient = useQueryClient();

  const filteredMedia = mediaItems.filter(media => {
    const matchesSearch = media.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || media.type === filterType;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return (b.file_size || 0) - (a.file_size || 0);
    return 0;
  });

  // Calculate total storage
  const totalStorageBytes = mediaItems.reduce((acc, item) => acc + (item.file_size || 0), 0);
  const totalStorageMB = (totalStorageBytes / (1024 * 1024)).toFixed(1);
  const storageLimitMB = 5120; // 5GB default limit
  const storagePercentage = Math.min((parseFloat(totalStorageMB) / storageLimitMB) * 100, 100);

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedMediaIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMediaIds(newSet);
  };

  const toggleAllSelection = () => {
    if (selectedMediaIds.size === filteredMedia.length) {
      setSelectedMediaIds(new Set());
    } else {
      setSelectedMediaIds(new Set(filteredMedia.map(m => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const promises = Array.from(selectedMediaIds).map(id => deleteMediaItem.mutateAsync(id));
      await Promise.all(promises);
      setSelectedMediaIds(new Set());
      setBulkDeleteDialogOpen(false);
      toast({ title: "Mídias excluídas com sucesso" });
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast({ title: "Erro ao excluir mídias", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "active": return "default";
      case "draft": return "secondary";
      case "scheduled": return "outline";
      case "processing": return "outline";
      default: return "destructive";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativo";
      case "draft": return "Rascunho";
      case "scheduled": return "Agendado";
      case "inactive": return "Inativo";
      case "processing": return "Processando";
      default: return status;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleEdit = (media: MediaItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedMedia(media);
    setEditDialogOpen(true);
  };

  const handleDelete = (media: MediaItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedMedia(media);
    setDeleteDialogOpen(true);
  };

  const handleSaveMedia = async (id: string, updates: { name: string; status: string; duration?: number }) => {
    await updateMediaItem.mutateAsync({ id, ...updates });
  };

  const handleConfirmDelete = async (id: string) => {
    await deleteMediaItem.mutateAsync(id);
  };

  const isLoading = loadingMedia;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-140px)] gap-4 animate-fade-in">
        {/* Sidebar */}
        <FolderSidebar 
          currentFolderId={currentFolderId}
          onSelectFolder={(folder, path) => {
            setCurrentFolderId(folder ? folder.id : null);
            setFolderPath(path);
          }}
          className="w-64 shrink-0 rounded-lg border bg-card/50"
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
            {/* Storage Warning - hidden for Lite plans */}
            {!isLite && (
              <Alert className="bg-red-50 border-red-200 shadow-sm shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-semibold ml-2">Atenção</AlertTitle>
                <AlertDescription className="text-red-700 ml-2">
                  Mídias não utilizadas por mais de 30 dias serão removidas automaticamente do sistema.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-4 shrink-0">
            {/* Navigation and Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-2 overflow-hidden w-full md:w-auto">
                {currentFolderId && (
                  <Button variant="ghost" onClick={navigateUp} className="mr-2 shrink-0">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Button>
                )}
                <div className="flex items-center text-sm font-medium overflow-x-auto no-scrollbar whitespace-nowrap">
                    <span 
                      className={`flex items-center hover:bg-accent px-2 py-1 rounded cursor-pointer ${!currentFolderId ? "font-bold text-foreground" : "text-muted-foreground"}`}
                      onClick={() => {
                        setCurrentFolderId(null);
                        setFolderPath([]);
                      }}
                    >
                      <HardDrive className="w-4 h-4 mr-1" />
                      Raiz
                    </span>
                    {folderPath.map((folder, index) => (
                      <span key={folder.id} className="flex items-center">
                        <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground shrink-0" />
                        <span 
                          className={`hover:bg-accent px-2 py-1 rounded cursor-pointer ${index === folderPath.length - 1 ? "font-bold text-foreground" : "text-muted-foreground"}`}
                          onClick={() => {
                            const newPath = folderPath.slice(0, index + 1);
                            setFolderPath(newPath);
                            setCurrentFolderId(folder.id);
                          }}
                        >
                          {folder.name}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Nova Pasta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Nova Pasta</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="name">Nome da Pasta</Label>
                      <Input 
                        id="name" 
                        value={newFolderName} 
                        onChange={(e) => setNewFolderName(e.target.value)} 
                        placeholder="Nome da pasta"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateFolder}>Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Mídia
                </Button>
              </div>
            </div>
          </div>

          <MediaUploadDialog 
            open={uploadDialogOpen} 
            onOpenChange={setUploadDialogOpen}
            onSuccess={() => {
              refetch();
              toast({ title: "Mídia enviada com sucesso" });
            }}
            folderId={currentFolderId}
          />

          <MediaLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            mediaItems={filteredMedia}
            initialIndex={lightboxIndex}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <MediaEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            media={selectedMedia}
            onSave={handleSaveMedia}
          />

          <MediaDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            media={selectedMedia}
            onConfirm={handleConfirmDelete}
          />

          <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir mídias selecionadas</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir {selectedMediaIds.size} itens selecionados?
                  <br />
                  Esta ação não pode ser desfeita e os arquivos serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleBulkDelete();
                  }}
                  disabled={isBulkDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir Selecionados
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
                  <div className="flex items-center space-x-2 w-full md:w-auto">
                    <Input
                      placeholder="Buscar mídias..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm w-full"
                    />
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0">
                          <Filter className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuLabel>Filtrar por Tipo</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                          <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="image">Imagens</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="video">Vídeos</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                          <DropdownMenuRadioItem value="newest">Mais Recentes</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="oldest">Mais Antigos</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="name">Nome (A-Z)</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="size">Tamanho</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                  <div className="flex flex-col gap-1 w-32 md:w-48">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Uso: {totalStorageMB} MB</span>
                      <span>{storagePercentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={storagePercentage} className="h-2" />
                  </div>

                  {selectedMediaIds.size > 0 && (
                    <div className="flex items-center gap-2">
                       {selectedMediaIds.size === 1 && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const id = Array.from(selectedMediaIds)[0];
                            const item = mediaItems.find(m => m.id === id);
                            if (item) handleEdit(item);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir ({selectedMediaIds.size})
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center border rounded-md bg-background">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-9 w-9 rounded-r-none"
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-9 w-9 rounded-l-none"
                      onClick={() => setViewMode("list")}
                    >
                      <LayoutList className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {filteredMedia.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma mídia encontrada</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      {searchTerm 
                        ? "Nenhuma mídia corresponde à sua busca."
                        : "Faça upload da sua primeira mídia para começar."}
                    </p>
                  </CardContent>
                </Card>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-10">
                  {filteredMedia.map((media, index) => {
                    const thumbnailUrl = media.thumbnail_url || media.file_url;
                    const isSelected = selectedMediaIds.has(media.id);
                    
                    const openLightbox = () => {
                      if (selectedMediaIds.size > 0) {
                        toggleSelection(media.id);
                        return;
                      }
                      setLightboxIndex(index);
                      setLightboxOpen(true);
                    };
                    
                    return (
                      <DraggableMediaWrapper key={media.id} media={media}>
                      <Card 
                        className={`group hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer border-2 ${isSelected ? 'border-primary' : 'border-transparent'} h-full`}
                        onClick={openLightbox}
                      >
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(media.id)}
                              className={`bg-white/90 border-black/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                            />
                          </div>

                          {thumbnailUrl ? (
                            media.type === "video" ? (
                              <>
                                <video
                                  src={media.file_url || ''}
                                  className="w-full h-full object-cover"
                                  muted
                                  preload="metadata"
                                  onLoadedData={(e) => {
                                    const video = e.currentTarget;
                                    if (video.duration > 1) {
                                      video.currentTime = 1;
                                    }
                                  }}
                                  onMouseEnter={(e) => {
                                    const video = e.currentTarget;
                                    video.play().catch(() => {});
                                  }}
                                  onMouseLeave={(e) => {
                                    const video = e.currentTarget;
                                    video.pause();
                                    if (video.duration > 1) {
                                      video.currentTime = 1;
                                    } else {
                                      video.currentTime = 0;
                                    }
                                  }}
                                  onError={() => {
                                    console.warn('Video preview error:', media.name);
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none">
                                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Play className="w-5 h-5 text-white ml-0.5" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img
                                src={thumbnailUrl}
                                alt={media.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => {
                                  console.warn('Image preview error:', media.name);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {media.type === "video" ? (
                                <Video className="w-10 h-10 text-muted-foreground" />
                              ) : (
                                <ImageIcon className="w-10 h-10 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2">
                            <Badge variant={getStatusVariant(media.status)} className="text-xs">
                              {getStatusLabel(media.status)}
                            </Badge>
                          </div>
                          
                          {media.type === "video" && media.duration && (
                            <div className="absolute bottom-2 right-2">
                              <span className="px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
                                {Math.floor(media.duration / 60)}:{String(media.duration % 60).padStart(2, '0')}
                              </span>
                            </div>
                          )}
                          
                          <div className="absolute bottom-2 left-2">
                            <div className="w-6 h-6 rounded bg-black/60 flex items-center justify-center">
                              {media.type === "video" ? (
                                <Video className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-white" />
                              )}
                            </div>
                          </div>
                          
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLightbox();
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                            </div>
                          </div>

                          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity pl-8">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="secondary" size="icon" className="h-7 w-7">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={(e) => handleEdit(media, e as unknown as React.MouseEvent)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => handleDelete(media, e as unknown as React.MouseEvent)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm truncate" title={media.name}>
                            {media.name}
                          </h3>
                          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                            <span>{media.resolution || "-"}</span>
                            <span>{formatFileSize(media.file_size)}</span>
                          </div>
                          {media.type === "image" && (
                            <div className="flex items-center mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              <span>{media.duration || 10}s</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      </DraggableMediaWrapper>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border pb-10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={selectedMediaIds.size === filteredMedia.length && filteredMedia.length > 0}
                            onCheckedChange={toggleAllSelection}
                          />
                        </TableHead>
                        <TableHead className="w-[100px]">Preview</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMedia.map((media, index) => (
                        <DraggableMediaRow
                          key={media.id}
                          media={media}
                          index={index}
                          isSelected={selectedMediaIds.has(media.id)}
                          onToggleSelection={toggleSelection}
                          onOpenLightbox={(idx) => {
                            setLightboxIndex(idx);
                            setLightboxOpen(true);
                          }}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          formatFileSize={formatFileSize}
                          getStatusVariant={getStatusVariant}
                          getStatusLabel={getStatusLabel}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeDragItem ? (
          <div className="relative">
            {selectedMediaIds.size > 1 && selectedMediaIds.has(activeDragItem.id) && (
              <>
                <div className="absolute top-1 left-1 w-48 h-14 bg-card/50 border rounded-md shadow-sm" />
                <div className="absolute top-2 left-2 w-48 h-14 bg-card/30 border rounded-md shadow-sm" />
              </>
            )}
            <div className="bg-card border rounded-md shadow-xl p-2 w-48 flex items-center gap-2 opacity-95 cursor-grabbing relative z-10 h-14">
              <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center">
                {activeDragItem.thumbnail_url || activeDragItem.file_url ? (
                  activeDragItem.type === 'video' ? (
                     <Video className="w-5 h-5 text-muted-foreground" />
                  ) : (
                     <img 
                       src={activeDragItem.thumbnail_url || activeDragItem.file_url || ''} 
                       alt={activeDragItem.name}
                       className="w-full h-full object-cover" 
                     />
                  )
                ) : (
                  activeDragItem.type === 'video' ? <Video className="w-5 h-5 text-muted-foreground" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <span className="text-sm font-medium truncate flex-1">{activeDragItem.name}</span>
              {selectedMediaIds.size > 1 && selectedMediaIds.has(activeDragItem.id) && (
                  <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                      {selectedMediaIds.size}
                  </Badge>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default Media;
