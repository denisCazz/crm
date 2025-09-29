export interface Client {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[] | null;
  lat: number | null;
  lon: number | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
}

export type LicenseStatus = 'active' | 'inactive' | 'trial' | 'expired';

export interface License {
  id: string;
  user_id: string;
  status: LicenseStatus;
  expires_at: string | null;
  plan?: string | null;
  seats?: number | null;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
}