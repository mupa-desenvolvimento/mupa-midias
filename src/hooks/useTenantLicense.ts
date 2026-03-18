import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LicensePlan = "lite" | "standard" | "enterprise";

export interface TenantLicense {
  has_license: boolean;
  plan?: LicensePlan;
  max_playlists?: number;
  max_devices?: number;
  max_media_uploads?: number;
  max_stores?: number;
  max_device_groups?: number;
  allow_video_upload?: boolean;
  expires_at?: string;
  starts_at?: string;
}

// Items visible in LITE plan
const LITE_ALLOWED_URLS = [
  "/admin/dashboard",
  "/admin/stores",
  "/admin/devices",
  "/admin/device-groups",
  "/admin/playlists",
  "/admin/media",
  "/admin/settings",
  "/admin/product-analytics",
];

// Sidebar sections visible in LITE
const LITE_HIDDEN_SECTIONS = [
  "auto_content",
  "super_admin",
];

export function useTenantLicense() {
  const { user } = useAuth();

  const { data: license, isLoading, error } = useQuery({
    queryKey: ["tenant-license", user?.id],
    queryFn: async (): Promise<TenantLicense> => {
      if (!user?.id) return { has_license: false };

      // Get user's tenant
      const { data: mapping } = await supabase
        .from("user_tenant_mappings")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mapping?.tenant_id) return { has_license: false };

      const { data, error } = await supabase.rpc("get_tenant_license", {
        p_tenant_id: mapping.tenant_id,
      });

      if (error) throw error;
      return (data as unknown as TenantLicense) ?? { has_license: false };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isLite = license?.has_license && license.plan === "lite";
  const isExpired = license?.has_license && license.expires_at
    ? new Date(license.expires_at) < new Date()
    : false;

  const isMenuItemAllowed = (url: string) => {
    if (!isLite) return true;
    return LITE_ALLOWED_URLS.some((allowed) => url.startsWith(allowed));
  };

  const isSectionAllowed = (section: string) => {
    if (!isLite) return true;
    return !LITE_HIDDEN_SECTIONS.includes(section);
  };

  const canUploadVideo = license?.allow_video_upload ?? true;

  const checkLimit = (resource: "playlists" | "devices" | "media" | "stores" | "device_groups", currentCount: number) => {
    if (!isLite || !license) return true;
    const maxKey = `max_${resource}` as keyof TenantLicense;
    const max = license[maxKey] as number | undefined;
    if (max === undefined) return true;
    return currentCount < max;
  };

  return {
    license: license ?? { has_license: false },
    isLoading,
    error,
    isLite,
    isExpired,
    isMenuItemAllowed,
    isSectionAllowed,
    canUploadVideo,
    checkLimit,
  };
}
