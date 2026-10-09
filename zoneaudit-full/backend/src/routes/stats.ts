import { Router } from 'express';
import { todayIn } from '../dataverse/dates.js';
import { SEVERITIES, type Finding } from '../dataverse/types.js';
import type { AppContext } from '../services/context.js';
import { canSeeFinding } from '../services/findingFlow.js';
import { toRunViews } from '../services/views.js';

const DAYS_30_MS = 30 * 24 * 3600_000;

export function statsRoutes(ctx: AppContext) {
  const { repo, cfg } = ctx;
  const r = Router();

  r.get('/stats', async (req, res) => {
    const user = req.user!;
    const today = todayIn(cfg.timezone);
    const findings: Finding[] = (await repo.listFindings()).filter((f) => canSeeFinding(user, f));

    const open = (f: Finding) => f.status === 'Open' || f.status === 'In Progress';
    const byStatus = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<(typeof SEVERITIES)[number], number>;
    let overdue = 0;
    let mine = 0;
    for (const f of findings) {
      if (f.status === 'Open') byStatus.open++;
      else if (f.status === 'In Progress') byStatus.inProgress++;
      else if (f.status === 'Resolved') byStatus.resolved++;
      else byStatus.closed++;
      if (open(f)) {
        if (f.severity) bySeverity[f.severity]++;
        if (f.dueDate && f.dueDate < today) overdue++;
      }
      if (f.assignedTo?.toLowerCase() === user.email.toLowerCase() && open(f)) mine++;
    }

    const base = { findings: { ...byStatus, overdue, mine, bySeverity } };
    if (user.role === 'fixer') return res.json({ ...base, runs: null });

    const runs = await repo.listRuns();
    const since = Date.now() - DAYS_30_MS;
    const recent = runs.filter((x) => Date.parse(x.createdOn) >= since);
    const scored = recent.filter((x) => x.score != null);
    const openByZoneRun = new Map<string, number>();
    const runZone = new Map(runs.map((x) => [x.id, x.zoneId]));
    for (const f of findings) {
      const z = runZone.get(f.runId);
      if (z && open(f)) openByZoneRun.set(z, (openByZoneRun.get(z) ?? 0) + 1);
    }

    const zoneAgg = new Map<string, { sum: number; n: number }>();
    for (const x of scored) {
      const a = zoneAgg.get(x.zoneId) ?? { sum: 0, n: 0 };
      a.sum += x.score!;
      a.n++;
      zoneAgg.set(x.zoneId, a);
    }
    const zoneNames = new Map((await ctx.master.zones()).map((z) => [z.id, z.title]));
    const byZone = [...zoneAgg].map(([zoneId, a]) => ({
      zoneId,
      zoneTitle: zoneNames.get(zoneId) ?? '—',
      avgScore: Math.round(a.sum / a.n),
      runs: a.n,
      openFindings: openByZoneRun.get(zoneId) ?? 0,
    }));
    byZone.sort((a, b) => a.avgScore - b.avgScore);

    res.json({
      ...base,
      runs: {
        count30d: recent.length,
        avgScore30d: scored.length ? Math.round(scored.reduce((s, x) => s + x.score!, 0) / scored.length) : null,
        byZone,
        latest: (await toRunViews(ctx, runs.slice(0, 5))),
      },
    });
  });

  return r;
}
