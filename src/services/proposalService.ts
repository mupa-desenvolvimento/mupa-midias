import { supabase } from "@/integrations/supabase/client";
import { ProposalData } from "../types/proposal";

export async function generateProposalPDF(proposalData: ProposalData) {
  const { data, error } = await supabase.functions.invoke("generate-proposal-pdf", {
    body: proposalData,
  });

  if (error) throw error;
  
  // The function should return a blob or a URL to the PDF
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `Proposta_Mupa_${proposalData.clientName.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
