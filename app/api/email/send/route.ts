import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { sendEmail } from '../../../../lib/emailSender';
import { requireAuth } from '../../../../lib/authHelpers';

type SendEmailPayload = {
  client_id: string;
  template_id: string;
};

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? '';
  });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabaseClient();

  let sendId: string | null = null;

  try {
    const user = await requireAuth(req);
    const userId = user.id;
    const userEmail = user.email;

    const body = (await req.json()) as SendEmailPayload;
    const clientId = body.client_id?.trim();
    const templateId = body.template_id?.trim();

    if (!clientId || !templateId) {
      return NextResponse.json({ error: 'client_id and template_id are required' }, { status: 400 });
    }

    const [clientRes, templateRes, settingsRes] = await Promise.all([
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
      supabase
        .from('app_settings')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle(),
    ]);

    if (clientRes.error) {
      return NextResponse.json({ error: clientRes.error.message }, { status: 400 });
    }
    if (templateRes.error) {
      return NextResponse.json({ error: templateRes.error.message }, { status: 400 });
    }

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

    const settings = settingsRes.data;

    if (!client.email) {
      return NextResponse.json({ error: 'Il cliente non ha un indirizzo email.' }, { status: 400 });
    }

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

    // Invia email usando il nuovo sistema Brevo centralizzato
    await sendEmail({
      to: client.email,
      subject,
      html,
      text,
      replyTo: userEmail,
      fromName: settings?.brand_name ? `${settings.brand_name}` : 'Bitora CRM',
    });

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
        const supabase = getServiceSupabaseClient();
        await supabase
          .from('email_sends')
          .update({ status: 'failed', error: message })
          .eq('id', sendId);
      } catch {
        // ignore
      }
    }

    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
