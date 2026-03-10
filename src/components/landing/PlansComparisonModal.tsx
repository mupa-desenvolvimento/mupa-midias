import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlansComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: 'lite' | 'flow' | 'insight' | 'impact') => void;
}

export function PlansComparisonModal({ isOpen, onClose, onSelectPlan }: PlansComparisonModalProps) {
  const features = [
    { name: "Suporte Técnico Remoto Imediato", lite: true, flow: true, insight: true, impact: true },
    { name: "Operação 100% Offline", lite: true, flow: true, insight: true, impact: true },
    { name: "Consulta de Preço/Produto", lite: true, flow: false, insight: true, impact: true },
    { name: "Gestão Centralizada (Cloud)", lite: false, flow: true, insight: true, impact: true },
    { name: "Playlists e Agendamentos", lite: false, flow: true, insight: true, impact: true },
    { name: "Monitoramento Online/Offline", lite: false, flow: true, insight: true, impact: true },
    { name: "Analytics de Consulta", lite: false, flow: false, insight: true, impact: true },
    { name: "Audience Analytics (Câmera)", lite: false, flow: false, insight: true, impact: true },
    { name: "Mapa de Calor de Atenção", lite: false, flow: false, insight: true, impact: true },
    { name: "Segmentação Dinâmica (IA)", lite: false, flow: false, insight: false, impact: true },
    { name: "Recomendação Automática", lite: false, flow: false, insight: false, impact: true },
    { name: "Monetização de Telas", lite: false, flow: false, insight: false, impact: true },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-bold text-center">Comparativo de Planos</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Compare os recursos e escolha a solução ideal para sua operação.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-[200px] text-muted-foreground">Recurso</TableHead>
                  <TableHead className="text-center text-muted-foreground font-bold text-sm sm:text-lg">MUPA LITE</TableHead>
                  <TableHead className="text-center text-secondary font-bold text-sm sm:text-lg">MUPA FLOW</TableHead>
                  <TableHead className="text-center text-primary-foreground font-bold text-sm sm:text-lg">MUPA INSIGHT</TableHead>
                  <TableHead className="text-center text-accent font-bold text-sm sm:text-lg">MUPA IMPACT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature, idx) => (
                  <TableRow key={idx} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground/80 text-sm sm:text-base">{feature.name}</TableCell>
                    <TableCell className="text-center">
                      {feature.lite ? <Check className="mx-auto w-5 h-5 text-muted-foreground" /> : <Minus className="mx-auto w-5 h-5 text-muted" />}
                    </TableCell>
                  <TableCell className="text-center">
                    {feature.flow ? <Check className="mx-auto w-5 h-5 text-secondary" /> : <Minus className="mx-auto w-5 h-5 text-muted" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {feature.insight ? <Check className="mx-auto w-5 h-5 text-primary-foreground" /> : <Minus className="mx-auto w-5 h-5 text-muted" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {feature.impact ? <Check className="mx-auto w-5 h-5 text-accent" /> : <Minus className="mx-auto w-5 h-5 text-muted" />}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableCell></TableCell>
                <TableCell className="p-4">
                  <Button onClick={() => onSelectPlan('lite')} className="w-full bg-muted hover:bg-muted/80 text-foreground">Selecionar</Button>
                </TableCell>
                <TableCell className="p-4">
                  <Button onClick={() => onSelectPlan('flow')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Selecionar</Button>
                </TableCell>
                <TableCell className="p-4">
                  <Button onClick={() => onSelectPlan('insight')} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">Selecionar</Button>
                </TableCell>
                <TableCell className="p-4">
                  <Button onClick={() => onSelectPlan('impact')} className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground">Selecionar</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
