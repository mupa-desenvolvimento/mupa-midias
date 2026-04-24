import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type DeviceCommandStatus = "pending" | "executed" | "failed";

export interface DeviceCommand {
  id: string;
  device_id: string;
  command: string;
  status: DeviceCommandStatus;
  created_at: string;
  executed_at: string | null;
  error_message: string | null;
  metadata: any;
}

export const useDeviceCommands = (deviceId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: commands = [], isLoading } = useQuery({
    queryKey: ["device_commands", deviceId],
    queryFn: async () => {
      if (!deviceId) return [];
      const { data, error } = await supabase
        .from("device_commands")
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as DeviceCommand[];
    },
    enabled: !!deviceId,
  });

  const sendCommand = useMutation({
    mutationFn: async ({ deviceId, command, metadata = {} }: { deviceId: string; command: string; metadata?: any }) => {
      const { data, error } = await supabase
        .from("device_commands")
        .insert([{ device_id: deviceId, command, metadata, status: "pending" }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device_commands", deviceId] });
      toast({
        title: "Comando enviado",
        description: "O comando foi registrado e será enviado ao dispositivo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar comando",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    commands,
    isLoading,
    sendCommand,
  };
};
