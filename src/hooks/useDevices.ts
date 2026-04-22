import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";
import type { Json } from "@/integrations/supabase/types";
import { useEffect } from "react";

// ... keep existing types

export const useDevices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, companyId, isSuperAdmin } = useUserTenant();

  const { data: devices = [], isLoading, error, refetch } = useQuery({
    queryKey: ["devices", tenantId, isSuperAdmin],
    queryFn: async () => {
      // ... keep existing fetch logic (lines 83-219)
    },
  });

  // Realtime subscription for devices
  useEffect(() => {
    const channel = supabase
      .channel("devices-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        (payload) => {
          console.log("[Devices] Realtime change received:", payload);
          // Optimization: Update the cache directly instead of invalidating everything
          if (payload.eventType === "UPDATE") {
            queryClient.setQueryData<DeviceWithRelations[]>(["devices", tenantId, isSuperAdmin], (old) => {
              if (!old) return old;
              return old.map((d) => 
                d.id === payload.new.id ? { ...d, ...payload.new } as DeviceWithRelations : d
              );
            });
          } else {
            // For INSERT or DELETE, invalidating is safer
            queryClient.invalidateQueries({ queryKey: ["devices"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, isSuperAdmin]);

  // ... keep existing mutations (createDevice, updateDevice, deleteDevice)

  return {
    devices,
    isLoading,
    error,
    refetch,
    createDevice,
    updateDevice,
    deleteDevice,
  };
};

