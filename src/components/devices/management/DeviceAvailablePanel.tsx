import React, { useState, useMemo } from "react";
import { useDevices, DeviceWithRelations } from "@/hooks/useDevices";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, MonitorOff, CheckSquare, Square, Filter } from "lucide-react";
import { DeviceDraggableItem } from "./DeviceDraggableItem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DeviceAvailablePanelProps {
  onSelectDevices?: (ids: string[]) => void;
  selectedIds?: string[];
}

export const DeviceAvailablePanel = ({
  onSelectDevices,
  selectedIds = [],
}: DeviceAvailablePanelProps) => {
  const { devices, isLoading } = useDevices();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");

  const unassignedDevices = useMemo(() => {
    // A device is unassigned if it has no group relationship
    return devices.filter((device) => {
      const hasGroup = device.group || (device.groups && device.groups.length > 0);
      return !hasGroup;
    });
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return unassignedDevices.filter((device) => {
      const matchesSearch =
        device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online" ? device.status === "online" : device.status !== "online");

      return matchesSearch && matchesStatus;
    });
  }, [unassignedDevices, searchTerm, statusFilter]);

  const toggleSelect = (id: string) => {
    if (!onSelectDevices) return;
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id];
    onSelectDevices(newSelected);
  };

  const selectAll = () => {
    if (!onSelectDevices) return;
    onSelectDevices(filteredDevices.map((d) => d.id));
  };

  const deselectAll = () => {
    if (!onSelectDevices) return;
    onSelectDevices([]);
  };

  const { setNodeRef, isOver } = useDroppable({
    id: "available-devices",
    data: {
      type: "available",
    },
  });

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full border-none rounded-none transition-colors",
        isOver ? "bg-primary/10 ring-2 ring-primary/20" : "bg-muted/30"
      )}
    >
      <CardHeader className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorOff className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Dispositivos Disponíveis
            </CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono">
            {filteredDevices.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                Todos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("online")}>
                Online
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("offline")}>
                Offline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-2 gap-1.5"
            onClick={selectedIds.length === filteredDevices.length ? deselectAll : selectAll}
          >
            {selectedIds.length === filteredDevices.length ? (
              <>
                <Square className="h-3 w-3" />
                Deselecionar todos
              </>
            ) : (
              <>
                <CheckSquare className="h-3 w-3" />
                Selecionar todos
              </>
            )}
          </Button>
          {selectedIds.length > 0 && (
            <span className="text-[10px] font-medium text-primary">
              {selectedIds.length} selecionados
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2 py-2">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                <MonitorOff className="h-8 w-8 mb-2" />
                <p className="text-xs">Nenhum dispositivo disponível</p>
              </div>
            ) : (
              filteredDevices.map((device) => (
                <DeviceDraggableItem
                  key={device.id}
                  device={device}
                  isSelected={selectedIds.includes(device.id)}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
