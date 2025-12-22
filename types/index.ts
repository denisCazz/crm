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
  lead_source?: 'manual' | 'newsletter' | 'contact' | string;
  contact_request?: string | null;
  status?: 'new' | 'contacted' | 'converted' | 'archived';
  first_contacted_at?: string | null;
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

export interface AppSettings {
  id: string;
  owner_id: string;
  brand_name: string | null;
  logo_url: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_user: string | null;
  // Mai esporre questa stringa al client: viene gestita solo via API server.
  smtp_password_enc?: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  smtp_reply_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  owner_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailSendStatus = 'queued' | 'sent' | 'failed';

export interface EmailSend {
  id: string;
  owner_id: string;
  client_id: string | null;
  template_id: string | null;
  to_email: string;
  subject: string;
  status: EmailSendStatus;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}