import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "./useUserTenant";
import { toast } from "sonner";

export interface LiteProduct {
  id: string;
  company_id: string;
  tenant_id: string;
  ean: string;
  internal_code: string | null;
  description: string;
  normal_price: number;
  promo_price: number | null;
  de_por_price: number | null;
  club_price: number | null;
  leve_x_pague_y: string | null;
  discount_4th_item: number | null;
  other_price: number | null;
  custom_field_name: string | null;
  custom_field_value: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const getImageProxyUrl = (ean: string) => `${SUPABASE_URL}/functions/v1/product-image-proxy?ean=${ean}`;

export function useLiteProducts() {
  const { tenantId, companyId } = useUserTenant();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["lite-products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("lite_products")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("description");
      if (error) throw error;
      return data as unknown as LiteProduct[];
    },
    enabled: !!tenantId,
  });

  const upsertProduct = useMutation({
    mutationFn: async (product: Partial<LiteProduct> & { ean: string; description: string }) => {
      if (!tenantId || !companyId) throw new Error("Tenant/Company não encontrado");

      // If no image_url, try Mupa API
      let imageUrl = product.image_url;
      if (!imageUrl && product.ean) {
        imageUrl = getImageProxyUrl(product.ean);
      }

      const record = {
        ...product,
        tenant_id: tenantId,
        company_id: companyId,
        image_url: imageUrl,
        normal_price: product.normal_price ?? 0,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("lite_products")
        .upsert(record as any, { onConflict: "company_id,ean" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lite-products"] });
    },
  });

  const importProducts = useMutation({
    mutationFn: async (rows: Array<Record<string, string>>) => {
      if (!tenantId || !companyId) throw new Error("Tenant/Company não encontrado");

      const records = rows.map((row) => ({
        tenant_id: tenantId,
        company_id: companyId,
        ean: row.ean || row.codigo_barras || row.gtin || "",
        internal_code: row.codigo_interno || row.internal_code || null,
        description: row.descricao || row.description || row.nome || "Sem descrição",
        normal_price: parseFloat(row.preco_normal || row.normal_price || row.preco || "0") || 0,
        promo_price: parseFloat(row.preco_promocional || row.promo_price || "") || null,
        de_por_price: parseFloat(row.de_por || row.de_por_price || "") || null,
        club_price: parseFloat(row.clube || row.club_price || "") || null,
        leve_x_pague_y: row.leve_x_pague_y || row.leve_pague || null,
        discount_4th_item: parseFloat(row.desconto_4_item || row.discount_4th_item || "") || null,
        other_price: parseFloat(row.outro || row.other_price || "") || null,
        custom_field_name: row.campo_extra_nome || row.custom_field_name || null,
        custom_field_value: row.campo_extra_valor || row.custom_field_value || null,
        image_url: row.url_imagem || row.image_url || `${MUPA_API}/produto-imagem/${row.ean || row.codigo_barras || row.gtin || ""}`,
        is_active: true,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.ean);

      if (records.length === 0) throw new Error("Nenhum produto válido encontrado no arquivo");

      const { error } = await supabase
        .from("lite_products")
        .upsert(records as any[], { onConflict: "company_id,ean" });

      if (error) throw error;
      return records.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["lite-products"] });
      toast.success(`${count} produto(s) importado(s) com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro na importação: ${err.message}`);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lite_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lite-products"] });
      toast.success("Produto removido");
    },
  });

  return { products: products ?? [], isLoading, upsertProduct, importProducts, deleteProduct };
}
