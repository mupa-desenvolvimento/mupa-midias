import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeviceGroupWithDetails } from "@/hooks/useDeviceGroups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Store as StoreIcon,
  Monitor,
  Tv,
  MoreVertical,
  Edit,
  Trash2,
  Link2,
  Star,
  Globe,
  CircleDot,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { DeviceDraggableItem } from "./management/DeviceDraggableItem";

const SCREEN_ICONS: Record<string, typeof Monitor> = {
  tv: Tv,
  totem: Monitor,
  terminal: Monitor,
};

interface DeviceMember {
  id: string;
  device_id: string;
  group_id: string;
  device?: {
    id: string;
    name: string;
    device_code: string;
    status: string;
    is_active: boolean;
    store_id: string | null;
  } | null;
}

interface DeviceGroupsTreeProps {
  groups: DeviceGroupWithDetails[];
  onEdit: (group: DeviceGroupWithDetails) => void;
  onDelete: (groupId: string) => void;
  onManageChannels: (group: DeviceGroupWithDetails) => void;
}

export const DeviceGroupsTree = ({
  groups,
  onEdit,
  onDelete,
  onManageChannels,
}: DeviceGroupsTreeProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  const { data: members = [] } = useQuery<DeviceMember[]>({
    queryKey: ["device-group-members-tree", groupIds],
    queryFn: async () => {
      if (groupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("device_group_members")
        .select(
          `id, device_id, group_id,
           device:devices(id, name, device_code, status, is_active, store_id)`
        )
        .in("group_id", groupIds);
      if (error) throw error;
      return (data as unknown as DeviceMember[]) || [];
    },
    enabled: groupIds.length > 0,
  });

  // Build tree: group -> store -> devices
  const tree = useMemo(() => {
    return groups.map((group) => {
      const groupMembers = members.filter((m) => m.group_id === group.id);
      const devices = groupMembers
        .map((m) => m.device)
        .filter((d): d is NonNullable<typeof d> => Boolean(d));

      // Bucket devices by store_id (fallback to "no-store")
      const buckets = new Map<
        string,
        { storeId: string | null; storeName: string; devices: typeof devices }
      >();

      devices.forEach((device) => {
        const sid = device.store_id || "__no_store__";
        const storeName =
          device.store_id && group.store?.id === device.store_id
            ? group.store.name
            : group.store?.name || "Sem loja";
        if (!buckets.has(sid)) {
          buckets.set(sid, {
            storeId: device.store_id,
            storeName,
            devices: [],
          });
        }
        buckets.get(sid)!.devices.push(device);
      });

      // If no devices yet, show one empty bucket from the group's own store
      if (buckets.size === 0 && group.store) {
        buckets.set(group.store.id, {
          storeId: group.store.id,
          storeName: group.store.name,
          devices: [],
        });
      }

      return {
        group,
        deviceCount: devices.length,
        stores: Array.from(buckets.values()),
      };
    });
  }, [groups, members]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStore = (key: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {tree.map(({ group, deviceCount, stores }) => {
        const isOpen = expandedGroups.has(group.id);
        const ScreenIcon = SCREEN_ICONS[group.screen_type] || Monitor;
        const screenLabel =
          group.screen_type === "tv"
            ? "TV"
            : group.screen_type === "totem"
            ? "Totem"
            : "Terminal";

        // Group drop zone
        const { setNodeRef, isOver } = useDroppable({
          id: `group-${group.id}`,
          data: {
            type: "group",
            groupId: group.id,
          },
        });

        return (
          <Card
            key={group.id}
            ref={setNodeRef}
            className={cn(
              "overflow-hidden border-l-4 transition-all",
              isOver ? "border-l-primary scale-[1.01] shadow-lg ring-2 ring-primary/20 bg-primary/5" : "border-l-primary/60 hover:border-l-primary"
            )}
          >
            {/* GROUP NODE */}
            <div className="flex items-center gap-3 p-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => toggleGroup(group.id)}
                aria-label={isOpen ? "Recolher" : "Expandir"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <TruncatedText
                    text={group.name}
                    as="h3"
                    className="text-base font-semibold"
                  />
                  {group.is_default && (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                </div>
                {group.description && (
                  <TruncatedText
                    text={group.description}
                    as="p"
                    className="text-xs text-muted-foreground"
                  />
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <ScreenIcon className="h-3 w-3" />
                  {screenLabel}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Monitor className="h-3 w-3" />
                  {deviceCount} {deviceCount === 1 ? "disp" : "disps"}
                </Badge>
                {!group.store && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Global
                  </Badge>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onManageChannels(group)}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Gerenciar campanhas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(group)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(group.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* CHILDREN */}
            {isOpen && (
              <div className="border-t bg-muted/20 px-4 py-3">
                {stores.length === 0 ? (
                  <div className="py-3 pl-12 text-sm text-muted-foreground">
                    Nenhum dispositivo neste grupo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stores.map((bucket) => {
                      const storeKey = `${group.id}:${bucket.storeId ?? "none"}`;
                      const storeOpen =
                        expandedStores.has(storeKey) || stores.length === 1;
                      return (
                        <div
                          key={storeKey}
                          className="relative pl-6"
                        >
                          {/* tree connector */}
                          <span className="absolute left-2 top-0 h-full w-px bg-border" />
                          <span className="absolute left-2 top-5 h-px w-3 bg-border" />

                          <div className="rounded-md border bg-background">
                            <button
                              type="button"
                              onClick={() => toggleStore(storeKey)}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
                            >
                              {storeOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <StoreIcon className="h-4 w-4 shrink-0 text-amber-500" />
                              <TruncatedText
                                text={bucket.storeName}
                                className="flex-1 text-sm font-medium"
                              />
                              <Badge variant="outline" className="text-xs">
                                {bucket.devices.length}
                              </Badge>
                            </button>

                            {storeOpen && (
                              <div className="border-t px-3 py-3">
                                {bucket.devices.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    Sem dispositivos
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {bucket.devices.map((device) => (
                                      <div
                                        key={device.id}
                                        className={cn(
                                          "flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5",
                                          "transition-colors hover:border-primary/40"
                                        )}
                                      >
                                        <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                          <TruncatedText
                                            text={device.name}
                                            className="text-xs font-medium leading-tight"
                                          />
                                          <TruncatedText
                                            text={device.device_code}
                                            className="text-[10px] text-muted-foreground leading-tight"
                                          />
                                        </div>
                                        <CircleDot
                                          className={cn(
                                            "h-3 w-3 shrink-0",
                                            device.status === "online" &&
                                              device.is_active
                                              ? "text-emerald-500"
                                              : "text-muted-foreground/40"
                                          )}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
