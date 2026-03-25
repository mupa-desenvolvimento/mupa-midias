import { motion } from "framer-motion";
import { Package, Percent, Tag } from "lucide-react";
import { rgbToString, rgbToRgba, type ExtractedColors, type RGB } from "@/lib/colorExtractor";
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

interface ProductDisplayProps {
  product: ProductData;
  colors: ExtractedColors;
  countdown: number;
  timeout: number;
  onImageLoad: () => void;
  imageLoaded: boolean;
  settings?: Partial<ProductDisplaySettings>;
  preloadedSrc?: string | null;
}

const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 30, g: 58, b: 95 };
};

const darkenRgb = (rgb: RGB, factor: number): RGB => ({
  r: Math.round(rgb.r * factor),
  g: Math.round(rgb.g * factor),
  b: Math.round(rgb.b * factor),
});

const lightenRgb = (rgb: RGB, factor: number): RGB => ({
  r: Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor)),
  g: Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor)),
  b: Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor)),
});

export const ProductDisplay = ({
  product,
  colors,
  countdown,
  timeout,
  onImageLoad,
  imageLoaded,
  settings,
  preloadedSrc,
}: ProductDisplayProps) => {
  const formatPrice = (price: number) => {
    const [reais, centavos] = price.toFixed(2).split(".");
    return { reais, centavos };
  };

  const currentPrice = formatPrice(product.current_price);
  const originalPrice = product.original_price ? formatPrice(product.original_price) : null;

  const useColorExtraction = settings?.enable_color_extraction !== false;
  // Prioritize API colors from Mupa endpoint
  const hasApiColors = !!product.api_colors;
  const primaryColor = hasApiColors
    ? hexToRgb(product.api_colors!.cor_assinatura_produto)
    : useColorExtraction ? colors.dominant : hexToRgb(settings?.container_primary_color || "#1E3A5F");
  const secondaryColor = hasApiColors
    ? hexToRgb(product.api_colors!.fundo_legibilidade)
    : useColorExtraction ? colors.muted : hexToRgb(settings?.container_secondary_color || "#2D4A6F");
  const accentColor = hasApiColors
    ? hexToRgb(product.api_colors!.cor_dominante_claro)
    : useColorExtraction ? colors.vibrant : hexToRgb(settings?.accent_color || "#3B82F6");
  const darkPrimary = darkenRgb(primaryColor, 0.7);
  const lightPrimary = lightenRgb(primaryColor, 0.3);

  const priceSize = settings?.price_font_size ? settings.price_font_size * 1.6 : 160;
  const titleSize = settings?.title_font_size || 52;
  const subtitleSize = settings?.subtitle_font_size || 26;
  const originalPriceSize = settings?.original_price_font_size || 36;
  const imagePosition = settings?.image_position || "right";

  const formatProductName = (name: string) => {
    const words = name.split(" ");
    return { boldPart: words.slice(0, 3).join(" "), restPart: words.slice(3).join(" ") };
  };
  const { boldPart, restPart } = formatProductName(product.name);

  // Background gradient using extracted colors
  const panelGradient = `linear-gradient(160deg, ${rgbToString(primaryColor)} 0%, ${rgbToString(darkPrimary)} 60%, ${rgbToString(darkenRgb(primaryColor, 0.5))} 100%)`;

  const renderInfoPanel = () => (
    <motion.div
      className="relative h-full flex flex-col justify-between overflow-hidden"
      style={{
        background: panelGradient,
        width: "55%",
        clipPath: imagePosition === "right"
          ? "polygon(0 0, 100% 0, 92% 100%, 0 100%)"
          : "polygon(8% 0, 100% 0, 100% 100%, 0 100%)",
      }}
      initial={{ x: imagePosition === "right" ? -80 : 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Decorative shapes */}
      <motion.div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full"
        style={{ background: rgbToRgba(lightPrimary, 0.08) }}
        animate={{ scale: [1, 1.15, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-10 -left-10 w-40 h-40 rounded-full"
        style={{ background: rgbToRgba(accentColor, 0.1) }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div className="flex flex-col justify-between h-full p-8 lg:p-12 relative z-10">
        {/* Product Name */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h1 className="leading-none mb-1">
            <span
              className="block font-black tracking-tight uppercase"
              style={{ fontSize: `${titleSize}px`, color: "#FFFFFF" }}
            >
              {boldPart}
            </span>
            {restPart && (
              <span
                className="block font-light tracking-wider uppercase mt-1"
                style={{ fontSize: `${subtitleSize}px`, color: "rgba(255,255,255,0.7)" }}
              >
                {restPart}
              </span>
            )}
          </h1>
        </motion.div>

        {/* Price Section */}
        <motion.div
          className="flex-1 flex flex-col justify-center"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {/* Current Price - Bebas Neue */}
          <div className="flex items-baseline">
            <span
              className="font-normal"
              style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: `${priceSize * 0.35}px`,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1,
                marginRight: "4px",
              }}
            >
              R$
            </span>
            <motion.span
              style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: `${priceSize}px`,
                color: "#FFFFFF",
                lineHeight: 0.85,
                letterSpacing: "-2px",
              }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4, type: "spring", stiffness: 150, damping: 12 }}
            >
              {currentPrice.reais}
            </motion.span>
            <span
              style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: `${priceSize * 0.45}px`,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1,
                alignSelf: "flex-start",
                marginTop: `${priceSize * 0.05}px`,
              }}
            >
              ,{currentPrice.centavos}
            </span>
          </div>

          {/* Original price / offer info */}
          {product.is_offer && originalPrice && (
            <motion.div
              className="mt-3 flex items-center gap-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.55 }}
            >
              <span
                className="text-sm font-medium px-3 py-1 rounded"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}
              >
                A partir de {product.savings_percent ? `${product.savings_percent}% OFF` : "3 Un:"}
              </span>
              <span
                style={{
                  fontFamily: "'Bebas Neue', cursive",
                  fontSize: `${originalPriceSize * 1.2}px`,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                R$ {originalPrice.reais},{originalPrice.centavos}
              </span>
            </motion.div>
          )}

          {/* Offer badge */}
          {product.is_offer && (
            <motion.div
              className="mt-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6, type: "spring", stiffness: 200 }}
            >
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  color: "#FFFFFF",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Tag className="w-3.5 h-3.5" />
                ATENÇÃO: Promoção especial para este produto
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* EAN code */}
        <motion.div
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.35)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <p>Código: {product.ean}</p>
        </motion.div>
      </div>

      {/* Countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        <motion.div
          className="h-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.5)",
            width: `${(countdown / timeout) * 100}%`,
          }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );

  const renderImagePanel = () => (
    <motion.div
      className="h-full flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", flex: 1 }}
      initial={{ x: imagePosition === "right" ? 60 : -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Subtle shadow on the diagonal edge */}
      <div
        className="absolute top-0 h-full w-16 z-20"
        style={{
          [imagePosition === "right" ? "left" : "right"]: "-8px",
          background: imagePosition === "right"
            ? "linear-gradient(to right, rgba(0,0,0,0.08), transparent)"
            : "linear-gradient(to left, rgba(0,0,0,0.08), transparent)",
        }}
      />

      {(preloadedSrc || product.image_url) ? (
        <motion.img
          src={preloadedSrc || product.image_url || ""}
          alt={product.name}
          className="max-w-[75%] max-h-[80vh] object-contain relative z-10"
          style={{
            filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.12))",
          }}
          onLoad={onImageLoad}
          onError={(e) => {
            const target = e.currentTarget;
            if (preloadedSrc && product.image_url && target.src !== product.image_url) {
              target.src = product.image_url;
            }
          }}
          crossOrigin="anonymous"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: imageLoaded ? 1 : 0.8, opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.25, type: "spring", stiffness: 100 }}
        />
      ) : (
        <div
          className="w-48 h-48 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: rgbToRgba(primaryColor, 0.04) }}
        >
          <Package className="w-20 h-20" style={{ color: rgbToRgba(primaryColor, 0.15) }} />
        </div>
      )}

      {/* Countdown badge */}
      <motion.div
        className="absolute bottom-4 right-4 px-3 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor: rgbToRgba(primaryColor, 0.06),
          color: rgbToRgba(primaryColor, 0.35),
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {countdown}s
      </motion.div>
    </motion.div>
  );

  const isPortrait = typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false;

  if (isPortrait) {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
        <motion.div
          className="w-full"
          style={{
            background: panelGradient,
            height: "55%",
            clipPath: "polygon(0 0, 100% 0, 100% 88%, 0 100%)",
          }}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col justify-between h-full p-6 relative z-10">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
              <h1 className="leading-none">
                <span className="block font-black tracking-tight uppercase" style={{ fontSize: `${titleSize * 0.8}px`, color: "#FFFFFF" }}>
                  {boldPart}
                </span>
                {restPart && (
                  <span className="block font-light tracking-wider uppercase mt-1" style={{ fontSize: `${subtitleSize * 0.8}px`, color: "rgba(255,255,255,0.7)" }}>
                    {restPart}
                  </span>
                )}
              </h1>
            </motion.div>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }}>
              <div className="flex items-baseline">
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.25}px`, color: "rgba(255,255,255,0.9)", marginRight: "4px" }}>R$</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.7}px`, color: "#FFFFFF", lineHeight: 0.85 }}>{currentPrice.reais}</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.35}px`, color: "rgba(255,255,255,0.9)", alignSelf: "flex-start" }}>,{currentPrice.centavos}</span>
              </div>
            </motion.div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div className="h-full" style={{ backgroundColor: "rgba(255,255,255,0.5)", width: `${(countdown / timeout) * 100}%` }} />
          </div>
        </motion.div>
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#FFFFFF" }}>
          {(preloadedSrc || product.image_url) ? (
            <motion.img
              src={preloadedSrc || product.image_url || ""}
              alt={product.name}
              className="max-w-[70%] max-h-[90%] object-contain"
              style={{ filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.12))" }}
              onLoad={onImageLoad}
              crossOrigin="anonymous"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            />
          ) : (
            <Package className="w-20 h-20" style={{ color: rgbToRgba(primaryColor, 0.15) }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex" style={{ backgroundColor: "#FFFFFF" }}>
      {imagePosition === "left" ? (
        <>
          {renderImagePanel()}
          {renderInfoPanel()}
        </>
      ) : (
        <>
          {renderInfoPanel()}
          {renderImagePanel()}
        </>
      )}
    </div>
  );
};
