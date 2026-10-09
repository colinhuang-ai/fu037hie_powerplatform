import type { Draft, DraftAnswer, Store, User } from '../db.js';
import { isDateOnly, todayIn } from '../dataverse/dates.js';
import { SEVERITIES, type Finding, type Repo, type Run, type Severity } from '../dataverse/types.js';
import { badRequest } from '../errors.js';
import { DESCRIPTION_MAX, IMAGE_PATH_RE } from './findingFlow.js';

export function computeScore(answers: Record<string, DraftAnswer>): { pass: number; fail: number; na: number; score: number | null } {
  let pass = 0, fail = 0, na = 0;
  for (const a of Object.values(answers)) {
    if (a.result === 'pass') pass++;
    else if (a.result === 'fail') fail++;
    else if (a.result === 'na') na++;
  }
  const scored = pass + fail;
  return { pass, fail, na, score: scored ? Math.round((pass / scored) * 100) : null };
}

export function draftProgress(d: Draft) {
  const answered = d.items.filter((i) => d.answers[i.id]?.result).length;
  return { answered, total: d.items.length };
}

/** Throws a 400 listing what is still missing; the checklist must be complete before it becomes a run. */
export function validateForSubmit(d: Draft, validAssignees: Set<string>) {
  const problems: string[] = [];
  for (const item of d.items) {
    const a = d.answers[item.id];
    if (!a?.result) {
      problems.push(`Chưa đánh giá: "${item.title}"`);
      continue;
    }
    if (a.result !== 'fail') continue;
    if (!a.note?.trim()) problems.push(`Cần mô tả vấn đề cho: "${item.title}"`);
    if (a.assignedTo && !validAssignees.has(a.assignedTo.toLowerCase())) problems.push(`Người xử lý không hợp lệ cho: "${item.title}"`);
    if (a.photo && !IMAGE_PATH_RE.test(a.photo)) problems.push(`Ảnh không hợp lệ cho: "${item.title}"`);
    if (a.dueDate && !isDateOnly(a.dueDate)) problems.push(`Hạn xử lý không hợp lệ cho: "${item.title}"`);
  }
  const { score } = computeScore(d.answers);
  if (score === null) problems.push('Cần ít nhất một hạng mục Đạt hoặc Không đạt (không thể tất cả đều N/A)');
  if (problems.length) throw badRequest('Checklist chưa hợp lệ', problems);
}

export interface SubmitResult {
  run: Run;
  findings: Finding[];
}

/**
 * Turns a draft into Dataverse rows: one Audit Run (with the final score) plus one Audit Finding per failed item.
 * Dataverse has no multi-row transaction over the plain API, so on any failure the rows created so far are removed
 * and the draft stays intact for a retry.
 */
export async function submitDraft(opts: {
  draft: Draft;
  user: User;
  repo: Repo;
  store: Store;
  timezone: string;
  validAssignees: Set<string>;
}): Promise<SubmitResult> {
  const { draft, user, repo, store, timezone, validAssignees } = opts;
  validateForSubmit(draft, validAssignees);
  const { score } = computeScore(draft.answers);
  const date = todayIn(timezone);

  const created: Finding[] = [];
  let run: Run | undefined;
  try {
    run = await repo.createRun({
      title: `${draft.templateTitle} - ${draft.zoneTitle} - ${date}`.slice(0, 850),
      zoneId: draft.zoneId,
      auditDate: date,
      auditor: user.email.toLowerCase(),
      score: score!,
    });
    for (const item of draft.items) {
      const a = draft.answers[item.id]!;
      if (a.result !== 'fail') continue;
      const severity: Severity = (SEVERITIES as readonly string[]).includes(a.severity ?? '') ? (a.severity as Severity) : 'Medium';
      created.push(
        await repo.createFinding({
          title: item.title.slice(0, 850),
          description: (a.note ?? '').trim().slice(0, DESCRIPTION_MAX) || null,
          severity,
          dueDate: a.dueDate || null,
          assignedTo: a.assignedTo ? a.assignedTo.toLowerCase() : null,
          beforeImage: a.photo || null,
          runId: run.id,
          itemId: item.id,
        }),
      );
    }
  } catch (err) {
    // Best-effort rollback; ignore secondary failures so the original error surfaces.
    for (const f of created) await repo.deleteFinding(f.id).catch(() => {});
    if (run) await repo.deleteRun(run.id).catch(() => {});
    throw err;
  }

  store.deleteDraft(draft.id);
  return { run, findings: created };
}
