import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollText, RefreshCw, Search, AlertCircle, CheckCircle, Clock, Database, ShoppingBag, Play, Shield, Activity, Wifi } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    completed: { variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
    success: { variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
    processing: { variant: "secondary", icon: <Clock className="w-3 h-3 animate-spin" /> },
    pending: { variant: "outline", icon: <Clock className="w-3 h-3" /> },
    failed: { variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
    error: { variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const cfg = map[status] || { variant: "outline" as const, icon: null };
  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs">
      {cfg.icon}
      {status}
    </Badge>
  );
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return d;
  }
};

function ImportLogsTab({ search }: { search: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter(
    (r) =>
      !search ||
      r.type?.toLowerCase().includes(search.toLowerCase()) ||
      r.file_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Arquivo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Sucesso</TableHead>
          <TableHead className="text-right">Erros</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
        ) : (
          filtered.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell><Badge variant="outline">{log.type}</Badge></TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{log.file_name || "—"}</TableCell>
              <TableCell>{statusBadge(log.status)}</TableCell>
              <TableCell className="text-right font-mono">{log.total_rows ?? 0}</TableCell>
              <TableCell className="text-right font-mono text-green-400">{log.success_rows ?? 0}</TableCell>
              <TableCell className="text-right font-mono text-red-400">{log.error_rows ?? 0}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ProductLookupLogsTab({ search }: { search: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["logs-product-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_lookup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter(
    (r) =>
      !search ||
      r.ean?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase()) ||
      r.store_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>EAN</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Latência (ms)</TableHead>
          <TableHead>Erro</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
        ) : (
          filtered.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell className="font-mono text-sm">{log.ean}</TableCell>
              <TableCell>{log.store_code || "—"}</TableCell>
              <TableCell>{statusBadge(log.status)}</TableCell>
              <TableCell className="text-right font-mono">{log.latency_ms ?? "—"}</TableCell>
              <TableCell className="text-xs text-red-400 max-w-[200px] truncate">{log.error_message || "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function MediaPlayLogsTab({ search }: { search: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["logs-media-play"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_play_logs")
        .select("*, media_items(name), devices(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter(
    (r: any) =>
      !search ||
      r.media_items?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.devices?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Mídia</TableHead>
          <TableHead>Dispositivo</TableHead>
          <TableHead className="text-right">Duração (s)</TableHead>
          <TableHead>Reproduzido em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
        ) : (
          filtered.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell className="text-sm">{log.media_items?.name || log.media_id?.slice(0, 8)}</TableCell>
              <TableCell className="text-sm">{log.devices?.name || log.device_id?.slice(0, 8)}</TableCell>
              <TableCell className="text-right font-mono">{log.duration ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(log.played_at)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function AdminLogsTab({ search }: { search: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["logs-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_admin_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (data || []).filter(
    (r: any) =>
      !search ||
      r.action?.toLowerCase().includes(search.toLowerCase()) ||
      r.actor_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Ação</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead>Detalhes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
        ) : (
          filtered.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
              <TableCell className="text-sm">{log.actor_email || "—"}</TableCell>
              <TableCell className="text-xs font-mono max-w-[300px] truncate">{JSON.stringify(log.details)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PlatformLogsTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["logs-platform"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  // Realtime: refresh on every new log
  useEffect(() => {
    const ch = supabase
      .channel("platform-logs-tab")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["logs-platform"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const filtered = (data || []).filter((r: any) =>
    !search ||
    r.message?.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase()) ||
    r.device_code?.toLowerCase().includes(search.toLowerCase())
  );

  const levelBadge = (level: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      info: "default", debug: "secondary", warn: "outline", error: "destructive",
    };
    return <Badge variant={map[level] || "outline"} className="text-xs uppercase">{level}</Badge>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Nível</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Mensagem</TableHead>
          <TableHead>Dispositivo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
        ) : (
          filtered.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell>{levelBadge(log.level)}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{log.category}</Badge></TableCell>
              <TableCell className="text-sm">{log.message}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{log.device_code || "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function DeviceStatusLogsTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["logs-device-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_status_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("device-status-logs-tab")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "device_status_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["logs-device-status"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const filtered = (data || []).filter((r: any) =>
    !search ||
    r.device_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.device_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.new_status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Dispositivo</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>De</TableHead>
          <TableHead>Para</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
        ) : filtered.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma mudança de status registrada</TableCell></TableRow>
        ) : (
          filtered.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell className="text-sm">{log.device_name || "—"}</TableCell>
              <TableCell className="text-xs font-mono">{log.device_code || "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{log.old_status || "—"}</Badge></TableCell>
              <TableCell>
                <Badge variant={log.new_status === "online" ? "default" : "destructive"} className="text-xs">
                  {log.new_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function PlatformLogs() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("platform");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logs da Plataforma</h1>
            <p className="text-sm text-muted-foreground">Visualize todos os eventos e registros do sistema</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nos logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="import" className="gap-2">
            <Database className="h-4 w-4" />
            Importações
          </TabsTrigger>
          <TabsTrigger value="product" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Consulta Preço
          </TabsTrigger>
          <TabsTrigger value="play" className="gap-2">
            <Play className="h-4 w-4" />
            Reprodução
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-2">
            <Shield className="h-4 w-4" />
            Admin
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardContent className="p-0 overflow-auto max-h-[calc(100vh-320px)]">
            <TabsContent value="import" className="m-0">
              <ImportLogsTab search={search} />
            </TabsContent>
            <TabsContent value="product" className="m-0">
              <ProductLookupLogsTab search={search} />
            </TabsContent>
            <TabsContent value="play" className="m-0">
              <MediaPlayLogsTab search={search} />
            </TabsContent>
            <TabsContent value="admin" className="m-0">
              <AdminLogsTab search={search} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
