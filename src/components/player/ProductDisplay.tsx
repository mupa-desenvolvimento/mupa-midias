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
  offer_quantity?: number | null;
  offer_type?: string | null;
  packs?: Array<{
    id_product: number;
    id_store: number;
    unit_pack: number;
    price_pack: number;
    price_prom_pack: number;
    stock_avaliable: number;
  }>;
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
  playerIsPortrait?: boolean;
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
  playerIsPortrait = false,
}: ProductDisplayProps) => {
  if (playerIsPortrait && Array.isArray(product.packs) && product.packs.length > 0) {
    return (
      <GrupoAssaiPortraitDisplay
        product={product}
        colors={colors}
        countdown={countdown}
        timeout={timeout}
        onImageLoad={onImageLoad}
        imageLoaded={imageLoaded}
        settings={settings}
        preloadedSrc={preloadedSrc}
      />
    );
  }

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
  const subtitleSize = settings?.subtitle_font_size || 32;
  const originalPriceSize = settings?.original_price_font_size || 36;
  const imagePosition = settings?.image_position || "right";

  const formatProductName = (name: string) => {
    const words = name.split(" ");
    return { boldPart: words.slice(0, 3).join(" "), restPart: words.slice(3).join(" ") };
  };
  const { boldPart, restPart } = formatProductName(product.name);

  const panelGradient = `linear-gradient(180deg, #D32F2F 0%, #D32F2F 35%, ${rgbToString(darkPrimary)} 35%, ${rgbToString(darkPrimary)} 100%)`;
  const displayMainPriceValue =
    product.offer_quantity && product.original_price && product.original_price > product.current_price
      ? product.original_price
      : product.current_price;
  const badgePromoValue =
    product.offer_quantity && product.original_price && product.original_price > product.current_price
      ? product.current_price
      : null;
  const mainPrice = formatPrice(displayMainPriceValue);
  const badgePrice = badgePromoValue != null ? formatPrice(badgePromoValue) : null;

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
          <div
            className="inline-block rounded-lg px-6 py-3"
            style={{ backgroundColor: "#D32F2F", boxShadow: "0 12px 28px rgba(0,0,0,0.25)" }}
          >
            <div
              className="font-black tracking-tight uppercase"
              style={{ fontSize: `${titleSize}px`, color: "#FFFFFF", lineHeight: 1 }}
            >
              {boldPart}
            </div>
          </div>
          {restPart && (
            <div
              className="mt-2 font-medium tracking-wide uppercase"
              style={{ fontSize: `${subtitleSize}px`, color: "rgba(255,255,255,0.82)" }}
            >
              {restPart}
            </div>
          )}
        </motion.div>

        {/* Price Section */}
        <motion.div
          className="flex-1 flex flex-col justify-center"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {/* Current Price - Bebas Neue */}
          <div
            className="inline-flex items-baseline px-5 py-3 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
              backdropFilter: "blur(6px)",
              alignSelf: "flex-start",
            }}
          >
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
                textShadow: "0 12px 28px rgba(0,0,0,0.35)",
              }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4, type: "spring", stiffness: 150, damping: 12 }}
            >
              {mainPrice.reais}
            </motion.span>
            <span
              style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: `${priceSize * 0.45}px`,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1,
                alignSelf: "flex-start",
                marginTop: `${priceSize * 0.05}px`,
                textShadow: "0 10px 24px rgba(0,0,0,0.35)",
              }}
            >
              ,{mainPrice.centavos}
            </span>
          </div>

          {badgePrice ? (
            <motion.div
              className="mt-3 flex items-center gap-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.55 }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                A partir de {product.offer_quantity} Un:
              </span>
              <span
                className="inline-flex items-baseline gap-1 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "#E53935", color: "#FFFFFF", boxShadow: "0 10px 24px rgba(0,0,0,0.28)" }}
              >
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${originalPriceSize * 0.7}px`, lineHeight: 1 }}>R$</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${originalPriceSize * 1.3}px`, lineHeight: 0.9 }}>{badgePrice.reais}</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${originalPriceSize * 0.9}px`, alignSelf: "flex-start", lineHeight: 1 }}>,{badgePrice.centavos}</span>
              </span>
            </motion.div>
          ) : product.is_offer && originalPrice ? (
            <motion.div
              className="mt-3 flex items-center gap-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.55 }}
            >
              <span
                className="text-sm font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-2"
                style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
              >
                {product.savings_percent ? <Percent className="w-4 h-4" /> : null}
                {product.savings_percent ? `${product.savings_percent}% OFF` : "Oferta"}
              </span>
              <span
                style={{
                  fontFamily: "'Bebas Neue', cursive",
                  fontSize: `${originalPriceSize * 1.2}px`,
                  color: "rgba(255,255,255,0.85)",
                  textDecoration: "line-through",
                }}
              >
                R$ {originalPrice.reais},{originalPrice.centavos}
              </span>
            </motion.div>
          ) : null}

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
      <div
        className="absolute"
        style={{
          width: "260px",
          height: "46px",
          borderRadius: "999px",
          backgroundColor: "#FFFFFF",
          bottom: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
          zIndex: 5,
        }}
      />

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
                  <span className="block font-medium tracking-wide uppercase mt-1" style={{ fontSize: `${subtitleSize * 0.9}px`, color: "rgba(255,255,255,0.82)" }}>
                    {restPart}
                  </span>
                )}
              </h1>
            </motion.div>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }}>
              <div className="inline-flex items-baseline px-4 py-2 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 18px 45px rgba(0,0,0,0.28)", backdropFilter: "blur(6px)", alignSelf: "flex-start" }}>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.25}px`, color: "rgba(255,255,255,0.9)", marginRight: "4px" }}>R$</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.7}px`, color: "#FFFFFF", lineHeight: 0.85, textShadow: "0 12px 28px rgba(0,0,0,0.35)" }}>{mainPrice.reais}</span>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${priceSize * 0.35}px`, color: "rgba(255,255,255,0.9)", alignSelf: "flex-start", textShadow: "0 10px 24px rgba(0,0,0,0.35)" }}>,{mainPrice.centavos}</span>
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

const formatCurrencyValue = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(2);
  const [reais, centavos] = fixed.split(".");
  return { reais, centavos };
};

const parseProductNameParts = (text: string) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  return {
    head: words.slice(0, 3).join(" "),
    tail: words.slice(3).join(" "),
  };
};

const getPackUnitPrice = (pack: { price_pack: number; price_prom_pack: number; unit_pack: number }) => {
  const unitPack = Math.max(1, Number(pack.unit_pack) || 1);
  const promo = Number(pack.price_prom_pack) || 0;
  const regular = Number(pack.price_pack) || 0;
  const best = promo > 0 ? promo : regular;
  return best > 0 ? best / unitPack : 0;
};

const pickUnitPack = (
  packs: Array<{ unit_pack: number; price_pack: number; price_prom_pack: number }>,
) => packs.find((p) => Number(p.unit_pack) === 1) || null;

const pickBestMultiPack = (
  packs: Array<{ unit_pack: number; price_pack: number; price_prom_pack: number }>,
) => {
  const candidates = packs
    .filter((p) => Number(p.unit_pack) > 1 && ((Number(p.price_pack) || 0) > 0 || (Number(p.price_prom_pack) || 0) > 0))
    .map((p) => ({ p, perUnit: getPackUnitPrice(p) }))
    .filter((x) => x.perUnit > 0)
    .sort((a, b) => a.perUnit - b.perUnit);
  return candidates[0]?.p || null;
};

const GrupoAssaiPortraitDisplay = ({
  product,
  countdown,
  timeout,
  onImageLoad,
  imageLoaded,
  preloadedSrc,
}: ProductDisplayProps) => {
  const hasApiColors = !!product.api_colors;
  const baseDark = hasApiColors ? product.api_colors!.cor_dominante_escuro : "#1E3A5F";
  const baseAssinatura = hasApiColors ? product.api_colors!.cor_assinatura_produto : "#1E3A5F";
  const baseLight = hasApiColors ? product.api_colors!.cor_dominante_claro : "#FFFFFF";
  const legible = hasApiColors ? product.api_colors!.fundo_legibilidade : "#FFFFFF";

  const darkRgb = hexToRgb(baseDark);
  const lightRgb = hexToRgb(baseLight);
  const assinaturaRgb = hexToRgb(baseAssinatura);

  const secondaryBg = rgbToRgba(assinaturaRgb, hasApiColors ? 0.85 : 1);
  const secondaryText = rgbToRgba(hexToRgb(legible), 0.75);
  const blobColor = rgbToRgba(lightRgb, 0.12);
  const shadowColor = rgbToRgba(darkRgb, 0.45);

  const packs = (product.packs || []) as Array<{
    unit_pack: number;
    price_pack: number;
    price_prom_pack: number;
  }>;
  const unitPack = pickUnitPack(packs);
  const bestMulti = pickBestMultiPack(packs);

  const unitPriceValue = unitPack
    ? (Number(unitPack.price_prom_pack) || 0) > 0 ? Number(unitPack.price_prom_pack) : Number(unitPack.price_pack) || 0
    : Number(product.current_price) || 0;
  const unitOriginalValue = unitPack && (Number(unitPack.price_prom_pack) || 0) > 0 && (Number(unitPack.price_pack) || 0) > (Number(unitPack.price_prom_pack) || 0)
    ? Number(unitPack.price_pack)
    : null;

  const unitPrice = formatCurrencyValue(unitPriceValue);
  const unitOriginal = unitOriginalValue != null ? formatCurrencyValue(unitOriginalValue) : null;

  const multiPerUnit = bestMulti ? getPackUnitPrice(bestMulti) : 0;
  const multiPerUnitOriginal = bestMulti && (Number(bestMulti.price_prom_pack) || 0) > 0 && (Number(bestMulti.price_pack) || 0) > (Number(bestMulti.price_prom_pack) || 0)
    ? (Number(bestMulti.price_pack) || 0) / Math.max(1, Number(bestMulti.unit_pack) || 1)
    : null;

  const multiPrice = multiPerUnit > 0 ? formatCurrencyValue(multiPerUnit) : null;
  const multiOriginal = multiPerUnitOriginal != null ? formatCurrencyValue(multiPerUnitOriginal) : null;

  const { head, tail } = parseProductNameParts(product.name);
  const imageSrc = preloadedSrc || product.image_url;
  const showImage = hasApiColors && !!imageSrc;

  const background = `linear-gradient(145deg, ${rgbToString(darkRgb)} 0%, ${rgbToString(darkRgb)} 50%, ${secondaryBg} 50%, ${secondaryBg} 100%)`;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background }}>
      <motion.div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full"
        style={{ background: blobColor }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full"
        style={{ background: blobColor }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-56 left-6 w-56 h-56 rounded-full blur-sm"
        style={{ background: rgbToRgba(lightRgb, 0.08) }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <div className="relative z-10 grid h-full grid-rows-[0.2fr_0.4fr_0.4fr] px-10 py-12">
        <motion.div
          className="flex items-start"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0 }}
        >
          <div className="max-w-[90%]">
            <div className="inline-block rounded-2xl px-6 py-4" style={{ backgroundColor: "#D32F2F" }}>
              <div className="text-[34px] leading-[1] font-bold uppercase" style={{ color: legible }}>
                {head}
              </div>
            </div>
            {tail ? (
              <div className="mt-3 text-[22px] leading-[1.2] font-medium uppercase" style={{ color: secondaryText }}>
                {tail}
              </div>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col items-center justify-center"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.2 }}
        >
          <div className="relative flex flex-col items-center justify-center w-full">
            {showImage ? (
              <img
                src={imageSrc!}
                alt={product.name}
                className="max-h-[280px] object-contain select-none"
                style={{ filter: `drop-shadow(0 26px 28px ${shadowColor})` }}
                onLoad={() => {
                  if (!imageLoaded) onImageLoad();
                }}
              />
            ) : (
              <Package className="w-28 h-28" style={{ color: rgbToRgba(lightRgb, 0.25) }} />
            )}

            <div className="relative mt-4 w-full flex items-center justify-center">
              <div className="absolute top-1/2 -translate-y-1/2 w-[68%] h-9 rounded-full bg-white/90" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[72%] h-10 rounded-full"
                style={{ boxShadow: `0 18px 26px ${rgbToRgba(darkRgb, 0.45)}` }}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col justify-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.35 }}
        >
          <div className="flex flex-col items-start">
            <div className="flex items-end gap-2">
              <span
                className="font-normal"
                style={{
                  fontFamily: "'Bebas Neue', cursive",
                  fontSize: "52px",
                  lineHeight: 1,
                  color: legible,
                }}
              >
                R$
              </span>
              <span
                style={{
                  fontFamily: "'Bebas Neue', cursive",
                  fontSize: "170px",
                  lineHeight: 0.85,
                  letterSpacing: "-2px",
                  color: legible,
                }}
              >
                {unitPrice.reais},{unitPrice.centavos}
              </span>
            </div>

            {unitOriginal ? (
              <div
                className="mt-2 text-[26px] font-semibold uppercase"
                style={{ color: secondaryText, textDecoration: "line-through" }}
              >
                R$ {unitOriginal.reais},{unitOriginal.centavos}
              </div>
            ) : null}

            {bestMulti && multiPrice ? (
              <motion.div
                className="mt-6 flex items-center gap-4"
                initial={{ x: -22, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="text-[18px] font-semibold uppercase" style={{ color: secondaryText }}>
                  A partir de {bestMulti.unit_pack} Un:
                </div>
                <div className="rounded-xl px-5 py-3" style={{ backgroundColor: "#D32F2F" }}>
                  <div className="flex items-end gap-1" style={{ color: legible }}>
                    <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: "28px", lineHeight: 1 }}>R$</span>
                    <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: "54px", lineHeight: 0.9 }}>
                      {multiPrice.reais},{multiPrice.centavos}
                    </span>
                  </div>
                  {multiOriginal ? (
                    <div className="mt-1 text-[14px] font-semibold uppercase" style={{ color: legible, opacity: 0.85, textDecoration: "line-through" }}>
                      R$ {multiOriginal.reais},{multiOriginal.centavos}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </div>

          <div className="mt-10 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${(countdown / timeout) * 100}%`,
                background: rgbToRgba(hexToRgb(legible), 0.35),
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};
