import { supabase } from "@/integrations/supabase/client";

export interface Product {
  gtin: string;
  descricao: string;
  preco: number;
  imagem_url?: string;
  categoria?: string;
}

class ProductService {
  private static instance: ProductService;
  private apiUrl = "http://srv-mupa.ddns.net:5050";
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

  private constructor() {}

  static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  async getProduct(gtin: string): Promise<Product | null> {
    try {
      // 1. Try local cache/Supabase if implemented
      // For now, fetch directly from Mupa API as per memory
      
      const response = await fetch(`${this.apiUrl}/api/products/${gtin}`);
      if (!response.ok) {
        // Fallback: Try searching in Supabase 'products' table if it exists
        // Or return null
        return null;
      }

      const data = await response.json();
      
      // Map response to Product interface
      return {
        gtin: data.gtin || gtin,
        descricao: data.descricao || "Produto sem descrição",
        preco: Number(data.preco) || 0,
        imagem_url: `${this.apiUrl}/produto-imagem/${gtin}`,
        categoria: data.categoria
      };
    } catch (error) {
      console.error("[ProductService] Error fetching product:", error);
      return null;
    }
  }
}

export const productService = ProductService.getInstance();
