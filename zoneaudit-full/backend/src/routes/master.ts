import { Router } from 'express';
import { badRequest, notFound } from '../errors.js';
import { isGuid } from '../dataverse/types.js';
import type { AppContext } from '../services/context.js';

export function masterRoutes(ctx: AppContext) {
  const r = Router();

  r.get('/zones', async (_req, res) => {
    res.json(await ctx.master.zones());
  });

  r.get('/templates', async (_req, res) => {
    const [templates, items] = await Promise.all([ctx.master.templates(), ctx.master.items()]);
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.templateId, (counts.get(i.templateId) ?? 0) + 1);
    res.json(templates.map((t) => ({ ...t, itemCount: counts.get(t.id) ?? 0 })));
  });

  r.get('/templates/:id/items', async (req, res) => {
    const id = req.params.id;
    if (!isGuid(id)) throw badRequest('ID không hợp lệ');
    const templates = await ctx.master.templates();
    if (!templates.some((t) => t.id === id)) throw notFound('Không tìm thấy mẫu kiểm tra');
    res.json((await ctx.master.items()).filter((i) => i.templateId === id));
  });

  return r;
}
