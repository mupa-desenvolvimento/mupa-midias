import { useEffect, useState } from "react";
import { generateThemeFromImage, getFallbackTheme, type ProductTheme } from "@/lib/productTheme";

/**
 * Extrai um ProductTheme da imagem do produto.
 * Reage a mudanças de `imageSrc` e devolve o fallback enquanto carrega
 * (ou se a extração falhar — ex. CORS).
 */
export const useProductTheme = (imageSrc: string | null | undefined): ProductTheme => {
  const [theme, setTheme] = useState<ProductTheme>(getFallbackTheme);

  useEffect(() => {
    let cancelled = false;
    if (!imageSrc) {
      setTheme(getFallbackTheme());
      return;
    }
    generateThemeFromImage(imageSrc).then((t) => {
      if (!cancelled) setTheme(t);
    });
    return () => { cancelled = true; };
  }, [imageSrc]);

  return theme;
};
