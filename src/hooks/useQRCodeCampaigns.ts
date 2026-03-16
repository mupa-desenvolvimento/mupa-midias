import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CampaignType =
  | "satisfaction_survey"
  | "product_link"
  | "instant_coupon"
  | "quick_loyalty"
  | "whatsapp_chat"
  | "photo_feedback"
  | "digital_catalog"
  | "daily_raffle"
  | "tutorial_recipe"
  | "instagram_store"
  | "refer_earn"
  | "accessibility_info";

export interface QRCodeCampaign {
  id: string;
  tenant_id: string | null;
  user_id: string;
  title: string;
  campaign_type: CampaignType;
  config: Record<string, any>;
  qr_url: string | null;
  short_url: string | null;
  image_url: string | null;
  media_id: string | null;
  is_active: boolean;
  scans_count: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CAMPAIGN_TYPE_INFO: Record<CampaignType, { label: string; description: string; icon: string; color: string }> = {
  satisfaction_survey: { label: "Pesquisa de Satisfação", description: "Enquete simples com relatório", icon: "📊", color: "from-blue-500 to-cyan-500" },
  product_link: { label: "Link para Produto/Folder", description: "Redireciona para produto ou folder digital", icon: "🔗", color: "from-green-500 to-emerald-500" },
  instant_coupon: { label: "Cupom Instantâneo", description: "Desconto % com validade em minutos", icon: "🎟️", color: "from-orange-500 to-amber-500" },
  quick_loyalty: { label: "Fidelidade Rápida", description: "Cadastro com nome + WhatsApp + pontos", icon: "⭐", color: "from-yellow-500 to-orange-500" },
  whatsapp_chat: { label: "Chat WhatsApp Direto", description: "Mensagem pré-definida via WhatsApp", icon: "💬", color: "from-green-600 to-green-400" },
  photo_feedback: { label: "Foto + Feedback", description: "Usuário tira foto + nota + comentário", icon: "📸", color: "from-pink-500 to-rose-500" },
  digital_catalog: { label: "Catálogo Digital", description: "Catálogo completo de produtos", icon: "📖", color: "from-purple-500 to-violet-500" },
  daily_raffle: { label: "Sorteio Diário/Semanal", description: "Participação em sorteio automático", icon: "🎰", color: "from-red-500 to-pink-500" },
  tutorial_recipe: { label: "Tutorial ou Receita", description: "Link para vídeo ou passo a passo", icon: "🎬", color: "from-teal-500 to-cyan-500" },
  instagram_store: { label: "Instagram da Loja", description: "Perfil do Instagram integrado", icon: "📱", color: "from-fuchsia-500 to-pink-500" },
  refer_earn: { label: "Indique e Ganhe", description: "Programa de indicação com recompensa", icon: "🎁", color: "from-indigo-500 to-purple-500" },
  accessibility_info: { label: "Acessibilidade", description: "Libras ou texto ampliado", icon: "♿", color: "from-sky-500 to-blue-500" },
};

export function useQRCodeCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["qrcode-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qrcode_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as QRCodeCampaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<QRCodeCampaign>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("qrcode_campaigns" as any)
        .insert({ ...campaign, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as QRCodeCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qrcode-campaigns"] });
      toast.success("Campanha criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QRCodeCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from("qrcode_campaigns" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as QRCodeCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qrcode-campaigns"] });
      toast.success("Campanha atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("qrcode_campaigns" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qrcode-campaigns"] });
      toast.success("Campanha removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign };
}

export function useCampaignScanStats(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign-scans", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qrcode_scan_logs" as any)
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("scanned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
