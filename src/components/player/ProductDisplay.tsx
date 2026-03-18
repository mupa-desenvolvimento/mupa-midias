import { motion } from "framer-motion";
import { Package, Tag, Percent } from "lucide-react";
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
  const savings = product.original_price ? product.original_price - product.current_price : 0;

  const useColorExtraction = settings?.enable_color_extraction !== false;
  const primaryColor = useColorExtraction ? colors.dominant : hexToRgb(settings?.container_primary_color || "#1E3A5F");
  const secondaryColor = useColorExtraction ? colors.muted : hexToRgb(settings?.container_secondary_color || "#2D4A6F");
  const accentColor = useColorExtraction ? colors.vibrant : hexToRgb(settings?.accent_color || "#3B82F6");

  // Darker variants for text on white background
  const titleColor = darkenRgb(primaryColor, 0.7);
  const priceColor = darkenRgb(primaryColor, 0.65);

  const titleSize = settings?.title_font_size || 52;
  const subtitleSize = settings?.subtitle_font_size || 26;
  const priceSize = settings?.price_font_size || 100;
  const originalPriceSize = settings?.original_price_font_size || 36;
  const imagePosition = settings?.image_position || "right";

  const formatProductName = (name: string) => {
    const words = name.split(" ");
    return { boldPart: words.slice(0, 3).join(" "), restPart: words.slice(3).join(" ") };
  };
  const { boldPart, restPart } = formatProductName(product.name);

  // Accent gradient for badges and decorative elements
  const accentGradient = `linear-gradient(135deg, ${rgbToString(accentColor)}, ${rgbToString(primaryColor)})`;

  const renderInfoPanel = () => (
    <motion.div
      className="w-1/2 h-full flex flex-col justify-between relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF" }}
      initial={{ x: imagePosition === "right" ? -60 : 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Top decorative accent line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: accentGradient }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />

      {/* Subtle side accent stripe */}
      <motion.div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ background: accentGradient }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      />

      <div className="flex flex-col justify-between h-full p-8 lg:p-12 pl-10 lg:pl-14">
        {/* Product Name */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="leading-tight mb-2">
            <span
              className="block font-black tracking-tight uppercase"
              style={{ fontSize: `${titleSize}px`, color: rgbToString(titleColor) }}
            >
              {boldPart}
            </span>
            {restPart && (
              <span
                className="block font-light tracking-wider uppercase mt-1"
                style={{ fontSize: `${subtitleSize}px`, color: rgbToRgba(titleColor, 0.6) }}
              >
                {restPart}
              </span>
            )}
          </h1>
        </motion.div>

        {/* Offer badge */}
        {product.is_offer && (
          <motion.div
            className="flex items-center gap-2 my-3"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4, type: "spring", stiffness: 200 }}
          >
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-sm shadow-lg"
              style={{
                background: accentGradient,
                boxShadow: `0 4px 20px ${rgbToRgba(accentColor, 0.3)}`,
              }}
            >
              <Percent className="w-4 h-4" />
              OFERTA ESPECIAL
            </span>
          </motion.div>
        )}

        {/* Price block */}
        <motion.div
          className="my-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          {/* Original price */}
          {product.is_offer && originalPrice && (
            <motion.div
              className="flex items-baseline gap-2 mb-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <span style={{ fontSize: `${originalPriceSize * 0.5}px`, color: rgbToRgba(titleColor, 0.4) }}>DE</span>
              <span style={{ fontSize: `${originalPriceSize * 0.55}px`, color: rgbToRgba(titleColor, 0.4) }}>R$</span>
              <span
                className="line-through font-semibold"
                style={{ fontSize: `${originalPriceSize}px`, color: rgbToRgba(titleColor, 0.45) }}
              >
                {originalPrice.reais}
                <span style={{ fontSize: `${originalPriceSize * 0.6}px` }}>,{originalPrice.centavos}</span>
              </span>
            </motion.div>
          )}

          {/* Current price card with product-colored background */}
          <motion.div
            className="inline-block px-6 py-5 rounded-2xl"
            style={{
              backgroundColor: rgbToRgba(primaryColor, 0.08),
              border: `2px solid ${rgbToRgba(accentColor, 0.15)}`,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45, type: "spring", stiffness: 150 }}
          >
            {product.is_offer && (
              <span
                className="block text-sm mb-1 font-semibold tracking-wide"
                style={{ color: rgbToString(accentColor) }}
              >
                POR APENAS
              </span>
            )}
            <div className="flex items-baseline">
              <span className="font-medium mr-1" style={{ fontSize: `${priceSize * 0.28}px`, color: rgbToString(priceColor) }}>
                R$
              </span>
              <motion.span
                className="font-extrabold"
                style={{ fontSize: `${priceSize}px`, lineHeight: 1, color: rgbToString(priceColor) }}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6, type: "spring" }}
              >
                {currentPrice.reais}
              </motion.span>
              <span className="font-bold" style={{ fontSize: `${priceSize * 0.4}px`, color: rgbToString(priceColor) }}>
                ,{currentPrice.centavos}
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Savings message */}
        {product.is_offer && savings > 0 && (
          <motion.div
            className="p-4 rounded-xl mb-3"
            style={{
              backgroundColor: rgbToRgba(accentColor, 0.06),
              borderLeft: `3px solid ${rgbToString(accentColor)}`,
            }}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <p className="text-base lg:text-lg" style={{ color: rgbToRgba(titleColor, 0.8) }}>
              Produto em oferta! De{" "}
              <span className="font-semibold" style={{ color: rgbToString(accentColor) }}>
                R$ {product.original_price?.toFixed(2).replace(".", ",")}
              </span>{" "}
              por{" "}
              <span className="font-semibold" style={{ color: rgbToString(accentColor) }}>
                R$ {product.current_price.toFixed(2).replace(".", ",")}
              </span>.
              {product.savings_percent && (
                <span className="font-bold" style={{ color: rgbToString(primaryColor) }}> Economia de {product.savings_percent}%!</span>
              )}
            </p>
          </motion.div>
        )}

        {/* EAN code */}
        <motion.div
          className="text-sm mt-auto"
          style={{ color: rgbToRgba(titleColor, 0.3) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <p>Código: {product.ean}</p>
        </motion.div>
      </div>

      {/* Countdown progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: rgbToRgba(primaryColor, 0.06) }}>
        <motion.div
          className="h-full"
          style={{ background: accentGradient, width: `${(countdown / timeout) * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );

  const renderImagePanel = () => (
    <motion.div
      className="w-1/2 h-full flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#FFFFFF" }}
      initial={{ x: imagePosition === "right" ? 60 : -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Subtle colored glow behind image */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "60%",
          height: "60%",
          background: `radial-gradient(circle, ${rgbToRgba(primaryColor, 0.06)} 0%, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {(preloadedSrc || product.image_url) ? (
        <motion.img
          src={preloadedSrc || product.image_url || ""}
          alt={product.name}
          className="max-w-[80%] max-h-[80vh] object-contain relative z-10"
          style={{
            filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.08))",
          }}
          onLoad={onImageLoad}
          onError={(e) => {
            const target = e.currentTarget;
            if (preloadedSrc && product.image_url && target.src !== product.image_url) {
              target.src = product.image_url;
            }
          }}
          crossOrigin="anonymous"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: imageLoaded ? 1 : 0.85, opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.3, type: "spring", stiffness: 120 }}
        />
      ) : (
        <div className="w-64 h-64 rounded-2xl flex items-center justify-center" style={{ backgroundColor: rgbToRgba(primaryColor, 0.04) }}>
          <Package className="w-24 h-24" style={{ color: rgbToRgba(primaryColor, 0.15) }} />
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
        <div className="w-full h-[45%]">{renderImagePanel()}</div>
        <div className="w-full flex-1">{renderInfoPanel()}</div>
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
