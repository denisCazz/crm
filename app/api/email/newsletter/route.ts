import { NextResponse } from 'next/server';
import { sendEmail } from '../../../../lib/emailSender';
import { requireAuth } from '../../../../lib/authHelpers';
import { dbQuery } from '../../../../lib/mysql';
import { randomUUID } from 'crypto';

type NewsletterPayload = {
  template_id: string;
};

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? '';
  });
}

export async function POST(req: Request) {
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
    const [templateRows, clientRows, settingsRows] = await Promise.all([
      dbQuery<any>(
        `SELECT id, owner_id, subject, body_html, body_text FROM email_templates
         WHERE id = :id AND owner_id = :owner_id LIMIT 1`,
        { id: templateId, owner_id: userId }
      ),
      dbQuery<any>(
        `SELECT id, first_name, last_name, email FROM clients
         WHERE owner_id = :owner_id AND email IS NOT NULL AND email <> ''`,
        { owner_id: userId }
      ),
      dbQuery<any>(`SELECT * FROM app_settings WHERE owner_id = :owner_id LIMIT 1`, { owner_id: userId }),
    ]);

    const template = templateRows[0] as {
      id: string;
      owner_id: string;
      subject: string;
      body_html: string;
      body_text: string | null;
    };

    if (!template) return NextResponse.json({ error: 'Template non trovato' }, { status: 400 });

    const clients = (clientRows ?? []).filter(
      (c: { email?: string | null }) => c.email && c.email.trim().length > 0
    );

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Nessun cliente con email trovato.' }, { status: 400 });
    }

    const settings = settingsRows[0] ?? null;

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
    const sendId = randomUUID();
    await dbQuery(
      `INSERT INTO email_sends (id, owner_id, client_id, template_id, to_email, subject, status)
       VALUES (:id, :owner_id, NULL, :template_id, :to_email, :subject, 'queued')`,
      {
        id: sendId,
        owner_id: userId,
        template_id: template.id,
        to_email: `Newsletter (${bccEmails.length} destinatari)`,
        subject,
      }
    );

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

      await dbQuery(
        `UPDATE email_sends SET status = 'sent', sent_at = NOW(3), error = NULL WHERE id = :id AND owner_id = :owner_id`,
        { id: sendId, owner_id: userId }
      );

      return NextResponse.json({ 
        ok: true, 
        send_id: sendId,
        recipients_count: bccEmails.length,
        message: `Newsletter inviata a ${bccEmails.length} destinatari`
      });
    } catch (sendError: unknown) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      
      await dbQuery(
        `UPDATE email_sends SET status = 'failed', error = :error WHERE id = :id AND owner_id = :owner_id`,
        { id: sendId, owner_id: userId, error: errorMessage }
      );

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
