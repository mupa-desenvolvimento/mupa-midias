import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StoreWithHierarchy, Region, State, City } from '@/types/database';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { useUserTenant } from './useUserTenant';

interface StoreInsert {
  code: string;
  name: string;
  city_id: string;
  address?: string | null;
  is_active?: boolean;
  metadata?: Json;
  tenant_id?: string | null;
}

interface StoreUpdate {
  code?: string;
  name?: string;
  city_id?: string;
  address?: string | null;
  is_active?: boolean;
  metadata?: Json;
}

export function useStores() {
  const [stores, setStores] = useState<StoreWithHierarchy[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { tenantId, isSuperAdmin } = useUserTenant();

  const fetchStores = async () => {
    try {
      let query = supabase
        .from('stores')
        .select(`
          *,
          city:cities(
            *,
            state:states(
              *,
              region:regions(
                *,
                country:countries(*)
              )
            )
          )
        `)
        .order('name');

      // Filter by tenant if not super admin
      if (!isSuperAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStores((data as unknown as StoreWithHierarchy[]) || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchRegions = async () => {
    try {
      let query = supabase
        .from('regions')
        .select('*, country:countries(*)')
        .order('name');

      if (!isSuperAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchStates = async () => {
    try {
      let query = supabase
        .from('states')
        .select('*, region:regions(*)')
        .order('name');

      if (!isSuperAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStates(data || []);
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  const fetchCities = async () => {
    try {
      let query = supabase
        .from('cities')
        .select('*, state:states(*)')
        .order('name');

      if (!isSuperAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchStores(), fetchRegions(), fetchStates(), fetchCities()]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin || tenantId) {
      fetchAll();
    }
  }, [tenantId, isSuperAdmin]);

  const createStore = async (store: StoreInsert) => {
    try {
      // Auto-assign tenant_id if not super admin
      const storeData = { ...store };
      if (!isSuperAdmin && tenantId && !storeData.tenant_id) {
        storeData.tenant_id = tenantId;
      }

      const { data, error } = await supabase
        .from('stores')
        .insert(storeData)
        .select()
        .single();

      if (error) throw error;
      await fetchStores();
      toast.success('Loja criada com sucesso');
      return data;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '23505') {
        toast.error('Já existe uma loja com este código');
      } else {
        toast.error('Erro ao criar loja');
      }
      throw error;
    }
  };

  const updateStore = async (id: string, updates: StoreUpdate) => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchStores();
      toast.success('Loja atualizada com sucesso');
      return data;
    } catch (error) {
      toast.error('Erro ao atualizar loja');
      throw error;
    }
  };

  const deleteStore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchStores();
      toast.success('Loja excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir loja');
      throw error;
    }
  };

  const createState = async (state: { region_id: string; name: string; code: string; tenant_id?: string }) => {
    const stateData = { ...state };
    if (!isSuperAdmin && tenantId && !stateData.tenant_id) {
      stateData.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('states')
      .insert(stateData)
      .select()
      .single();

    if (error) throw error;
    await fetchStates();
    return data;
  };

  const createCity = async (city: { state_id: string; name: string; tenant_id?: string }) => {
    const cityData = { ...city };
    if (!isSuperAdmin && tenantId && !cityData.tenant_id) {
      cityData.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('cities')
      .insert(cityData)
      .select()
      .single();

    if (error) throw error;
    await fetchCities();
    return data;
  };

  const createRegion = async (region: { country_id: string; name: string; code?: string; tenant_id?: string }) => {
    const regionData = { ...region };
    if (!isSuperAdmin && tenantId && !regionData.tenant_id) {
      regionData.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('regions')
      .insert(regionData)
      .select()
      .single();

    if (error) throw error;
    await fetchRegions();
    return data;
  };

  return {
    stores,
    regions,
    states,
    cities,
    isLoading,
    refetch: fetchAll,
    createStore,
    updateStore,
    deleteStore,
    createState,
    createCity,
    createRegion,
  };
}
