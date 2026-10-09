import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PNG, createCompletedDraft, makeHarness, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const upload = async (agent: ReturnType<typeof request.agent>) => {
  const res = await agent.post('/api/uploads').attach('file', PNG, { filename: 'p.png', contentType: 'image/png' });
  expect(res.status).toBe(201);
  return res.body.path as string;
};

describe('master data', () => {
  it('auditors can list zones/templates/items; fixers cannot', async () => {
    const auditor = await h.login('auditor');
    expect((await auditor.get('/api/master/zones').expect(200)).body).toHaveLength(3);
    const templates = (await auditor.get('/api/master/templates').expect(200)).body as { id: string; itemCount: number }[];
    expect(templates.map((t) => t.itemCount)).toEqual([5, 6]);
    await auditor.get(`/api/master/templates/${templates[0]!.id}/items`).expect(200);

    const fixer = await h.login('fixer');
    await fixer.get('/api/master/zones').expect(403);
  });

  it('rejects malformed ids', async () => {
    const auditor = await h.login('auditor');
    await auditor.get("/api/master/templates/abc'%20or%201=1/items").expect(400);
  });
});

describe('audit drafts', () => {
  it('creates a draft with a snapshot of the template items', async () => {
    const auditor = await h.login('auditor');
    const res = await auditor.post('/api/drafts').send({ zoneId: h.repo.zones[0]!.id, templateId: h.repo.templates[0]!.id });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.progress).toEqual({ answered: 0, total: 5 });
  });

  it('rejects unknown zone/template', async () => {
    const auditor = await h.login('auditor');
    await auditor.post('/api/drafts').send({ zoneId: '11111111-1111-1111-1111-111111111111', templateId: h.repo.templates[0]!.id }).expect(400);
  });

  it('drafts are private to their owner', async () => {
    const a1 = await h.login('auditor');
    const a2 = await h.login('auditor2');
    const { draftId } = await createCompletedDraft(h, a1, () => ({ result: 'pass' }));
    await a2.get(`/api/drafts/${draftId}`).expect(404);
    await a2.put(`/api/drafts/${draftId}`).send({ answers: {} }).expect(404);
    await a2.post(`/api/drafts/${draftId}/submit`).expect(404);
    await a2.delete(`/api/drafts/${draftId}`).expect(404);
    expect((await a2.get('/api/drafts').expect(200)).body).toHaveLength(0);
  });

  it('rejects answers for items outside the draft and invalid photo paths', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, () => ({ result: 'pass' }));
    await a.put(`/api/drafts/${draftId}`).send({ answers: { '22222222-2222-2222-2222-222222222222': { result: 'pass' } } }).expect(400);
    const draft = (await a.get(`/api/drafts/${draftId}`)).body as { items: { id: string }[] };
    await a.put(`/api/drafts/${draftId}`).send({ answers: { [draft.items[0]!.id]: { result: 'fail', photo: 'https://evil.example/x.png' } } }).expect(400);
  });

  it('refuses to submit an incomplete checklist and lists what is missing', async () => {
    const a = await h.login('auditor');
    const created = (await a.post('/api/drafts').send({ zoneId: h.repo.zones[0]!.id, templateId: h.repo.templates[0]!.id })).body;
    const res = await a.post(`/api/drafts/${created.id}/submit`);
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(5);
    expect(h.repo.runs).toHaveLength(0);
  });

  it('requires a description for every failed item', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => ({ result: i === 0 ? 'fail' : 'pass' }));
    const res = await a.post(`/api/drafts/${draftId}/submit`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.details)).toContain('mô tả');
    expect(h.repo.runs).toHaveLength(0);
  });

  it('refuses an all-N/A checklist', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, () => ({ result: 'na' }));
    await a.post(`/api/drafts/${draftId}/submit`).expect(400);
  });

  it('refuses assigning to a non-fixer', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => ({
      result: i === 0 ? 'fail' : 'pass',
      extra: i === 0 ? { note: 'Bẩn', assignedTo: 'auditor2@t.local' } : {},
    }));
    await a.post(`/api/drafts/${draftId}/submit`).expect(400);
  });

  it('submits: creates one run with the score and one finding per failed item, then removes the draft', async () => {
    const a = await h.login('auditor');
    const photo = await upload(a);
    // 5 items: 2 fail, 2 pass, 1 N/A  -> score = 2/4 = 50
    const { draftId, items } = await createCompletedDraft(h, a, (i) => {
      if (i === 0) return { result: 'fail', extra: { note: 'Sàn dính dầu', severity: 'High', photo, assignedTo: 'fixer@t.local', dueDate: '2030-01-31' } };
      if (i === 1) return { result: 'fail', extra: { note: 'Thiếu nhãn' } };
      if (i === 2) return { result: 'na' };
      return { result: 'pass' };
    });

    const res = await a.post(`/api/drafts/${draftId}/submit`);
    expect(res.status).toBe(201);
    expect(res.body.run.score).toBe(50);
    expect(res.body.run.auditor).toBe('auditor@t.local');
    expect(res.body.run.zoneTitle).toBe(h.repo.zones[0]!.title);
    expect(res.body.findings).toHaveLength(2);

    expect(h.repo.runs).toHaveLength(1);
    expect(h.repo.findings).toHaveLength(2);
    const first = h.repo.findings.find((f) => f.itemId === items[0]!.id)!;
    expect(first).toMatchObject({ severity: 'High', status: 'Open', assignedTo: 'fixer@t.local', dueDate: '2030-01-31', beforeImage: photo, description: 'Sàn dính dầu' });
    const second = h.repo.findings.find((f) => f.itemId === items[1]!.id)!;
    expect(second).toMatchObject({ severity: 'Medium', assignedTo: null });

    expect(h.store.getDraft(draftId)).toBeNull();
  });

  it('rolls back created rows and keeps the draft when Dataverse fails midway', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => ({ result: i < 3 ? 'fail' : 'pass', extra: i < 3 ? { note: 'x' } : {} }));
    const original = h.repo.createFinding.bind(h.repo);
    let calls = 0;
    h.repo.createFinding = async (input) => {
      if (++calls === 3) throw new Error('boom');
      return original(input);
    };
    const res = await a.post(`/api/drafts/${draftId}/submit`);
    expect(res.status).toBe(500);
    expect(h.repo.runs).toHaveLength(0);
    expect(h.repo.findings).toHaveLength(0);
    expect(h.store.getDraft(draftId)).not.toBeNull();
  });
});

describe('finding lifecycle', () => {
  async function seedFindings() {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => {
      if (i === 0) return { result: 'fail', extra: { note: 'Cho fixer 1', assignedTo: 'fixer@t.local' } };
      if (i === 1) return { result: 'fail', extra: { note: 'Cho fixer 2', assignedTo: 'fixer2@t.local' } };
      if (i === 2) return { result: 'fail', extra: { note: 'Chưa giao' } };
      return { result: 'pass' };
    });
    await a.post(`/api/drafts/${draftId}/submit`).expect(201);
    const byNote = (n: string) => h.repo.findings.find((f) => f.description === n)!;
    return { a, mine: byNote('Cho fixer 1'), theirs: byNote('Cho fixer 2'), pool: byNote('Chưa giao') };
  }

  it('fixers only see their own findings and the unassigned open pool', async () => {
    const { mine, theirs, pool } = await seedFindings();
    const fixer = await h.login('fixer');
    const list = (await fixer.get('/api/findings').expect(200)).body as { id: string }[];
    expect(list.map((f) => f.id).sort()).toEqual([mine.id, pool.id].sort());
    await fixer.get(`/api/findings/${theirs.id}`).expect(404);
    await fixer.post(`/api/findings/${theirs.id}/actions`).send({ type: 'start' }).expect(404);
  });

  it('auditors see every finding', async () => {
    await seedFindings();
    const auditor = await h.login('auditor2');
    expect((await auditor.get('/api/findings').expect(200)).body).toHaveLength(3);
  });

  it('runs the happy path: start -> resolve -> close', async () => {
    const { a, mine } = await seedFindings();
    const fixer = await h.login('fixer');

    const started = await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('In Progress');

    const after = await upload(fixer);
    const resolved = await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'resolve', afterImage: after, note: 'Đã lau sạch' });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'Resolved', afterImage: after });
    expect(resolved.body.description).toContain('Đã xử lý: Đã lau sạch');
    expect(resolved.body.description).toContain('Cho fixer 1');

    const closed = await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'close', note: 'OK' });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('Closed');
  });

  it('a fixer can claim an unassigned finding', async () => {
    const { pool } = await seedFindings();
    const fixer = await h.login('fixer2');
    const res = await fixer.post(`/api/findings/${pool.id}/actions`).send({ type: 'start' }).expect(200);
    expect(res.body).toMatchObject({ status: 'In Progress', assignedTo: 'fixer2@t.local' });
  });

  it('requires an after-photo from our own storage to resolve', async () => {
    const { mine } = await seedFindings();
    const fixer = await h.login('fixer');
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(200);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'resolve' }).expect(400);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'resolve', afterImage: 'https://evil.example/x.png' }).expect(400);
  });

  it('enforces the state machine', async () => {
    const { a, mine } = await seedFindings();
    const fixer = await h.login('fixer');
    const after = await upload(fixer);
    // cannot resolve or close straight from Open
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'resolve', afterImage: after }).expect(409);
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'close' }).expect(409);
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'reopen', note: 'x' }).expect(409);
    // cannot start twice
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(200);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(409);
  });

  it('fixers cannot verify, reopen, assign or edit', async () => {
    const { mine } = await seedFindings();
    const fixer = await h.login('fixer');
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'close' }).expect(403);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'reopen', note: 'x' }).expect(403);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'assign', assignedTo: 'fixer@t.local' }).expect(403);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'update', severity: 'Low' }).expect(403);
  });

  it('auditors cannot do the fixer steps', async () => {
    const { mine } = await seedFindings();
    const a = await h.login('auditor');
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(403);
  });

  it('a different fixer cannot resolve someone elses finding even after it is claimed', async () => {
    const { a, mine } = await seedFindings();
    const f1 = await h.login('fixer');
    await f1.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(200);
    // reassign mid-flight to fixer2, then fixer1 loses access entirely
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'assign', assignedTo: 'fixer2@t.local' }).expect(200);
    await f1.get(`/api/findings/${mine.id}`).expect(404);
  });

  it('reopen requires a reason and sends it back to Open', async () => {
    const { a, mine } = await seedFindings();
    const fixer = await h.login('fixer');
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'start' }).expect(200);
    const after = await upload(fixer);
    await fixer.post(`/api/findings/${mine.id}/actions`).send({ type: 'resolve', afterImage: after }).expect(200);
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'reopen' }).expect(400);
    const res = await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'reopen', note: 'Vẫn còn dầu' }).expect(200);
    expect(res.body.status).toBe('Open');
    expect(res.body.description).toContain('Mở lại: Vẫn còn dầu');
  });

  it('assign validates the assignee is an active fixer', async () => {
    const { a, pool } = await seedFindings();
    await a.post(`/api/findings/${pool.id}/actions`).send({ type: 'assign', assignedTo: 'auditor2@t.local' }).expect(400);
    await a.post(`/api/findings/${pool.id}/actions`).send({ type: 'assign', assignedTo: 'nobody@t.local' }).expect(400);
    h.store.updateUser(h.users.fixer2.id, { active: false });
    await a.post(`/api/findings/${pool.id}/actions`).send({ type: 'assign', assignedTo: 'fixer2@t.local', dueDate: '2030-05-05' }).expect(400);
    const ok = await a.post(`/api/findings/${pool.id}/actions`).send({ type: 'assign', assignedTo: 'fixer@t.local', dueDate: '2030-05-05' }).expect(200);
    expect(ok.body).toMatchObject({ assignedTo: 'fixer@t.local', dueDate: '2030-05-05', assignedToName: 'Fixer' });
  });

  it('flags overdue open findings and filters by them', async () => {
    const { a, pool } = await seedFindings();
    await a.post(`/api/findings/${pool.id}/actions`).send({ type: 'update', dueDate: '2000-01-01' }).expect(200);
    const res = await a.get('/api/findings?overdue=1').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: pool.id, overdue: true });
  });

  it('filters by status, severity and assignee', async () => {
    const { a } = await seedFindings();
    expect((await a.get('/api/findings?status=Open').expect(200)).body).toHaveLength(3);
    expect((await a.get('/api/findings?status=Closed').expect(200)).body).toHaveLength(0);
    expect((await a.get('/api/findings?assignee=unassigned').expect(200)).body).toHaveLength(1);
    expect((await a.get('/api/findings?assignee=fixer@t.local').expect(200)).body).toHaveLength(1);
    await a.get('/api/findings?status=Bogus').expect(400);
  });

  it('rejects malformed action payloads', async () => {
    const { a, mine } = await seedFindings();
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'explode' }).expect(400);
    await a.post(`/api/findings/${mine.id}/actions`).send({ type: 'update', dueDate: 'tomorrow' }).expect(400);
    await a.post('/api/findings/not-a-guid/actions').send({ type: 'close' }).expect(400);
  });
});

describe('runs and stats', () => {
  it('lists runs and run detail with findings (auditors only)', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => ({ result: i === 0 ? 'fail' : 'pass', extra: i === 0 ? { note: 'x' } : {} }));
    const { body } = await a.post(`/api/drafts/${draftId}/submit`).expect(201);

    const list = (await a.get('/api/runs').expect(200)).body as { id: string }[];
    expect(list).toHaveLength(1);
    const detail = (await a.get(`/api/runs/${body.run.id}`).expect(200)).body;
    expect(detail.run.score).toBe(80);
    expect(detail.findings).toHaveLength(1);

    const fixer = await h.login('fixer');
    await fixer.get('/api/runs').expect(403);
  });

  it('stats are scoped: fixers get findings only, auditors also get run aggregates', async () => {
    const a = await h.login('auditor');
    const { draftId } = await createCompletedDraft(h, a, (i) => ({ result: i < 2 ? 'fail' : 'pass', extra: i < 2 ? { note: 'x', assignedTo: 'fixer@t.local' } : {} }));
    await a.post(`/api/drafts/${draftId}/submit`).expect(201);

    const s = (await a.get('/api/stats').expect(200)).body;
    expect(s.findings.open).toBe(2);
    expect(s.runs.count30d).toBe(1);
    expect(s.runs.avgScore30d).toBe(60);
    expect(s.runs.byZone[0]).toMatchObject({ avgScore: 60, openFindings: 2 });

    const fixer = await h.login('fixer');
    const fs = (await fixer.get('/api/stats').expect(200)).body;
    expect(fs.runs).toBeNull();
    expect(fs.findings.mine).toBe(2);
  });
});

describe('uploads', () => {
  it('stores a real image and serves it back to signed-in users only', async () => {
    const a = await h.login('auditor');
    const path = await upload(a);
    expect(path).toMatch(/^\/api\/files\/[a-f0-9]{32}\.png$/);
    expect(path.length).toBeLessThanOrEqual(100); // fits crd1a_beforeimage / crd1a_afterimage (nvarchar 100)
    const got = await a.get(path).expect(200);
    expect(got.headers['content-type']).toContain('image/png');
    await request(h.app).get(path).expect(401);
  });

  it('rejects non-images even when the client claims image/png', async () => {
    const a = await h.login('auditor');
    const res = await a.post('/api/uploads').attach('file', Buffer.from('<svg onload=alert(1)>'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('rejects path traversal on download', async () => {
    const a = await h.login('auditor');
    await a.get('/api/files/..%2f..%2fapp.db').expect(404);
    await a.get('/api/files/not-a-valid-name.png').expect(404);
  });
});
