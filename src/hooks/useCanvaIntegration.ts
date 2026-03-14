 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
interface CanvaDesign {
  id: string;
  title: string;
  thumbnail?: {
    url: string;
  };
  created_at: string;
  updated_at: string;
  type?: string;
}

interface CanvaFolder {
  id: string;
  name: string;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}
 
  // Use current origin for redirect (works for both localhost and production)
  const getRedirectUri = () => `${window.location.origin}/admin/canva/callback`;
  
  export function useCanvaIntegration() {
   const { toast } = useToast();
   const [isConnected, setIsConnected] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [designs, setDesigns] = useState<CanvaDesign[]>([]);
   const [folders, setFolders] = useState<CanvaFolder[]>([]);
   const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
   const [continuation, setContinuation] = useState<string | null>(null);
   const [isLoadingDesigns, setIsLoadingDesigns] = useState(false);
  const [isExporting, setIsExporting] = useState<string[]>([]);
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
 const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<FolderBreadcrumb[]>([{ id: 'root', name: 'Meus Projetos' }]);

  const toggleSelection = useCallback((designId: string) => {
    setSelectedDesigns(prev => {
      const next = new Set(prev);
      if (next.has(designId)) {
        next.delete(designId);
      } else {
        next.add(designId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedDesigns(new Set(designs.map(d => d.id)));
  }, [designs]);

  const clearSelection = useCallback(() => {
    setSelectedDesigns(new Set());
  }, []);
 
   const callCanvaApi = useCallback(async (action: string, body: Record<string, unknown>) => {
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) throw new Error('Not authenticated');
 
     const response = await fetch(
       `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canva-auth?action=${action}`,
       {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${session.access_token}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ ...body, user_id: session.user.id }),
       }
     );
 
     return response.json();
   }, []);
 
   const checkConnection = useCallback(async () => {
     try {
       setIsLoading(true);
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) {
         setIsConnected(false);
         return;
       }
       const result = await callCanvaApi('status', {});
       setIsConnected(result.connected);
     } catch (error) {
       if (error instanceof Error && error.message === "Not authenticated") {
         setIsConnected(false);
         return;
       }
       console.error('Error checking Canva connection:', error);
       setIsConnected(false);
     } finally {
       setIsLoading(false);
     }
   }, [callCanvaApi]);
 
   useEffect(() => {
     checkConnection();
   }, [checkConnection]);
 
  const connect = useCallback(async () => {
    try {
      // Use dynamic redirect URI
      const redirectUri = getRedirectUri();
      console.log('[Canva Integration] Initiating connection with redirect_uri:', redirectUri);
      
      const result = await callCanvaApi('get_auth_url', { redirect_uri: redirectUri });
      
      if (result.auth_url) {
        window.location.href = result.auth_url;
      } else {
        throw new Error(result.error || 'Failed to get auth URL');
      }
    } catch (error) {
      console.error('Error connecting to Canva:', error);
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível iniciar a conexão com o Canva',
        variant: 'destructive',
      });
    }
  }, [callCanvaApi, toast]);
 
  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      // Must match the redirect_uri used during authorization
      const redirectUri = getRedirectUri();
      const result = await callCanvaApi('exchange_code', { code, state, redirect_uri: redirectUri });
      
      if (result.success) {
        setIsConnected(true);
        toast({
          title: 'Conectado!',
          description: 'Sua conta do Canva foi conectada com sucesso',
        });
        return true;
      } else {
        throw new Error(result.error || 'Failed to exchange code');
      }
    } catch (error) {
      console.error('Error handling callback:', error);
      toast({
        title: 'Erro na autenticação',
        description: 'Não foi possível completar a conexão com o Canva',
        variant: 'destructive',
      });
      return false;
    }
  }, [callCanvaApi, toast]);
 
   const disconnect = useCallback(async () => {
     try {
       await callCanvaApi('disconnect', {});
       setIsConnected(false);
       setDesigns([]);
       setFolders([]);
       toast({
         title: 'Desconectado',
         description: 'Sua conta do Canva foi desconectada',
       });
     } catch (error) {
       console.error('Error disconnecting:', error);
       toast({
         title: 'Erro',
         description: 'Não foi possível desconectar do Canva',
         variant: 'destructive',
       });
     }
   }, [callCanvaApi, toast]);
 
  // Load folder items (designs and subfolders) using folder_id
  const loadFolderItems = useCallback(async (folderId: string = 'root', loadMore = false) => {
    try {
      setIsLoadingDesigns(true);
      
      const result = await callCanvaApi('list_folder_items', {
        folder_id: folderId,
        continuation: loadMore ? continuation : undefined,
      });
      
      if (result.connected === false) {
        setIsConnected(false);
        return;
      }
      
      if (result.success) {
        if (loadMore) {
          setDesigns(prev => [...prev, ...(result.designs || [])]);
          setFolders(prev => [...prev, ...(result.folders || [])]);
        } else {
          setDesigns(result.designs || []);
          setFolders(result.folders || []);
        }
        setContinuation(result.continuation || null);
        setCurrentFolderId(folderId);
      }
    } catch (error) {
      console.error('Error loading folder items:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os itens do Canva',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDesigns(false);
    }
  }, [callCanvaApi, continuation, toast]);

  // Navigate into a folder
  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setFolderBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    loadFolderItems(folderId);
  }, [loadFolderItems]);

  // Navigate back to a specific breadcrumb
  const navigateToBreadcrumb = useCallback((index: number) => {
    const breadcrumb = folderBreadcrumbs[index];
    if (breadcrumb) {
      setFolderBreadcrumbs(prev => prev.slice(0, index + 1));
      loadFolderItems(breadcrumb.id);
    }
  }, [folderBreadcrumbs, loadFolderItems]);

  // Legacy methods for backward compatibility
  const loadFolders = useCallback(async () => {
    // Now part of loadFolderItems
  }, []);

  const loadDesigns = useCallback(async (folderId?: string | null, loadMore = false) => {
    await loadFolderItems(folderId || 'root', loadMore);
  }, [loadFolderItems]);
 
  const exportDesign = useCallback(async (designId: string, designTitle: string, format: 'png' | 'jpg' | 'pdf' = 'png') => {
    try {
      setIsExporting(prev => [...prev, designId]);
      
      // 1. Export from Canva (uses correct action name: export_design)
      const result = await callCanvaApi('export_design', {
        design_id: designId,
        format,
      });

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      const exportUrls = result.export_urls;
      if (!exportUrls || exportUrls.length === 0) {
        throw new Error('Export completed but no URLs returned');
      }

      const imageUrl = exportUrls[0];

      // 2. Upload to media library
      const imageResponse = await fetch(imageUrl);
      const blob = await imageResponse.blob();
      const file = new File([blob], `${designTitle}.${format}`, { type: blob.type });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', designTitle);
      formData.append('description', `Importado do Canva em ${new Date().toLocaleString()}`);
      formData.append('duration', '10');
      formData.append('type', blob.type.startsWith('image/') ? 'image' : 'video');
      formData.append('fileType', blob.type);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const uploadResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          body: formData,
        }
      );
      
      const uploadResult = await uploadResponse.json();
      
      if (uploadResponse.ok) {
        toast({
          title: 'Importado!',
          description: `"${designTitle}" foi importado para sua biblioteca de mídia`,
        });
        return uploadResult.mediaItem;
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error exporting design:', error);
      toast({
        title: 'Erro ao importar',
        description: error instanceof Error ? error.message : 'Não foi possível importar o design do Canva',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsExporting(prev => prev.filter(id => id !== designId));
    }
  }, [callCanvaApi, toast]);
 
  const exportSelectedDesigns = useCallback(async (format: 'png' | 'jpg' | 'pdf' = 'png') => {
    const designsToExport = designs.filter(d => selectedDesigns.has(d.id));
    const results = [];
    
    for (const design of designsToExport) {
      const result = await exportDesign(design.id, design.title, format);
      if (result) {
        results.push(result);
      }
    }
    
    clearSelection();
    return results;
  }, [designs, selectedDesigns, exportDesign, clearSelection]);

   return {
     isConnected,
     isLoading,
     designs,
     folders,
     selectedFolder,
     setSelectedFolder,
     continuation,
     isLoadingDesigns,
     isExporting,
     connect,
     disconnect,
     handleCallback,
     loadFolders,
     loadDesigns,
     exportDesign,
    checkConnection,
    selectedDesigns,
    toggleSelection,
    selectAll,
    clearSelection,
    exportSelectedDesigns,
    loadFolderItems,
    navigateToFolder,
    navigateToBreadcrumb,
    currentFolderId,
    folderBreadcrumbs,
  };
}
