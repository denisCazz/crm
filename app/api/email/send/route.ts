import { NextResponse } from 'next/server';
import { sendEmail } from '../../../../lib/emailSender';
import { requireAuth } from '../../../../lib/authHelpers';
import { dbQuery } from '../../../../lib/mysql';
import { randomUUID } from 'crypto';

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

    const [clientRows, templateRows, settingsRows] = await Promise.all([
      dbQuery<any>(
        `SELECT id, owner_id, first_name, last_name, email, phone, status, first_contacted_at
         FROM clients WHERE id = :id AND owner_id = :owner_id LIMIT 1`,
        { id: clientId, owner_id: userId }
      ),
      dbQuery<any>(
        `SELECT id, owner_id, subject, body_html, body_text
         FROM email_templates WHERE id = :id AND owner_id = :owner_id LIMIT 1`,
        { id: templateId, owner_id: userId }
      ),
      dbQuery<any>(
        `SELECT * FROM app_settings WHERE owner_id = :owner_id LIMIT 1`,
        { owner_id: userId }
      ),
    ]);

    const client = clientRows[0] as {
      id: string;
      owner_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      status?: string | null;
      first_contacted_at?: string | null;
    };

    const template = templateRows[0] as {
      id: string;
      owner_id: string;
      subject: string;
      body_html: string;
      body_text: string | null;
    };

    if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 400 });
    if (!template) return NextResponse.json({ error: 'Template non trovato' }, { status: 400 });

    const settings = settingsRows[0] ?? null;

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
    sendId = randomUUID();
    await dbQuery(
      `INSERT INTO email_sends (id, owner_id, client_id, template_id, to_email, subject, status)
       VALUES (:id, :owner_id, :client_id, :template_id, :to_email, :subject, :status)`,
      {
        id: sendId,
        owner_id: userId,
        client_id: client.id,
        template_id: template.id,
        to_email: client.email,
        subject,
        status: 'queued',
      }
    );

    // Invia email usando il nuovo sistema Brevo centralizzato
    await sendEmail({
      to: client.email,
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

    // Se è il primo contatto, aggiorna stato cliente.
    if (!client.first_contacted_at) {
      await dbQuery(
        `UPDATE clients SET status = 'contacted', first_contacted_at = NOW(3) WHERE id = :id AND owner_id = :owner_id`,
        { id: client.id, owner_id: userId }
      );
    }

    return NextResponse.json({ ok: true, send_id: sendId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    if (sendId) {
      try {
        await dbQuery(`UPDATE email_sends SET status = 'failed', error = :error WHERE id = :id`, { id: sendId, error: message });
      } catch {
        // ignore
      }
    }

    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
