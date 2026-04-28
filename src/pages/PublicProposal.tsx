import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProposalData } from "@/types/proposal";
import { ProposalPreview } from "@/components/proposals/ProposalPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileDown, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PublicProposal = () => {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        if (!id) return;
        
        const { data, error } = await (supabase
          .from("proposals" as any)
          .select("*")
          .eq("id", id)
          .single() as any);

        if (error) throw error;

        // Transform DB data to ProposalData type
        const proposalData: ProposalData = {
          clientName: data.client_name,
          companyName: data.company_name,
          sellerName: data.seller_name || "Equipe Mupa",
          licenseCount: data.license_count,
          unitValue: Number(data.unit_value),
          planType: data.plan_type as any,
          validUntil: data.valid_until,
          discountValue: Number(data.discount_value),
          discountType: data.discount_type as any,
          implementationFee: Number(data.implementation_fee),
          recurrence: data.recurrence as any,
          totalValue: Number(data.total_value),
        };

        setProposal(proposalData);
      } catch (error) {
        console.error("Erro ao carregar proposta:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar",
          description: "Não foi possível encontrar esta proposta comercial.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [id, toast]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copiado!",
      description: "O link da proposta foi copiado para sua área de transferência.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-[80vh] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <h2 className="text-2xl font-bold mb-4">Proposta não encontrada</h2>
        <p className="text-slate-400 mb-8">O link pode estar expirado ou incorreto.</p>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Voltar para Início
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center">
        <img src="/logo-dark.svg" alt="Mupa Logo" className="h-8 opacity-50" />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
          <Button variant="default" size="sm" onClick={() => window.print()}>
            <FileDown className="mr-2 h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>
      
      <ProposalPreview data={proposal} isPublic />
      
      <div className="max-w-4xl mx-auto mt-12 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Mupa Midias. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};

export default PublicProposal;