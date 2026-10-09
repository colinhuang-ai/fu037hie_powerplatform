import { z } from 'zod';

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyToUndef, schema.optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  /** Browser origin(s) allowed to call the API (comma separated). Used for the CSRF Origin check. */
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),

  SESSION_SECRET: opt(z.string().min(32, 'SESSION_SECRET must be at least 32 characters')),
  SESSION_HOURS: z.coerce.number().positive().default(12),
  COOKIE_SECURE: opt(z.enum(['true', 'false'])),
  /** Set to true when running behind a reverse proxy so rate limiting sees the real client IP. */
  TRUST_PROXY: opt(z.enum(['true', 'false'])),

  DATA_DIR: z.string().default('./data'),

  // Dataverse (live mode). When any is missing the app falls back to the in-memory mock.
  DATAVERSE_MODE: opt(z.enum(['live', 'mock'])),
  DATAVERSE_URL: opt(z.string().url()),
  AZURE_TENANT_ID: opt(z.string()),
  AZURE_CLIENT_ID: opt(z.string()),
  AZURE_CLIENT_SECRET: opt(z.string()),

  // Google sign-in
  GOOGLE_CLIENT_ID: opt(z.string()),
  /** If set, unknown (verified) Google accounts are auto-created with this role. Empty = only pre-registered emails. */
  GOOGLE_AUTO_PROVISION_ROLE: opt(z.enum(['auditor', 'fixer'])),
  GOOGLE_ALLOWED_DOMAINS: opt(z.string()),

  // First admin (created on startup when the user table is empty)
  ADMIN_EMAIL: opt(z.string().email()),
  ADMIN_PASSWORD: opt(z.string().min(8)),
  ADMIN_NAME: z.string().default('Administrator'),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  appOrigins: string[];
  timezone: string;
  sessionSecret: string;
  sessionHours: number;
  cookieSecure: boolean;
  trustProxy: boolean;
  dataDir: string;
  dataverse: { mode: 'live' | 'mock'; url?: string; tenantId?: string; clientId?: string; clientSecret?: string };
  google: { clientId?: string; autoProvisionRole?: 'auditor' | 'fixer'; allowedDomains: string[] };
  admin: { email?: string; password?: string; name: string };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const e = EnvSchema.parse(source);
  const isProd = e.NODE_ENV === 'production';

  const hasDv = !!(e.DATAVERSE_URL && e.AZURE_TENANT_ID && e.AZURE_CLIENT_ID && e.AZURE_CLIENT_SECRET);
  const mode = e.DATAVERSE_MODE ?? (hasDv ? 'live' : 'mock');
  if (mode === 'live' && !hasDv) {
    throw new Error('DATAVERSE_MODE=live requires DATAVERSE_URL, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
  }
  if (isProd && mode === 'mock') {
    throw new Error('Mock Dataverse is not allowed in production. Configure the DATAVERSE_* / AZURE_* variables.');
  }

  let sessionSecret = e.SESSION_SECRET;
  if (!sessionSecret) {
    if (isProd) throw new Error('SESSION_SECRET is required in production');
    sessionSecret = 'dev-only-secret-dev-only-secret-dev-only-secret';
  }

  return {
    env: e.NODE_ENV,
    port: e.PORT,
    appOrigins: e.APP_ORIGIN.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
    timezone: e.APP_TIMEZONE,
    sessionSecret,
    sessionHours: e.SESSION_HOURS,
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : isProd,
    trustProxy: e.TRUST_PROXY === 'true',
    dataDir: e.DATA_DIR,
    dataverse: {
      mode,
      url: e.DATAVERSE_URL?.replace(/\/$/, ''),
      tenantId: e.AZURE_TENANT_ID,
      clientId: e.AZURE_CLIENT_ID,
      clientSecret: e.AZURE_CLIENT_SECRET,
    },
    google: {
      clientId: e.GOOGLE_CLIENT_ID,
      autoProvisionRole: e.GOOGLE_AUTO_PROVISION_ROLE,
      allowedDomains: (e.GOOGLE_ALLOWED_DOMAINS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    },
    admin: { email: e.ADMIN_EMAIL, password: e.ADMIN_PASSWORD, name: e.ADMIN_NAME },
  };
}
