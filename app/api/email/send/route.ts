import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { decryptSecret } from '../../../../lib/crypto';
import { sendEmail } from '../../../../lib/emailSender';

type SendEmailPayload = {
  client_id: string;
  template_id: string;
};

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? '';
  });
}

async function getUserIdFromBearerToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const [kind, token] = authHeader.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) return null;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function POST(req: Request) {
  const supabase = getServiceSupabaseClient();

  let sendId: string | null = null;

  try {
    const userId = await getUserIdFromBearerToken(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SendEmailPayload;
    const clientId = body.client_id?.trim();
    const templateId = body.template_id?.trim();

    if (!clientId || !templateId) {
      return NextResponse.json({ error: 'client_id and template_id are required' }, { status: 400 });
    }

    const [settingsRes, clientRes, templateRes] = await Promise.all([
      supabase
        .from('app_settings')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('id, owner_id, first_name, last_name, email, phone, status, first_contacted_at')
        .eq('id', clientId)
        .eq('owner_id', userId)
        .single(),
      supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .eq('owner_id', userId)
        .single(),
    ]);

    if (settingsRes.error) {
      return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
    }
    if (clientRes.error) {
      return NextResponse.json({ error: clientRes.error.message }, { status: 400 });
    }
    if (templateRes.error) {
      return NextResponse.json({ error: templateRes.error.message }, { status: 400 });
    }

    const settings = settingsRes.data;
    const client = clientRes.data as {
      id: string;
      owner_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      status?: string | null;
      first_contacted_at?: string | null;
    };

    const template = templateRes.data as {
      id: string;
      owner_id: string;
      subject: string;
      body_html: string;
      body_text: string | null;
    };

    if (!client.email) {
      return NextResponse.json({ error: 'Il cliente non ha un indirizzo email.' }, { status: 400 });
    }

    if (!settings?.smtp_host || !settings?.smtp_port || !settings?.smtp_user || !settings?.smtp_password_enc) {
      return NextResponse.json({ error: 'SMTP non configurato in Impostazioni.' }, { status: 400 });
    }

    const smtpPassword = decryptSecret(String(settings.smtp_password_enc));

    const vars: Record<string, string> = {
      first_name: client.first_name ?? '',
      last_name: client.last_name ?? '',
      full_name: [client.first_name ?? '', client.last_name ?? ''].join(' ').trim(),
      email: client.email ?? '',
      phone: client.phone ?? '',
    };

    const subject = renderTemplate(template.subject, vars);
    const html = renderTemplate(template.body_html, vars);
    const text = template.body_text ? renderTemplate(template.body_text, vars) : undefined;

    const fromEmail = settings.smtp_from_email ?? settings.smtp_user;
    const fromName = settings.smtp_from_name ?? settings.brand_name ?? undefined;
    const from = fromName ? `${fromName} <${fromEmail}>` : String(fromEmail);

    // Log send row
    const { data: sendRow, error: sendInsertError } = await supabase
      .from('email_sends')
      .insert({
        owner_id: userId,
        client_id: client.id,
        template_id: template.id,
        to_email: client.email,
        subject,
        status: 'queued',
      })
      .select('id')
      .single();

    if (sendInsertError) {
      return NextResponse.json({ error: sendInsertError.message }, { status: 500 });
    }

    sendId = sendRow.id as string;

    // Invia email usando il nuovo helper (supporta Resend API + SMTP)
    await sendEmail(
      {
        host: String(settings.smtp_host),
        port: Number(settings.smtp_port),
        secure: Boolean(settings.smtp_secure),
        user: String(settings.smtp_user),
        password: smtpPassword,
      },
      {
        from,
        to: client.email,
        subject,
        html,
        text,
        replyTo: settings.smtp_reply_to ?? undefined,
      }
    );

    await supabase
      .from('email_sends')
      .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
      .eq('id', sendId)
      .eq('owner_id', userId);

    // Se è il primo contatto, aggiorna stato cliente.
    if (!client.first_contacted_at) {
      await supabase
        .from('clients')
        .update({ status: 'contacted', first_contacted_at: new Date().toISOString() })
        .eq('id', client.id)
        .eq('owner_id', userId);
    }

    return NextResponse.json({ ok: true, send_id: sendId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    if (sendId) {
      try {
        await supabase
          .from('email_sends')
          .update({ status: 'failed', error: message })
          .eq('id', sendId);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
