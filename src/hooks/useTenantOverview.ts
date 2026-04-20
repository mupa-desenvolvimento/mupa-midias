import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantOverviewEntry {
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  cnpj: string | null;
  defaultPlaylistId: string | null;
  integrationsCount: number;
  devicesCount: number;
  storesCount: number;
  usersCount: number;
}

export type TenantOverviewMap = Record<string, TenantOverviewEntry>;

/**
 * Aggregates per-tenant info (company, integrations, devices, stores, users)
 * for display on the super admin clients (tenants) page.
 */
export function useTenantOverview(tenantIds: string[]) {
  const [overview, setOverview] = useState<TenantOverviewMap>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tenantIds.length) {
      setOverview({});
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [companiesRes, devicesRes, storesRes, mappingsRes] = await Promise.all([
          supabase
            .from("companies")
            .select("id, tenant_id, name, code, cnpj, default_playlist_id, company_integrations(id)")
            .in("tenant_id", tenantIds),
          supabase
            .from("devices")
            .select("id, company_id, store_id, store:stores(tenant_id), company:companies(tenant_id)"),
          supabase
            .from("stores")
            .select("id, tenant_id")
            .in("tenant_id", tenantIds),
          supabase
            .from("user_tenant_mappings")
            .select("tenant_id")
            .in("tenant_id", tenantIds),
        ]);

        if (cancelled) return;

        const map: TenantOverviewMap = {};
        tenantIds.forEach((id) => {
          map[id] = {
            companyId: null,
            companyName: null,
            companyCode: null,
            cnpj: null,
            defaultPlaylistId: null,
            integrationsCount: 0,
            devicesCount: 0,
            storesCount: 0,
            usersCount: 0,
          };
        });

        (companiesRes.data ?? []).forEach((c: any) => {
          if (!c.tenant_id || !map[c.tenant_id]) return;
          // Prefer first company per tenant
          if (!map[c.tenant_id].companyId) {
            map[c.tenant_id].companyId = c.id;
            map[c.tenant_id].companyName = c.name;
            map[c.tenant_id].companyCode = c.code ?? null;
            map[c.tenant_id].cnpj = c.cnpj ?? null;
            map[c.tenant_id].defaultPlaylistId = c.default_playlist_id ?? null;
          }
          map[c.tenant_id].integrationsCount += c.company_integrations?.length ?? 0;
        });

        (devicesRes.data ?? []).forEach((d: any) => {
          const tenantId = d.store?.tenant_id ?? d.company?.tenant_id;
          if (tenantId && map[tenantId]) {
            map[tenantId].devicesCount += 1;
          }
        });

        (storesRes.data ?? []).forEach((s: any) => {
          if (s.tenant_id && map[s.tenant_id]) {
            map[s.tenant_id].storesCount += 1;
          }
        });

        (mappingsRes.data ?? []).forEach((m: any) => {
          if (m.tenant_id && map[m.tenant_id]) {
            map[m.tenant_id].usersCount += 1;
          }
        });

        setOverview(map);
      } catch (err) {
        console.error("[useTenantOverview] error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [tenantIds.join(",")]);

  return { overview, isLoading };
}
