export type AppRole = 'admin_global' | 'admin_regional' | 'admin_loja' | 'operador_conteudo' | 'tecnico';

export interface Country {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
  country?: Country;
}

export interface State {
  id: string;
  region_id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
  region?: Region;
}

export interface City {
  id: string;
  state_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  state?: State;
}

export interface Store {
  id: string;
  city_id: string;
  code: string;
  name: string;
  address: string | null;
  playlist_id?: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  city?: City;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  entity_type: 'country' | 'region' | 'state' | 'city' | 'store';
  entity_id: string;
  created_at: string;
}

export interface ImportLog {
  id: string;
  user_id: string | null;
  type: string;
  file_name: string | null;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  errors: Array<{ row: number; message: string }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface StoreWithHierarchy extends Store {
  city: City & {
    state: State & {
      region: Region & {
        country: Country;
      };
    };
  };
}
