import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, makeHarness, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

describe('password login', () => {
  it('logs in with valid credentials and sets an httpOnly cookie', async () => {
    const res = await request(h.app).post('/api/auth/login').send({ email: 'auditor@t.local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'auditor@t.local', role: 'auditor' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('za_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('is case-insensitive on email', async () => {
    const res = await request(h.app).post('/api/auth/login').send({ email: 'AUDITOR@T.LOCAL', password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('rejects wrong password and unknown email with the same message', async () => {
    const a = await request(h.app).post('/api/auth/login').send({ email: 'auditor@t.local', password: 'nope-nope' });
    const b = await request(h.app).post('/api/auth/login').send({ email: 'ghost@t.local', password: 'nope-nope' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('rejects deactivated users', async () => {
    h.store.updateUser(h.users.auditor.id, { active: false });
    const res = await request(h.app).post('/api/auth/login').send({ email: 'auditor@t.local', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('invalidates an existing session when the user is deactivated', async () => {
    const agent = await h.login('auditor');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    h.store.updateUser(h.users.auditor.id, { active: false });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('requires a session for protected routes', async () => {
    expect((await request(h.app).get('/api/findings')).status).toBe(401);
    expect((await request(h.app).get('/api/stats')).status).toBe(401);
  });

  it('logout clears the session cookie', async () => {
    const agent = await h.login('fixer');
    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a forged session token', async () => {
    const res = await request(h.app).get('/api/auth/me').set('Cookie', 'za_session=not.a.jwt');
    expect(res.status).toBe(401);
  });
});

describe('change password', () => {
  it('requires the current password', async () => {
    const agent = await h.login('fixer');
    await agent.post('/api/auth/change-password').send({ currentPassword: 'wrong-wrong', newPassword: 'Another@123' }).expect(401);
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Another@123' }).expect(204);
    await request(h.app).post('/api/auth/login').send({ email: 'fixer@t.local', password: 'Another@123' }).expect(200);
    await request(h.app).post('/api/auth/login').send({ email: 'fixer@t.local', password: PASSWORD }).expect(401);
  });
});

describe('google login', () => {
  const identity = (email: string, extra = {}) => ({ sub: `sub-${email}`, email, emailVerified: true, name: 'G User', ...extra });

  it('logs in a pre-registered email and links the google subject', async () => {
    h.setGoogleIdentity(identity('auditor@t.local'));
    const res = await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('auditor');
  });

  it('refuses unknown accounts by default', async () => {
    h.setGoogleIdentity(identity('stranger@gmail.com'));
    const res = await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) });
    expect(res.status).toBe(403);
    expect(h.store.getUserForLogin('stranger@gmail.com')).toBeNull();
  });

  it('refuses unverified google emails', async () => {
    h.setGoogleIdentity(identity('auditor@t.local', { emailVerified: false }));
    const res = await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) });
    expect(res.status).toBe(401);
  });

  it('refuses when the token cannot be verified', async () => {
    h.setGoogleIdentity(new Error('bad signature'));
    const res = await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) });
    expect(res.status).toBe(401);
  });

  it('refuses a different google account claiming a linked email', async () => {
    h.setGoogleIdentity(identity('auditor@t.local'));
    await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) }).expect(200);
    h.setGoogleIdentity({ ...identity('auditor@t.local'), sub: 'someone-else' });
    await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) }).expect(401);
  });

  it('refuses deactivated users', async () => {
    h.store.updateUser(h.users.fixer.id, { active: false });
    h.setGoogleIdentity(identity('fixer@t.local'));
    await request(h.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) }).expect(403);
  });

  it('auto-provisions within allowed domains when configured', async () => {
    const h2 = await makeHarness({ GOOGLE_AUTO_PROVISION_ROLE: 'fixer', GOOGLE_ALLOWED_DOMAINS: 'corp.com' });
    h2.setGoogleIdentity(identity('new@corp.com'));
    const ok = await request(h2.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('fixer');

    h2.setGoogleIdentity(identity('new@other.com'));
    await request(h2.app).post('/api/auth/google').send({ credential: 'x'.repeat(20) }).expect(403);
  });
});

describe('csrf origin guard', () => {
  it('blocks state-changing requests from a foreign origin', async () => {
    const res = await request(h.app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'auditor@t.local', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('allows the configured origin', async () => {
    const res = await request(h.app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send({ email: 'auditor@t.local', password: PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe('user management', () => {
  it('only admins can list/create/update users', async () => {
    const auditor = await h.login('auditor');
    await auditor.get('/api/users').expect(403);
    await auditor.post('/api/users').send({ email: 'x@t.local', name: 'X', role: 'fixer', password: 'Password@1' }).expect(403);

    const admin = await h.login('admin');
    const created = await admin.post('/api/users').send({ email: 'new@t.local', name: 'New', role: 'fixer', password: 'Password@1' });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();
    await admin.post('/api/users').send({ email: 'NEW@t.local', name: 'Dup', role: 'fixer' }).expect(409);
    await request(h.app).post('/api/auth/login').send({ email: 'new@t.local', password: 'Password@1' }).expect(200);
  });

  it('keeps at least one active admin', async () => {
    const admin = await h.login('admin');
    await admin.patch(`/api/users/${h.users.admin.id}`).send({ role: 'auditor' }).expect(400);
    await admin.patch(`/api/users/${h.users.admin.id}`).send({ active: false }).expect(400);
  });

  it('assignable list is limited to fixers and exposes minimal fields', async () => {
    const auditor = await h.login('auditor');
    const res = await auditor.get('/api/users/assignable').expect(200);
    const emails = (res.body as { email: string }[]).map((u) => u.email);
    expect(emails).toContain('fixer@t.local');
    expect(emails).not.toContain('auditor@t.local');
    expect(res.body[0]).not.toHaveProperty('createdAt');
    const fixer = await h.login('fixer');
    await fixer.get('/api/users/assignable').expect(403);
  });
});
