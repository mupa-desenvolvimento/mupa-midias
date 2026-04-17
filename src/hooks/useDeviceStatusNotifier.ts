import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";
import React from "react";

/**
 * Listens for real-time changes on device_status_logs and shows
 * a toast whenever a device transitions online/offline.
 * Also invalidates the devices query so lists refresh automatically.
 */
export function useDeviceStatusNotifier() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("device-status-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_status_logs" },
        (payload) => {
          const row = payload.new as {
            device_name: string | null;
            new_status: string;
            old_status: string | null;
          };
          const name = row.device_name || "Dispositivo";
          const isOnline = row.new_status === "online";

          if (isOnline) {
            toast.success(`${name} está online`, {
              icon: React.createElement(Wifi, { className: "h-4 w-4" }),
              description: `Mudou de ${row.old_status ?? "—"} para online`,
            });
          } else {
            toast.warning(`${name} ficou ${row.new_status}`, {
              icon: React.createElement(WifiOff, { className: "h-4 w-4" }),
              description: `Mudou de ${row.old_status ?? "—"} para ${row.new_status}`,
            });
          }

          queryClient.invalidateQueries({ queryKey: ["devices"] });
          queryClient.invalidateQueries({ queryKey: ["logs-platform"] });
          queryClient.invalidateQueries({ queryKey: ["logs-device-status"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
