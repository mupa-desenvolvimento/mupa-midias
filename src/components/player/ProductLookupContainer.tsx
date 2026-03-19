import { useEffect, useState, useRef, useCallback } from "react";
import { AlertCircle, Package, Loader2 } from "lucide-react";
import { preloadImage, extractColorsFromElement, getDefaultColors, rgbToString, rgbToRgba, type ExtractedColors, type RGB } from "@/lib/colorExtractor";
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
  cores?: string[] | null;
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

const defaultColors: ExtractedColors = getDefaultColors();

const hexToRgb = (hex: string): RGB | null => {
  const normalized = hex.trim();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
};

const getLuminance = (rgb: RGB): number => (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

const paletteToExtractedColors = (cores: string[]): ExtractedColors => {
  const rgbs = cores.map(hexToRgb).filter((c): c is RGB => !!c);
  if (!rgbs.length) return defaultColors;

  const saturation = (c: RGB) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const key = (c: RGB) => `${c.r},${c.g},${c.b}`;
  const nonWhite = rgbs.filter((c) => getLuminance(c) <= 0.95);
  const candidates = nonWhite.length ? nonWhite : rgbs;
  const bySat = [...candidates].sort((a, b) => saturation(b) - saturation(a));

  const dominant = bySat[0] || rgbs[0];
  const dominantKey = key(dominant);
  const muted =
    bySat.find((c) => key(c) !== dominantKey && Math.abs(getLuminance(c) - getLuminance(dominant)) > 0.08) ||
    bySat.find((c) => key(c) !== dominantKey) ||
    rgbs[1] ||
    dominant;
  const vibrant =
    bySat.find((c) => key(c) !== dominantKey && key(c) !== key(muted)) ||
    rgbs.find((c) => key(c) !== dominantKey) ||
    dominant;

  return { dominant, muted, vibrant, isDark: getLuminance(dominant) < 0.5 };
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

  // Preload image + extract colors in single pass
  useEffect(() => {
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
    const hasApiPalette = Array.isArray(product.cores) && product.cores.length > 0;

    if (hasApiPalette) {
      setColors(paletteToExtractedColors(product.cores as string[]));
    }
    
    preloadImage(url)
      .then((img) => {
        if (preloadAbortRef.current) return;
        if (!hasApiPalette) {
          const extracted = extractColorsFromElement(img);
          setColors(extracted);
        }
        setPreloadedSrc(url);
        setImageLoaded(true);
      })
      .catch((err) => {
        console.warn("[ProductLookup] Image preload failed:", err);
        if (preloadAbortRef.current) return;
        setColors(defaultColors);
        // Still set the src so the <img> tag can try loading it
        setPreloadedSrc(url);
      });

    return () => {
      preloadAbortRef.current = true;
    };
  }, [product?.image_url, product?.cores]);

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
