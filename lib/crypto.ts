import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.SMTP_ENCRYPTION_SECRET;

function getKey(): Buffer {
  if (!ENCRYPTION_SECRET) {
    throw new Error('Missing SMTP_ENCRYPTION_SECRET');
  }

  // Deriva una key a 32 byte (AES-256) da una passphrase.
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM standard

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptSecret(cipherText: string): string {
  const key = getKey();
  const json = Buffer.from(cipherText, 'base64').toString('utf8');
  const payload = JSON.parse(json) as { v: number; alg: string; iv: string; tag: string; data: string };

  if (payload.v !== 1 || payload.alg !== 'aes-256-gcm') {
    throw new Error('Unsupported encrypted payload');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
