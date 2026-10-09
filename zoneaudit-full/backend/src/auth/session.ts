import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import type { Role, Store, User } from '../db.js';
import { forbidden, unauthorized } from '../errors.js';

export const COOKIE_NAME = 'za_session';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

const cookieOptions = (cfg: Config): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: cfg.cookieSecure,
  path: '/',
});

export function issueSession(res: Response, cfg: Config, user: User) {
  const token = jwt.sign({ sub: user.id }, cfg.sessionSecret, { algorithm: 'HS256', expiresIn: `${cfg.sessionHours}h` });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(cfg), maxAge: cfg.sessionHours * 3600_000 });
}

export function clearSession(res: Response, cfg: Config) {
  res.clearCookie(COOKIE_NAME, cookieOptions(cfg));
}

/** Resolves the session cookie to a live, active user (role changes / deactivation apply immediately). */
export function requireAuth(cfg: Config, store: Store) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next(unauthorized());
    try {
      const payload = jwt.verify(token, cfg.sessionSecret, { algorithms: ['HS256'] }) as { sub?: string };
      const user = payload.sub ? store.getUser(payload.sub) : null;
      if (!user || !user.active) return next(unauthorized('Tài khoản không còn hiệu lực'));
      req.user = user;
      next();
    } catch {
      next(unauthorized('Phiên đăng nhập đã hết hạn'));
    }
  };
}

/** Admin implicitly passes every role check. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return next(unauthorized());
    if (u.role !== 'admin' && !roles.includes(u.role)) return next(forbidden());
    next();
  };
