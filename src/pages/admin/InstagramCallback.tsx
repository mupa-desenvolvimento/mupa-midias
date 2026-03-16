import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Instagram, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InstagramCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(searchParams.get("error_description") || "Autorização negada pelo usuário.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("Código de autorização não encontrado.");
      return;
    }

    exchangeCode(code);
  }, [searchParams]);

  const exchangeCode = async (code: string) => {
    try {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id_strict");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = `${window.location.origin}/admin/instagram/callback`;

      const callbackUrl = `https://${projectId}.supabase.co/functions/v1/instagram-oauth?action=callback&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&tenant_id=${tenantId || ""}`;

      const res = await fetch(callbackUrl);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Falha ao trocar o código por token.");
      }

      setUsername(data.username || "");
      setStatus("success");
      setMessage(data.username ? `Conectado como @${data.username}` : "Instagram conectado com sucesso!");
    } catch (err: any) {
      console.error("[instagram-callback]", err);
      setStatus("error");
      setMessage(err.message || "Erro desconhecido.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center space-y-4">
          {status === "loading" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold">Conectando ao Instagram...</h3>
              <p className="text-sm text-muted-foreground">Aguarde enquanto processamos a autorização.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Instagram conectado!</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button onClick={() => navigate("/admin/auto-content/instagram")} className="gap-2 mt-4">
                <Instagram className="w-4 h-4" />
                Ir para o Instagram Feed
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Erro na conexão</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button variant="outline" onClick={() => navigate("/admin/auto-content/instagram")} className="mt-4">
                Voltar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
