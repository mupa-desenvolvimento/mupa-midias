import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import type { Json } from "@/integrations/supabase/types";

export type CampaignSegment = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  filters_json: Json;
  created_at: string;
  updated_at: string;
};

export type CampaignSegmentTarget = {
  id: string;
  segment_id: string;
  clause_id: string;
  target_type: string;
  include: boolean;
  company_id: string | null;
  state_id: string | null;
  region_id: string | null;
  city_id: string | null;
  store_id: string | null;
  sector_id: string | null;
  zone_id: string | null;
  device_type_id: string | null;
  device_group_id: string | null;
  device_id: string | null;
  tag_id: string | null;
  created_at: string;
};

export type SegmentUpsert = {
  name: string;
  description?: string | null;
  filters_json?: Json;
};

export type SegmentTargetInsert = {
  segment_id: string;
  clause_id?: string;
  target_type: string;
  include?: boolean;
  company_id?: string | null;
  state_id?: string | null;
  region_id?: string | null;
  city_id?: string | null;
  store_id?: string | null;
  sector_id?: string | null;
  zone_id?: string | null;
  device_type_id?: string | null;
  device_group_id?: string | null;
  device_id?: string | null;
  tag_id?: string | null;
};

export function useCampaignSegments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const segmentsQuery = useQuery({
    queryKey: ["campaign-segments", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("campaign_segments" as any)
        .select("id, tenant_id, name, description, filters_json, created_at, updated_at")
        .order("name");

      if (!isSuperAdmin) {
        if (!tenantId) return [] as CampaignSegment[];
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CampaignSegment[];
    },
  });

  const createSegment = useMutation({
    mutationFn: async (payload: SegmentUpsert) => {
      if (!isSuperAdmin && !tenantId) throw new Error("Tenant não encontrado");
      const insertPayload = {
        tenant_id: tenantId,
        name: payload.name,
        description: payload.description ?? null,
        filters_json: payload.filters_json ?? {},
      };
      const { data, error } = await supabase
        .from("campaign_segments" as any)
        .insert([insertPayload])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-segments"] });
      toast({ title: "Segmento criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, ...payload }: SegmentUpsert & { id: string }) => {
      const { error } = await supabase
        .from("campaign_segments" as any)
        .update({
          name: payload.name,
          description: payload.description ?? null,
          ...(payload.filters_json !== undefined ? { filters_json: payload.filters_json } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-segments"] });
      toast({ title: "Segmento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_segments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-segments"] });
      toast({ title: "Segmento removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addSegmentTarget = useMutation({
    mutationFn: async (payload: SegmentTargetInsert) => {
      const { error } = await supabase.from("campaign_segment_targets" as any).insert([
        {
          segment_id: payload.segment_id,
          ...(payload.clause_id ? { clause_id: payload.clause_id } : {}),
          target_type: payload.target_type,
          include: payload.include ?? true,
          company_id: payload.company_id ?? null,
          state_id: payload.state_id ?? null,
          region_id: payload.region_id ?? null,
          city_id: payload.city_id ?? null,
          store_id: payload.store_id ?? null,
          sector_id: payload.sector_id ?? null,
          zone_id: payload.zone_id ?? null,
          device_type_id: payload.device_type_id ?? null,
          device_group_id: payload.device_group_id ?? null,
          device_id: payload.device_id ?? null,
          tag_id: payload.tag_id ?? null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign-segment-targets", vars.segment_id] });
      toast({ title: "Filtro adicionado ao segmento" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeSegmentTarget = useMutation({
    mutationFn: async ({ id, segmentId }: { id: string; segmentId: string }) => {
      const { error } = await supabase.from("campaign_segment_targets" as any).delete().eq("id", id);
      if (error) throw error;
      return segmentId;
    },
    onSuccess: (segmentId) => {
      qc.invalidateQueries({ queryKey: ["campaign-segment-targets", segmentId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    segments: segmentsQuery.data ?? [],
    isLoading: segmentsQuery.isLoading,
    error: segmentsQuery.error,
    refetch: segmentsQuery.refetch,
    createSegment,
    updateSegment,
    deleteSegment,
    addSegmentTarget,
    removeSegmentTarget,
  };
}

export function useCampaignSegmentTargets(segmentId?: string | null) {
  return useQuery({
    queryKey: ["campaign-segment-targets", segmentId],
    enabled: !!segmentId,
    queryFn: async () => {
      if (!segmentId) return [] as CampaignSegmentTarget[];
      const { data, error } = await supabase
        .from("campaign_segment_targets" as any)
        .select(
          "id, segment_id, clause_id, target_type, include, company_id, state_id, region_id, city_id, store_id, sector_id, zone_id, device_type_id, device_group_id, device_id, tag_id, created_at"
        )
        .eq("segment_id", segmentId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as CampaignSegmentTarget[];
    },
  });
}

export type SegmentDeviceStats = { device_count: number; store_count: number };

export function useSegmentDeviceStats(segmentId?: string | null, opts?: { limit?: number; onlyOnline?: boolean }) {
  const limit = opts?.limit ?? 1000;
  const onlyOnline = opts?.onlyOnline ?? false;

  return useQuery({
    queryKey: ["segment-device-stats", segmentId, limit, onlyOnline],
    enabled: !!segmentId,
    queryFn: async () => {
      if (!segmentId) return { device_count: 0, store_count: 0 } as SegmentDeviceStats;
      const { data, error } = await supabase.rpc("resolve_segment_device_stats" as any, {
        p_segment_id: segmentId,
        p_limit: limit,
        p_only_online: onlyOnline,
      });
      if (error) throw error;
      const row = (data as any)?.[0] ?? data ?? { device_count: 0, store_count: 0 };
      return {
        device_count: Number(row.device_count ?? 0),
        store_count: Number(row.store_count ?? 0),
      } as SegmentDeviceStats;
    },
  });
}
