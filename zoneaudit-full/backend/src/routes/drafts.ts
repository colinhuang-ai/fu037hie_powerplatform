import { Router } from 'express';
import { z } from 'zod';
import type { DraftAnswer } from '../db.js';
import { isDateOnly } from '../dataverse/dates.js';
import { SEVERITIES, isGuid } from '../dataverse/types.js';
import { badRequest, notFound } from '../errors.js';
import { computeScore, draftProgress, submitDraft } from '../services/audit.js';
import type { AppContext } from '../services/context.js';
import { IMAGE_PATH_RE } from '../services/findingFlow.js';
import { toFindingViews, toRunViews } from '../services/views.js';

const Guid = z.string().refine(isGuid, 'ID không hợp lệ');

const AnswerSchema = z.object({
  result: z.enum(['pass', 'fail', 'na']).nullable(),
  note: z.string().max(1500).optional(),
  severity: z.enum(SEVERITIES).optional(),
  photo: z.string().regex(IMAGE_PATH_RE).nullable().optional(),
  assignedTo: z.string().email().max(100).nullable().optional(),
  dueDate: z.string().refine(isDateOnly, 'Ngày không hợp lệ (YYYY-MM-DD)').nullable().optional(),
});

const CreateBody = z.object({ zoneId: Guid, templateId: Guid });
const SaveBody = z.object({ answers: z.record(Guid, AnswerSchema) });

export function draftRoutes(ctx: AppContext) {
  const { store, repo } = ctx;
  const r = Router();

  /** Drafts are private to their owner; anyone else gets a 404 rather than a hint that it exists. */
  const own = (id: string, userId: string) => {
    if (!isGuid(id)) throw badRequest('ID không hợp lệ');
    const d = store.getDraft(id);
    if (!d || d.ownerId !== userId) throw notFound('Không tìm thấy bản nháp');
    return d;
  };

  const present = (d: ReturnType<typeof own>) => ({ ...d, progress: draftProgress(d), tally: computeScore(d.answers) });

  r.get('/', (req, res) => {
    res.json(store.listDrafts(req.user!.id).map(present));
  });

  r.post('/', async (req, res) => {
    const { zoneId, templateId } = CreateBody.parse(req.body);
    const [zones, templates, items] = await Promise.all([ctx.master.zones(), ctx.master.templates(), ctx.master.items()]);
    const zone = zones.find((z) => z.id === zoneId);
    const template = templates.find((t) => t.id === templateId);
    if (!zone) throw badRequest('Khu vực không tồn tại');
    if (!template) throw badRequest('Mẫu kiểm tra không tồn tại');
    const tplItems = items.filter((i) => i.templateId === templateId).sort((a, b) => a.order - b.order);
    if (!tplItems.length) throw badRequest('Mẫu kiểm tra này chưa có hạng mục nào');

    const draft = store.createDraft({
      ownerId: req.user!.id,
      zoneId,
      zoneTitle: zone.title,
      templateId,
      templateTitle: template.title,
      items: tplItems.map((i) => ({ id: i.id, title: i.title, order: i.order })),
    });
    res.status(201).json(present(draft));
  });

  r.get('/:id', (req, res) => {
    res.json(present(own(req.params.id!, req.user!.id)));
  });

  r.put('/:id', (req, res) => {
    const draft = own(req.params.id!, req.user!.id);
    const { answers } = SaveBody.parse(req.body);
    const valid = new Set(draft.items.map((i) => i.id));
    const unknown = Object.keys(answers).filter((k) => !valid.has(k));
    if (unknown.length) throw badRequest('Có hạng mục không thuộc bản nháp này');
    const saved = store.saveDraftAnswers(draft.id, answers as Record<string, DraftAnswer>)!;
    res.json(present(saved));
  });

  r.delete('/:id', (req, res) => {
    const draft = own(req.params.id!, req.user!.id);
    store.deleteDraft(draft.id);
    res.status(204).end();
  });

  r.post('/:id/submit', async (req, res) => {
    const draft = own(req.params.id!, req.user!.id);
    const fixers = new Set(store.listUsers().filter((u) => u.active && (u.role === 'fixer' || u.role === 'admin')).map((u) => u.email.toLowerCase()));
    const { run, findings } = await submitDraft({
      draft,
      user: req.user!,
      repo,
      store,
      timezone: ctx.cfg.timezone,
      validAssignees: fixers,
    });
    const [runView] = await toRunViews(ctx, [run]);
    res.status(201).json({ run: runView, findings: await toFindingViews(ctx, findings, [run]) });
  });

  return r;
}
