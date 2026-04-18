import { motion } from "framer-motion";
import { Package } from "lucide-react";

interface ProductOfferViewProps {
  name: string;
  unit?: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string | null;
  onImageLoad?: () => void;
  preloadedSrc?: string | null;
}

const formatPrice = (value: number) => {
  const [int, dec = "00"] = value.toFixed(2).split(".");
  return { int, dec };
};

export const ProductOfferView = ({
  name,
  unit,
  currentPrice,
  originalPrice,
  imageUrl,
  onImageLoad,
  preloadedSrc,
}: ProductOfferViewProps) => {
  const orig = formatPrice(originalPrice);
  const curr = formatPrice(currentPrice);
  const src = preloadedSrc || imageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col bg-white overflow-hidden"
    >
      {/* Red diagonal "PRODUTO EM OFERTA" ribbon */}
      <motion.div
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        className="absolute top-0 left-0 z-20 origin-top-left"
        style={{
          transform: "rotate(-45deg) translate(-30%, 40%)",
          width: "320px",
        }}
      >
        <div
          className="text-center py-2 shadow-lg"
          style={{
            background: "linear-gradient(180deg, #E63946 0%, #B71C1C 100%)",
            color: "#fff",
          }}
        >
          <span className="text-base md:text-lg font-black uppercase tracking-wider">
            Produto em Oferta
          </span>
        </div>
      </motion.div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        {src ? (
          <img
            src={src}
            alt={name}
            onLoad={onImageLoad}
            className="max-h-full max-w-full object-contain drop-shadow-xl"
          />
        ) : (
          <Package className="w-40 h-40 text-zinc-300" />
        )}
      </div>

      {/* Brown card */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
        className="relative mx-4 mb-4 rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#8B3A1F" }}
      >
        {/* Yellow header band */}
        <div
          className="px-6 py-5 text-center"
          style={{ backgroundColor: "#FFD60A" }}
        >
          <h1
            className="text-3xl md:text-5xl font-black uppercase leading-tight tracking-tight"
            style={{ color: "#8B3A1F", fontFamily: "'Impact', 'Anton', sans-serif" }}
          >
            {name}
          </h1>
          {unit && (
            <p
              className="text-xl md:text-2xl font-bold mt-1"
              style={{ color: "#8B3A1F" }}
            >
              {unit}
            </p>
          )}
        </div>

        {/* Prices */}
        <div className="flex flex-col gap-3 py-6 px-6">
          {/* DE: original price (struck) */}
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg px-3 py-1 shadow"
              style={{ backgroundColor: "#E63946" }}
            >
              <span className="text-white font-black text-lg md:text-xl">DE:</span>
            </div>
            <div className="relative inline-flex items-baseline gap-1">
              <span className="text-2xl md:text-4xl font-black text-white">R$</span>
              <span className="text-3xl md:text-5xl font-black text-white">
                {orig.int},{orig.dec}
              </span>
              {/* Diagonal red strike */}
              <span
                className="absolute left-0 right-0 top-1/2 h-[4px] md:h-[6px] -rotate-6"
                style={{ backgroundColor: "#E63946" }}
              />
            </div>
          </div>

          {/* POR: promo price */}
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg px-3 py-1 shadow"
              style={{ backgroundColor: "#FFD60A" }}
            >
              <span className="font-black text-lg md:text-xl" style={{ color: "#111" }}>
                POR:
              </span>
            </div>
            <div
              className="rounded-2xl px-5 py-2 shadow-lg"
              style={{ backgroundColor: "#FFD60A" }}
            >
              <div className="flex items-baseline gap-1">
                <span className="text-3xl md:text-5xl font-black" style={{ color: "#111" }}>
                  R$
                </span>
                <span
                  className="text-7xl md:text-9xl font-black leading-none tracking-tight"
                  style={{ color: "#111" }}
                >
                  {curr.int}
                </span>
                <span
                  className="text-4xl md:text-6xl font-black"
                  style={{ color: "#111" }}
                >
                  ,{curr.dec}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
