// Types for baby tracker database entries

export type BabyLogKind = 'feeding' | 'diaper' | 'sleep';

export type FeedingType = 'breast' | 'formula' | 'breast_pumped';

export type DiaperType = 'wet' | 'dirty' | 'both';

export interface BabyLogEntry {
  id: string;
  user_id: string;
  kind: BabyLogKind;
  logged_at: string;
  
  // Feeding fields
  feeding_type?: FeedingType | null;
  feeding_duration_minutes?: number | null;
  feeding_amount_ml?: number | null;
  feeding_amount_unit?: 'ml' | 'oz' | null;
  
  // Diaper fields
  diaper_type?: DiaperType | null;
  
  // Sleep fields
  sleep_start?: string | null;
  sleep_end?: string | null;
  
  created_at?: string;
  updated_at?: string;
}
