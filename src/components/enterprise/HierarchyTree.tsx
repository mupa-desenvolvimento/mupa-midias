import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { ChevronRight, ChevronDown, Building2, MapPin, Map, Landmark, Store, Layers, Box, Monitor, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TreeNode {
  id: string;
  name: string;
  type: "company" | "state" | "region" | "city" | "store" | "sector" | "zone" | "device";
  children?: TreeNode[];
  status?: string;
  deviceCount?: number;
  meta?: Record<string, any>;
}

const typeIcons: Record<string, any> = {
  company: Building2,
  state: MapPin,
  region: Map,
  city: Landmark,
  store: Store,
  sector: Layers,
  zone: Box,
  device: Monitor,
};

const typeLabels: Record<string, string> = {
  company: "Empresa",
  state: "Estado",
  region: "Região",
  city: "Cidade",
  store: "Loja",
  sector: "Setor",
  zone: "Zona",
  device: "Dispositivo",
};

interface TreeItemProps {
  node: TreeNode;
  level: number;
  onSelect: (node: TreeNode) => void;
  selectedId: string | null;
}

const TreeItem = ({ node, level, onSelect, selectedId }: TreeItemProps) => {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = typeIcons[node.type] || Monitor;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node);
        }}
        className={cn(
          "w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors hover:bg-accent/50",
          isSelected && "bg-primary/10 text-primary font-medium",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
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
            <TreeItem key={child.id} node={child} level={level + 1} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
};

interface HierarchyTreeProps {
  onSelect?: (node: TreeNode) => void;
}

export const HierarchyTree = ({ onSelect }: HierarchyTreeProps) => {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { tenantId } = useUserTenant();

  useEffect(() => {
    if (!tenantId) return;
    loadTreeData();
  }, [tenantId]);

  const loadTreeData = async () => {
    setLoading(true);
    try {
      // Load all data in parallel
      const [companiesRes, statesRes, regionsRes, citiesRes, storesRes, sectorsRes, zonesRes, devicesRes] = await Promise.all([
        supabase.from("companies").select("id, name, slug").eq("tenant_id", tenantId!),
        supabase.from("states").select("id, name, code, region_id"),
        supabase.from("regions").select("id, name, code, country_id"),
        supabase.from("cities").select("id, name, state_id"),
        supabase.from("stores").select("id, name, code, city_id, is_active").eq("tenant_id", tenantId!),
        supabase.from("sectors").select("id, name, store_id").eq("tenant_id", tenantId!),
        supabase.from("zones").select("id, name, sector_id").eq("tenant_id", tenantId!),
        supabase.from("devices").select("id, name, device_code, store_id, sector_id, zone_id, status, company_id"),
      ]);

      const companies = companiesRes.data || [];
      const states = statesRes.data || [];
      const regions = regionsRes.data || [];
      const cities = citiesRes.data || [];
      const stores = storesRes.data || [];
      const sectors = sectorsRes.data || [];
      const zones = zonesRes.data || [];
      const devices = devicesRes.data || [];

      // Build tree: Company > State > Region > City > Store > Sector > Zone > Device
      const treeNodes: TreeNode[] = companies.map((company) => {
        const companyDevices = devices.filter((d) => d.company_id === company.id);
        const companyStores = stores.filter((s) => {
          const storeDevices = companyDevices.filter((d) => d.store_id === s.id);
          return storeDevices.length > 0 || true; // Show all stores
        });

        // Group stores by city > state
        const storesByCityId: Record<string, any[]> = {};
        for (const store of companyStores) {
          if (!store.city_id) continue;
          if (!storesByCityId.has(store.city_id)) storesByCityId.set(store.city_id, []);
          storesByCityId.get(store.city_id)!.push(store);
        }

        const relevantCityIds = [...storesByCityId.keys()];
        const relevantCities = cities.filter((c) => relevantCityIds.includes(c.id));
        const relevantStateIds = [...new Set(relevantCities.map((c) => c.state_id))];
        const relevantStates = states.filter((s) => relevantStateIds.includes(s.id));

        const stateNodes: TreeNode[] = relevantStates.map((state) => {
          const stateCities = relevantCities.filter((c) => c.state_id === state.id);

          const cityNodes: TreeNode[] = stateCities.map((city) => {
            const cityStores = storesByCityId.get(city.id) || [];

            const storeNodes: TreeNode[] = cityStores.map((store) => {
              const storeSectors = sectors.filter((s) => s.store_id === store.id);
              const storeDevices = companyDevices.filter((d) => d.store_id === store.id);

              const sectorNodes: TreeNode[] = storeSectors.map((sector) => {
                const sectorZones = zones.filter((z) => z.sector_id === sector.id);
                const sectorDevices = storeDevices.filter((d) => d.sector_id === sector.id);

                const zoneNodes: TreeNode[] = sectorZones.map((zone) => {
                  const zoneDevices = storeDevices.filter((d) => d.zone_id === zone.id);
                  return {
                    id: zone.id,
                    name: zone.name,
                    type: "zone" as const,
                    deviceCount: zoneDevices.length,
                    children: zoneDevices.map((d) => ({
                      id: d.id,
                      name: d.name || d.device_code,
                      type: "device" as const,
                      status: d.status,
                    })),
                  };
                });

                // Devices directly in sector (no zone)
                const unzonedDevices = sectorDevices.filter((d) => !d.zone_id);

                return {
                  id: sector.id,
                  name: sector.name,
                  type: "sector" as const,
                  deviceCount: sectorDevices.length,
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

              // Devices directly in store (no sector)
              const unsectoredDevices = storeDevices.filter((d) => !d.sector_id);

              return {
                id: store.id,
                name: `${store.name} (${store.code})`,
                type: "store" as const,
                deviceCount: storeDevices.length,
                children: [
                  ...sectorNodes,
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
        });

        return {
          id: company.id,
          name: company.name,
          type: "company" as const,
          deviceCount: companyDevices.length,
          children: stateNodes,
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
    <ScrollArea className="h-full">
      <div className="py-2">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} level={0} onSelect={handleSelect} selectedId={selectedId} />
        ))}
      </div>
    </ScrollArea>
  );
};

export type { TreeNode };
