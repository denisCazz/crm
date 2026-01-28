export interface EmailOptions {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * Configurazione Brevo API di sistema
 * Legge da variabili ambiente
 */
function getBrevoConfig() {
  return {
    apiKey: process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASSWORD || '',
    fromEmail: process.env.BREVO_SMTP_FROM_EMAIL || 'noreply@bitora-crm.com',
  };
}

/**
 * Valida che le credenziali Brevo siano configurate
 */
function validateBrevoConfig() {
  const config = getBrevoConfig();
  if (!config.apiKey) {
    throw new Error(
      'Credenziali Brevo non configurate. Imposta BREVO_API_KEY in .env'
    );
  }
  return config;
}

/**
 * Invia email usando Brevo API HTTP (più affidabile di SMTP)
 */
async function sendWithBrevoAPI(options: EmailOptions): Promise<void> {
  const config = validateBrevoConfig();
  
  const fromEmail = options.fromEmail || config.fromEmail;
  const fromName = options.fromName || 'Bitora CRM';

  // Prepara destinatari
  const toArray = Array.isArray(options.to) ? options.to : [options.to];
  const toRecipients = toArray.map(email => ({ email }));
  
  // BCC recipients
  const bccRecipients = options.bcc 
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map(email => ({ email }))
    : undefined;

  // Assicurati che html non sia vuoto (Brevo richiede htmlContent)
  const htmlContent = options.html && options.html.trim().length > 0 
    ? options.html 
    : options.text || '<p>Messaggio vuoto</p>';

  const payload: Record<string, unknown> = {
    sender: { name: fromName, email: fromEmail },
    to: toRecipients,
    subject: options.subject || '(Nessun oggetto)',
    htmlContent: htmlContent,
  };

  if (options.text) {
    payload.textContent = options.text;
  }

  if (bccRecipients && bccRecipients.length > 0) {
    payload.bcc = bccRecipients;
  }

  if (options.replyTo) {
    payload.replyTo = { email: options.replyTo };
  }

  console.log('[Brevo] Sending email:', { to: toRecipients.length, bcc: bccRecipients?.length || 0, subject: options.subject });

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { message?: string; code?: string };
    console.error('[Brevo] Error:', errorData);
    throw new Error(errorData.message || `Brevo API error: ${response.status}`);
  }

  console.log('[Brevo] Email sent successfully');
}

/**
 * Funzione principale per inviare email
 * Usa Brevo API HTTP (porta 443, mai bloccata)
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  await sendWithBrevoAPI(options);
}
