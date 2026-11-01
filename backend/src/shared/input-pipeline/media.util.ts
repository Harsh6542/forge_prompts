import { BadGatewayException, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export async function preprocessImage(buffer: Buffer): Promise<{
  jpegBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}> {
  try {
    const pipeline = sharp(buffer).rotate().resize({ width: 1600, withoutEnlargement: true });
    const meta = await pipeline.metadata();
    const jpegBuffer = await pipeline.jpeg({ quality: 82 }).toBuffer();
    return { jpegBuffer, mimeType: 'image/jpeg', width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    throw new BadRequestException('Unsupported or corrupted image file (HEIC/JPEG/PNG/WebP accepted)');
  }
}
