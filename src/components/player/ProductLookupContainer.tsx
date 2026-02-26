import { useEffect, useState, useRef } from "react";
import { AlertCircle, Package, Loader2 } from "lucide-react";
import { extractColors, rgbToString, rgbToRgba, type ExtractedColors } from "@/lib/colorExtractor";
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

const defaultColors: ExtractedColors = {
  dominant: { r: 30, g: 58, b: 95 },
  vibrant: { r: 59, g: 130, b: 246 },
  muted: { r: 15, g: 23, b: 42 },
  isDark: true,
};

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
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const effectiveInputRef = inputRef || hiddenInputRef;

  // Foca no input quando produto é carregado
  useEffect(() => {
    if (product && effectiveInputRef.current) {
      effectiveInputRef.current.focus();
    }
  }, [product, effectiveInputRef]);

  // Extrair cores quando produto muda
  useEffect(() => {
    if (product?.image_url) {
      setImageLoaded(false);
      extractColors(product.image_url).then((extractedColors) => {
        setColors(extractedColors);
      });
    } else {
      setColors(defaultColors);
    }
  }, [product?.image_url]);

  // Countdown para retorno automático
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

  // Reset countdown quando produto muda
  useEffect(() => {
    setCountdown(timeout);
  }, [product?.ean, timeout]);

  // Estado de carregamento
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

  // Estado de erro
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
        
        {/* Barra de progresso */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-red-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / timeout) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // Estado de produto encontrado
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
      />
    );
  }

  return null;
};

// Re-export types
export type { ProductData };
