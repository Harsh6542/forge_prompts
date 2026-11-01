import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadResult {
  url: string | null;
  publicId: string | null;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
      });
      this.configured = true;
    } else {
      this.logger.warn('Cloudinary credentials missing in .env — media uploads will be skipped');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
    mimeType?: string,
  ): Promise<CloudinaryUploadResult> {
    if (!this.configured) return { url: null, publicId: null };

    return new Promise((resolve) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `civicpulse/${folder}`,
          resource_type: resourceType,
          ...(mimeType ? { format: undefined } : {}),
        },
        (err, result) => {
          if (err || !result?.secure_url) {
            this.logger.error(`Cloudinary upload failed: ${err?.message ?? 'no url'}`);
            resolve({ url: null, publicId: null });
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  // Audio needs the video family + data-URI upload so Cloudinary decodes format
  // and serves it with an audio/wav content-type instead of octet-stream.
  async uploadAudioBuffer(buffer: Buffer, folder: string): Promise<CloudinaryUploadResult> {
    if (!this.configured) return { url: null, publicId: null };

    return new Promise((resolve) => {
      void cloudinary.uploader.upload(
        `data:audio/wav;base64,${buffer.toString('base64')}`,
        { folder: `civicpulse/${folder}`, resource_type: 'video' },
        (err, result) => {
          if (err || !result?.secure_url) {
            this.logger.error(`Cloudinary audio upload failed: ${err?.message ?? 'no url'}`);
            resolve({ url: null, publicId: null });
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
    });
  }
}
