
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MoreHorizontal, Edit, Trash2, CheckCircle2, XCircle,
  Activity, Terminal, Globe, Clock
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Shield } from "lucide-react";

export default function PriceCheckIntegrationsList() {
  const navigate = useNavigate();
  const { integrations, isLoading, deleteIntegration } = usePriceCheckIntegrations();
  const { isSuperAdmin } = useSuperAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = integrations?.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.endpoint_url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteId) {
      await deleteIntegration.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrações de Preço</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte qualquer API de consulta de preço colando a CURL
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => navigate("new")} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Integração via CURL
          </Button>
        )}
        {!isSuperAdmin && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Shield className="h-3 w-3" /> Somente visualização
          </Badge>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar integrações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32 mt-1" />
              </CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma integração</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crie sua primeira integração colando uma CURL de API de preços
            </p>
            <Button onClick={() => navigate("new")} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Integração via CURL
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((integration) => (
            <Card key={integration.id} className="group hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{integration.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {integration.companies?.name || "Todas as empresas"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate(`${integration.id}/edit`)}>
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`${integration.id}/logs`)}>
                        <Activity className="mr-2 h-4 w-4" /> Ver Logs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(integration.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground truncate">
                  <Globe className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{integration.endpoint_url || (integration as any).request_url || "—"}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(integration.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {integration.status === "active" ? (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20 gap-1">
                      <XCircle className="h-3 w-3" /> Inativo
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs capitalize">
                    {integration.auth_type?.replace("_", " ") || "none"}
                  </Badge>
                  <Badge
                    variant={integration.environment === "production" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {integration.environment === "production" ? "Prod" : "Homolog"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação excluirá permanentemente a integração e pode afetar dispositivos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
