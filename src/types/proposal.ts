export type PlanType = 'Básico' | 'Profissional' | 'Avançado';
export type RecurrenceType = 'monthly' | 'yearly';
export type DiscountType = 'percentage' | 'fixed';

export interface ProposalData {
  clientName: string;
  companyName: string;
  sellerName: string;
  licenseCount: number;
  unitValue: number;
  planType: PlanType;
  validUntil: string;
  observations?: string;
  clientLogoUrl?: string;
  customColors?: {
    primary: string;
    secondary: string;
  };
  discountValue?: number;
  discountType?: DiscountType;
  implementationFee?: number;
  recurrence?: RecurrenceType;
  totalValue: number;
}
