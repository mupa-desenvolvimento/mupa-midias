import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Heart, User, Gift, QrCode, Search } from "lucide-react";
// @ts-ignore - JSX component type mismatch
import QRCode from "react-qr-code";
import { ActiveFace } from "@/hooks/useFaceDetection";

interface LoyaltyOverlayProps {
  visible: boolean;
  activeFaces: ActiveFace[];
  onClose: () => void;
  isPortrait?: boolean;
}

interface LoyaltyOffer {
  id: string;
  name: string;
  discount: string;
  imageUrl?: string;
  ean: string;
}

// Mock offers for demo
const mockOffers: LoyaltyOffer[] = [
  { id: "1", name: "Café Premium 500g", discount: "20% OFF", ean: "7891000100103" },
  { id: "2", name: "Leite Integral 1L", discount: "R$ 2,99", ean: "7891000200104" },
  { id: "3", name: "Pão de Forma", discount: "Leve 2 Pague 1", ean: "7891000300105" },
  { id: "4", name: "Queijo Mussarela", discount: "15% OFF", ean: "7891000400106" },
  { id: "5", name: "Chocolate Ao Leite", discount: "R$ 4,49", ean: "7891000500107" },
  { id: "6", name: "Suco Natural 1L", discount: "30% OFF", ean: "7891000600108" },
];

export const LoyaltyOverlay = ({
  visible,
  activeFaces,
  onClose,
  isPortrait = false,
}: LoyaltyOverlayProps) => {
  const [cpfInput, setCpfInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<ActiveFace | null>(null);
  const [showQR, setShowQR] = useState(false);

  if (!visible) return null;

  const recognizedFace = activeFaces.find(f => f.isRegistered);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          Programa de Fidelidade
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto p-6",
          isPortrait ? "pb-10" : ""
        )}
      >
        {/* Recognized face banner */}
        {recognizedFace && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/30 flex items-center justify-center">
              <User className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-green-400 text-sm">Cliente Reconhecido</p>
              <p className="text-white font-semibold text-lg">{recognizedFace.name}</p>
              {recognizedFace.cpf && (
                <p className="text-white/50 text-xs">CPF: {formatCPF(recognizedFace.cpf)}</p>
              )}
            </div>
            <button
              onClick={() => setShowQR(true)}
              className="ml-auto p-3 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400 transition-colors"
            >
              <QrCode className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* CPF input */}
        {!recognizedFace && (
          <div className="mb-6">
            <label className="text-white/60 text-sm mb-2 block">Identificar por CPF</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cpfInput}
                onChange={e => setCpfInput(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 text-lg font-mono"
              />
              <button className="p-3 bg-primary hover:bg-primary/80 rounded-xl text-white">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Personalized offers */}
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-yellow-400" />
          Ofertas Personalizadas
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mockOffers.map(offer => (
            <div
              key={offer.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="w-full h-24 bg-white/5 rounded-lg mb-3 flex items-center justify-center">
                <Gift className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white text-sm font-medium truncate">{offer.name}</p>
              <p className="text-green-400 text-lg font-bold mt-1">{offer.discount}</p>
              <p className="text-white/30 text-xs mt-1">EAN: {offer.ean}</p>
            </div>
          ))}
        </div>

        {/* QR Code modal */}
        {showQR && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setShowQR(false)}>
            <div className="bg-white rounded-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
              <QRCode
                value={`loyalty://${recognizedFace?.cpf || cpfInput}`}
                size={200}
              />
              <p className="text-gray-800 font-medium mt-4">Escaneie para resgatar</p>
              <p className="text-gray-500 text-sm mt-1">
                {recognizedFace?.name || "Cliente"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
