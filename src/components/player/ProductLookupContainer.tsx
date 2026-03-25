import { useEffect, useState, useRef, useCallback } from "react";
import { AlertCircle, Package, Loader2 } from "lucide-react";
import { preloadImage, extractColorsFromElement, getDefaultColors, rgbToString, rgbToRgba, type ExtractedColors } from "@/lib/colorExtractor";
import { ProductDisplay } from "./ProductDisplay";
import type { ProductDisplaySettings } from "@/hooks/useProductDisplaySettings";

interface ProductData {
  ean: string;
  name: string;
  unit: string;
  current_price: number;
  original_price: number | null;
  is_offer: boolean;
  savings_percent: number | null;
  image_url: string | null;
  store_code: string;
  api_colors?: {
    cor_assinatura_produto: string;
    fundo_legibilidade: string;
    cor_dominante_claro: string;
    cor_dominante_escuro: string;
  } | null;
}

interface ProductLookupContainerProps {
  product: ProductData | null;
  isLoading: boolean;
  error: string | null;
  onDismiss: () => void;
  timeout?: number;
  inputRef?: React.RefObject<HTMLInputElement>;
  displaySettings?: Partial<ProductDisplaySettings>;
  isPortrait?: boolean;
}

const defaultColors: ExtractedColors = getDefaultColors();

export const ProductLookupContainer = ({
  product,
  isLoading,
  error,
  onDismiss,
  timeout = 15,
  inputRef,
  displaySettings,
  isPortrait = false
}: ProductLookupContainerProps) => {
  const [countdown, setCountdown] = useState(timeout);
  const [colors, setColors] = useState<ExtractedColors>(defaultColors);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [preloadedSrc, setPreloadedSrc] = useState<string | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const effectiveInputRef = inputRef || hiddenInputRef;
  const preloadAbortRef = useRef<boolean>(false);

  // Focus input when product loads
  useEffect(() => {
    if (product && effectiveInputRef.current) {
      effectiveInputRef.current.focus();
    }
  }, [product, effectiveInputRef]);

  // Use API colors if available, otherwise extract from image
  useEffect(() => {
    // If API provides colors, use them directly (no canvas needed)
    if (product?.api_colors) {
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
          : { r: 30, g: 58, b: 95 };
      };
      const apiColors = product.api_colors;
      const dominant = hexToRgb(apiColors.cor_assinatura_produto);
      const vibrant = hexToRgb(apiColors.cor_dominante_claro);
      const muted = hexToRgb(apiColors.cor_dominante_escuro);
      const luminance = (0.299 * dominant.r + 0.587 * dominant.g + 0.114 * dominant.b) / 255;
      setColors({ dominant, vibrant, muted, isDark: luminance < 0.5 });
      console.log("[ProductLookup] Using API colors:", apiColors);
      return;
    }

    if (!product?.image_url) {
      setColors(defaultColors);
      setImageLoaded(false);
      setPreloadedSrc(null);
      return;
    }

    preloadAbortRef.current = false;
    setImageLoaded(false);
    setPreloadedSrc(null);

    const url = product.image_url;
    
    preloadImage(url)
      .then((img) => {
        if (preloadAbortRef.current) return;
        const extracted = extractColorsFromElement(img);
        setColors(extracted);
        setPreloadedSrc(url);
        setImageLoaded(true);
      })
      .catch((err) => {
        console.warn("[ProductLookup] Image preload failed:", err);
        if (preloadAbortRef.current) return;
        setColors(defaultColors);
        setPreloadedSrc(url);
      });

    return () => {
      preloadAbortRef.current = true;
    };
  }, [product?.image_url, product?.api_colors]);

  // Countdown for auto-dismiss
  useEffect(() => {
    if (isLoading) {
      setCountdown(timeout);
      return;
    }

    if (!product && !error) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [product, error, isLoading, timeout, onDismiss]);

  // Reset countdown on product change
  useEffect(() => {
    setCountdown(timeout);
  }, [product?.ean, timeout]);

  // Loading state
  if (isLoading) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-20 h-20 text-primary animate-spin mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">Consultando Produto...</h2>
          <p className="text-white/60 text-xl">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Produto Não Encontrado</h2>
            <p className="text-white/70 text-xl mb-8">{error}</p>
            <div className="flex flex-col items-center gap-4">
              <p className="text-white/40 text-sm">
                Retornando automaticamente em {countdown}s
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-red-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / timeout) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // Product found
  if (product) {
    return (
      <ProductDisplay
        product={product}
        colors={colors}
        countdown={countdown}
        timeout={timeout}
        onImageLoad={() => setImageLoaded(true)}
        imageLoaded={imageLoaded}
        settings={displaySettings}
        preloadedSrc={preloadedSrc}
      />
    );
  }

  return null;
};

// Re-export types
export type { ProductData };
