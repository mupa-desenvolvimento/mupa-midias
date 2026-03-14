export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_integrations: {
        Row: {
          auth_body_json: Json
          auth_method: string | null
          auth_token_path: string | null
          auth_type: string
          auth_url: string | null
          barcode_param_name: string | null
          base_url: string
          created_at: string
          default_settings: Json | null
          description: string | null
          endpoints: Json | null
          id: string
          is_active: boolean
          name: string
          request_headers_json: Json
          request_method: string | null
          request_params_json: Json
          request_url: string | null
          response_mapping_json: Json
          slug: string
          store_param_name: string | null
          token_cache: Json
          token_expiration_seconds: number | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          auth_body_json?: Json
          auth_method?: string | null
          auth_token_path?: string | null
          auth_type?: string
          auth_url?: string | null
          barcode_param_name?: string | null
          base_url: string
          created_at?: string
          default_settings?: Json | null
          description?: string | null
          endpoints?: Json | null
          id?: string
          is_active?: boolean
          name: string
          request_headers_json?: Json
          request_method?: string | null
          request_params_json?: Json
          request_url?: string | null
          response_mapping_json?: Json
          slug: string
          store_param_name?: string | null
          token_cache?: Json
          token_expiration_seconds?: number | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_body_json?: Json
          auth_method?: string | null
          auth_token_path?: string | null
          auth_type?: string
          auth_url?: string | null
          barcode_param_name?: string | null
          base_url?: string
          created_at?: string
          default_settings?: Json | null
          description?: string | null
          endpoints?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          request_headers_json?: Json
          request_method?: string | null
          request_params_json?: Json
          request_url?: string | null
          response_mapping_json?: Json
          slug?: string
          store_param_name?: string | null
          token_cache?: Json
          token_expiration_seconds?: number | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auto_content_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          payload_json: Json | null
          source: string
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          payload_json?: Json | null
          source?: string
          status?: string
          tenant_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          payload_json?: Json | null
          source?: string
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_content_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_content_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_fetch_at: string | null
          module_type: string
          refresh_interval_minutes: number
          tenant_id: string
          updated_at: string
          weather_city: string | null
          weather_country: string | null
          weather_state: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_fetch_at?: string | null
          module_type: string
          refresh_interval_minutes?: number
          tenant_id: string
          updated_at?: string
          weather_city?: string | null
          weather_country?: string | null
          weather_state?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_fetch_at?: string | null
          module_type?: string
          refresh_interval_minutes?: number
          tenant_id?: string
          updated_at?: string
          weather_city?: string | null
          weather_country?: string | null
          weather_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_content_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_people: {
        Row: {
          birth_date: string
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          role: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          role?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          role?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_auth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          id: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at: string
          id?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          state_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          state_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          state_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          slug: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          slug: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          slug?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          company_id: string
          created_at: string
          credentials: Json | null
          id: string
          integration_id: string
          is_active: boolean
          settings: Json | null
          token_cache: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          credentials?: Json | null
          id?: string
          integration_id: string
          is_active?: boolean
          settings?: Json | null
          token_cache?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          credentials?: Json | null
          id?: string
          integration_id?: string
          is_active?: boolean
          settings?: Json | null
          token_cache?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_detection_logs: {
        Row: {
          age: number | null
          age_group: string | null
          attention_duration: number | null
          confidence: number | null
          content_id: string | null
          content_name: string | null
          created_at: string
          detected_at: string
          device_id: string | null
          device_nickname: string | null
          device_serial: string
          emotion: string | null
          emotion_confidence: number | null
          face_descriptor: Json | null
          gender: string | null
          id: string
          is_facing_camera: boolean | null
          metadata: Json | null
          playlist_id: string | null
        }
        Insert: {
          age?: number | null
          age_group?: string | null
          attention_duration?: number | null
          confidence?: number | null
          content_id?: string | null
          content_name?: string | null
          created_at?: string
          detected_at?: string
          device_id?: string | null
          device_nickname?: string | null
          device_serial: string
          emotion?: string | null
          emotion_confidence?: number | null
          face_descriptor?: Json | null
          gender?: string | null
          id?: string
          is_facing_camera?: boolean | null
          metadata?: Json | null
          playlist_id?: string | null
        }
        Update: {
          age?: number | null
          age_group?: string | null
          attention_duration?: number | null
          confidence?: number | null
          content_id?: string | null
          content_name?: string | null
          created_at?: string
          detected_at?: string
          device_id?: string | null
          device_nickname?: string | null
          device_serial?: string
          emotion?: string | null
          emotion_confidence?: number | null
          face_descriptor?: Json | null
          gender?: string | null
          id?: string
          is_facing_camera?: boolean | null
          metadata?: Json | null
          playlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_detection_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_detection_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_detection_logs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      device_group_channels: {
        Row: {
          created_at: string
          distribution_channel_id: string
          group_id: string
          id: string
          position: number
        }
        Insert: {
          created_at?: string
          distribution_channel_id: string
          group_id: string
          id?: string
          position?: number
        }
        Update: {
          created_at?: string
          distribution_channel_id?: string
          group_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "device_group_channels_distribution_channel_id_fkey"
            columns: ["distribution_channel_id"]
            isOneToOne: false
            referencedRelation: "distribution_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_group_channels_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      device_group_members: {
        Row: {
          created_at: string
          device_id: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_group_members_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      device_groups: {
        Row: {
          channel_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          screen_type: string | null
          store_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          screen_type?: string | null
          store_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          screen_type?: string | null
          store_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_groups_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "distribution_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_groups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          api_integration_id: string | null
          blocked_message: string | null
          camera_enabled: boolean
          channel_id: string | null
          company_id: string | null
          created_at: string
          current_playlist_id: string | null
          device_code: string
          device_token: string | null
          display_profile_id: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          last_seen_at: string | null
          last_sync_requested_at: string | null
          metadata: Json | null
          name: string
          override_media_expires_at: string | null
          override_media_id: string | null
          price_integration_enabled: boolean
          region_id: string | null
          resolution: string | null
          status: string
          store_code: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          api_integration_id?: string | null
          blocked_message?: string | null
          camera_enabled?: boolean
          channel_id?: string | null
          company_id?: string | null
          created_at?: string
          current_playlist_id?: string | null
          device_code: string
          device_token?: string | null
          display_profile_id?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          last_seen_at?: string | null
          last_sync_requested_at?: string | null
          metadata?: Json | null
          name: string
          override_media_expires_at?: string | null
          override_media_id?: string | null
          price_integration_enabled?: boolean
          region_id?: string | null
          resolution?: string | null
          status?: string
          store_code?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          api_integration_id?: string | null
          blocked_message?: string | null
          camera_enabled?: boolean
          channel_id?: string | null
          company_id?: string | null
          created_at?: string
          current_playlist_id?: string | null
          device_code?: string
          device_token?: string | null
          display_profile_id?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          last_seen_at?: string | null
          last_sync_requested_at?: string | null
          metadata?: Json | null
          name?: string
          override_media_expires_at?: string | null
          override_media_id?: string | null
          price_integration_enabled?: boolean
          region_id?: string | null
          resolution?: string | null
          status?: string
          store_code?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_api_integration_id_fkey"
            columns: ["api_integration_id"]
            isOneToOne: false
            referencedRelation: "api_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "distribution_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_current_playlist_id_fkey"
            columns: ["current_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_display_profile_id_fkey"
            columns: ["display_profile_id"]
            isOneToOne: false
            referencedRelation: "display_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_override_media_id_fkey"
            columns: ["override_media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      display_profiles: {
        Row: {
          created_at: string
          default_layout: string | null
          has_touch: boolean
          id: string
          idle_behavior: string | null
          metadata: Json | null
          name: string
          offline_behavior: string | null
          orientation: string
          permitted_channels: string[] | null
          resolution: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_layout?: string | null
          has_touch?: boolean
          id?: string
          idle_behavior?: string | null
          metadata?: Json | null
          name: string
          offline_behavior?: string | null
          orientation?: string
          permitted_channels?: string[] | null
          resolution?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_layout?: string | null
          has_touch?: boolean
          id?: string
          idle_behavior?: string | null
          metadata?: Json | null
          name?: string
          offline_behavior?: string | null
          orientation?: string
          permitted_channels?: string[] | null
          resolution?: string
          updated_at?: string
        }
        Relationships: []
      }
      distribution_channels: {
        Row: {
          created_at: string
          description: string | null
          fallback_playlist_id: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          priority: number
          rules: Json | null
          source: string
          type: string
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fallback_playlist_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          priority?: number
          rules?: Json | null
          source?: string
          type?: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fallback_playlist_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          priority?: number
          rules?: Json | null
          source?: string
          type?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_fallback_playlist_id_fkey"
            columns: ["fallback_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      external_editor_sessions: {
        Row: {
          asset_type: string
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json | null
          provider: string
          provider_design_id: string | null
          result_media_id: string | null
          session_type: string
          started_at: string | null
          status: string
          target_folder_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          provider_design_id?: string | null
          result_media_id?: string | null
          session_type?: string
          started_at?: string | null
          status?: string
          target_folder_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          provider_design_id?: string | null
          result_media_id?: string | null
          session_type?: string
          started_at?: string | null
          status?: string
          target_folder_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_editor_sessions_result_media_id_fkey"
            columns: ["result_media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_editor_sessions_target_folder_id_fkey"
            columns: ["target_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: number | null
          errors: Json | null
          file_name: string | null
          id: string
          status: string
          success_rows: number | null
          total_rows: number | null
          type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          errors?: Json | null
          file_name?: string | null
          id?: string
          status?: string
          success_rows?: number | null
          total_rows?: number | null
          type: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          errors?: Json | null
          file_name?: string | null
          id?: string
          status?: string
          success_rows?: number | null
          total_rows?: number | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      media_items: {
        Row: {
          created_at: string
          duration: number | null
          file_size: number | null
          file_url: string | null
          folder_id: string | null
          id: string
          metadata: Json | null
          name: string
          resolution: string | null
          status: string
          thumbnail_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          file_size?: number | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          name: string
          resolution?: string | null
          status?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          file_size?: number | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          resolution?: string | null
          status?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_play_logs: {
        Row: {
          created_at: string | null
          device_id: string | null
          duration: number | null
          id: string
          media_id: string | null
          played_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          duration?: number | null
          id?: string
          media_id?: string | null
          played_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          duration?: number | null
          id?: string
          media_id?: string | null
          played_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_play_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_play_logs_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      motivational_quotes: {
        Row: {
          author: string
          created_at: string
          id: string
          image_orientation: string | null
          image_url: string | null
          is_active: boolean
          quote: string
          source: string | null
          tenant_id: string | null
          updated_at: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          image_orientation?: string | null
          image_url?: string | null
          is_active?: boolean
          quote: string
          source?: string | null
          tenant_id?: string | null
          updated_at?: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          image_orientation?: string | null
          image_url?: string | null
          is_active?: boolean
          quote?: string
          source?: string | null
          tenant_id?: string | null
          updated_at?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motivational_quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          active: boolean | null
          api_article_id: string | null
          api_source: string | null
          category: string | null
          content: string | null
          description: string | null
          feed_id: string | null
          id: string
          image_cached: boolean | null
          image_r2_key: string | null
          image_url: string | null
          imported_at: string
          link: string | null
          published_at: string | null
          slug: string | null
          source: string | null
          source_priority: number | null
          title: string
        }
        Insert: {
          active?: boolean | null
          api_article_id?: string | null
          api_source?: string | null
          category?: string | null
          content?: string | null
          description?: string | null
          feed_id?: string | null
          id?: string
          image_cached?: boolean | null
          image_r2_key?: string | null
          image_url?: string | null
          imported_at?: string
          link?: string | null
          published_at?: string | null
          slug?: string | null
          source?: string | null
          source_priority?: number | null
          title: string
        }
        Update: {
          active?: boolean | null
          api_article_id?: string | null
          api_source?: string | null
          category?: string | null
          content?: string | null
          description?: string | null
          feed_id?: string | null
          id?: string
          image_cached?: boolean | null
          image_r2_key?: string | null
          image_url?: string | null
          imported_at?: string
          link?: string | null
          published_at?: string | null
          slug?: string | null
          source?: string | null
          source_priority?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "news_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      news_feeds: {
        Row: {
          active: boolean | null
          category: string | null
          collector: string
          created_at: string
          id: string
          name: string
          priority: number | null
          query: string | null
          rss_url: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          collector?: string
          created_at?: string
          id?: string
          name: string
          priority?: number | null
          query?: string | null
          rss_url: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          collector?: string
          created_at?: string
          id?: string
          name?: string
          priority?: number | null
          query?: string | null
          rss_url?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_feeds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      news_settings: {
        Row: {
          active_categories: Json | null
          created_at: string
          display_time: number | null
          id: string
          layout_type: string | null
          max_items: number | null
          tenant_id: string | null
          theme_mode: string | null
          type_view: string | null
          updated_at: string
        }
        Insert: {
          active_categories?: Json | null
          created_at?: string
          display_time?: number | null
          id?: string
          layout_type?: string | null
          max_items?: number | null
          tenant_id?: string | null
          theme_mode?: string | null
          type_view?: string | null
          updated_at?: string
        }
        Update: {
          active_categories?: Json | null
          created_at?: string
          display_time?: number | null
          id?: string
          layout_type?: string | null
          max_items?: number | null
          tenant_id?: string | null
          theme_mode?: string | null
          type_view?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_channel_items: {
        Row: {
          channel_id: string
          created_at: string
          days_of_week: number[] | null
          duration_override: number | null
          end_date: string | null
          end_time: string | null
          global_position: number | null
          id: string
          is_schedule_override: boolean | null
          media_id: string
          position: number
          start_date: string | null
          start_time: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          days_of_week?: number[] | null
          duration_override?: number | null
          end_date?: string | null
          end_time?: string | null
          global_position?: number | null
          id?: string
          is_schedule_override?: boolean | null
          media_id: string
          position?: number
          start_date?: string | null
          start_time?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          days_of_week?: number[] | null
          duration_override?: number | null
          end_date?: string | null
          end_time?: string | null
          global_position?: number | null
          id?: string
          is_schedule_override?: boolean | null
          media_id?: string
          position?: number
          start_date?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_channel_items_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "playlist_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_channel_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_channels: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          description: string | null
          end_date: string | null
          end_time: string
          id: string
          is_active: boolean
          is_fallback: boolean
          metadata: Json | null
          name: string
          playlist_id: string
          position: number
          start_date: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          metadata?: Json | null
          name: string
          playlist_id: string
          position?: number
          start_date?: string | null
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          metadata?: Json | null
          name?: string
          playlist_id?: string
          position?: number
          start_date?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_channels_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          duration_override: number | null
          end_date: string | null
          end_time: string | null
          id: string
          is_schedule_override: boolean | null
          media_id: string
          playlist_id: string
          position: number
          start_date: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          duration_override?: number | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_schedule_override?: boolean | null
          media_id: string
          playlist_id: string
          position?: number
          start_date?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          duration_override?: number | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_schedule_override?: boolean | null
          media_id?: string
          playlist_id?: string
          position?: number
          start_date?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          channel_id: string | null
          content_scale: string | null
          created_at: string
          days_of_week: number[] | null
          description: string | null
          end_date: string | null
          end_time: string | null
          fallback_media_id: string | null
          has_channels: boolean
          id: string
          is_active: boolean
          name: string
          priority: number | null
          schedule: Json | null
          start_date: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          content_scale?: string | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          fallback_media_id?: string | null
          has_channels?: boolean
          id?: string
          is_active?: boolean
          name: string
          priority?: number | null
          schedule?: Json | null
          start_date?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          content_scale?: string | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          fallback_media_id?: string | null
          has_channels?: boolean
          id?: string
          is_active?: boolean
          name?: string
          priority?: number | null
          schedule?: Json | null
          start_date?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_distribution_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "distribution_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_fallback_media_id_fkey"
            columns: ["fallback_media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_cache: {
        Row: {
          company_id: string
          created_at: string
          ean: string
          expires_at: string
          id: string
          image_url: string | null
          product_data: Json
          store_code: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ean: string
          expires_at: string
          id?: string
          image_url?: string | null
          product_data: Json
          store_code: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ean?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          product_data?: Json
          store_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_display_settings: {
        Row: {
          accent_color: string | null
          company_id: string
          container_primary_color: string | null
          container_secondary_color: string | null
          created_at: string
          enable_color_extraction: boolean
          id: string
          image_background_color: string | null
          image_position: string
          layout_preset: number
          original_price_font_size: number
          price_font_size: number
          price_position: string
          remove_image_background: boolean
          subtitle_font_size: number
          title_font_size: number
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          company_id: string
          container_primary_color?: string | null
          container_secondary_color?: string | null
          created_at?: string
          enable_color_extraction?: boolean
          id?: string
          image_background_color?: string | null
          image_position?: string
          layout_preset?: number
          original_price_font_size?: number
          price_font_size?: number
          price_position?: string
          remove_image_background?: boolean
          subtitle_font_size?: number
          title_font_size?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          company_id?: string
          container_primary_color?: string | null
          container_secondary_color?: string | null
          created_at?: string
          enable_color_extraction?: boolean
          id?: string
          image_background_color?: string | null
          image_position?: string
          layout_preset?: number
          original_price_font_size?: number
          price_font_size?: number
          price_position?: string
          remove_image_background?: boolean
          subtitle_font_size?: number
          title_font_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_display_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lookup_analytics: {
        Row: {
          age_estimate: number | null
          age_group: string | null
          ai_category: string | null
          ai_description: string | null
          ai_enriched: boolean | null
          ai_enriched_at: string | null
          ai_tags: string[] | null
          company_id: string | null
          created_at: string
          device_id: string | null
          ean: string
          emotion: string | null
          emotion_confidence: number | null
          first_lookup_at: string
          gender: string | null
          id: string
          last_lookup_at: string
          lookup_count: number | null
          lookup_date: string
          product_data: Json | null
          product_name: string | null
          store_code: string | null
          updated_at: string
        }
        Insert: {
          age_estimate?: number | null
          age_group?: string | null
          ai_category?: string | null
          ai_description?: string | null
          ai_enriched?: boolean | null
          ai_enriched_at?: string | null
          ai_tags?: string[] | null
          company_id?: string | null
          created_at?: string
          device_id?: string | null
          ean: string
          emotion?: string | null
          emotion_confidence?: number | null
          first_lookup_at?: string
          gender?: string | null
          id?: string
          last_lookup_at?: string
          lookup_count?: number | null
          lookup_date?: string
          product_data?: Json | null
          product_name?: string | null
          store_code?: string | null
          updated_at?: string
        }
        Update: {
          age_estimate?: number | null
          age_group?: string | null
          ai_category?: string | null
          ai_description?: string | null
          ai_enriched?: boolean | null
          ai_enriched_at?: string | null
          ai_tags?: string[] | null
          company_id?: string | null
          created_at?: string
          device_id?: string | null
          ean?: string
          emotion?: string | null
          emotion_confidence?: number | null
          first_lookup_at?: string
          gender?: string | null
          id?: string
          last_lookup_at?: string
          lookup_count?: number | null
          lookup_date?: string
          product_data?: Json | null
          product_name?: string | null
          store_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lookup_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lookup_analytics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lookup_logs: {
        Row: {
          company_id: string | null
          created_at: string
          device_id: string | null
          ean: string
          error_message: string | null
          id: string
          latency_ms: number | null
          status: string
          store_code: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          device_id?: string | null
          ean: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          status: string
          store_code?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          device_id?: string | null
          ean?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          status?: string
          store_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_lookup_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lookup_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recommendations: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          ean: string
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          score: number | null
          source_data: Json | null
          tags: string[] | null
          target_age_max: number | null
          target_age_min: number | null
          target_gender: string | null
          target_mood: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          ean: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          score?: number | null
          source_data?: Json | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_gender?: string | null
          target_mood?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          ean?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          score?: number | null
          source_data?: Json | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_gender?: string | null
          target_mood?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          region_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          region_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          region_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "states_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          bairro: string | null
          cep: string | null
          city_id: string
          cnpj: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          regional_responsavel: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bairro?: string | null
          cep?: string | null
          city_id: string
          cnpj?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          regional_responsavel?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bairro?: string | null
          cep?: string | null
          city_id?: string
          cnpj?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          regional_responsavel?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_admin_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admin_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_migration_at: string | null
          max_devices: number | null
          max_stores: number | null
          max_users: number | null
          metadata: Json | null
          migration_version: number | null
          name: string
          schema_name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_migration_at?: string | null
          max_devices?: number | null
          max_stores?: number | null
          max_users?: number | null
          metadata?: Json | null
          migration_version?: number | null
          name: string
          schema_name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_migration_at?: string | null
          max_devices?: number | null
          max_stores?: number | null
          max_users?: number | null
          metadata?: Json | null
          migration_version?: number | null
          name?: string
          schema_name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tenant_mappings: {
        Row: {
          created_at: string | null
          id: string
          is_tenant_admin: boolean | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_tenant_admin?: boolean | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_tenant_admin?: boolean | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_locations: {
        Row: {
          city: string
          created_at: string
          current_temp: number | null
          daily_forecast: Json | null
          display_time: number | null
          hourly_forecast: Json | null
          humidity: number | null
          id: string
          is_active: boolean
          is_default: boolean
          last_updated_at: string | null
          latitude: number | null
          layout_type: string | null
          longitude: number | null
          openweather_city_id: string | null
          raw_data: Json | null
          state: string
          tenant_id: string | null
          theme_color: string | null
          type_view: string | null
          updated_at: string
          weather_description: string | null
          weather_icon: string | null
          wind_speed: number | null
        }
        Insert: {
          city: string
          created_at?: string
          current_temp?: number | null
          daily_forecast?: Json | null
          display_time?: number | null
          hourly_forecast?: Json | null
          humidity?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_updated_at?: string | null
          latitude?: number | null
          layout_type?: string | null
          longitude?: number | null
          openweather_city_id?: string | null
          raw_data?: Json | null
          state: string
          tenant_id?: string | null
          theme_color?: string | null
          type_view?: string | null
          updated_at?: string
          weather_description?: string | null
          weather_icon?: string | null
          wind_speed?: number | null
        }
        Update: {
          city?: string
          created_at?: string
          current_temp?: number | null
          daily_forecast?: Json | null
          display_time?: number | null
          hourly_forecast?: Json | null
          humidity?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_updated_at?: string | null
          latitude?: number | null
          layout_type?: string | null
          longitude?: number | null
          openweather_city_id?: string | null
          raw_data?: Json | null
          state?: string
          tenant_id?: string | null
          theme_color?: string | null
          type_view?: string | null
          updated_at?: string
          weather_description?: string | null
          weather_icon?: string | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_tenant_data: {
        Args: { check_tenant_id: string; check_user_id: string }
        Returns: boolean
      }
      create_tenant_schema: {
        Args: { p_schema_name: string; p_tenant_id: string }
        Returns: undefined
      }
      device_heartbeat: {
        Args: {
          p_current_playlist_id?: string
          p_device_token: string
          p_status: string
        }
        Returns: Json
      }
      drop_tenant_schema: {
        Args: { p_confirm: string; p_schema_name: string; p_tenant_id: string }
        Returns: undefined
      }
      get_device_config: { Args: { p_device_token: string }; Returns: Json }
      get_device_weather_settings: {
        Args: { p_device_code: string }
        Returns: Json
      }
      get_public_device_info: {
        Args: { p_device_code: string }
        Returns: {
          blocked_message: string
          camera_enabled: boolean
          company_id: string
          company_slug: string
          current_playlist_id: string
          id: string
          is_blocked: boolean
          last_sync_requested_at: string
          name: string
          override_media_data: Json
          override_media_expires_at: string
          override_media_id: string
          store_code: string
          store_id: string
        }[]
      }
      get_public_playlists_data: {
        Args: { p_channel_ids: string[]; p_playlist_ids: string[] }
        Returns: Json
      }
      get_user_tenant_id: { Args: { check_user_id?: string }; Returns: string }
      get_user_tenant_id_strict: {
        Args: { check_user_id?: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { check_tenant_id: string; check_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_tenant_admin: { Args: { check_user_id?: string }; Returns: boolean }
      list_tenant_schemas: {
        Args: never
        Returns: {
          created_at: string
          is_active: boolean
          schema_name: string
          tenant_id: string
          tenant_name: string
        }[]
      }
      register_device: {
        Args: {
          p_company_id: string
          p_device_code: string
          p_group_id: string
          p_name: string
          p_store_code?: string
          p_store_id: string
        }
        Returns: Json
      }
      register_play_logs: {
        Args: { p_device_token: string; p_logs: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin_global"
        | "admin_regional"
        | "admin_loja"
        | "operador_conteudo"
        | "tecnico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin_global",
        "admin_regional",
        "admin_loja",
        "operador_conteudo",
        "tecnico",
      ],
    },
  },
} as const
