import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CampaignType } from "@/hooks/useQRCodeCampaigns";

interface Props {
  campaignType: CampaignType;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function CampaignConfigForm({ campaignType, config, onChange }: Props) {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });

  switch (campaignType) {
    case "satisfaction_survey":
      return (
        <div className="space-y-4">
          <div>
            <Label>Pergunta 1 *</Label>
            <Input value={config.question1 || ""} onChange={(e) => set("question1", e.target.value)} placeholder="Como foi sua experiência hoje?" />
          </div>
          <div>
            <Label>Tipo de resposta</Label>
            <Select value={config.answer_type || "stars"} onValueChange={(v) => set("answer_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">Nota 1–5 estrelas</SelectItem>
                <SelectItem value="nps">NPS (0–10)</SelectItem>
                <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pergunta 2 (opcional)</Label>
            <Input value={config.question2 || ""} onChange={(e) => set("question2", e.target.value)} placeholder="O que podemos melhorar?" />
          </div>
          <div>
            <Label>Pergunta 3 (opcional)</Label>
            <Input value={config.question3 || ""} onChange={(e) => set("question3", e.target.value)} />
          </div>
        </div>
      );

    case "product_link":
      return (
        <div className="space-y-4">
          <div>
            <Label>URL do Produto/Folder *</Label>
            <Input value={config.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Texto do botão (CTA)</Label>
            <Input value={config.cta_text || ""} onChange={(e) => set("cta_text", e.target.value)} placeholder="Ver produto" />
          </div>
        </div>
      );

    case "instant_coupon":
      return (
        <div className="space-y-4">
          <div>
            <Label>Desconto (%) *</Label>
            <Input type="number" min={1} max={100} value={config.discount || ""} onChange={(e) => set("discount", Number(e.target.value))} placeholder="10" />
          </div>
          <div>
            <Label>Validade (minutos) *</Label>
            <Input type="number" min={1} value={config.validity_minutes || ""} onChange={(e) => set("validity_minutes", Number(e.target.value))} placeholder="30" />
          </div>
          <div>
            <Label>Texto do cupom</Label>
            <Input value={config.coupon_text || ""} onChange={(e) => set("coupon_text", e.target.value)} placeholder="DESCONTO10" />
          </div>
          <div>
            <Label>Condições</Label>
            <Textarea value={config.conditions || ""} onChange={(e) => set("conditions", e.target.value)} placeholder="Válido para compras acima de R$50" />
          </div>
        </div>
      );

    case "quick_loyalty":
      return (
        <div className="space-y-4">
          <div>
            <Label>Pontos por cadastro *</Label>
            <Input type="number" min={1} value={config.points || ""} onChange={(e) => set("points", Number(e.target.value))} placeholder="100" />
          </div>
          <div>
            <Label>Mensagem de boas-vindas</Label>
            <Textarea value={config.welcome_message || ""} onChange={(e) => set("welcome_message", e.target.value)} placeholder="Bem-vindo ao programa de fidelidade!" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.ask_whatsapp ?? true} onCheckedChange={(v) => set("ask_whatsapp", v)} />
            <Label>Pedir WhatsApp</Label>
          </div>
        </div>
      );

    case "whatsapp_chat":
      return (
        <div className="space-y-4">
          <div>
            <Label>Número do WhatsApp (com DDI) *</Label>
            <Input value={config.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="5511999999999" />
          </div>
          <div>
            <Label>Mensagem pré-definida *</Label>
            <Textarea value={config.message || ""} onChange={(e) => set("message", e.target.value)} placeholder="Olá! Vi esta oferta na loja e gostaria de saber mais." />
          </div>
        </div>
      );

    case "photo_feedback":
      return (
        <div className="space-y-4">
          <div>
            <Label>Título da pesquisa *</Label>
            <Input value={config.survey_title || ""} onChange={(e) => set("survey_title", e.target.value)} placeholder="Compartilhe sua experiência" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.require_photo ?? true} onCheckedChange={(v) => set("require_photo", v)} />
            <Label>Foto obrigatória</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.require_rating ?? true} onCheckedChange={(v) => set("require_rating", v)} />
            <Label>Nota obrigatória</Label>
          </div>
        </div>
      );

    case "digital_catalog":
      return (
        <div className="space-y-4">
          <div>
            <Label>URL do catálogo *</Label>
            <Input value={config.catalog_url || ""} onChange={(e) => set("catalog_url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Título do catálogo</Label>
            <Input value={config.catalog_title || ""} onChange={(e) => set("catalog_title", e.target.value)} placeholder="Catálogo de Ofertas" />
          </div>
        </div>
      );

    case "daily_raffle":
      return (
        <div className="space-y-4">
          <div>
            <Label>Prêmio *</Label>
            <Input value={config.prize || ""} onChange={(e) => set("prize", e.target.value)} placeholder="Vale compras de R$100" />
          </div>
          <div>
            <Label>Frequência</Label>
            <Select value={config.frequency || "daily"} onValueChange={(v) => set("frequency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Regras</Label>
            <Textarea value={config.rules || ""} onChange={(e) => set("rules", e.target.value)} placeholder="1 participação por CPF" />
          </div>
        </div>
      );

    case "tutorial_recipe":
      return (
        <div className="space-y-4">
          <div>
            <Label>URL do vídeo/tutorial *</Label>
            <Input value={config.video_url || ""} onChange={(e) => set("video_url", e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div>
            <Label>Título</Label>
            <Input value={config.recipe_title || ""} onChange={(e) => set("recipe_title", e.target.value)} placeholder="Receita de bolo de cenoura" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={config.description || ""} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
      );

    case "instagram_store":
      return (
        <div className="space-y-4">
          <div>
            <Label>@ do Instagram *</Label>
            <Input value={config.instagram_handle || ""} onChange={(e) => set("instagram_handle", e.target.value)} placeholder="@minhaloja" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.use_mupa_integration ?? false} onCheckedChange={(v) => set("use_mupa_integration", v)} />
            <Label>Usar integração Instagram da Mupa</Label>
          </div>
        </div>
      );

    case "refer_earn":
      return (
        <div className="space-y-4">
          <div>
            <Label>Recompensa por indicação *</Label>
            <Input value={config.reward || ""} onChange={(e) => set("reward", e.target.value)} placeholder="R$10 de desconto" />
          </div>
          <div>
            <Label>Recompensa para indicado</Label>
            <Input value={config.referred_reward || ""} onChange={(e) => set("referred_reward", e.target.value)} placeholder="R$5 de desconto" />
          </div>
          <div>
            <Label>Regras</Label>
            <Textarea value={config.rules || ""} onChange={(e) => set("rules", e.target.value)} />
          </div>
        </div>
      );

    case "accessibility_info":
      return (
        <div className="space-y-4">
          <div>
            <Label>Tipo de acessibilidade</Label>
            <Select value={config.accessibility_type || "libras"} onValueChange={(v) => set("accessibility_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="libras">Vídeo em Libras</SelectItem>
                <SelectItem value="large_text">Texto ampliado</SelectItem>
                <SelectItem value="audio">Áudio descrição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>URL do conteúdo acessível *</Label>
            <Input value={config.content_url || ""} onChange={(e) => set("content_url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={config.description || ""} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
      );

    default:
      return <p className="text-muted-foreground text-sm">Tipo de campanha não reconhecido.</p>;
  }
}
