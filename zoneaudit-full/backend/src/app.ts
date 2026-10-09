import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Router, type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { ZodError } from 'zod';
import { requireAuth, requireRole } from './auth/session.js';
import type { Config } from './config.js';
import { DataverseError } from './dataverse/client.js';
import { HttpError, forbidden } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { draftRoutes } from './routes/drafts.js';
import { findingRoutes } from './routes/findings.js';
import { masterRoutes } from './routes/master.js';
import { runRoutes } from './routes/runs.js';
import { statsRoutes } from './routes/stats.js';
import { uploadRoutes } from './routes/uploads.js';
import { userRoutes } from './routes/users.js';
import type { AppContext } from './services/context.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** CSRF defence in depth (on top of SameSite=Lax): reject state-changing requests from foreign origins. */
const originGuard =
  (cfg: Config): RequestHandler =>
  (req, _res, next) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || !origin) return next();
    try {
      if (cfg.appOrigins.includes(origin) || new URL(origin).host === req.headers.host) return next();
    } catch {
      /* fall through */
    }
    next(forbidden('Origin không hợp lệ'));
  };

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof ZodError) {
    return void res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`) });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return void res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'Ảnh quá lớn (tối đa 8MB)' : 'Upload không hợp lệ' });
  }
  if ((err as { type?: string }).type === 'entity.parse.failed') return void res.status(400).json({ error: 'JSON không hợp lệ' });
  if ((err as { type?: string }).type === 'entity.too.large') return void res.status(413).json({ error: 'Dữ liệu quá lớn' });
  if (err instanceof DataverseError) {
    console.error(`[dataverse] ${req.method} ${req.originalUrl}: ${err.message}`);
    return void res.status(502).json({ error: 'Không kết nối được tới Dataverse, vui lòng thử lại sau' });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
};

export function createApp(ctx: AppContext) {
  const { cfg, store } = ctx;
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // Google Identity Services needs its script, iframe, styles and popup messaging.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
          frameSrc: ['https://accounts.google.com/gsi/'],
          connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', originGuard(cfg));

  app.use('/api/auth', authRoutes(ctx));

  const secured = Router();
  secured.use(requireAuth(cfg, store));
  secured.use(uploadRoutes(ctx));
  secured.use(statsRoutes(ctx));
  secured.use('/master', requireRole('auditor'), masterRoutes(ctx));
  secured.use('/drafts', requireRole('auditor'), draftRoutes(ctx));
  secured.use('/runs', requireRole('auditor'), runRoutes(ctx));
  secured.use('/findings', findingRoutes(ctx));
  secured.use('/users', userRoutes(ctx));
  app.use('/api', secured);
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Không tìm thấy' }));

  // Production: serve the built SPA from the same origin (cookies stay first-party, no CORS needed).
  const dist = resolve(import.meta.dirname, '../../frontend/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => void res.sendFile(resolve(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
