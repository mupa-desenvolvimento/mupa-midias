import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupDevice {
  id: string;
  group_id: string;
  device_id: string;
  created_at: string;
  device?: { id: string; name: string; device_code: string; status: string } | null;
}

export const useGroupDevices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groupDevices = [], isLoading } = useQuery({
    queryKey: ["group-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_devices")
        .select(`
          *,
          device:devices(id, name, device_code, status)
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as GroupDevice[];
    },
  });

  const linkDevice = useMutation({
    mutationFn: async ({ groupId, deviceId }: { groupId: string; deviceId: string }) => {
      const { data, error } = await supabase
        .from("group_devices")
        .insert([{ group_id: groupId, device_id: deviceId }])
        .select(`*, device:devices(id, name, device_code, status)`)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-devices"] });
      toast({ title: "Dispositivo vinculado ao grupo" });
    },
    onError: (error) => {
      const msg = error.message.includes("duplicate") ? "Dispositivo já vinculado a este grupo" : error.message;
      toast({ title: "Erro ao vincular dispositivo", description: msg, variant: "destructive" });
    },
  });

  const unlinkDevice = useMutation({
    mutationFn: async ({ groupId, deviceId }: { groupId: string; deviceId: string }) => {
      const { error } = await supabase
        .from("group_devices")
        .delete()
        .eq("group_id", groupId)
        .eq("device_id", deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-devices"] });
      toast({ title: "Dispositivo desvinculado do grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao desvincular dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const getDevicesForGroup = (groupId: string) => {
    return groupDevices.filter(gd => gd.group_id === groupId);
  };

  return { groupDevices, isLoading, linkDevice, unlinkDevice, getDevicesForGroup };
};
