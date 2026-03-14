 import { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Link2, Link2Off, Loader2, Download, FolderOpen, 
  Image, RefreshCw, CheckCircle2, ExternalLink, CheckSquare, Square,
  ChevronRight, Home, Paintbrush
} from 'lucide-react';
import { useCanvaIntegration } from '@/hooks/useCanvaIntegration';
import { Checkbox } from '@/components/ui/checkbox';
 
 export default function CanvaIntegration() {
   const navigate = useNavigate();
   
  const {
    isConnected,
    isLoading,
    designs,
    folders,
    continuation,
    isLoadingDesigns,
    isExporting,
    connect,
    disconnect,
    handleCallback,
    loadFolderItems,
    navigateToFolder,
    navigateToBreadcrumb,
    currentFolderId,
    folderBreadcrumbs,
    selectedDesigns,
    toggleSelection,
    selectAll,
    clearSelection,
    exportSelectedDesigns,
    exportDesign,
  } = useCanvaIntegration();
 
  // Load designs when connected
  useEffect(() => {
    if (isConnected) {
      loadFolderItems('root');
    }
  }, [isConnected, loadFolderItems]);
 
   if (isLoading) {
     return (
       <div className="p-6 space-y-6">
         <div className="flex items-center justify-center min-h-[400px]">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </div>
     );
   }
 
   return (
    <div className="p-6 space-y-6">
      {!isConnected ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Card className="w-full max-w-md shadow-xl border-border/60">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Image className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Conectar ao Canva</CardTitle>
              <CardDescription className="text-sm">
                Importe seus designs diretamente para a biblioteca de mídia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Image className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Importar designs</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Exporte como PNG de alta qualidade
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Navegar por pastas</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Acesse pastas pessoais e da equipe
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Importação em lote</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Selecione vários designs de uma vez
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={connect} className="w-full" size="lg">
                <Link2 className="h-4 w-4 mr-2" />
                Conectar ao Canva
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full gap-2" 
                size="lg"
                onClick={() => navigate('/admin/graphic-editor')}
              >
                <Paintbrush className="h-4 w-4" />
                Criar no Editor Gráfico
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Você será redirecionado para o Canva para autorizar o acesso.
              </p>
            </CardContent>
          </Card>
        </div>
       ) : (
          <div className="space-y-4">
           <div className="flex items-center justify-between">
             <p className="text-muted-foreground">
               Importe designs do Canva para suas playlists
             </p>
             <div className="flex items-center gap-3">
               <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                 <CheckCircle2 className="h-4 w-4 text-green-500" />
                 Conectado
               </Badge>
               <Button variant="outline" onClick={disconnect}>
                 <Link2Off className="h-4 w-4 mr-2" />
                 Desconectar
               </Button>
             </div>
           </div>

            <div className="flex items-center gap-1 text-sm flex-wrap">
              {folderBreadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center">
                  {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                  <Button 
                    variant={index === folderBreadcrumbs.length - 1 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => navigateToBreadcrumb(index)}
                    className="h-7"
                  >
                    {index === 0 ? <Home className="h-4 w-4 mr-1" /> : null}
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>

             {/* Actions */}
             <div className="flex items-center gap-3">
               {selectedDesigns.size > 0 && (
                 <Button onClick={() => exportSelectedDesigns()}>
                   <Download className="h-4 w-4 mr-2" />
                   Importar ({selectedDesigns.size})
                 </Button>
               )}

               <Button 
                 variant="outline" 
                 onClick={() => navigate('/admin/graphic-editor')}
               >
                 <Paintbrush className="h-4 w-4 mr-2" />
                 Editor Gráfico
               </Button>

               <Button 
                 variant="outline" 
                 onClick={() => loadFolderItems(currentFolderId)} 
                 disabled={isLoadingDesigns}
               >
                 <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingDesigns ? 'animate-spin' : ''}`} />
                 Atualizar
               </Button>
             </div>

          {/* Designs Grid */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="mb-4 flex items-center gap-2">
               <Button variant="ghost" size="sm" onClick={selectAll} disabled={designs.length === 0}>
                 Selecionar tudo
               </Button>
               {selectedDesigns.size > 0 && (
                 <Button variant="ghost" size="sm" onClick={clearSelection}>
                   Limpar seleção
                 </Button>
               )}
            </div>

            {/* Loading state */}
            {isLoadingDesigns && designs.length === 0 && folders.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-lg" />
                ))}
              </div>
            ) : designs.length === 0 && folders.length === 0 ? (
              <Card className="p-8 text-center">
                <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum item encontrado nesta pasta</p>
              </Card>
            ) : (
              <>
                {/* Folders grid */}
                {folders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Pastas</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {folders.map(folder => (
                        <Card 
                          key={folder.id}
                          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => navigateToFolder(folder.id, folder.name)}
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen className="h-8 w-8 text-primary" />
                            <span className="font-medium text-sm truncate">{folder.name}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Designs section */}
                {designs.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Designs</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {designs.map(design => (
                        <DesignCard
                          key={design.id}
                          design={design}
                          isExporting={isExporting.includes(design.id)}
                          isSelected={selectedDesigns.has(design.id)}
                          onToggle={() => toggleSelection(design.id)}
                          onImport={exportDesign}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            
            {continuation && (
               <div className="flex justify-center py-4">
                 <Button 
                   variant="outline" 
                    onClick={() => loadFolderItems(currentFolderId, true)}
                   disabled={isLoadingDesigns}
                 >
                   {isLoadingDesigns ? (
                     <Loader2 className="h-4 w-4 animate-spin mr-2" />
                   ) : null}
                   Carregar mais
                 </Button>
               </div>
             )}
           </ScrollArea>
         </div>
       )}
     </div>
   );
 }
 
interface DesignCardProps {
  design: {
    id: string;
    title: string;
    thumbnail?: { url: string };
    updated_at: string;
    type?: string;
  };
  isExporting: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onImport: (designId: string, designTitle: string) => Promise<any>;
}

function DesignCard({ design, isExporting, isSelected, onToggle, onImport }: DesignCardProps) {
  const [importedId, setImportedId] = useState<string | null>(null);
  
  const handleImport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await onImport(design.id, design.title);
    if (result?.id) {
      setImportedId(result.id);
    }
  };
  
  return (
    <Card 
      className={`group overflow-hidden transition-all cursor-pointer ${
        isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:ring-2 hover:ring-primary/50'
      }`}
      onClick={onToggle}
    >
      <div className="aspect-video relative bg-muted">
        {design.thumbnail?.url ? (
          <img
            src={design.thumbnail.url}
            alt={design.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Image className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Selection Checkbox Overlay */}
        <div className={`absolute top-2 left-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
           <div className={`bg-background/80 backdrop-blur-sm rounded-sm p-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
             {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
           </div>
        </div>
        
        {/* Import overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {importedId ? (
            <Badge className="bg-green-500 hover:bg-green-600">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Importado
            </Badge>
          ) : (
            <>
              <Button 
                size="sm" 
                onClick={handleImport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Importar
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.canva.com/design/${design.id}`, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      <CardContent className="p-3">
        <p className="font-medium text-sm truncate" title={design.title}>
          {design.title}
        </p>
         {design.type && (
           <Badge variant="secondary" className="text-xs mt-1">
             {design.type}
           </Badge>
         )}
       </CardContent>
     </Card>
   );
 }
