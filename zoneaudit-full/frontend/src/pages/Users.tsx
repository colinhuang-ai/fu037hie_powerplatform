import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { type Role } from '../types';
import { Alert, Loading, PageHeader, ROLE_LABEL, fmtDateTime, useAsync } from '../ui';

const ROLES: Role[] = ['auditor', 'fixer', 'admin'];

export default function Users() {
  const { user: me } = useAuth();
  const { data, error, reload } = useAsync(() => api.users(), []);
  const [form, setForm] = useState({ email: '', name: '', role: 'fixer' as Role, password: '' });
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.createUser({ ...form, password: form.password || undefined });
      setForm({ email: '', name: '', role: 'fixer', password: '' });
      setMsg({ kind: 'success', text: 'Đã tạo người dùng.' });
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, patch: Parameters<typeof api.updateUser>[1]) => {
    setMsg(null);
    try {
      await api.updateUser(id, patch);
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    }
  };

  const resetPassword = (id: string, name: string) => {
    const pw = prompt(`Mật khẩu mới cho ${name} (tối thiểu 8 ký tự):`);
    if (pw) update(id, { password: pw });
  };

  if (!data) return <Loading error={error} />;

  return (
    <>
      <PageHeader title="Người dùng" sub="Tài khoản Auditor, Fixer và Admin. Đăng nhập Google chỉ dành cho email đã được thêm ở đây." />
      {msg && <div style={{ marginBottom: '1rem' }}><Alert kind={msg.kind}>{msg.text}</Alert></div>}

      <form className="card stack" onSubmit={create}>
        <h2>Thêm người dùng</h2>
        <div className="form-grid">
          <label className="field">Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field">Họ tên<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">
            Vai trò
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="field">
            Mật khẩu (bỏ trống = chỉ đăng nhập Google)
            <input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
        </div>
        <div><button className="btn primary" disabled={busy}>Thêm</button></div>
      </form>

      <section className="card flush table-wrap mt">
        <table>
          <thead>
            <tr><th>Người dùng</th><th>Vai trò</th><th>Đăng nhập</th><th>Lần cuối</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="muted small">{u.email}</div>
                </td>
                <td>
                  <select value={u.role} aria-label={`Vai trò của ${u.name}`} onChange={(e) => update(u.id, { role: e.target.value })} style={{ width: 'auto' }}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="small">{u.hasPassword ? 'Mật khẩu' : ''}{u.hasPassword ? ' · ' : ''}Google</td>
                <td className="small muted">{fmtDateTime(u.lastLogin)}</td>
                <td>{u.active ? <span className="badge score-good">Hoạt động</span> : <span className="badge">Đã khóa</span>}</td>
                <td className="row gap">
                  <button className="btn sm" onClick={() => resetPassword(u.id, u.name)}>Đặt mật khẩu</button>
                  <button className="btn sm" disabled={u.id === me?.id} onClick={() => update(u.id, { active: !u.active })}>{u.active ? 'Khóa' : 'Mở khóa'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
