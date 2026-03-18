import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantLicense } from "./useTenantLicense";
import { useUserTenant } from "./useUserTenant";
import { useToast } from "./use-toast";

type Resource = "playlists" | "devices" | "media" | "stores" | "device_groups";

const RESOURCE_TABLE_MAP: Record<Resource, string> = {
  playlists: "playlists",
  devices: "devices",
  media: "media_items",
  stores: "stores",
  device_groups: "device_groups",
};

const RESOURCE_LABEL_MAP: Record<Resource, string> = {
  playlists: "playlists",
  devices: "dispositivos",
  media: "mídias",
  stores: "lojas",
  device_groups: "grupos de dispositivos",
};

const RESOURCE_TENANT_FILTER: Record<Resource, "tenant_id" | "company_id"> = {
  playlists: "tenant_id",
  devices: "company_id",
  media: "tenant_id",
  stores: "tenant_id",
  device_groups: "tenant_id",
};

export function useLimitCheck() {
  const { license, isLite } = useTenantLicense();
  const { tenantId, companyId, isSuperAdmin } = useUserTenant();
  const { toast } = useToast();

  const canCreate = useCallback(
    async (resource: Resource): Promise<boolean> => {
      if (isSuperAdmin || !isLite || !license?.has_license) return true;

      const maxKey = `max_${resource}` as keyof typeof license;
      const max = license[maxKey] as number | undefined;
      if (max === undefined) return true;

      const table = RESOURCE_TABLE_MAP[resource];
      const filterCol = RESOURCE_TENANT_FILTER[resource];
      const filterId = filterCol === "company_id" ? companyId : tenantId;

      if (!filterId) return false;

      let count = 0;

      if (resource === "devices" && tenantId) {
        // Devices filter by company_id, get all companies for tenant
        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("tenant_id", tenantId);
        const companyIds = (companies || []).map((c) => c.id);
        if (companyIds.length === 0) return true;

        const { count: c } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .in("company_id", companyIds);
        count = c || 0;
      } else {
        const { count: c } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq(filterCol, filterId);
        count = c || 0;
      }

      if (count >= max) {
        const label = RESOURCE_LABEL_MAP[resource];
        toast({
          title: `Limite do plano LITE atingido`,
          description: `Você atingiu o limite de ${max} ${label}. Faça upgrade para criar mais.`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    },
    [isSuperAdmin, isLite, license, tenantId, companyId, toast]
  );

  const canUploadVideo = !isLite || (license?.allow_video_upload ?? true);

  return { canCreate, canUploadVideo, isLite };
}
