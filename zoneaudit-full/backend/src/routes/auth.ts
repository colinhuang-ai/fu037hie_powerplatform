import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/passwords.js';
import { clearSession, issueSession, requireAuth } from '../auth/session.js';
import { badRequest, forbidden, unauthorized } from '../errors.js';
import type { AppContext } from '../services/context.js';

const LoginBody = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) });
const GoogleBody = z.object({ credential: z.string().min(10).max(4096) });
const ChangePasswordBody = z.object({ currentPassword: z.string().max(200).optional(), newPassword: z.string().min(8).max(200) });

export function authRoutes(ctx: AppContext) {
  const { cfg, store } = ctx;
  const r = Router();

  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => cfg.env === 'test',
    message: { error: 'Quá nhiều lần thử, vui lòng thử lại sau ít phút' },
  });

  r.get('/config', (_req, res) => {
    res.json({ googleClientId: cfg.google.clientId ?? null, mock: cfg.dataverse.mode === 'mock' });
  });

  r.post('/login', limiter, async (req, res) => {
    const { email, password } = LoginBody.parse(req.body);
    const u = store.getUserForLogin(email);
    if (!u) {
      await burnPasswordCheck(password);
      throw unauthorized('Sai email hoặc mật khẩu');
    }
    const ok = await verifyPassword(password, u.passwordHash);
    if (!ok || !u.active) throw unauthorized('Sai email hoặc mật khẩu');
    store.touchLogin(u.id);
    const user = store.getUser(u.id)!;
    issueSession(res, cfg, user);
    res.json({ user });
  });

  r.post('/google', limiter, async (req, res) => {
    if (!ctx.googleVerifier) throw badRequest('Đăng nhập bằng Google chưa được cấu hình');
    const { credential } = GoogleBody.parse(req.body);

    let identity;
    try {
      identity = await ctx.googleVerifier(credential);
    } catch {
      throw unauthorized('Không xác thực được tài khoản Google');
    }
    if (!identity.emailVerified) throw unauthorized('Email Google chưa được xác minh');

    let existing = store.getUserForLogin(identity.email);
    if (!existing) {
      const domain = identity.email.split('@')[1] ?? '';
      const role = cfg.google.autoProvisionRole;
      const domainOk = !cfg.google.allowedDomains.length || cfg.google.allowedDomains.includes(domain);
      if (!role || !domainOk) throw forbidden('Tài khoản Google này chưa được cấp quyền. Hãy liên hệ quản trị viên.');
      const created = store.createUser({ email: identity.email, name: identity.name, role, googleSub: identity.sub });
      existing = store.getUserForLogin(created.email)!;
    } else {
      if (!existing.active) throw forbidden('Tài khoản đã bị vô hiệu hóa');
      if (existing.googleSub && existing.googleSub !== identity.sub) throw unauthorized('Không xác thực được tài khoản Google');
      if (!existing.googleSub) store.updateUser(existing.id, { googleSub: identity.sub });
    }

    store.touchLogin(existing.id);
    const user = store.getUser(existing.id)!;
    issueSession(res, cfg, user);
    res.json({ user });
  });

  r.post('/logout', (_req, res) => {
    clearSession(res, cfg);
    res.status(204).end();
  });

  const auth = requireAuth(cfg, store);

  r.get('/me', auth, (req, res) => {
    res.json({ user: req.user });
  });

  r.post('/change-password', auth, limiter, async (req, res) => {
    const body = ChangePasswordBody.parse(req.body);
    const u = store.getUserWithHash(req.user!.id)!;
    // Accounts that never had a password (Google-only) can set one without a current password.
    if (u.passwordHash) {
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, u.passwordHash))) throw unauthorized('Mật khẩu hiện tại không đúng');
    }
    store.updateUser(u.id, { passwordHash: await hashPassword(body.newPassword) });
    res.status(204).end();
  });

  return r;
}
