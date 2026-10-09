import { Router } from 'express';
import { z } from 'zod';
import { isDateOnly } from '../dataverse/dates.js';
import { FINDING_STATUSES, SEVERITIES, isGuid, type Finding } from '../dataverse/types.js';
import { badRequest, notFound } from '../errors.js';
import type { AppContext } from '../services/context.js';
import { canSeeFinding, planTransition, type FindingAction } from '../services/findingFlow.js';
import { toFindingViews } from '../services/views.js';

const DateOnly = z.string().refine(isDateOnly, 'Ngày không hợp lệ (YYYY-MM-DD)');

const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('assign'), assignedTo: z.string().email().max(100).nullable(), dueDate: DateOnly.nullable().optional() }),
  z.object({
    type: z.literal('update'),
    severity: z.enum(SEVERITIES).optional(),
    dueDate: DateOnly.nullable().optional(),
    title: z.string().trim().min(1).max(850).optional(),
    description: z.string().max(2000).nullable().optional(),
  }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('resolve'), afterImage: z.string().max(100), note: z.string().max(800).optional() }),
  z.object({ type: z.literal('close'), note: z.string().max(800).optional() }),
  z.object({ type: z.literal('reopen'), note: z.string().trim().min(1, 'Cần nhập lý do mở lại').max(800) }),
]);

const Query = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  assignee: z.string().max(100).optional(), // 'me' | 'unassigned' | email
  overdue: z.enum(['1', 'true']).optional(),
  runId: z.string().refine(isGuid).optional(),
  zoneId: z.string().refine(isGuid).optional(),
  q: z.string().max(100).optional(),
});

export function findingRoutes(ctx: AppContext) {
  const { repo, store } = ctx;
  const r = Router();

  const load = async (id: string, userId: string): Promise<Finding> => {
    if (!isGuid(id)) throw badRequest('ID không hợp lệ');
    const f = await repo.getFinding(id);
    const user = store.getUser(userId)!;
    // 404 (not 403) so fixers cannot probe for findings that are not theirs.
    if (!f || !canSeeFinding(user, f)) throw notFound('Không tìm thấy sự cố');
    return f;
  };

  r.get('/', async (req, res) => {
    const q = Query.parse(req.query);
    const user = req.user!;
    const me = user.email.toLowerCase();

    let rows = (await repo.listFindings(q.runId ? { runId: q.runId } : undefined)).filter((f) => canSeeFinding(user, f));
    if (q.status) rows = rows.filter((f) => f.status === q.status);
    if (q.severity) rows = rows.filter((f) => f.severity === q.severity);
    if (q.assignee === 'me') rows = rows.filter((f) => f.assignedTo?.toLowerCase() === me);
    else if (q.assignee === 'unassigned') rows = rows.filter((f) => !f.assignedTo);
    else if (q.assignee) rows = rows.filter((f) => f.assignedTo?.toLowerCase() === q.assignee!.toLowerCase());

    let views = await toFindingViews(ctx, rows);
    if (q.overdue) views = views.filter((f) => f.overdue);
    if (q.zoneId) views = views.filter((f) => f.zoneId === q.zoneId);
    if (q.q) {
      const needle = q.q.toLowerCase();
      views = views.filter((f) => [f.title, f.description, f.zoneTitle, f.itemTitle].some((s) => s?.toLowerCase().includes(needle)));
    }
    res.json(views);
  });

  r.get('/:id', async (req, res) => {
    const f = await load(req.params.id!, req.user!.id);
    const [view] = await toFindingViews(ctx, [f]);
    res.json(view);
  });

  r.post('/:id/actions', async (req, res) => {
    const user = req.user!;
    const finding = await load(req.params.id!, user.id);
    const action = ActionSchema.parse(req.body) as FindingAction;

    if (action.type === 'assign' && action.assignedTo) {
      const target = store.getUserForLogin(action.assignedTo);
      if (!target || !target.active || (target.role !== 'fixer' && target.role !== 'admin')) throw badRequest('Người được giao phải là Fixer đang hoạt động');
    }

    const patch = planTransition(user, finding, action);
    const updated = await repo.updateFinding(finding.id, patch, finding.etag);
    const [view] = await toFindingViews(ctx, [updated]);
    res.json(view);
  });

  return r;
}
