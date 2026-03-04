
import { useParams, useNavigate } from "react-router-dom";
import { usePriceCheckLogs, usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PriceCheckIntegrationLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: logs, isLoading, refetch } = usePriceCheckLogs(id);
  const { integrations } = usePriceCheckIntegrations();
  
  const integration = integrations?.find(i => i.id === id);

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/integrations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Logs de Integração
            </h1>
            <p className="text-muted-foreground">
              Histórico de requisições para: <span className="text-white font-medium">{integration?.name || "..."}</span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Últimas Requisições</CardTitle>
          <CardDescription>
            Logs detalhados das últimas 100 tentativas de consulta de preço
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead>Código de Barras</TableHead>
                <TableHead>Status HTTP</TableHead>
                <TableHead>Tempo (ms)</TableHead>
                <TableHead>Mensagem / Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Carregando logs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum log registrado para esta integração.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono bg-muted/20 px-2 py-1 rounded text-xs">
                        {log.barcode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.status_code >= 200 && log.status_code < 300 ? "default" : "destructive"}
                        className={log.status_code >= 200 && log.status_code < 300 
                          ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" 
                          : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"}
                      >
                        {log.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {log.response_time_ms}ms
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.error_message ? (
                        <div className="flex items-center gap-2 text-red-400 text-sm max-w-[300px] truncate" title={log.error_message}>
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{log.error_message}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Sucesso</span>
                        </div>
                      )}
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
