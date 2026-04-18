import { motion } from "framer-motion";
import { Package } from "lucide-react";
import { useProductTheme } from "@/hooks/useProductTheme";

interface ProductNormalViewProps {
  name: string;
  unit?: string;
  price: number;
  imageUrl: string | null;
  onImageLoad?: () => void;
  preloadedSrc?: string | null;
}

const formatPrice = (value: number) => {
  const [int, dec = "00"] = value.toFixed(2).split(".");
  return { int, dec };
};

export const ProductNormalView = ({
  name,
  unit,
  price,
  imageUrl,
  onImageLoad,
  preloadedSrc,
}: ProductNormalViewProps) => {
  const { int, dec } = formatPrice(price);
  const src = preloadedSrc || imageUrl;
  const theme = useProductTheme(src);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col bg-white"
    >
      {/* Image area */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        {src ? (
          <img
            src={src}
            alt={name}
            onLoad={onImageLoad}
            crossOrigin="anonymous"
            className="max-h-full max-w-full object-contain drop-shadow-xl"
          />
        ) : (
          <Package className="w-40 h-40 text-zinc-300" />
        )}
      </div>

      {/* Card */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
        className="relative mx-4 mb-4 rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: theme.cardBg }}
      >
        {/* Header band (extracted) */}
        <div
          className="px-6 py-5 text-center"
          style={{ backgroundColor: theme.bandBg }}
        >
          <h1
            className="text-3xl md:text-5xl font-black uppercase leading-tight tracking-tight"
            style={{ color: theme.bandText, fontFamily: "'Impact', 'Anton', sans-serif" }}
          >
            {name}
          </h1>
          {unit && (
            <p
              className="text-xl md:text-2xl font-bold mt-1"
              style={{ color: theme.bandText }}
            >
              {unit}
            </p>
          )}
        </div>

        {/* Price block */}
        <div className="flex items-center justify-center py-10 px-6">
          <div
            className="rounded-2xl px-8 py-4 shadow-lg"
            style={{ backgroundColor: theme.priceBg }}
          >
            <div className="flex items-baseline gap-1">
              <span className="text-3xl md:text-5xl font-black" style={{ color: theme.priceText }}>
                R$
              </span>
              <span
                className="text-7xl md:text-9xl font-black leading-none tracking-tight"
                style={{ color: theme.priceText }}
              >
                {int}
              </span>
              <span
                className="text-4xl md:text-6xl font-black"
                style={{ color: theme.priceText }}
              >
                ,{dec}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
