import { Package, Tag, CheckCircle } from "lucide-react";
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
}

// Convert hex to RGB
const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 30, g: 58, b: 95 };
};

// Get luminance to determine text color
const getLuminance = (rgb: RGB): number => {
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
};

export const ProductDisplay = ({
  product,
  colors,
  countdown,
  timeout,
  onImageLoad,
  imageLoaded,
  settings,
}: ProductDisplayProps) => {
  // Formatar preço
  const formatPrice = (price: number) => {
    const [reais, centavos] = price.toFixed(2).split(".");
    return { reais, centavos };
  };

  const currentPrice = formatPrice(product.current_price);
  const originalPrice = product.original_price ? formatPrice(product.original_price) : null;

  // Calcular economia
  const savings = product.original_price 
    ? product.original_price - product.current_price 
    : 0;

  // Determine colors based on settings
  const useColorExtraction = settings?.enable_color_extraction !== false;
  
  // Colors for the gradient/background
  const primaryColor = useColorExtraction 
    ? colors.muted 
    : hexToRgb(settings?.container_primary_color || "#1E3A5F");
  const secondaryColor = useColorExtraction 
    ? colors.dominant 
    : hexToRgb(settings?.container_secondary_color || "#2D4A6F");
  const accentColor = useColorExtraction 
    ? colors.vibrant 
    : hexToRgb(settings?.accent_color || "#3B82F6");

  // Determine if background is dark
  const isDark = useColorExtraction ? colors.isDark : getLuminance(primaryColor) < 0.5;

  // Gerar gradiente de fundo
  const leftGradient = `linear-gradient(180deg, 
    ${rgbToRgba(primaryColor, 1)} 0%, 
    ${rgbToRgba(secondaryColor, 0.9)} 50%, 
    ${rgbToRgba(primaryColor, 1)} 100%
  )`;

  // Fundo do lado da imagem
  const imageBackground = settings?.image_background_color || "#FFFFFF";

  // Cores do texto baseadas na luminância do fundo
  const textColor = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-white/70" : "text-slate-600";

  // Font sizes from settings
  const titleSize = settings?.title_font_size || 48;
  const subtitleSize = settings?.subtitle_font_size || 24;
  const priceSize = settings?.price_font_size || 96;
  const originalPriceSize = settings?.original_price_font_size || 36;

  // Positions
  const imagePosition = settings?.image_position || "right";
  const pricePosition = settings?.price_position || "bottom";

  // Formatar nome do produto: 3 primeiras palavras em bold
  const formatProductName = (name: string) => {
    const words = name.split(" ");
    const boldPart = words.slice(0, 3).join(" ");
    const restPart = words.slice(3).join(" ");
    return { boldPart, restPart };
  };

  const { boldPart, restPart } = formatProductName(product.name);

  // Render info section
  const renderInfoSection = () => (
    <div 
      className="w-1/2 flex flex-col justify-between p-8 lg:p-12 relative overflow-hidden"
      style={{ background: leftGradient }}
    >
      {/* Header com nome - container destacado */}
      <div 
        className="relative z-10 px-6 py-4 -mx-8 lg:-mx-12"
        style={{ 
          backgroundColor: rgbToRgba(accentColor, 0.95),
        }}
      >
        {/* Nome do produto - 3 primeiras palavras em bold, restante menor e fino */}
        <h1 className="text-white leading-tight">
          <span 
            className="block font-black tracking-tight uppercase"
            style={{ fontSize: `${titleSize}px` }}
          >
            {boldPart}
          </span>
          {restPart && (
            <span 
              className="block font-light tracking-wide uppercase mt-1"
              style={{ fontSize: `${subtitleSize}px` }}
            >
              {restPart}
            </span>
          )}
        </h1>
      </div>

      {/* Tags de oferta */}
      {product.is_offer && pricePosition === "bottom" && (
        <div className="flex flex-wrap gap-2 my-4">
          <span 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold text-sm lg:text-base"
            style={{ backgroundColor: rgbToString(accentColor) }}
          >
            <CheckCircle className="w-4 h-4" />
            OFERTA PREÇO DE POR
          </span>
        </div>
      )}

      {/* Bloco de preços - position varies */}
      <div 
        className={`relative z-10 my-6 ${
          pricePosition === "top" ? "order-first" : 
          pricePosition === "center" ? "flex-1 flex flex-col justify-center" : ""
        }`}
      >
        {/* Preço original (se oferta) */}
        {product.is_offer && originalPrice && (
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`${textMuted}`} style={{ fontSize: `${originalPriceSize * 0.5}px` }}>DE</span>
            <span 
              className={`${textMuted} line-through`}
              style={{ fontSize: `${originalPriceSize}px` }}
            >
              R$ {originalPrice.reais}<span style={{ fontSize: `${originalPriceSize * 0.6}px` }}>,{originalPrice.centavos}</span>
            </span>
          </div>
        )}
        
        {/* Preço atual */}
        <div 
          className="inline-block px-6 py-4 rounded-xl"
          style={{ 
            backgroundColor: rgbToRgba(isDark ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }, 0.3),
            backdropFilter: 'blur(8px)'
          }}
        >
          {product.is_offer && (
            <span className={`block text-sm ${textMuted} mb-1`}>POR</span>
          )}
          <div className="flex items-baseline">
            <span 
              className={`${textColor} font-medium mr-1`}
              style={{ fontSize: `${priceSize * 0.3}px` }}
            >
              R$
            </span>
            <span 
              className={`font-bold ${textColor}`}
              style={{ fontSize: `${priceSize}px` }}
            >
              {currentPrice.reais}
            </span>
            <span 
              className={`${textColor} font-bold`}
              style={{ fontSize: `${priceSize * 0.4}px` }}
            >
              ,{currentPrice.centavos}
            </span>
            <span 
              className={`${textMuted} font-medium ml-2`}
              style={{ fontSize: `${priceSize * 0.25}px` }}
            >
              / {product.unit || 'UN'}
            </span>
          </div>
        </div>
      </div>

      {/* Mensagem de economia */}
      {product.is_offer && savings > 0 && pricePosition === "bottom" && (
        <div 
          className="p-4 rounded-xl mb-4"
          style={{ 
            backgroundColor: rgbToRgba(isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }, 0.15),
            backdropFilter: 'blur(4px)'
          }}
        >
          <p className={`${textColor} text-base lg:text-lg`}>
            Produto em oferta! De <span className="font-semibold">R$ {product.original_price?.toFixed(2).replace('.', ',')}</span> por{' '}
            <span className="font-semibold">R$ {product.current_price.toFixed(2).replace('.', ',')}</span>.
            {product.savings_percent && (
              <span className="font-bold"> Economia de {product.savings_percent}%!</span>
            )}
          </p>
        </div>
      )}

      {/* Economia em destaque */}
      {product.is_offer && savings > 0 && pricePosition === "bottom" && (
        <div className="mb-4">
          <p className={`${textMuted} text-sm mb-2`}>Você economiza:</p>
          <div 
            className="inline-flex items-center px-4 py-2 rounded-lg font-bold text-white text-xl"
            style={{ backgroundColor: 'rgb(34, 197, 94)' }}
          >
            R$ {savings.toFixed(2).replace('.', ',')}
          </div>
        </div>
      )}

      {/* Código EAN e countdown */}
      <div className={`relative z-10 ${textMuted} text-sm`}>
        <p>Código: {product.ean}</p>
      </div>

      {/* Barra de progresso do countdown */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{ 
            width: `${(countdown / timeout) * 100}%`,
            backgroundColor: rgbToString(accentColor)
          }}
        />
      </div>
    </div>
  );

  // Render image section
  const renderImageSection = () => (
    <div 
      className="w-1/2 flex items-center justify-center p-8 relative"
      style={{ backgroundColor: imageBackground }}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className={`max-w-[85%] max-h-[85vh] object-contain drop-shadow-2xl transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={onImageLoad}
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center">
          <Package className="w-24 h-24 text-slate-300" />
        </div>
      )}

      {/* Indicador de countdown discreto */}
      <div className="absolute bottom-4 right-4 text-slate-300 text-xs">
        {countdown}s
      </div>
    </div>
  );

  const isPortrait = typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false;

  if (isPortrait) {
    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="w-full h-1/2">
          {renderImageSection()}
        </div>
        <div className="w-full flex-1">
          {renderInfoSection()}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex">
      {imagePosition === "left" ? (
        <>
          {renderImageSection()}
          {renderInfoSection()}
        </>
      ) : (
        <>
          {renderInfoSection()}
          {renderImageSection()}
        </>
      )}
    </div>
  );
};
