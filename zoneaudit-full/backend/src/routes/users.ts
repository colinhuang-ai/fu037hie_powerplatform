import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/passwords.js';
import { requireRole } from '../auth/session.js';
import { ROLES } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import type { AppContext } from '../services/context.js';

const CreateBody = z.object({
  email: z.string().trim().email().max(100),
  name: z.string().trim().min(1).max(100),
  role: z.enum(ROLES),
  /** Omit for a Google-only account. */
  password: z.string().min(8).max(200).optional(),
});

const UpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export function userRoutes(ctx: AppContext) {
  const { store } = ctx;
  const r = Router();

  /** Auditors need the list of people they can assign findings to; only minimal fields are exposed. */
  r.get('/assignable', requireRole('auditor'), (_req, res) => {
    res.json(
      store
        .listUsers()
        .filter((u) => u.active && (u.role === 'fixer' || u.role === 'admin'))
        .map(({ id, name, email, role }) => ({ id, name, email, role })),
    );
  });

  r.get('/', requireRole(), (_req, res) => {
    res.json(store.listUsers());
  });

  r.post('/', requireRole(), async (req, res) => {
    const body = CreateBody.parse(req.body);
    if (store.getUserForLogin(body.email)) throw conflict('Email này đã tồn tại');
    const user = store.createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      passwordHash: body.password ? await hashPassword(body.password) : null,
    });
    res.status(201).json(user);
  });

  r.patch('/:id', requireRole(), async (req, res) => {
    const id = String(req.params.id);
    const body = UpdateBody.parse(req.body);
    const target = store.getUser(id);
    if (!target) throw notFound('Không tìm thấy người dùng');

    const losesAdmin = target.role === 'admin' && target.active && ((body.role && body.role !== 'admin') || body.active === false);
    if (losesAdmin && store.countActiveAdmins() <= 1) throw badRequest('Phải còn ít nhất một Admin đang hoạt động');

    const updated = store.updateUser(id, {
      name: body.name,
      role: body.role,
      active: body.active,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    });
    res.json(updated);
  });

  return r;
}
