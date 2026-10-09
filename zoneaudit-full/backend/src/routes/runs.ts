import { Router } from 'express';
import { badRequest, notFound } from '../errors.js';
import { isGuid } from '../dataverse/types.js';
import type { AppContext } from '../services/context.js';
import { toFindingViews, toRunViews } from '../services/views.js';

export function runRoutes(ctx: AppContext) {
  const { repo } = ctx;
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await toRunViews(ctx, await repo.listRuns()));
  });

  r.get('/:id', async (req, res) => {
    const id = req.params.id!;
    if (!isGuid(id)) throw badRequest('ID không hợp lệ');
    const run = await repo.getRun(id);
    if (!run) throw notFound('Không tìm thấy lượt kiểm tra');
    const [runView] = await toRunViews(ctx, [run]);
    const findings = await toFindingViews(ctx, await repo.listFindings({ runId: id }), [run]);
    res.json({ run: runView, findings });
  });

  return r;
}
