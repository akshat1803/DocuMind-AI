import { randomUUID } from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../../config/env.js';

export interface StoredDocument {
  publicId: string;
  assetId: string;
  bytes: number;
  resourceType: string;
  deliveryType: string;
}

export interface DocumentStorageProvider {
  uploadPdf(buffer: Buffer, userId: string): Promise<StoredDocument>;
  downloadPdf(publicId: string, signal?: AbortSignal): Promise<Buffer>;
  deletePdf(publicId: string): Promise<void>;
  createDownloadUrl(publicId: string, expiresInSeconds?: number): string;
}

export class CloudinaryStorageProvider implements DocumentStorageProvider {
  constructor() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new Error('CLOUDINARY_NOT_CONFIGURED');
    }

    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  uploadPdf(buffer: Buffer, userId: string): Promise<StoredDocument> {
    return new Promise((resolve, reject) => {
      const publicId = `documind/users/${userId}/${randomUUID()}`;
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          type: 'authenticated',
          format: 'pdf',
          overwrite: false,
          use_filename: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('CLOUDINARY_UPLOAD_FAILED'));
            return;
          }
          const uploaded = result as UploadApiResponse;
          resolve({
            publicId: uploaded.public_id,
            assetId: uploaded.asset_id,
            bytes: uploaded.bytes,
            resourceType: uploaded.resource_type,
            deliveryType: uploaded.type,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async deletePdf(publicId: string): Promise<void> {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('CLOUDINARY_DELETE_FAILED');
    }
  }

  async downloadPdf(publicId: string, signal?: AbortSignal): Promise<Buffer> {
    const response = await fetch(this.createDownloadUrl(publicId), { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('CLOUDINARY_DOWNLOAD_FAILED');
    if (!response.body) throw new Error('CLOUDINARY_DOWNLOAD_FAILED');
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > env.MAX_FILE_SIZE_MB * 1024 * 1024) throw new Error('PDF_TOO_LARGE');
        parts.push(value);
      }
      return Buffer.concat(parts);
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }

  createDownloadUrl(publicId: string, expiresInSeconds = 300): string {
    return cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      attachment: false,
    });
  }
}

let storageInstance: DocumentStorageProvider | undefined;

export function getDocumentStorage(): DocumentStorageProvider {
  storageInstance ??= new CloudinaryStorageProvider();
  return storageInstance;
}
