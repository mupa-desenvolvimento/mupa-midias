import { useState, useCallback } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Check, QrCode, Wand2 } from "lucide-react";
import { CampaignTypeSelector } from "./CampaignTypeSelector";
import { CampaignConfigForm } from "./CampaignConfigForm";
import { CAMPAIGN_TYPE_INFO, type CampaignType, type QRCodeCampaign } from "@/hooks/useQRCodeCampaigns";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (campaign: Partial<QRCodeCampaign>) => void;
  saving?: boolean;
}

export function CampaignWizard({ open, onClose, onSave, saving }: Props) {
  const [step, setStep] = useState(0);
  const [campaignType, setCampaignType] = useState<CampaignType | null>(null);
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setCampaignType(null);
    setTitle("");
    setConfig({});
    setQrDataUrl(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const generateQR = useCallback(async () => {
    const baseUrl = window.location.origin;
    // Dynamic QR URL: points to our own endpoint that we can redirect later
    const qrUrl = `${baseUrl}/c/${Date.now().toString(36)}`;
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(dataUrl);
      return { qrUrl, dataUrl };
    } catch {
      return null;
    }
  }, []);

  const handleNext = async () => {
    if (step === 0 && campaignType) {
      setStep(1);
    } else if (step === 1 && title.trim()) {
      const result = await generateQR();
      if (result) setStep(2);
    }
  };

  const handleSave = () => {
    if (!campaignType || !title.trim()) return;
    const baseUrl = window.location.origin;
    const shortCode = Date.now().toString(36);
    onSave({
      title: title.trim(),
      campaign_type: campaignType,
      config,
      qr_url: `${baseUrl}/c/${shortCode}`,
      image_url: qrDataUrl,
      is_active: true,
    });
    reset();
  };

  const typeInfo = campaignType ? CAMPAIGN_TYPE_INFO[campaignType] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Nova Campanha QR Code
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {["Tipo", "Configurar", "QR Code"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 0: Type selection */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Escolha o tipo de campanha que deseja criar:</p>
            <CampaignTypeSelector selected={campaignType} onSelect={setCampaignType} />
          </div>
        )}

        {/* Step 1: Configuration */}
        {step === 1 && campaignType && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-2xl">{typeInfo?.icon}</span>
              <div>
                <p className="font-semibold text-sm">{typeInfo?.label}</p>
                <p className="text-xs text-muted-foreground">{typeInfo?.description}</p>
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold">Nome da Campanha *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Promoção Fim de Semana"
                className="mt-1"
              />
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-sm mb-3">Configurações da campanha</h3>
              <CampaignConfigForm campaignType={campaignType} config={config} onChange={setConfig} />
            </div>
          </div>
        )}

        {/* Step 2: QR Preview & Save */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-white rounded-2xl shadow-lg">
                {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />}
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground">{typeInfo?.label}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
              <p className="text-sm font-medium">✅ QR Code gerado com sucesso</p>
              <p className="text-xs text-muted-foreground">
                O QR Code aponta para um link dinâmico controlado pela Mupa. Você pode alterar o destino a qualquer momento sem precisar reimprimir.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <Wand2 className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Dica:</strong> Após salvar, abra o Editor Gráfico para criar uma arte profissional com este QR Code embutido.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={step === 0 ? handleClose : () => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {step < 2 ? (
            <Button
              onClick={handleNext}
              disabled={(step === 0 && !campaignType) || (step === 1 && !title.trim())}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              <Check className="h-4 w-4 mr-1" />
              Salvar Campanha
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
