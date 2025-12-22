import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface EmailOptions {
  from: string;
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Determina se usare Resend API o SMTP in base alla configurazione
 * - Se l'host è "smtp.resend.com", usa l'API Resend (più affidabile)
 * - Altrimenti usa nodemailer SMTP
 */
function isResendHost(host: string): boolean {
  return host.toLowerCase().includes('resend.com');
}

/**
 * Invia email usando Resend API
 */
async function sendWithResend(apiKey: string, options: EmailOptions): Promise<void> {
  const resend = new Resend(apiKey);
  
  const { error } = await resend.emails.send({
    from: options.from,
    to: Array.isArray(options.to) ? options.to : [options.to],
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });

  if (error) {
    throw new Error(error.message || 'Errore Resend API');
  }

  return;
}

/**
 * Invia email usando nodemailer SMTP
 */
async function sendWithSmtp(config: SmtpConfig, options: EmailOptions): Promise<void> {
  const port = config.port;
  const isSecure = config.secure;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure: isSecure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    // Timeout aumentati per evitare ECONNECT
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    // Per servizi che usano STARTTLS su porta 587
    ...(port === 587 && !isSecure ? { 
      requireTLS: true,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2' as const
      }
    } : {}),
    // Per servizi SSL su porta 465
    ...(port === 465 || isSecure ? {
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2' as const
      }
    } : {}),
  });

  await transporter.sendMail({
    from: options.from,
    to: options.to,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });
}

/**
 * Funzione principale per inviare email
 * Sceglie automaticamente il metodo migliore in base alla configurazione
 */
export async function sendEmail(config: SmtpConfig, options: EmailOptions): Promise<void> {
  // Se è Resend, usa l'API invece di SMTP (molto più affidabile su Vercel/serverless)
  if (isResendHost(config.host)) {
    // La password SMTP di Resend è la API key
    await sendWithResend(config.password, options);
  } else {
    // Usa nodemailer SMTP per altri provider
    await sendWithSmtp(config, options);
  }
}
