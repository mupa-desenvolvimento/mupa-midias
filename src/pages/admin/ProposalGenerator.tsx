import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Eye, Save, Calculator, CheckCircle2, Star } from "lucide-react";
import { ProposalData, PlanType, RecurrenceType, DiscountType } from "@/types/proposal";
import { generateProposalPDF } from "@/services/proposalService";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const ProposalGenerator = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("form");

  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<ProposalData>({
    defaultValues: {
      clientName: "",
      companyName: "",
      sellerName: "",
      licenseCount: 1,
      unitValue: 150,
      planType: "Profissional",
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discountValue: 0,
      discountType: "percentage",
      implementationFee: 0,
      recurrence: "monthly",
      totalValue: 150,
    }
  });

  const formData = watch();

  const totals = useMemo(() => {
    const subtotal = formData.licenseCount * formData.unitValue;
    let discount = 0;
    if (formData.discountType === "percentage") {
      discount = subtotal * (formData.discountValue || 0) / 100;
    } else {
      discount = formData.discountValue || 0;
    }
    const total = subtotal - discount + (formData.implementationFee || 0);
    return { subtotal, discount, total };
  }, [formData]);

  useEffect(() => {
    setValue("totalValue", totals.total);
  }, [totals.total, setValue]);

  const onExportPDF = async () => {
    try {
      setIsGenerating(true);
      await generateProposalPDF(formData);
      toast({
        title: "Sucesso!",
        description: "Proposta gerada e exportada com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar a proposta. Tente novamente.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gerador de Propostas Comerciais</h1>
          <p className="text-muted-foreground">Crie apresentações profissionais e orçamentos em segundos.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setActiveTab(activeTab === "form" ? "preview" : "form")}>
            {activeTab === "form" ? <><Eye className="mr-2 h-4 w-4" /> Visualizar</> : <><Calculator className="mr-2 h-4 w-4" /> Editar</>}
          </Button>
          <Button onClick={onExportPDF} disabled={isGenerating}>
            <FileDown className="mr-2 h-4 w-4" /> {isGenerating ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulário */}
        <div className={`lg:col-span-5 space-y-6 ${activeTab === 'preview' ? 'hidden lg:block' : ''}`}>
          <Card className="bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input {...register("clientName", { required: true })} placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input {...register("companyName", { required: true })} placeholder="Ex: Mercado Central" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Configuração do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select onValueChange={(v) => setValue("planType", v as PlanType)} defaultValue={formData.planType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Básico">Básico</SelectItem>
                      <SelectItem value="Profissional">Profissional</SelectItem>
                      <SelectItem value="Avançado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Licenças</Label>
                  <Input type="number" {...register("licenseCount", { min: 1 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Unitário (R$)</Label>
                  <Input type="number" {...register("unitValue")} />
                </div>
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <Select onValueChange={(v) => setValue("recurrence", v as RecurrenceType)} defaultValue={formData.recurrence}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Subtotal:</span>
                  <span className="font-mono">R$ {totals.subtotal.toFixed(2)}</span>
                </div>
                {formData.discountValue > 0 && (
                  <div className="flex justify-between mb-2 text-green-400">
                    <span className="text-sm">Desconto:</span>
                    <span className="font-mono">- R$ {totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-lg text-primary">
                  <span>Total Final:</span>
                  <span className="font-mono">R$ {totals.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className={`lg:col-span-7 ${activeTab === 'form' ? 'hidden lg:block' : ''}`}>
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden aspect-[1/1.414] w-full origin-top">
            {/* Proposal Slide 1: Cover */}
            <div className="h-full flex flex-col p-12 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-3xl rounded-full -mr-20 -mt-20"></div>
              
              <div className="mb-auto">
                <img src="/logo.png" alt="Mupa Logo" className="h-12 brightness-0 invert" onError={(e) => e.currentTarget.style.display='none'} />
                <span className="text-3xl font-bold tracking-tight">MUPA</span>
              </div>

              <div className="space-y-6 mb-12">
                <Badge className="bg-primary/20 text-primary border-primary/30 mb-4 px-4 py-1">Proposta Comercial</Badge>
                <h2 className="text-6xl font-extrabold leading-tight">
                  Transformando a <span className="text-primary">Experiência</span> Visual da {formData.companyName || "Sua Empresa"}
                </h2>
                <p className="text-xl text-slate-300 max-w-xl">
                  A solução completa de Digital Signage para encantar seus clientes e escalar suas vendas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8 mt-auto">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Preparado para</p>
                  <p className="font-semibold text-lg">{formData.clientName || "Nome do Cliente"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Consultor Mupa</p>
                  <p className="font-semibold text-lg">{formData.sellerName || "Equipe Mupa"}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-center gap-2">
             <div className="w-2 h-2 rounded-full bg-primary"></div>
             <div className="w-2 h-2 rounded-full bg-slate-700"></div>
             <div className="w-2 h-2 rounded-full bg-slate-700"></div>
             <div className="w-2 h-2 rounded-full bg-slate-700"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalGenerator;
