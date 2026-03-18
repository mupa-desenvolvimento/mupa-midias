import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserTenantInfo {
  tenantId: string | null;
  companyId: string | null;
  isSuperAdmin: boolean;
}

export function useUserTenant() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-tenant-info", user?.id],
    queryFn: async (): Promise<UserTenantInfo> => {
      if (!user?.id) return { tenantId: null, companyId: null, isSuperAdmin: false };

      // Check if super admin
      const { data: superAdmin } = await supabase.rpc("is_super_admin", {
        check_user_id: user.id,
      });

      if (superAdmin) {
        return { tenantId: null, companyId: null, isSuperAdmin: true };
      }

      // Get tenant mapping
      const { data: mapping } = await supabase
        .from("user_tenant_mappings")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mapping?.tenant_id) return { tenantId: null, companyId: null, isSuperAdmin: false };

      // Get company for this tenant
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("tenant_id", mapping.tenant_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      return {
        tenantId: mapping.tenant_id,
        companyId: company?.id ?? null,
        isSuperAdmin: false,
      };
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  return {
    tenantId: data?.tenantId ?? null,
    companyId: data?.companyId ?? null,
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isLoading,
  };
}
