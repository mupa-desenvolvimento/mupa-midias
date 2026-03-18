import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean | null;
  max_users: number | null;
  max_devices: number | null;
  max_stores: number | null;
  migration_version: number | null;
  last_migration_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: Json | null;
}

interface CreateTenantData {
  name: string;
  slug: string;
  max_users?: number;
  max_devices?: number;
  max_stores?: number;
  license_plan?: 'lite' | 'standard' | 'enterprise';
}

export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const createTenant = async (data: CreateTenantData) => {
    try {
      // Generate schema name from slug
      const schemaName = `tenant_${data.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Create tenant record
      const { data: tenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          schema_name: schemaName,
          max_users: data.max_users || 50,
          max_devices: data.max_devices || 100,
          max_stores: data.max_stores || 500,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create tenant schema using the function
      const { error: schemaError } = await supabase.rpc('create_tenant_schema', {
        p_tenant_id: tenant.id,
        p_schema_name: schemaName
      });

      if (schemaError) {
        // Rollback tenant creation if schema creation fails
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw schemaError;
      }

      // Create license record
      const plan = data.license_plan || 'standard';
      const expiresAt = new Date();
      if (plan === 'lite') {
        expiresAt.setMonth(expiresAt.getMonth() + 3); // 3 months for LITE
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year for others
      }

      const licenseDefaults = {
        lite: { max_playlists: 1, max_devices: 3, max_media_uploads: 5, max_stores: 3, max_device_groups: 1, allow_video_upload: false },
        standard: { max_playlists: 50, max_devices: 100, max_media_uploads: 500, max_stores: 500, max_device_groups: 50, allow_video_upload: true },
        enterprise: { max_playlists: 9999, max_devices: 9999, max_media_uploads: 9999, max_stores: 9999, max_device_groups: 9999, allow_video_upload: true },
      };

      const limits = licenseDefaults[plan];

      const { error: licenseError } = await supabase
        .from('tenant_licenses')
        .insert({
          tenant_id: tenant.id,
          plan: plan,
          is_active: true,
          expires_at: expiresAt.toISOString(),
          ...limits,
        });

      if (licenseError) {
        console.error('Error creating license:', licenseError);
        // Don't rollback tenant, just warn
        toast.error('Cliente criado, mas houve erro ao criar a licença');
      }

      await fetchTenants();
      toast.success('Cliente criado com sucesso');
      return tenant;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        toast.error('Já existe um cliente com este slug');
      } else {
        toast.error(`Erro ao criar cliente: ${err.message}`);
      }
      throw error;
    }
  };

  const updateTenant = async (id: string, updates: { name?: string; max_users?: number; max_devices?: number; max_stores?: number; license_plan?: 'lite' | 'standard' | 'enterprise' }) => {
    try {
      const { license_plan, ...tenantUpdates } = updates;
      
      const { error } = await supabase
        .from('tenants')
        .update(tenantUpdates)
        .eq('id', id);

      if (error) throw error;

      // Update license if plan changed
      if (license_plan) {
        const licenseDefaults = {
          lite: { max_playlists: 1, max_devices: 3, max_media_uploads: 5, max_stores: 3, max_device_groups: 1, allow_video_upload: false },
          standard: { max_playlists: 50, max_devices: 100, max_media_uploads: 500, max_stores: 500, max_device_groups: 50, allow_video_upload: true },
          enterprise: { max_playlists: 9999, max_devices: 9999, max_media_uploads: 9999, max_stores: 9999, max_device_groups: 9999, allow_video_upload: true },
        };
        const limits = licenseDefaults[license_plan];
        const expiresAt = new Date();
        if (license_plan === 'lite') {
          expiresAt.setMonth(expiresAt.getMonth() + 3);
        } else {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        // Upsert license
        const { data: existing } = await supabase
          .from('tenant_licenses')
          .select('id')
          .eq('tenant_id', id)
          .maybeSingle();

        if (existing) {
          await supabase.from('tenant_licenses').update({
            plan: license_plan,
            expires_at: expiresAt.toISOString(),
            is_active: true,
            ...limits,
          }).eq('tenant_id', id);
        } else {
          await supabase.from('tenant_licenses').insert({
            tenant_id: id,
            plan: license_plan,
            expires_at: expiresAt.toISOString(),
            is_active: true,
            ...limits,
          });
        }
      }

      await fetchTenants();
      toast.success('Cliente atualizado com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar cliente');
      throw error;
    }
  };

  const getTenantLicense = async (tenantId: string) => {
    const { data } = await supabase
      .from('tenant_licenses')
      .select('plan')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();
    return (data?.plan as 'lite' | 'standard' | 'enterprise') || 'standard';
  };

  const toggleTenantStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      await fetchTenants();
      toast.success(isActive ? 'Cliente ativado' : 'Cliente desativado');
    } catch (error) {
      toast.error('Erro ao alterar status do cliente');
      throw error;
    }
  };

  const deleteTenant = async (id: string) => {
    try {
      // Get tenant info first
      const tenant = tenants.find(t => t.id === id);
      if (!tenant) throw new Error('Tenant not found');

      // Drop schema first
      const { error: dropError } = await supabase.rpc('drop_tenant_schema', {
        p_tenant_id: id,
        p_schema_name: tenant.schema_name,
        p_confirm: `CONFIRM_DELETE_${tenant.schema_name}`
      });

      if (dropError) throw dropError;

      // Delete tenant record
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchTenants();
      toast.success('Cliente excluído com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir cliente');
      throw error;
    }
  };

  return {
    tenants,
    isLoading,
    refetch: fetchTenants,
    createTenant,
    updateTenant,
    toggleTenantStatus,
    deleteTenant,
    getTenantLicense,
  };
}
