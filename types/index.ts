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