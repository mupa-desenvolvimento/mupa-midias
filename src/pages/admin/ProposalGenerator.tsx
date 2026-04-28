import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Eye, Save, Calculator, CheckCircle2, Star, Share2 } from "lucide-react";
import { ProposalData, PlanType, RecurrenceType, DiscountType } from "@/types/proposal";
import { generateProposalPDF } from "@/services/proposalService";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ProposalPreview } from "@/components/proposals/ProposalPreview";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const ProposalGenerator = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("form");
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null);

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
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden aspect-[1/1.414] w-full origin-top sticky top-8">
            <Tabs defaultValue="cover" className="h-full flex flex-col">
              <TabsList className="bg-slate-100 p-1 mx-4 mt-4 justify-start overflow-x-auto">
                <TabsTrigger value="cover">Capa</TabsTrigger>
                <TabsTrigger value="about">Sobre</TabsTrigger>
                <TabsTrigger value="solution">Solução</TabsTrigger>
                <TabsTrigger value="plans">Planos</TabsTrigger>
                <TabsTrigger value="commercial">Comercial</TabsTrigger>
              </TabsList>

              <TabsContent value="cover" className="flex-1 mt-0">
                <div className="h-full flex flex-col p-12 relative overflow-hidden bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#1e1b4b] text-white">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
                  <div className="mb-auto">
                    <img src="/logo-dark.svg" alt="Mupa Logo" className="h-10" />
                  </div>
                  <div className="space-y-6 mb-12">
                    <Badge className="bg-white/20 text-white border-white/30 mb-4 px-4 py-1 hover:bg-white/20">Proposta Comercial</Badge>
                    <h2 className="text-5xl font-extrabold leading-tight">
                      Transformando a <span className="text-white underline decoration-indigo-400 underline-offset-8">Experiência</span> Visual da {formData.companyName || "Sua Empresa"}
                    </h2>
                    <p className="text-xl text-indigo-100 max-w-xl font-light">
                      A solução líder em Digital Signage para encantar seus clientes e escalar resultados.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 border-t border-white/20 pt-8 mt-auto">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 mb-1">Preparado para</p>
                      <p className="font-semibold text-lg">{formData.clientName || "Nome do Cliente"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 mb-1">Consultor Mupa</p>
                      <p className="font-semibold text-lg">{formData.sellerName || "Equipe Mupa"}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="about" className="flex-1 mt-0 bg-white p-12 overflow-y-auto">
                <h3 className="text-2xl font-bold text-indigo-900 mb-6">Sobre a Mupa</h3>
                <div className="grid grid-cols-1 gap-6">
                  <p className="text-slate-600 leading-relaxed">
                    A Mupa é uma plataforma de Digital Signage moderna e intuitiva, desenvolvida para simplificar a gestão de conteúdos em telas profissionais de qualquer tamanho.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {[
                      { title: "Gestão Remota", desc: "Controle tudo de onde estiver." },
                      { title: "Conteúdo Dinâmico", desc: "Integrações com redes sociais e APIs." },
                      { title: "Inteligência Artificial", desc: "Reconhecimento facial e métricas." },
                      { title: "Editor Visual", desc: "Integração nativa com Canva." }
                    ].map((item, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <CheckCircle2 className="h-5 w-5 text-indigo-600 mb-2" />
                        <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="plans" className="flex-1 mt-0 bg-white p-8 overflow-y-auto">
                <h3 className="text-xl font-bold text-indigo-900 mb-6 text-center">Tabela Comparativa</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="p-3 text-slate-500 font-medium">Recurso</th>
                        <th className={`p-3 text-center ${formData.planType === 'Básico' ? 'bg-indigo-50 font-bold' : ''}`}>Básico</th>
                        <th className={`p-3 text-center ${formData.planType === 'Profissional' ? 'bg-indigo-50 font-bold' : ''}`}>Profissional</th>
                        <th className={`p-3 text-center ${formData.planType === 'Avançado' ? 'bg-indigo-50 font-bold' : ''}`}>Avançado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { name: "Gestão de Playlists", basic: true, prof: true, adv: true },
                        { name: "Editor Visual", basic: true, prof: true, adv: true },
                        { name: "Tabelas Dinâmicas", basic: false, prof: true, adv: true },
                        { name: "Integrações (Instagram/Canva)", basic: false, prof: true, adv: true },
                        { name: "IA e Reconhecimento Facial", basic: false, prof: false, adv: true },
                        { name: "Relatórios Avançados", basic: false, prof: false, adv: true }
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-700">{row.name}</td>
                          <td className="p-3 text-center">{row.basic ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-slate-300">-</span>}</td>
                          <td className="p-3 text-center">{row.prof ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-slate-300">-</span>}</td>
                          <td className="p-3 text-center">{row.adv ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-slate-300">-</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-indigo-600 fill-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">Plano Recomendado: {formData.planType}</p>
                      <p className="text-[10px] text-indigo-700">Ideal para atender as necessidades da {formData.companyName}.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="commercial" className="flex-1 mt-0 bg-slate-50 p-12 flex flex-col">
                <div className="mb-auto">
                  <h3 className="text-2xl font-bold text-indigo-900 mb-8">Resumo do Investimento</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                      <span className="text-slate-600">{formData.licenseCount}x Licenças Plano {formData.planType}</span>
                      <span className="font-semibold">R$ {(formData.licenseCount * formData.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {formData.discountValue > 0 && (
                      <div className="flex justify-between items-center py-3 border-b border-slate-200 text-green-600 font-medium">
                        <span>Desconto ({formData.discountType === 'percentage' ? `${formData.discountValue}%` : 'Fixo'})</span>
                        <span>- R$ {totals.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {formData.implementationFee > 0 && (
                      <div className="flex justify-between items-center py-3 border-b border-slate-200">
                        <span>Taxa de Implantação (Única)</span>
                        <span>R$ {Number(formData.implementationFee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 p-8 bg-indigo-900 text-white rounded-2xl shadow-xl">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-indigo-200 text-sm uppercase tracking-widest mb-1">Investimento {formData.recurrence === 'monthly' ? 'Mensal' : 'Anual'}</p>
                      <h4 className="text-4xl font-extrabold">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-indigo-300 text-xs">Válido até</p>
                      <p className="font-semibold">{new Date(formData.validUntil).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
                
                <p className="mt-6 text-[10px] text-slate-400 text-center">
                  Esta proposta está sujeita aos termos de serviço da Mupa. Valores expressos em Reais (BRL).
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalGenerator;
