import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { DataverseClient } from '../src/dataverse/client.js';
import { fromDvDate, isDateOnly, toDvDate } from '../src/dataverse/dates.js';
import { LiveRepo } from '../src/dataverse/liveRepo.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { computeScore } from '../src/services/audit.js';

describe('dates', () => {
  it('round-trips a calendar day regardless of viewer timezone', () => {
    const wire = toDvDate('2026-10-01')!;
    expect(wire).toBe('2026-10-01T12:00:00Z');
    expect(fromDvDate(wire, 'Asia/Ho_Chi_Minh')).toBe('2026-10-01');
    expect(fromDvDate(wire, 'America/New_York')).toBe('2026-10-01');
  });

  it('reads values written by the model-driven app at local midnight (UTC+7)', () => {
    expect(fromDvDate('2026-09-30T17:00:00Z', 'Asia/Ho_Chi_Minh')).toBe('2026-10-01');
  });

  it('passes through date-only values and nulls', () => {
    expect(fromDvDate('2026-10-01', 'Asia/Ho_Chi_Minh')).toBe('2026-10-01');
    expect(fromDvDate(null, 'UTC')).toBeNull();
    expect(toDvDate(null)).toBeNull();
  });

  it('validates date strings', () => {
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2026-10-1')).toBe(false);
    expect(isDateOnly('2026-10-01')).toBe(true);
  });
});

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('Secret@123');
    const b = await hashPassword('Secret@123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Secret@123', a)).toBe(true);
    expect(await verifyPassword('secret@123', a)).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('scoring', () => {
  it('ignores N/A and rounds', () => {
    expect(computeScore({ a: { result: 'pass' }, b: { result: 'pass' }, c: { result: 'fail' }, d: { result: 'na' } })).toMatchObject({ pass: 2, fail: 1, na: 1, score: 67 });
    expect(computeScore({ a: { result: 'na' } }).score).toBeNull();
    expect(computeScore({ a: { result: null } }).score).toBeNull();
  });
});

describe('config', () => {
  it('refuses mock Dataverse and a missing secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(40) })).toThrow(/Mock Dataverse/);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATAVERSE_URL: 'https://o.crm.dynamics.com', AZURE_TENANT_ID: 't', AZURE_CLIENT_ID: 'c', AZURE_CLIENT_SECRET: 's' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('treats empty strings from .env as unset', () => {
    const cfg = loadConfig({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: '', DATAVERSE_URL: '', SESSION_SECRET: '' });
    expect(cfg.google.clientId).toBeUndefined();
    expect(cfg.dataverse.mode).toBe('mock');
  });
});

/** Verifies the exact wire format sent to Dataverse (field names, bind syntax, choice values, escaping). */
describe('LiveRepo wire format', () => {
  function setup(responder: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      if (url.includes('login.microsoftonline.com')) return Response.json({ access_token: 'tok', expires_in: 3600 });
      calls.push({ url, init });
      const r = responder(url, init);
      return Response.json(r.body, { status: r.status ?? 200 });
    });
    const dv = new DataverseClient({ url: 'https://org.crm.dynamics.com', tenantId: 'tid', clientId: 'cid', clientSecret: 'sec' }, fetchMock as unknown as typeof fetch);
    return { repo: new LiveRepo(dv, 'Asia/Ho_Chi_Minh'), calls, fetchMock };
  }

  it('creates a finding with lookup binds, choice values and noon-UTC due date', async () => {
    const { repo, calls } = setup(() => ({
      body: { crd1a_auditfindingid: 'f1', crd1a_title: 'T', crd1a_severity: 982560002, crd1a_status: 982560000, crd1a_duedate: '2026-10-05T12:00:00Z', _crd1a_auditrun_value: 'r', _crd1a_audititem_value: 'i', createdon: 'x', modifiedon: 'y' },
    }));
    const runId = '11111111-1111-1111-1111-111111111111';
    const itemId = '22222222-2222-2222-2222-222222222222';
    const f = await repo.createFinding({ title: 'T', description: 'd', severity: 'Critical', dueDate: '2026-10-05', assignedTo: 'a@b.c', beforeImage: null, runId, itemId });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(calls[0]!.url).toBe('https://org.crm.dynamics.com/api/data/v9.2/crd1a_auditfindings');
    expect(body).toMatchObject({
      crd1a_severity: 982560002, // Critical (not the 4th in order!)
      crd1a_status: 982560000,
      crd1a_duedate: '2026-10-05T12:00:00Z',
      'crd1a_AuditRun@odata.bind': `/crd1a_auditruns(${runId})`,
      'crd1a_AuditItem@odata.bind': `/crd1a_audititems(${itemId})`,
    });
    expect(f).toMatchObject({ severity: 'Critical', status: 'Open', dueDate: '2026-10-05' });
  });

  it('maps every severity and status number from the real solution', async () => {
    const { repo } = setup(() => ({
      body: { value: [
        { crd1a_auditfindingid: 'a', crd1a_severity: 982560000, crd1a_status: 982560003 },
        { crd1a_auditfindingid: 'b', crd1a_severity: 982560001, crd1a_status: 982560001 },
        { crd1a_auditfindingid: 'c', crd1a_severity: 982560002, crd1a_status: 982560002 },
        { crd1a_auditfindingid: 'd', crd1a_severity: 982560003, crd1a_status: 982560000 },
      ] },
    }));
    const rows = await repo.listFindings();
    expect(rows.map((r) => [r.severity, r.status])).toEqual([['High', 'Closed'], ['Medium', 'In Progress'], ['Critical', 'Resolved'], ['Low', 'Open']]);
  });

  it('escapes quotes in OData filters and rejects non-GUID ids', async () => {
    const { repo, calls } = setup(() => ({ body: { value: [] } }));
    await repo.listFindings({ assignedTo: "o'brien+qa&x@x.com" });
    expect(calls[0]!.url).toContain("crd1a_assignedto eq 'o''brien%2Bqa%26x%40x.com'");
    await expect(repo.getFinding("x' or 1 eq 1")).rejects.toThrow(/Invalid GUID/);
    await expect(repo.listItems('not-a-guid')).rejects.toThrow(/Invalid GUID/);
  });

  it('follows @odata.nextLink pages and only reads active rows', async () => {
    let page = 0;
    const { repo, calls } = setup(() =>
      page++ === 0
        ? { body: { value: [{ crd1a_zoneid: 'z1', crd1a_title: 'A' }], '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/crd1a_zones?$skiptoken=abc' } }
        : { body: { value: [{ crd1a_zoneid: 'z2', crd1a_title: 'B' }] } },
    );
    const zones = await repo.listZones();
    expect(zones.map((z) => z.id)).toEqual(['z1', 'z2']);
    expect(decodeURIComponent(calls[0]!.url)).toContain('statecode eq 0');
  });

  it('updates with If-Match so a PATCH can never upsert, and clears fields with null', async () => {
    const { repo, calls } = setup(() => ({ body: { crd1a_auditfindingid: 'f', crd1a_status: 982560001 } }));
    await repo.updateFinding('11111111-1111-1111-1111-111111111111', { status: 'In Progress', assignedTo: null });
    const init = calls[0]!.init;
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('*');
    expect(JSON.parse(String(init.body))).toEqual({ crd1a_status: 982560001, crd1a_assignedto: null });
  });

  it('creates a run bound to its zone', async () => {
    const { repo, calls } = setup(() => ({ body: { crd1a_auditrunid: 'r', _crd1a_zone_value: 'z', crd1a_score: 80, createdon: 'x' } }));
    const zoneId = '33333333-3333-3333-3333-333333333333';
    await repo.createRun({ title: 'T', zoneId, auditDate: '2026-10-01', auditor: 'a@b.c', score: 80 });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ crd1a_score: 80, 'crd1a_Zone@odata.bind': `/crd1a_zones(${zoneId})`, crd1a_auditdate: '2026-10-01T12:00:00Z' });
  });

  it('retries once on 401 with a fresh token and surfaces Dataverse errors', async () => {
    let n = 0;
    const { repo, fetchMock } = setup(() => (n++ === 0 ? { status: 401, body: {} } : { body: { value: [] } }));
    await repo.listZones();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('login.microsoftonline.com'))).toHaveLength(2);

    const bad = setup(() => ({ status: 400, body: { error: { message: 'nope' } } }));
    await expect(bad.repo.listZones()).rejects.toThrow(/nope/);
  });
});

describe('optimistic concurrency', () => {
  const finding = { crd1a_auditfindingid: 'f', crd1a_status: 982560001, '@odata.etag': 'W/"123"' };

  it('sends the row etag as If-Match and maps 412 to a 409 conflict', async () => {
    const calls: RequestInit[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      if (String(input).includes('login.microsoftonline.com')) return Response.json({ access_token: 't', expires_in: 3600 });
      calls.push(init);
      return init.method === 'PATCH' ? Response.json({ error: { message: 'etag mismatch' } }, { status: 412 }) : Response.json(finding);
    });
    const repo = new LiveRepo(new DataverseClient({ url: 'https://o.crm.dynamics.com', tenantId: 't', clientId: 'c', clientSecret: 's' }, fetchMock as unknown as typeof fetch), 'UTC');
    const f = await repo.getFinding('11111111-1111-1111-1111-111111111111');
    expect(f!.etag).toBe('W/"123"');
    await expect(repo.updateFinding('11111111-1111-1111-1111-111111111111', { status: 'Resolved' }, f!.etag)).rejects.toMatchObject({ status: 409 });
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect((patch.headers as Record<string, string>)['If-Match']).toBe('W/"123"');
  });

  it('mock repo rejects a stale etag', async () => {
    const { MockRepo } = await import('../src/dataverse/mockRepo.js');
    const repo = new MockRepo();
    const f = await repo.createFinding({ title: 't', description: null, severity: 'Low', dueDate: null, assignedTo: null, beforeImage: null, runId: 'r', itemId: 'i' });
    await repo.updateFinding(f.id, { status: 'In Progress' }, f.etag);
    await expect(repo.updateFinding(f.id, { status: 'In Progress', assignedTo: 'x' }, f.etag)).rejects.toMatchObject({ status: 409 });
  });
});
