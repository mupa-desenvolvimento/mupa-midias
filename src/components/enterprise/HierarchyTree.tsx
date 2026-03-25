import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { ChevronRight, ChevronDown, Building2, MapPin, Map as MapIcon, Landmark, Store, Layers, Box, Monitor, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";

interface TreeNode {
  id: string;
  name: string;
  type: "company" | "state" | "region" | "city" | "store" | "sector" | "group" | "zone" | "device_type" | "device";
  children?: TreeNode[];
  status?: string;
  deviceCount?: number;
  meta?: Record<string, any>;
}

const typeIcons: Record<string, any> = {
  company: Building2,
  state: MapPin,
  region: MapIcon,
  city: Landmark,
  store: Store,
  sector: Layers,
  group: Layers,
  zone: Box,
  device_type: Monitor,
  device: Monitor,
};

const typeLabels: Record<string, string> = {
  company: "Empresa",
  state: "Estado",
  region: "Região",
  city: "Cidade",
  store: "Loja",
  sector: "Setor",
  group: "Grupo",
  zone: "Zona",
  device_type: "Tipo de Dispositivo",
  device: "Dispositivo",
};

interface TreeItemProps {
  node: TreeNode;
  level: number;
  onSelect: (node: TreeNode) => void;
  selectedId: string | null;
  searchActive: boolean;
}

const TreeItem = ({ node, level, onSelect, selectedId, searchActive }: TreeItemProps) => {
  const [expanded, setExpanded] = useState(level < 2 || searchActive);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = typeIcons[node.type] || Monitor;
  const isSelected = selectedId === node.id;
  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({
    id: `drag:${node.type}:${node.id}`,
    data: { type: node.type, id: node.id },
  });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `drop:${node.type}:${node.id}`,
    data: { type: node.type, id: node.id, meta: node.meta },
  });

  useEffect(() => {
    if (searchActive) setExpanded(true);
  }, [searchActive]);

  return (
    <div ref={dropRef}>
      <button
        ref={dragRef}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node);
        }}
        className={cn(
          "w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors hover:bg-accent/50",
          isSelected && "bg-primary/10 text-primary font-medium",
          isOver && "ring-1 ring-primary/40"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        data-node-id={node.id}
        data-node-type={node.type}
        {...listeners}
        {...attributes}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.type === "device" && node.status && (
          node.status === "online" ? (
            <Wifi className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
          )
        )}
        {node.deviceCount !== undefined && node.deviceCount > 0 && node.type !== "device" && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{node.deviceCount}</Badge>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface HierarchyTreeProps {
  onSelect?: (node: TreeNode) => void;
  search?: string;
}

export const HierarchyTree = ({ onSelect, search }: HierarchyTreeProps) => {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { tenantId } = useUserTenant();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!tenantId) return;
    loadTreeData();
  }, [tenantId]);

  const searchActive = Boolean(search && search.trim().length > 0);
  const filteredTree = (() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return tree;

    const filterNode = (node: TreeNode): TreeNode | null => {
      const nameMatch = (node.name || "").toLowerCase().includes(q);
      const children = (node.children || [])
        .map(filterNode)
        .filter((n): n is TreeNode => Boolean(n));

      if (nameMatch || children.length > 0) {
        return { ...node, children };
      }
      return null;
    };

    return tree.map(filterNode).filter((n): n is TreeNode => Boolean(n));
  })();

  const loadTreeData = async () => {
    setLoading(true);
    try {
      // Load all data in parallel
      const [companiesRes, statesRes, regionsRes, citiesRes, storesRes, sectorsRes, groupsRes, zonesRes, deviceTypesRes, devicesRes] = await Promise.all([
        supabase.from("companies").select("id, name, slug").eq("tenant_id", tenantId!),
        supabase.from("states").select("id, name, code, region_id"),
        supabase.from("regions").select("id, name, code, country_id"),
        supabase.from("cities").select("id, name, state_id"),
        supabase.from("stores").select("id, name, code, city_id, is_active").eq("tenant_id", tenantId!),
        supabase.from("sectors").select("id, name, store_id").eq("tenant_id", tenantId!),
        supabase.from("device_groups").select("id, name, store_id, tenant_id").eq("tenant_id", tenantId!),
        supabase.from("zones").select("id, name, sector_id").eq("tenant_id", tenantId!),
        supabase.from("device_types").select("id, name, code").eq("tenant_id", tenantId!),
        supabase.from("devices").select("id, name, device_code, store_id, sector_id, zone_id, device_type_id, status, company_id"),
      ]);

      const companies = companiesRes.data || [];
      const states = statesRes.data || [];
      const regions = regionsRes.data || [];
      const cities = citiesRes.data || [];
      const stores = storesRes.data || [];
      const sectors = sectorsRes.data || [];
      const groups = groupsRes.data || [];
      const zones = zonesRes.data || [];
      const deviceTypes = deviceTypesRes.data || [];
      const devices = devicesRes.data || [];
      const deviceTypeById = new Map(deviceTypes.map((t: any) => [t.id, t]));
      const groupIds = groups.map((g: any) => g.id).filter(Boolean);
      const groupMembersRes = groupIds.length
        ? await supabase.from("device_group_members").select("device_id, group_id").in("group_id", groupIds)
        : { data: [], error: null as any };
      if (groupMembersRes.error) throw groupMembersRes.error;
      const groupMembers = groupMembersRes.data || [];
      const groupDeviceIds = new Map<string, Set<string>>();
      const deviceGroupIds = new Map<string, Set<string>>();
      for (const m of groupMembers) {
        const byGroup = groupDeviceIds.get(m.group_id) || new Set<string>();
        byGroup.add(m.device_id);
        groupDeviceIds.set(m.group_id, byGroup);

        const byDevice = deviceGroupIds.get(m.device_id) || new Set<string>();
        byDevice.add(m.group_id);
        deviceGroupIds.set(m.device_id, byDevice);
      }

      // Build tree: Company > Region > State > City > Store > (Sectors | Groups) > Zone > (Device Type) > Device
      const treeNodes: TreeNode[] = companies.map((company) => {
        const companyDevices = devices.filter((d) => d.company_id === company.id);
        const companyStores = stores.filter((s) => {
          const storeDevices = companyDevices.filter((d) => d.store_id === s.id);
          return storeDevices.length > 0 || true; // Show all stores
        });

        // Group stores by city > state
        const storesByCityId = new globalThis.Map() as Map<string, any[]>;
        for (const store of companyStores) {
          if (!store.city_id) continue;
          if (!storesByCityId.has(store.city_id)) storesByCityId.set(store.city_id, []);
          storesByCityId.get(store.city_id)!.push(store);
        }

        const relevantCityIds = [...storesByCityId.keys()];
        const relevantCities = cities.filter((c) => relevantCityIds.includes(c.id));
        const relevantStateIds = [...new Set(relevantCities.map((c) => c.state_id))];
        const relevantStates = states.filter((s) => relevantStateIds.includes(s.id));

        const buildStateNode = (state: any): TreeNode => {
          const stateCities = relevantCities.filter((c) => c.state_id === state.id);

          const cityNodes: TreeNode[] = stateCities.map((city) => {
            const cityStores = storesByCityId.get(city.id) || [];

            const storeNodes: TreeNode[] = cityStores.map((store) => {
              const storeSectors = sectors.filter((s) => s.store_id === store.id);
              const storeGroups = groups.filter((g) => g.store_id === store.id);
              const storeDevices = companyDevices.filter((d) => d.store_id === store.id);

              const sectorNodes: TreeNode[] = storeSectors.map((sector) => {
                const sectorZones = zones.filter((z) => z.sector_id === sector.id);
                const sectorDevices = storeDevices.filter((d) => d.sector_id === sector.id);

                const zoneNodes: TreeNode[] = sectorZones.map((zone) => {
                  const zoneDevices = storeDevices.filter((d) => d.zone_id === zone.id);

                  const typedByTypeId = new Map<string, any[]>();
                  const untypedDevices: any[] = [];
                  for (const d of zoneDevices) {
                    if (d.device_type_id) {
                      const list = typedByTypeId.get(d.device_type_id) || [];
                      list.push(d);
                      typedByTypeId.set(d.device_type_id, list);
                    } else {
                      untypedDevices.push(d);
                    }
                  }

                  const deviceTypeNodes: TreeNode[] = [...typedByTypeId.entries()].map(([typeId, list]) => ({
                    id: typeId,
                    name: deviceTypeById.get(typeId)?.name || "Tipo de Dispositivo",
                    type: "device_type" as const,
                    deviceCount: list.length,
                    children: list.map((d: any) => ({
                      id: d.id,
                      name: d.name || d.device_code,
                      type: "device" as const,
                      status: d.status,
                    })),
                  }));

                  return {
                    id: zone.id,
                    name: zone.name,
                    type: "zone" as const,
                    deviceCount: zoneDevices.length,
                    meta: { sector_id: sector.id, store_id: store.id },
                    children: [
                      ...deviceTypeNodes,
                      ...untypedDevices.map((d) => ({
                        id: d.id,
                        name: d.name || d.device_code,
                        type: "device" as const,
                        status: d.status,
                      })),
                    ],
                  };
                });

                // Devices directly in sector (no zone)
                const unzonedDevices = sectorDevices.filter((d) => !d.zone_id);

                return {
                  id: sector.id,
                  name: sector.name,
                  type: "sector" as const,
                  deviceCount: sectorDevices.length,
                  meta: { store_id: store.id },
                  children: [
                    ...zoneNodes,
                    ...unzonedDevices.map((d) => ({
                      id: d.id,
                      name: d.name || d.device_code,
                      type: "device" as const,
                      status: d.status,
                    })),
                  ],
                };
              });

              const groupNodes: TreeNode[] = storeGroups.map((group) => {
                const memberDeviceIds = groupDeviceIds.get(group.id);
                const groupDevices = memberDeviceIds ? storeDevices.filter((d) => memberDeviceIds.has(d.id)) : [];
                return {
                  id: group.id,
                  name: group.name,
                  type: "group" as const,
                  deviceCount: groupDevices.length,
                  meta: { store_id: store.id },
                  children: groupDevices.map((d) => ({
                    id: d.id,
                    name: d.name || d.device_code,
                    type: "device" as const,
                    status: d.status,
                  })),
                };
              });

              // Devices directly in store (no sector/group)
              const unsectoredDevices = storeDevices.filter((d) => !d.sector_id && !deviceGroupIds.has(d.id) && !d.zone_id);

              return {
                id: store.id,
                name: store.name,
                type: "store" as const,
                deviceCount: storeDevices.length,
                meta: { code: store.code },
                children: [
                  ...sectorNodes,
                  ...groupNodes,
                  ...unsectoredDevices.map((d) => ({
                    id: d.id,
                    name: d.name || d.device_code,
                    type: "device" as const,
                    status: d.status,
                  })),
                ],
              };
            });

            return {
              id: city.id,
              name: city.name,
              type: "city" as const,
              deviceCount: cityStores.reduce((sum, s) => sum + companyDevices.filter((d) => d.store_id === s.id).length, 0),
              children: storeNodes,
            };
          });

          return {
            id: state.id,
            name: state.name,
            type: "state" as const,
            deviceCount: stateCities.reduce((sum, c) => {
              const cs = storesByCityId.get(c.id) || [];
              return sum + cs.reduce((s2, store) => s2 + companyDevices.filter((d) => d.store_id === store.id).length, 0);
            }, 0),
            children: cityNodes,
          };
        };

        const regionIdToStates = new Map<string, any[]>();
        const statesWithoutRegion: any[] = [];
        for (const s of relevantStates) {
          if (!s.region_id) {
            statesWithoutRegion.push(s);
            continue;
          }
          const list = regionIdToStates.get(s.region_id) || [];
          list.push(s);
          regionIdToStates.set(s.region_id, list);
        }

        const relevantRegionIds = [...new Set(relevantStates.map((s: any) => s.region_id).filter(Boolean))];
        const relevantRegions = regions.filter((r) => relevantRegionIds.includes(r.id));

        const regionNodes: TreeNode[] = relevantRegions.map((region) => {
          const regionStates = regionIdToStates.get(region.id) || [];
          const stateNodes = regionStates.map(buildStateNode);
          const deviceCount = stateNodes.reduce((sum, n) => sum + (n.deviceCount || 0), 0);
          return {
            id: region.id,
            name: region.name,
            type: "region" as const,
            deviceCount,
            children: stateNodes,
          };
        });

        const unassignedStateNodes = statesWithoutRegion.map(buildStateNode);

        return {
          id: company.id,
          name: company.name,
          type: "company" as const,
          deviceCount: companyDevices.length,
          children: [...regionNodes, ...unassignedStateNodes],
        };
      });

      setTree(treeNodes);
    } catch (err) {
      console.error("Error loading tree:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (node: TreeNode) => {
    setSelectedId(node.id);
    onSelect?.(node);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = (active?.data?.current as any) || {};
    const overData = (over?.data?.current as any) || {};
    const activeType = activeData.type;
    const activeId = activeData.id;
    const overType = overData.type;
    const overId = overData.id;
    if (!activeType || !activeId || !overType || !overId) return;
    const overMeta = overData.meta || {};
    if (overMeta?.virtual) return;

    try {
      if (activeType === "state" && overType === "region") {
        const { error } = await supabase.from("states").update({ region_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Estado movido para a região");
        await loadTreeData();
        return;
      }
      if (activeType === "device" && overType === "group") {
        const storeId = overMeta?.store_id;
        const { error: delError } = await supabase.from("device_group_members").delete().eq("device_id", activeId);
        if (delError) throw delError;
        if (storeId) {
          const { error: updError } = await supabase.from("devices").update({ store_id: storeId, sector_id: null, zone_id: null }).eq("id", activeId);
          if (updError) throw updError;
        }
        const { error } = await supabase.from("device_group_members").insert({ device_id: activeId, group_id: overId });
        if (error) throw error;
        toast.success("Dispositivo movido para o grupo");
        await loadTreeData();
        return;
      }
      if (activeType === "device" && overType === "sector") {
        const storeId = overMeta?.store_id;
        const { error: delError } = await supabase.from("device_group_members").delete().eq("device_id", activeId);
        if (delError) throw delError;
        const { error } = await supabase.from("devices").update({ store_id: storeId || undefined, sector_id: overId, zone_id: null }).eq("id", activeId);
        if (error) throw error;
        toast.success("Dispositivo movido para o setor");
        await loadTreeData();
        return;
      }
      if (activeType === "device" && overType === "zone") {
        const storeId = overMeta?.store_id;
        const sectorId = overMeta?.sector_id;
        const { error: delError } = await supabase.from("device_group_members").delete().eq("device_id", activeId);
        if (delError) throw delError;
        const update: any = { zone_id: overId, sector_id: sectorId || null };
        if (storeId) update.store_id = storeId;
        const { error } = await supabase.from("devices").update(update).eq("id", activeId);
        if (error) throw error;
        toast.success("Dispositivo movido para a zona");
        await loadTreeData();
        return;
      }
      if (activeType === "device" && overType === "store") {
        const { error: delError } = await supabase.from("device_group_members").delete().eq("device_id", activeId);
        if (delError) throw delError;
        const { error } = await supabase.from("devices").update({ store_id: overId, sector_id: null, zone_id: null }).eq("id", activeId);
        if (error) throw error;
        toast.success("Dispositivo movido para a loja");
        await loadTreeData();
        return;
      }
      if (activeType === "device" && overType === "device_type") {
        const { error } = await supabase.from("devices").update({ device_type_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Tipo de dispositivo atualizado");
        await loadTreeData();
        return;
      }
      if (activeType === "group" && overType === "store") {
        const { error } = await supabase.from("device_groups").update({ store_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Grupo movido para a loja");
        await loadTreeData();
        return;
      }
      if (activeType === "sector" && overType === "store") {
        const { error } = await supabase.from("sectors").update({ store_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Setor movido para a loja");
        await loadTreeData();
        return;
      }
      if (activeType === "zone" && overType === "sector") {
        const { error } = await supabase.from("zones").update({ sector_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Zona movida para o setor");
        await loadTreeData();
        return;
      }
      if (activeType === "store" && overType === "city") {
        const { error } = await supabase.from("stores").update({ city_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Loja movida para a cidade");
        await loadTreeData();
        return;
      }
      if (activeType === "city" && overType === "state") {
        const { error } = await supabase.from("cities").update({ state_id: overId }).eq("id", activeId);
        if (error) throw error;
        toast.success("Cidade movida para o estado");
        await loadTreeData();
        return;
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao mover");
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p className="text-sm">Nenhuma empresa encontrada</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <ScrollArea className="h-full">
        <div className="py-2">
          {filteredTree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              level={0}
              onSelect={handleSelect}
              selectedId={selectedId}
              searchActive={searchActive}
            />
          ))}
        </div>
      </ScrollArea>
    </DndContext>
  );
};

export type { TreeNode };
