import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Terminal } from "lucide-react";

const DeviceCommandHandler = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no_command">("loading");
  const [message, setMessage] = useState("Verificando comandos...");
  
  const deviceId = searchParams.get("id_device");
  const command = searchParams.get("cmd");
  const token = searchParams.get("token");

  useEffect(() => {
    const processCommand = async () => {
      if (!deviceId || !command || !token) {
        setStatus("error");
        setMessage("Parâmetros inválidos. A URL deve conter id_device, cmd e token.");
        return;
      }

      try {
        // 1. Fetch the pending command for this device using the RPC function we created
        // We use the 'cmd' from URL as a hint, but the source of truth is the DB
        const { data: pendingCommands, error: fetchError } = await supabase.rpc(
          "get_pending_device_command",
          {
            p_device_id: deviceId,
            p_device_token: token
          }
        );

        if (fetchError) throw fetchError;

        const pendingCommand = pendingCommands && pendingCommands.length > 0 ? pendingCommands[0] : null;

        if (!pendingCommand) {
          setStatus("no_command");
          setMessage("Nenhum comando pendente encontrado para este dispositivo.");
          return;
        }

        // 2. Map the command to an action (for the Kodular/WebView side to detect)
        // Since we are inside a WebView, the Kodular app will monitor the URL or page content
        setStatus("success");
        setMessage(`Comando detectado: ${pendingCommand.command}`);

        // 3. Mark as executed
        const { error: updateError } = await supabase.rpc(
          "mark_device_command_executed",
          {
            p_command_id: pendingCommand.id,
            p_device_token: token,
            p_status: "executed"
          }
        );

        if (updateError) console.error("Erro ao atualizar status do comando:", updateError);

      } catch (error: any) {
        console.error("Erro ao processar comando:", error);
        setStatus("error");
        setMessage(`Erro: ${error.message || "Falha na comunicação com o servidor"}`);
      }
    };

    processCommand();
  }, [deviceId, command, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md p-8 rounded-2xl border bg-card shadow-xl space-y-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center">
          {status === "loading" && <Loader2 className="h-16 w-16 text-primary animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-16 w-16 text-green-500" />}
          {status === "no_command" && <Terminal className="h-16 w-16 text-muted-foreground" />}
          {status === "error" && <XCircle className="h-16 w-16 text-destructive" />}
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {status === "loading" && "Processando..."}
            {status === "success" && "Comando Executado"}
            {status === "no_command" && "Status do Dispositivo"}
            {status === "error" && "Falha no Comando"}
          </h1>
          <p className="text-muted-foreground">
            {message}
          </p>
        </div>

        {status === "success" && (
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 text-green-600 dark:text-green-400 font-mono text-sm">
            COMANDO: {command?.toUpperCase()}
          </div>
        )}

        <div className="pt-4 text-xs text-muted-foreground border-t">
          ID: {deviceId || "—"} • TOKEN: {token ? "****" : "—"}
        </div>
      </div>
    </div>
  );
};

export default DeviceCommandHandler;
