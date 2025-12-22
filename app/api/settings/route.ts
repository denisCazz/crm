import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../lib/supabaseServer';
import { encryptSecret } from '../../../lib/crypto';

type SettingsUpdatePayload = {
  brand_name?: string | null;
  logo_url?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name?: string | null;
  smtp_reply_to?: string | null;
};

async function getUserIdFromBearerToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const [kind, token] = authHeader.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) return null;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromBearerToken(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('id, owner_id, brand_name, logo_url, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_email, smtp_from_name, smtp_reply_to, created_at, updated_at')
      .eq('owner_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Non restituiamo mai la password (neanche cifrata).
    return NextResponse.json({ settings: data ?? null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromBearerToken(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SettingsUpdatePayload;

    const update: Record<string, unknown> = {
      owner_id: userId,
      brand_name: body.brand_name ?? null,
      logo_url: body.logo_url ?? null,
      smtp_host: body.smtp_host ?? null,
      smtp_port: typeof body.smtp_port === 'number' ? body.smtp_port : null,
      smtp_secure: typeof body.smtp_secure === 'boolean' ? body.smtp_secure : null,
      smtp_user: body.smtp_user ?? null,
      smtp_from_email: body.smtp_from_email ?? null,
      smtp_from_name: body.smtp_from_name ?? null,
      smtp_reply_to: body.smtp_reply_to ?? null,
    };

    if (typeof body.smtp_password === 'string') {
      const trimmed = body.smtp_password.trim();
      // Se vuota => non aggiornare.
      if (trimmed.length > 0) {
        update.smtp_password_enc = encryptSecret(trimmed);
      }
    }

    const supabase = getServiceSupabaseClient();

    // Upsert per owner (unique)
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(update, { onConflict: 'owner_id' })
      .select('id, owner_id, brand_name, logo_url, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_email, smtp_from_name, smtp_reply_to, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
