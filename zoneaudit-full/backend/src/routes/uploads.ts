import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { badRequest, notFound } from '../errors.js';
import type { AppContext } from '../services/context.js';

const MAX_BYTES = 8 * 1024 * 1024;

/** Identify the real image type from magic bytes; never trust the client-supplied mimetype or filename. */
function sniffImage(buf: Buffer): { ext: 'jpg' | 'png' | 'webp' | 'gif'; mime: string } | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (buf.length > 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) return { ext: 'gif', mime: 'image/gif' };
  return null;
}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const FILE_RE = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;

export function uploadRoutes(ctx: AppContext) {
  const dir = resolve(ctx.cfg.dataDir, 'uploads');
  mkdirSync(dir, { recursive: true });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });
  const r = Router();

  r.post('/uploads', upload.single('file'), async (req, res) => {
    if (!req.file) throw badRequest('Thiếu file ảnh');
    const kind = sniffImage(req.file.buffer);
    if (!kind) throw badRequest('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF');
    const name = `${randomBytes(16).toString('hex')}.${kind.ext}`;
    await writeFile(resolve(dir, name), req.file.buffer, { flag: 'wx' });
    res.status(201).json({ path: `/api/files/${name}` });
  });

  r.get('/files/:name', (req, res, next) => {
    const name = req.params.name!;
    if (!FILE_RE.test(name)) return next(notFound());
    res.setHeader('Content-Type', MIME_BY_EXT[name.split('.')[1]!]!);
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.sendFile(name, { root: dir, dotfiles: 'deny' }, (err) => {
      if (err) next(notFound());
    });
  });

  return r;
}
