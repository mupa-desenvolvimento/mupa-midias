import { useState } from "react";
import { HierarchyTree, TreeNode } from "./HierarchyTree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Wifi, WifiOff, Play, Calendar, Tag } from "lucide-react";

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

export const HierarchyExplorer = () => {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Tree sidebar */}
      <Card className="w-80 shrink-0 flex flex-col">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">Hierarquia</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <HierarchyTree onSelect={setSelectedNode} />
        </CardContent>
      </Card>

      {/* Detail panel */}
      <Card className="flex-1">
        <CardContent className="p-6">
          {!selectedNode ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Selecione um item na árvore para ver detalhes</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="mb-2">{typeLabels[selectedNode.type]}</Badge>
                  <h2 className="text-xl font-bold">{selectedNode.name}</h2>
                </div>
                {selectedNode.type === "device" && (
                  <Badge variant={selectedNode.status === "online" ? "default" : "secondary"} className="gap-1">
                    {selectedNode.status === "online" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {selectedNode.status || "offline"}
                  </Badge>
                )}
              </div>

              {selectedNode.deviceCount !== undefined && selectedNode.type !== "device" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Monitor className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{selectedNode.deviceCount}</p>
                      <p className="text-xs text-muted-foreground">Dispositivos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Wifi className="w-5 h-5 mx-auto mb-1 text-green-500" />
                      <p className="text-2xl font-bold">-</p>
                      <p className="text-xs text-muted-foreground">Online</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Play className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">-</p>
                      <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Tag className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">-</p>
                      <p className="text-xs text-muted-foreground">Tags</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedNode.children && selectedNode.children.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Itens ({selectedNode.children.length})</h3>
                  <div className="grid gap-2">
                    {selectedNode.children.slice(0, 20).map((child) => (
                      <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium flex-1">{child.name}</span>
                        {child.type === "device" && (
                          <Badge variant={child.status === "online" ? "default" : "secondary"} className="text-[10px]">
                            {child.status || "offline"}
                          </Badge>
                        )}
                        {child.deviceCount !== undefined && child.deviceCount > 0 && (
                          <Badge variant="outline" className="text-[10px]">{child.deviceCount} devices</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
