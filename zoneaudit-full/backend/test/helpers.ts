import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/passwords.js';
import { buildContext } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';
import { Store } from '../src/db.js';
import { MockRepo, seedMockRepo } from '../src/dataverse/mockRepo.js';
import type { GoogleIdentity } from '../src/auth/google.js';

export const PASSWORD = 'Test@12345';

// 1x1 transparent PNG
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export async function makeHarness(env: Record<string, string> = {}) {
  const cfg = loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'x'.repeat(40),
    DATA_DIR: mkdtempSync(join(tmpdir(), 'za-test-')),
    DATAVERSE_MODE: 'mock',
    APP_ORIGIN: 'http://localhost:5173',
    ...env,
  });
  const store = new Store(':memory:');
  const repo = seedMockRepo(new MockRepo());
  let googleIdentity: GoogleIdentity | Error = new Error('no identity set');
  const ctx = await buildContext(cfg, {
    store,
    repo,
    googleVerifier: async () => {
      if (googleIdentity instanceof Error) throw googleIdentity;
      return googleIdentity;
    },
  });
  const app = createApp(ctx);

  const hash = await hashPassword(PASSWORD);
  const users = {
    admin: store.createUser({ email: 'admin@t.local', name: 'Admin', role: 'admin', passwordHash: hash }),
    auditor: store.createUser({ email: 'auditor@t.local', name: 'Auditor', role: 'auditor', passwordHash: hash }),
    auditor2: store.createUser({ email: 'auditor2@t.local', name: 'Auditor Two', role: 'auditor', passwordHash: hash }),
    fixer: store.createUser({ email: 'fixer@t.local', name: 'Fixer', role: 'fixer', passwordHash: hash }),
    fixer2: store.createUser({ email: 'fixer2@t.local', name: 'Fixer Two', role: 'fixer', passwordHash: hash }),
  };

  /** A supertest agent that carries the session cookie. */
  const login = async (who: keyof typeof users) => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: users[who].email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed for ${who}: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  };

  return {
    cfg, ctx, app, store, repo, users, login,
    setGoogleIdentity: (i: GoogleIdentity | Error) => (googleIdentity = i),
  };
}

export type Harness = Awaited<ReturnType<typeof makeHarness>>;

/** Start a draft for the first zone and first template, with every item answered per `plan`. */
export async function createCompletedDraft(
  h: Harness,
  agent: ReturnType<typeof request.agent>,
  plan: (index: number) => { result: 'pass' | 'fail' | 'na'; extra?: Record<string, unknown> },
) {
  const zone = h.repo.zones[0]!;
  const tpl = h.repo.templates[0]!;
  const created = await agent.post('/api/drafts').send({ zoneId: zone.id, templateId: tpl.id });
  if (created.status !== 201) throw new Error(`draft create failed: ${JSON.stringify(created.body)}`);
  const draft = created.body as { id: string; items: { id: string }[] };
  const answers: Record<string, unknown> = {};
  draft.items.forEach((item, i) => {
    const p = plan(i);
    answers[item.id] = { result: p.result, ...(p.extra ?? {}) };
  });
  const saved = await agent.put(`/api/drafts/${draft.id}`).send({ answers });
  if (saved.status !== 200) throw new Error(`draft save failed: ${JSON.stringify(saved.body)}`);
  return { draftId: draft.id, items: draft.items };
}
