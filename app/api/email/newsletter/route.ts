import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '../../../../lib/supabaseServer';
import { sendEmail } from '../../../../lib/emailSender';
import { requireAuth } from '../../../../lib/authHelpers';

type NewsletterPayload = {
  template_id: string;
};

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? '';
  });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabaseClient();

  try {
    const user = await requireAuth(req);
    const userId = user.id;
    const userEmail = user.email;

    const body = (await req.json()) as NewsletterPayload;
    const templateId = body.template_id?.trim();

    if (!templateId) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    // Fetch template and clients with email
    const [templateRes, clientsRes, settingsRes] = await Promise.all([
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
      supabase
        .from('app_settings')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle(),
    ]);

    if (templateRes.error) {
      return NextResponse.json({ error: templateRes.error.message }, { status: 400 });
    }
    if (clientsRes.error) {
      return NextResponse.json({ error: clientsRes.error.message }, { status: 500 });
    }

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

    const settings = settingsRes.data;

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
      // Invia email usando il nuovo sistema Brevo centralizzato
      await sendEmail({
        to: process.env.BREVO_SMTP_FROM_EMAIL || 'noreply@bitora-crm.com',
        bcc: bccEmails,
        subject,
        html,
        text,
        replyTo: userEmail,
        fromName: settings?.brand_name ? `${settings.brand_name}` : 'Bitora CRM',
      });

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
