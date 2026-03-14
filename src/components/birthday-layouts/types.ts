export interface BirthdayPerson {
  id: string;
  tenant_id: string;
  name: string;
  birth_date: string;
  department?: string | null;
  role?: string | null;
  email?: string | null;
  photo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BirthdayPeriod = "day" | "week" | "month";
export type BirthdayLayoutType = "cards" | "list" | "grid" | "banner" | "celebration";

export interface BirthdayLayoutProps {
  people: BirthdayPerson[];
  period: BirthdayPeriod;
  className?: string;
}
