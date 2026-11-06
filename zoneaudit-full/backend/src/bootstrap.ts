import { resolve } from 'node:path';
import { createGoogleVerifier, type GoogleVerifier } from './auth/google.js';
import { hashPassword } from './auth/passwords.js';
import type { Config } from './config.js';
import { Store } from './db.js';
import { DataverseClient } from './dataverse/client.js';
import { LiveRepo } from './dataverse/liveRepo.js';
import { MockRepo, seedMockRepo } from './dataverse/mockRepo.js';
import { DEMO_USERS, seedDemoData } from './dataverse/seedDemo.js';
import type { Repo } from './dataverse/types.js';
import { MasterCache, type AppContext } from './services/context.js';

export interface BuildOptions {
  repo?: Repo;
  store?: Store;
  googleVerifier?: GoogleVerifier;
}

export async function buildContext(cfg: Config, opts: BuildOptions = {}): Promise<AppContext> {
  const store = opts.store ?? new Store(resolve(cfg.dataDir, 'app.db'));

  let repo = opts.repo;
  if (!repo) {
    if (cfg.dataverse.mode === 'live') {
      const dv = cfg.dataverse;
      repo = new LiveRepo(new DataverseClient({ url: dv.url!, tenantId: dv.tenantId!, clientId: dv.clientId!, clientSecret: dv.clientSecret! }), cfg.timezone);
    } else {
      const mock = seedMockRepo(new MockRepo());
      console.warn('[dataverse] MOCK mode: using in-memory sample data (set DATAVERSE_URL / AZURE_* for the real environment)');
      if (cfg.demoSeed) {
        const n = seedDemoData(mock, { uploadsDir: resolve(cfg.dataDir, 'uploads'), timezone: cfg.timezone });
        console.log(`[demo] seeded ${n.zones} zones, ${n.templates} templates, ${n.runs} runs, ${n.findings} findings (DEMO_SEED=off to disable)`);
      }
      repo = mock;
    }
  }

  await seedUsers(cfg, store);

  const googleVerifier = opts.googleVerifier ?? (cfg.google.clientId ? createGoogleVerifier(cfg.google.clientId) : undefined);
  return { cfg, store, repo, googleVerifier, master: new MasterCache(repo) };
}

/** Creates the admin from env on first run; demo accounts are topped up every start in development + mock mode. */
async function seedUsers(cfg: Config, store: Store) {
  if (store.countUsers() === 0 && cfg.admin.email && cfg.admin.password) {
    store.createUser({ email: cfg.admin.email, name: cfg.admin.name, role: 'admin', passwordHash: await hashPassword(cfg.admin.password) });
    console.log(`[auth] created admin ${cfg.admin.email}`);
  }

  // The seeded findings are assigned to these addresses, so missing ones are re-created rather than seeded once.
  if (cfg.env === 'development' && cfg.dataverse.mode === 'mock') {
    for (const d of DEMO_USERS) {
      if (!store.getUserForLogin(d.email)) store.createUser({ ...d, passwordHash: await hashPassword('Demo@12345') });
    }
    console.log(`[auth] demo accounts (password Demo@12345): ${DEMO_USERS.map((d) => d.email).join(', ')}`);
  }

  if (store.countUsers() === 0) {
    console.warn('[auth] No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart to create the first admin.');
  }
}
