import type { Finding, Run } from '../dataverse/types.js';
import { todayIn } from '../dataverse/dates.js';
import type { AppContext } from './context.js';

export interface FindingView extends Finding {
  itemTitle: string | null;
  templateTitle: string | null;
  runTitle: string | null;
  zoneId: string | null;
  zoneTitle: string | null;
  assignedToName: string | null;
  overdue: boolean;
}

export interface RunView extends Run {
  zoneTitle: string | null;
  auditorName: string | null;
}

/** People are stored in Dataverse as plain email text; resolve them to names for display. */
function nameLookup(ctx: AppContext) {
  const byEmail = new Map(ctx.store.listUsers().map((u) => [u.email.toLowerCase(), u.name]));
  return (email: string | null) => (email ? (byEmail.get(email.toLowerCase()) ?? null) : null);
}

export async function toRunViews(ctx: AppContext, runs: Run[]): Promise<RunView[]> {
  const zones = new Map((await ctx.master.zones()).map((z) => [z.id, z.title]));
  const nameOf = nameLookup(ctx);
  return runs.map((r) => ({ ...r, zoneTitle: zones.get(r.zoneId) ?? null, auditorName: nameOf(r.auditor) }));
}

export async function toFindingViews(ctx: AppContext, findings: Finding[], runs?: Run[]): Promise<FindingView[]> {
  const [items, templates, zones, allRuns] = await Promise.all([
    ctx.master.items(),
    ctx.master.templates(),
    ctx.master.zones(),
    runs ?? ctx.repo.listRuns(),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const tplById = new Map(templates.map((t) => [t.id, t.title]));
  const zoneById = new Map(zones.map((z) => [z.id, z.title]));
  const runById = new Map(allRuns.map((r) => [r.id, r]));
  const nameOf = nameLookup(ctx);
  const today = todayIn(ctx.cfg.timezone);

  return findings.map((f) => {
    const item = itemById.get(f.itemId);
    const run = runById.get(f.runId);
    return {
      ...f,
      itemTitle: item?.title ?? null,
      templateTitle: item ? (tplById.get(item.templateId) ?? null) : null,
      runTitle: run?.title ?? null,
      zoneId: run?.zoneId ?? null,
      zoneTitle: run ? (zoneById.get(run.zoneId) ?? null) : null,
      assignedToName: nameOf(f.assignedTo),
      overdue: !!f.dueDate && f.dueDate < today && (f.status === 'Open' || f.status === 'In Progress'),
    };
  });
}
