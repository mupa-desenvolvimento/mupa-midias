 import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
 
 export type EditorProvider = 'canva' | 'figma';
 export type SessionType = 'create' | 'edit';
 export type AssetType = 'image' | 'video';
 export type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'failed';
 
 export interface EditorSession {
   id: string;
   user_id: string;
   provider: EditorProvider;
   provider_design_id?: string;
   session_type: SessionType;
   asset_type: AssetType;
   status: SessionStatus;
   target_folder_id?: string;
   result_media_id?: string;
  metadata: Json;
   started_at?: string;
   completed_at?: string;
   created_at: string;
   updated_at: string;
 }
 
 export interface CreateSessionParams {
   provider: EditorProvider;
   sessionType: SessionType;
   assetType: AssetType;
   targetFolderId?: string;
   providerDesignId?: string;
  metadata?: Json;
 }
 
 export interface EditorConfig {
   width?: number;
   height?: number;
   designType?: string;
   templateId?: string;
 }
 
 /**
  * Abstract service for external editor integrations (Canva, Figma, etc.)
  * Provides a unified interface for creating, editing, and exporting designs
  */
 export abstract class ExternalEditorService {
   protected provider: EditorProvider;
 
   constructor(provider: EditorProvider) {
     this.provider = provider;
   }
 
   /**
    * Create a new editor session in the database
    */
   async createSession(params: CreateSessionParams): Promise<EditorSession | null> {
     const { data: userData } = await (supabase.auth as any).getUser();
     if (!userData.user) {
       console.error('User not authenticated');
       return null;
     }
 
     const { data, error } = await supabase
       .from('external_editor_sessions')
      .insert([{
         user_id: userData.user.id,
         provider: params.provider,
         provider_design_id: params.providerDesignId,
         session_type: params.sessionType,
         asset_type: params.assetType,
         target_folder_id: params.targetFolderId,
         metadata: params.metadata || {},
         status: 'pending'
      }])
       .select()
       .single();
 
     if (error) {
       console.error('Failed to create editor session:', error);
       return null;
     }
 
     return data as EditorSession;
   }
 
   /**
    * Update session status
    */
  async updateSessionStatus(sessionId: string, status: SessionStatus, metadata?: Json): Promise<boolean> {
    const updateData: { status: string; updated_at: string; started_at?: string; completed_at?: string; metadata?: Json } = { 
       status,
       updated_at: new Date().toISOString()
     };
 
     if (status === 'active') {
       updateData.started_at = new Date().toISOString();
     } else if (status === 'completed' || status === 'cancelled' || status === 'failed') {
       updateData.completed_at = new Date().toISOString();
     }
 
     if (metadata) {
       updateData.metadata = metadata;
     }
 
     const { error } = await supabase
       .from('external_editor_sessions')
       .update(updateData)
       .eq('id', sessionId);
 
     if (error) {
       console.error('Failed to update session status:', error);
       return false;
     }
 
     return true;
   }
 
   /**
    * Link the resulting media to the session
    */
   async linkResultMedia(sessionId: string, mediaId: string): Promise<boolean> {
     const { error } = await supabase
       .from('external_editor_sessions')
       .update({ 
         result_media_id: mediaId,
         status: 'completed',
         completed_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       })
       .eq('id', sessionId);
 
     if (error) {
       console.error('Failed to link result media:', error);
       return false;
     }
 
     return true;
   }
 
   /**
    * Get session by ID
    */
   async getSession(sessionId: string): Promise<EditorSession | null> {
     const { data, error } = await supabase
       .from('external_editor_sessions')
       .select('*')
       .eq('id', sessionId)
       .single();
 
     if (error) {
       console.error('Failed to get session:', error);
       return null;
     }
 
     return data as EditorSession;
   }
 
   /**
    * Get all sessions for current user
    */
   async getUserSessions(status?: SessionStatus): Promise<EditorSession[]> {
     let query = supabase
       .from('external_editor_sessions')
       .select('*')
       .eq('provider', this.provider)
       .order('created_at', { ascending: false });
 
     if (status) {
       query = query.eq('status', status);
     }
 
     const { data, error } = await query;
 
     if (error) {
       console.error('Failed to get user sessions:', error);
       return [];
     }
 
     return data as EditorSession[];
   }
 
   // Abstract methods to be implemented by specific providers
   abstract isConnected(): Promise<boolean>;
   abstract getEditorUrl(session: EditorSession, config?: EditorConfig): Promise<string | null>;
   abstract exportDesign(designId: string, format: 'png' | 'jpg' | 'mp4'): Promise<Blob | null>;
   abstract importToGallery(session: EditorSession): Promise<string | null>;
 }