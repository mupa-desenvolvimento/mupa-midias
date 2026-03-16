import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, MoreVertical, Trash2, Eye, EyeOff, ExternalLink, QrCode, Loader2 } from "lucide-react";
import { useQRCodeCampaigns, CAMPAIGN_TYPE_INFO, type QRCodeCampaign } from "@/hooks/useQRCodeCampaigns";
import { CampaignWizard } from "@/components/qrcode-campaigns/CampaignWizard";
import { CampaignDashboard } from "@/components/qrcode-campaigns/CampaignDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function QRCodeCampaigns() {
  const { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign } = useQRCodeCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleSave = (data: Partial<QRCodeCampaign>) => {
    createCampaign.mutate(data, { onSuccess: () => setWizardOpen(false) });
  };

  const toggleActive = (c: QRCodeCampaign) => {
    updateCampaign.mutate({ id: c.id, is_active: !c.is_active });
  };

  return (
    <PageShell
      header={<div><h1 className="text-2xl font-bold">QR Code Campanhas</h1><p className="text-sm text-muted-foreground">Crie e gerencie campanhas com QR Code para TVs e terminais</p></div>}
    >
      <div className="overflow-y-auto h-full space-y-6 pr-1">
      {!isLoading && campaigns.length > 0 && <CampaignDashboard campaigns={campaigns} />}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Campanhas</h2>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Nenhuma campanha criada</h3>
              <p className="text-sm text-muted-foreground mt-1">Crie sua primeira campanha QR Code para engajar seus clientes</p>
            </div>
            <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const info = CAMPAIGN_TYPE_INFO[campaign.campaign_type];
            return (
              <Card key={campaign.id} className="group overflow-hidden hover:shadow-lg transition-shadow border-border">
                {/* QR Preview */}
                <div className="relative h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  {campaign.image_url ? (
                    <img src={campaign.image_url} alt="QR" className="h-32 w-32 object-contain" />
                  ) : (
                    <QrCode className="h-16 w-16 text-muted-foreground/30" />
                  )}
                  <Badge
                    variant={campaign.is_active ? "default" : "secondary"}
                    className="absolute top-2 left-2"
                  >
                    {campaign.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{campaign.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-sm">{info?.icon}</span>
                        <span className="text-xs text-muted-foreground">{info?.label}</span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleActive(campaign)}>
                          {campaign.is_active ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                          {campaign.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        {campaign.qr_url && (
                          <DropdownMenuItem onClick={() => window.open(campaign.qr_url!, "_blank")}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir Link
                          </DropdownMenuItem>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCampaign.mutate(campaign.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{campaign.scans_count} scans</span>
                    <span>{new Date(campaign.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Wizard */}
      <CampaignWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={handleSave}
        saving={createCampaign.isPending}
      />
    </PageShell>
  );
}
