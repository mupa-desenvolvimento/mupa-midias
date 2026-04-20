import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2, Settings, Trash2, Plug2 } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useCompanies, type CompanyWithIntegrations } from "@/hooks/useCompanies";

interface CompanyIntegrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  companyName: string | null;
}

const INITIAL_FORM = {
  integration_id: "",
  usuario: "",
  password: "",
  loja: "",
  image_base_url: "http://srv-mupa.ddns.net:5050/produto-imagem",
};

export function CompanyIntegrationsDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: CompanyIntegrationsDialogProps) {
  const {
    companies,
    availableIntegrations,
    addCompanyIntegration,
    removeCompanyIntegration,
  } = useCompanies();
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const company: CompanyWithIntegrations | undefined = companies.find(
    (c) => c.id === companyId,
  );

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setShowSecret(false);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!companyId) return;
    if (!form.integration_id) {
      toast.error("Selecione uma integração");
      return;
    }
    if (!form.usuario || !form.password) {
      toast.error("Credenciais são obrigatórias");
      return;
    }
    if (!form.loja) {
      toast.error("Código da loja é obrigatório");
      return;
    }

    await addCompanyIntegration.mutateAsync({
      company_id: companyId,
      integration_id: form.integration_id,
      credentials: { usuario: form.usuario, password: form.password } as unknown as Json,
      settings: {
        loja: form.loja,
        store_code: form.loja,
        image_base_url: form.image_base_url,
      } as unknown as Json,
    });

    setForm(INITIAL_FORM);
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remover esta integração?")) return;
    await removeCompanyIntegration.mutateAsync(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug2 className="h-5 w-5" />
            Integrações de API
          </DialogTitle>
          <DialogDescription>
            Configure integrações para {companyName || "esta empresa"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {company?.integrations && company.integrations.length > 0 && (
            <div className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">Integrações ativas</h4>
              {company.integrations.map((ci) => {
                const settings = (ci.settings as Record<string, string>) || {};
                return (
                  <div
                    key={ci.id}
                    className="flex items-center justify-between rounded bg-accent/40 p-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Plug2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{ci.integration?.name || "API"}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        Loja {settings.loja || "-"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(ci.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4" />
              Adicionar integração
            </h4>

            <div className="space-y-2">
              <Label>Tipo de Integração</Label>
              <Select
                value={form.integration_id}
                onValueChange={(value) => setForm({ ...form, integration_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {integration.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  value={form.usuario}
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  placeholder="Usuário da API"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Senha da API"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Código da Loja</Label>
                <Input
                  value={form.loja}
                  onChange={(e) => setForm({ ...form, loja: e.target.value })}
                  placeholder="Ex: 001"
                />
              </div>
              <div className="space-y-2">
                <Label>URL Base de Imagens</Label>
                <Input
                  value={form.image_base_url}
                  onChange={(e) => setForm({ ...form, image_base_url: e.target.value })}
                  placeholder="http://..."
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleAdd} disabled={addCompanyIntegration.isPending}>
            {addCompanyIntegration.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
