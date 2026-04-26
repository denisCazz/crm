/**
 * S3-compatible storage helper (server-only).
 * Supports any S3-compatible provider: AWS S3, MinIO, Cloudflare R2, Backblaze B2, etc.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'us-east-1';
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing S3 env vars: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are required');
  }

  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const { endpoint, region, accessKeyId, secretAccessKey } = getS3Config();
  _client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function getDefaultBucket(): string {
  return getS3Config().bucket;
}

/**
 * Upload a file buffer to S3.
 * Returns the S3 key used.
 */
export async function uploadToS3(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  bucket?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  const { bucket } = getS3Config();
  const targetBucket = params.bucket ?? bucket;

  await getClient().send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType ?? 'application/octet-stream',
      Metadata: params.metadata,
    })
  );

  return params.key;
}

/**
 * Delete a file from S3.
 */
export async function deleteFromS3(key: string, bucket?: string): Promise<void> {
  const { bucket: defaultBucket } = getS3Config();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket ?? defaultBucket,
      Key: key,
    })
  );
}

/**
 * Generate a presigned URL for downloading a file.
 * Default expiry: 1 hour.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  bucket?: string
): Promise<string> {
  const { bucket: defaultBucket } = getS3Config();
  const command = new GetObjectCommand({
    Bucket: bucket ?? defaultBucket,
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned URL for uploading a file directly from the browser.
 * Default expiry: 5 minutes.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
  bucket?: string
): Promise<string> {
  const { bucket: defaultBucket } = getS3Config();
  const command = new PutObjectCommand({
    Bucket: bucket ?? defaultBucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Check if a key exists in S3.
 */
export async function existsInS3(key: string, bucket?: string): Promise<boolean> {
  const { bucket: defaultBucket } = getS3Config();
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: bucket ?? defaultBucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a public URL if S3_PUBLIC_BASE_URL is configured.
 */
export function publicUrl(key: string): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}
