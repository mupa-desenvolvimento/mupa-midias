import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApiIntegrations } from "@/hooks/useApiIntegrations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Server, Building2 } from "lucide-react";

export default function ApiIntegrationsList() {
  const navigate = useNavigate();
  const { integrations, isLoading, setActive } = useApiIntegrations();
  const [searchTerm, setSearchTerm] = useState("");

  // Load company links
  const { data: companyLinks } = useQuery({
    queryKey: ["company-integration-links"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_integrations")
        .select("integration_id, company_id, companies(name)");
      return data ?? [];
    },
  });

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    (companyLinks ?? []).forEach((l: any) => {
      map[l.integration_id] = l.companies?.name ?? "—";
    });
    return map;
  }, [companyLinks]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return integrations ?? [];
    return (integrations ?? []).filter((i) =>
      i.name.toLowerCase().includes(term) ||
      i.slug.toLowerCase().includes(term) ||
      i.base_url.toLowerCase().includes(term) ||
      (companyMap[i.id] ?? "").toLowerCase().includes(term)
    );
  }, [integrations, searchTerm, companyMap]);

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mapeamento de Preços</h1>
          <p className="text-muted-foreground mt-2">Configure a integração com APIs de consulta de preços por empresa</p>
        </div>
        <Button onClick={() => navigate("new")} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova Integração
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar integrações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border/50"
          />
        </div>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Integrações</CardTitle>
          <CardDescription>Lista de integrações configuráveis para consulta de preço</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-muted/5">
                <TableHead className="w-[220px]">Nome</TableHead>
                <TableHead className="w-[180px]">Empresa</TableHead>
                <TableHead>Request URL</TableHead>
                <TableHead className="w-[100px]">Ativa</TableHead>
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhuma integração encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((integration) => (
                  <TableRow key={integration.id} className="border-border/20 hover:bg-muted/5 cursor-pointer" onClick={() => navigate(`${integration.id}/edit`)}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{integration.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{integration.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {companyMap[integration.id] ? (
                        <Badge variant="outline" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {companyMap[integration.id]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[320px] truncate" title={integration.request_url || integration.base_url}>
                        <Server className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-mono text-muted-foreground truncate">{integration.request_url || integration.base_url}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={!!integration.is_active}
                        onCheckedChange={(checked) => setActive.mutate({ id: integration.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 px-2" onClick={() => navigate(`${integration.id}/edit`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
