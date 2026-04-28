import React from "react";
import { ProposalData } from "@/types/proposal";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Star } from "lucide-react";

interface ProposalPreviewProps {
  data: ProposalData;
  isPublic?: boolean;
}

export const ProposalPreview = ({ data, isPublic = false }: ProposalPreviewProps) => {
  const totals = {
    subtotal: (data.licenseCount || 0) * (data.unitValue || 0),
    discount: data.discountType === "percentage" 
      ? ((data.licenseCount || 0) * (data.unitValue || 0)) * (data.discountValue || 0) / 100
      : (data.discountValue || 0),
    total: data.totalValue || 0
  };

  return (
    <div className={`bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden w-full origin-top ${isPublic ? 'max-w-4xl mx-auto my-8 min-h-[80vh]' : 'aspect-[1/1.414] sticky top-8'}`}>
      <Tabs defaultValue="cover" className="h-full flex flex-col">
        <TabsList className="bg-slate-100 p-1 mx-4 mt-4 justify-start overflow-x-auto">
          <TabsTrigger value="cover">Capa</TabsTrigger>
          <TabsTrigger value="about">Sobre</TabsTrigger>
          <TabsTrigger value="solution">Solução</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="commercial">Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="cover" className="flex-1 mt-0">
          <div className="h-full min-h-[600px] flex flex-col p-12 relative overflow-hidden bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#1e1b4b] text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
            <div className="mb-auto">
              <img src="/logo-dark.svg" alt="Mupa Logo" className="h-10" />
            </div>
            <div className="space-y-6 mb-12">
              <Badge className="bg-white/20 text-white border-white/30 mb-4 px-4 py-1 hover:bg-white/20">Proposta Comercial</Badge>
              <h2 className="text-5xl font-extrabold leading-tight">
                Transformando a <span className="text-white underline decoration-indigo-400 underline-offset-8">Experiência</span> Visual da {data.companyName || "Sua Empresa"}
              </h2>
              <p className="text-xl text-indigo-100 max-w-xl font-light">
                A solução líder em Digital Signage para encantar seus clientes e escalar resultados.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 border-t border-white/20 pt-8 mt-auto">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 mb-1">Preparado para</p>
                <p className="font-semibold text-lg">{data.clientName || "Nome do Cliente"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-200 mb-1">Consultor Mupa</p>
                <p className="font-semibold text-lg">{data.sellerName || "Equipe Mupa"}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

        <TabsContent value="solution" className="flex-1 mt-0 bg-white p-12 overflow-y-auto">
          <h3 className="text-2xl font-bold text-indigo-900 mb-6">Nossa Solução</h3>
          <p className="text-slate-600 mb-6">
            Oferecemos um ecossistema completo para sua comunicação visual, desde o hardware até a gestão inteligente de dados.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl border border-indigo-50 bg-indigo-50/30">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">1</div>
              <div>
                <h4 className="font-bold text-indigo-900">Implementação Simplificada</h4>
                <p className="text-sm text-slate-600">Configuração rápida em qualquer TV ou Monitor Profissional.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl border border-indigo-50 bg-indigo-50/30">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">2</div>
              <div>
                <h4 className="font-bold text-indigo-900">Monitoramento Real-time</h4>
                <p className="text-sm text-slate-600">Saiba exatamente o que está passando em cada tela em tempo real.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl border border-indigo-50 bg-indigo-50/30">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">3</div>
              <div>
                <h4 className="font-bold text-indigo-900">Métricas de Audiência</h4>
                <p className="text-sm text-slate-600">Entenda quem está vendo seu conteúdo através de IA.</p>
              </div>
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
                  <th className={`p-3 text-center ${data.planType === 'Básico' ? 'bg-indigo-50 font-bold' : ''}`}>Básico</th>
                  <th className={`p-3 text-center ${data.planType === 'Profissional' ? 'bg-indigo-50 font-bold' : ''}`}>Profissional</th>
                  <th className={`p-3 text-center ${data.planType === 'Avançado' ? 'bg-indigo-50 font-bold' : ''}`}>Avançado</th>
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
                <p className="text-xs font-bold text-indigo-900">Plano Recomendado: {data.planType}</p>
                <p className="text-[10px] text-indigo-700">Ideal para atender as necessidades da {data.companyName}.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="commercial" className="flex-1 mt-0 bg-slate-50 p-12 flex flex-col">
          <div className="mb-auto">
            <h3 className="text-2xl font-bold text-indigo-900 mb-8">Resumo do Investimento</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-200">
                <span className="text-slate-600">{data.licenseCount}x Licenças Plano {data.planType}</span>
                <span className="font-semibold">R$ {((data.licenseCount || 0) * (data.unitValue || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {data.discountValue > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-slate-200 text-green-600 font-medium">
                  <span>Desconto ({data.discountType === 'percentage' ? `${data.discountValue}%` : 'Fixo'})</span>
                  <span>- R$ {totals.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {data.implementationFee > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-slate-200">
                  <span>Taxa de Implantação (Única)</span>
                  <span>R$ {Number(data.implementationFee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 p-8 bg-indigo-900 text-white rounded-2xl shadow-xl">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-indigo-200 text-sm uppercase tracking-widest mb-1">Investimento {data.recurrence === 'monthly' ? 'Mensal' : 'Anual'}</p>
                <h4 className="text-4xl font-extrabold">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
              </div>
              <div className="text-right">
                <p className="text-indigo-300 text-xs">Válido até</p>
                <p className="font-semibold">{data.validUntil ? new Date(data.validUntil).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
            </div>
          </div>
          
          <p className="mt-6 text-[10px] text-slate-400 text-center">
            Esta proposta está sujeita aos termos de serviço da Mupa. Valores expressos em Reais (BRL).
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
