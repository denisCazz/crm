import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { decryptSecret } from '../../../../lib/crypto';
import { sendEmail } from '../../../../lib/emailSender';

type NewsletterPayload = {
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

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: missing Authorization header (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid Authorization scheme (expected: Bearer <token>)' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const userId = await getUserIdFromBearerToken(authHeader);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired token' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const body = (await req.json()) as NewsletterPayload;
    const templateId = body.template_id?.trim();

    if (!templateId) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    // Fetch settings, template, and all clients with email
    const [settingsRes, templateRes, clientsRes] = await Promise.all([
      supabase
        .from('app_settings')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle(),
      supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .eq('owner_id', userId)
        .single(),
      supabase
        .from('clients')
        .select('id, first_name, last_name, email')
        .eq('owner_id', userId)
        .not('email', 'is', null),
    ]);

    if (settingsRes.error) {
      return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
    }
    if (templateRes.error) {
      return NextResponse.json({ error: templateRes.error.message }, { status: 400 });
    }
    if (clientsRes.error) {
      return NextResponse.json({ error: clientsRes.error.message }, { status: 500 });
    }

    const settings = settingsRes.data;
    const template = templateRes.data as {
      id: string;
      owner_id: string;
      subject: string;
      body_html: string;
      body_text: string | null;
    };

    const clients = (clientsRes.data ?? []).filter(
      (c: { email?: string | null }) => c.email && c.email.trim().length > 0
    );

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Nessun cliente con email trovato.' }, { status: 400 });
    }

    if (!settings?.smtp_host || !settings?.smtp_port || !settings?.smtp_user || !settings?.smtp_password_enc) {
      return NextResponse.json({ error: 'SMTP non configurato. Vai su Impostazioni per configurarlo.' }, { status: 400 });
    }

    const smtpPassword = decryptSecret(String(settings.smtp_password_enc));

    // For newsletter, we use generic vars (no personalization in BCC mode)
    const vars: Record<string, string> = {
      first_name: '',
      last_name: '',
      full_name: '',
      email: '',
      phone: '',
    };

    const subject = renderTemplate(template.subject, vars);
    const html = renderTemplate(template.body_html, vars);
    const text = template.body_text ? renderTemplate(template.body_text, vars) : undefined;

    const fromEmail = settings.smtp_from_email ?? settings.smtp_user;
    const fromName = settings.smtp_from_name ?? settings.brand_name ?? undefined;
    const from = fromName ? `${fromName} <${fromEmail}>` : String(fromEmail);

    // Extract all emails for BCC
    const bccEmails = clients.map((c: { email: string }) => c.email);

    // Log the newsletter send
    const { data: sendRow, error: sendInsertError } = await supabase
      .from('email_sends')
      .insert({
        owner_id: userId,
        client_id: null, // Newsletter = no specific client
        template_id: template.id,
        to_email: `Newsletter (${bccEmails.length} destinatari)`,
        subject,
        status: 'queued',
      })
      .select('id')
      .single();

    if (sendInsertError) {
      return NextResponse.json({ error: sendInsertError.message }, { status: 500 });
    }

    const sendId = sendRow?.id as string;

    try {
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
          to: fromEmail, // Send to self
          bcc: bccEmails, // All clients in BCC
          subject,
          html,
          text,
          replyTo: settings.smtp_reply_to ?? undefined,
        }
      );

      await supabase
        .from('email_sends')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString(), 
          error: null 
        })
        .eq('id', sendId)
        .eq('owner_id', userId);

      return NextResponse.json({ 
        ok: true, 
        send_id: sendId,
        recipients_count: bccEmails.length,
        message: `Newsletter inviata a ${bccEmails.length} destinatari`
      });
    } catch (sendError: unknown) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      
      await supabase
        .from('email_sends')
        .update({ 
          status: 'failed', 
          error: errorMessage 
        })
        .eq('id', sendId)
        .eq('owner_id', userId);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
