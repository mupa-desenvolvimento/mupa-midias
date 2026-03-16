
import { useParams, useNavigate } from "react-router-dom";
import { usePriceCheckLogs, usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function PriceCheckIntegrationLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: logs, isLoading, refetch } = usePriceCheckLogs(id);
  const { integrations } = usePriceCheckIntegrations();
  const integration = integrations?.find(i => i.id === id);
  const [detailLog, setDetailLog] = useState<any>(null);

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/integrations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Logs de Execução</h1>
            <p className="text-sm text-muted-foreground">
              {integration?.name || "..."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas 100 requisições</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Nenhum log registrado.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded">{log.barcode}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.store_code || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          log.status_code && log.status_code >= 200 && log.status_code < 300
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {log.status_code || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.response_time_ms || 0}ms
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.error_message ? (
                        <div className="flex items-center gap-1 text-xs text-destructive max-w-[200px] truncate" title={log.error_message}>
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{log.error_message}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailLog(log)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Log — {detailLog?.barcode}</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Status:</span> <span className="font-mono">{detailLog.status_code}</span></div>
                <div><span className="text-muted-foreground">Tempo:</span> <span className="font-mono">{detailLog.response_time_ms}ms</span></div>
              </div>
              {detailLog.error_message && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-xs text-destructive">
                  {detailLog.error_message}
                </div>
              )}
              {detailLog.request_snapshot && (
                <div>
                  <Label className="text-xs text-muted-foreground">Request</Label>
                  <pre className="font-mono text-xs bg-muted/20 p-3 rounded overflow-auto max-h-[200px] mt-1">
                    {JSON.stringify(detailLog.request_snapshot, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.response_snapshot && (
                <div>
                  <Label className="text-xs text-muted-foreground">Response</Label>
                  <pre className="font-mono text-xs bg-muted/20 p-3 rounded overflow-auto max-h-[200px] mt-1">
                    {typeof detailLog.response_snapshot === "string"
                      ? detailLog.response_snapshot
                      : JSON.stringify(detailLog.response_snapshot, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.mapped_product && Object.keys(detailLog.mapped_product).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Produto Mapeado</Label>
                  <pre className="font-mono text-xs bg-green-500/5 border border-green-500/10 p-3 rounded overflow-auto max-h-[200px] mt-1">
                    {JSON.stringify(detailLog.mapped_product, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={className}>{children}</span>;
}
