 import { supabase } from "@/integrations/supabase/client";
 import { 
   ExternalEditorService, 
   EditorSession, 
   EditorConfig 
 } from "./externalEditorService";
 
 /**
  * Canva-specific implementation of the ExternalEditorService
  * Handles Canva editor integration for creating and editing designs
  */
 export class CanvaEditorService extends ExternalEditorService {
   constructor() {
     super('canva');
   }
 
   /**
    * Check if user has a valid Canva connection
    */
   async isConnected(): Promise<boolean> {
     const { data: userData } = await (supabase.auth as any).getUser();
     if (!userData?.user?.id) return false;
     
     const { data, error } = await supabase.functions.invoke('canva-auth?action=status', {
       body: { user_id: userData.user.id }
     });
 
     if (error) {
       console.error('Failed to check Canva connection:', error);
       return false;
     }
 
     return data?.connected === true;
   }
 
   /**
    * Get the URL to open the Canva editor
    * Note: Canva doesn't support iframe embedding, so this returns a redirect URL
    */
   async getEditorUrl(session: EditorSession, config?: EditorConfig): Promise<string | null> {
     // Canva editor URLs are constructed based on session type
     // For 'create': Opens a new design
     // For 'edit': Opens an existing design by ID
 
     if (session.session_type === 'edit' && session.provider_design_id) {
       // Edit existing design - redirect to Canva's edit URL
       return `https://www.canva.com/design/${session.provider_design_id}/edit`;
     }
 
     // For new designs, we need to use Canva's Create Design API (future implementation)
     // This will be implemented when Canva Button SDK is integrated
     console.log('Create new design with config:', config);
     
     // Placeholder - will be replaced with actual SDK integration
     return null;
   }
 
   /**
    * Export a design from Canva to a specific format
    * Uses the Canva Export API
    */
   async exportDesign(designId: string, format: 'png' | 'jpg' | 'mp4'): Promise<Blob | null> {
     try {
       const { data: userData } = await (supabase.auth as any).getUser();
       if (!userData?.user?.id) return null;
       
       const { data, error } = await supabase.functions.invoke('canva-auth?action=export_design', {
         body: {
           user_id: userData.user.id,
           design_id: designId,
           format
         }
       });
 
       if (error || !data?.url) {
         console.error('Failed to export design from Canva:', error || data?.error);
         return null;
       }
 
       // Download the exported file
       const response = await fetch(data.url);
       if (!response.ok) {
         console.error('Failed to download exported file');
         return null;
       }
 
       return await response.blob();
     } catch (err) {
       console.error('Export design error:', err);
       return null;
     }
   }
 
   /**
    * Import a completed design to the internal gallery
    * This will export the design and upload it to R2/gallery
    */
   async importToGallery(session: EditorSession): Promise<string | null> {
     if (!session.provider_design_id) {
       console.error('No design ID to import');
       return null;
     }
 
     const format = session.asset_type === 'video' ? 'mp4' : 'png';
     const blob = await this.exportDesign(session.provider_design_id, format);
 
     if (!blob) {
       console.error('Failed to export design for import');
       return null;
     }
 
     // Upload to internal gallery using upload-media edge function
     const formData = new FormData();
     const fileName = `canva-design-${Date.now()}.${format}`;
     formData.append('file', blob, fileName);
     
     if (session.target_folder_id) {
       formData.append('folder_id', session.target_folder_id);
     }
 
     const { data, error } = await supabase.functions.invoke('upload-media', {
       body: formData
     });
 
     if (error || !data?.id) {
       console.error('Failed to upload to gallery:', error || data?.error);
       return null;
     }
 
     // Link the result to the session
     await this.linkResultMedia(session.id, data.id);
 
     return data.id;
   }
 
   /**
    * Get available design templates from Canva
    * (Future implementation)
    */
   async getTemplates(category?: string): Promise<unknown[]> {
     console.log('Get templates for category:', category);
     // Will be implemented with Canva API
     return [];
   }
 
   /**
    * Start a new design session
    */
   async startNewDesign(
     assetType: 'image' | 'video',
     config?: EditorConfig,
     targetFolderId?: string
   ): Promise<EditorSession | null> {
     const session = await this.createSession({
       provider: 'canva',
       sessionType: 'create',
       assetType,
       targetFolderId,
      metadata: config ? JSON.parse(JSON.stringify(config)) : {}
     });
 
     if (!session) {
       return null;
     }
 
     // Update session to active
     await this.updateSessionStatus(session.id, 'active');
 
     return session;
   }
 
   /**
    * Start an edit session for an existing design
    */
   async startEditDesign(
     designId: string,
     assetType: 'image' | 'video',
     targetFolderId?: string
   ): Promise<EditorSession | null> {
     const session = await this.createSession({
       provider: 'canva',
       sessionType: 'edit',
       assetType,
       providerDesignId: designId,
       targetFolderId
     });
 
     if (!session) {
       return null;
     }
 
     // Update session to active
     await this.updateSessionStatus(session.id, 'active');
 
     return session;
   }
 }
 
 // Singleton instance
 export const canvaEditorService = new CanvaEditorService();