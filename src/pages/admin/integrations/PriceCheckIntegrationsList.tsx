
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Activity,
  Server
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PriceCheckIntegrationsList() {
  const navigate = useNavigate();
  const { integrations, isLoading, deleteIntegration } = usePriceCheckIntegrations();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredIntegrations = integrations?.filter(integration => 
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.endpoint_url.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Integrações de Preço</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as conexões com APIs externas para consulta de produtos
          </p>
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
            className="pl-9 bg-card border-white/10"
          />
        </div>
      </div>

      <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Integrações Cadastradas</CardTitle>
          <CardDescription>
            Lista de todas as integrações de consulta de preço configuradas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="w-[250px]">Nome / Empresa</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Autenticação</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredIntegrations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhuma integração encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredIntegrations?.map((integration) => (
                  <TableRow key={integration.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{integration.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {integration.companies?.name || "Todas as empresas"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[300px] truncate" title={integration.endpoint_url}>
                        <Server className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-mono text-muted-foreground truncate">
                          {integration.endpoint_url}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {integration.auth_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={integration.environment === 'production' ? "default" : "secondary"}
                        className={integration.environment === 'production' ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30" : "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"}
                      >
                        {integration.environment === 'production' ? 'Produção' : 'Homologação'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {integration.status === 'active' ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                            <XCircle className="h-3 w-3" /> Inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
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
                            className="text-red-600 focus:text-red-600 focus:bg-red-100/10"
                            onClick={() => setDeleteId(integration.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente a integração
              e poderá afetar os dispositivos que dependem dela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
