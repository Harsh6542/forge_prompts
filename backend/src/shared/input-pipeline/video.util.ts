import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const FFMPEG_PATH: string = require('@ffmpeg-installer/ffmpeg').path;
const FFPROBE_PATH: string = require('ffprobe-static').path;

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
}

export async function probeVideo(buffer: Buffer): Promise<VideoMetadata> {
  if (buffer.length === 0) throw new BadRequestException('Empty video file');

  const dir = await mkdtemp(join(tmpdir(), 'cp-video-'));
  const src = join(dir, 'input');
  try {
    await writeFile(src, buffer);
    const ffprobePath = FFPROBE_PATH;
    const meta = await spawnForJson(ffprobePath, [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', src,
    ]);
    const streams = (meta['streams'] ?? []) as Array<Record<string, unknown>>;
    const video = streams.find((s) => s['codec_type'] === 'video');
    if (!video) throw new BadRequestException('No video stream found in file');

    return {
      durationSeconds: Number((meta['format'] as Record<string, unknown> | undefined)?.['duration'] ?? 0),
      width: Number(video['width'] ?? 0),
      height: Number(video['height'] ?? 0),
      fps: Number(video['r_frame_rate'] ?? 25),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractKeyFrames(
  buffer: Buffer,
  durationSeconds: number,
  maxFrames = 6,
): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), 'cp-frames-'));
  // one frame per 10s; for longer videos, sample evenly across maxFrames slots
  const interval = durationSeconds && durationSeconds > 60
    ? Math.max(1, Math.ceil(durationSeconds / maxFrames))
    : 10;
  const outPattern = join(dir, 'frame-%02d.jpg');
  try {
    const src = join(dir, 'input');
    await writeFile(src, buffer);
    const run = await runFfmpeg([
      '-i', src,
      '-vf', `fps=1/${interval}`,
      '-frames:v', String(maxFrames),
      '-q:v', '3',
      outPattern,
    ]);
    if (run !== 0) throw new BadGatewayException('Failed to extract video frames');

    const frames: Buffer[] = [];
    for (let i = 1; i <= maxFrames; i++) {
      const name = join(dir, `frame-${String(i).padStart(2, '0')}.jpg`);
      try {
        frames.push(await readFile(name));
      } catch {
        break;
      }
    }
    if (frames.length === 0) throw new BadGatewayException('No frames extracted from video');
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractAudioTrack(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'cp-audio-'));
  try {
    const src = join(dir, 'input');
    const out = join(dir, 'audio.wav');
    await writeFile(src, buffer);
    const code = await runFfmpeg([
      '-i', src, '-vn',
      '-ac', '1', '-ar', '16000',
      '-acodec', 'pcm_s16le',
      out,
    ]);
    if (code !== 0) throw new BadGatewayException('Failed to strip audio track from video');
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, ['-y', ...args], { stdio: 'ignore' });
    proc.on('error', () => reject(new BadGatewayException('ffmpeg binary could not be started')));
    proc.on('close', (code) => resolve(code ?? 1));
  });
}

function spawnForJson(path: string, args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const proc = spawn(path, args);
    let out = '';
    proc.stdout?.on('data', (d) => (out += d));
    proc.on('error', () => reject(new BadGatewayException('ffprobe binary could not be started')));
    proc.on('close', () => {
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new BadGatewayException('Video probing failed'));
      }
    });
  });
}
