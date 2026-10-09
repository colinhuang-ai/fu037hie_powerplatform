import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, PageHeader, ROLE_LABEL } from '../ui';

export default function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.changePassword(user?.hasPassword ? current : undefined, next);
      setCurrent('');
      setNext('');
      setMsg({ kind: 'success', text: 'Đã đổi mật khẩu.' });
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Tài khoản" />
      <div className="card stack" style={{ maxWidth: 480 }}>
        <dl className="dl" style={{ margin: 0 }}>
          <dt>Họ tên</dt><dd>{user?.name}</dd>
          <dt>Email</dt><dd>{user?.email}</dd>
          <dt>Vai trò</dt><dd>{user && ROLE_LABEL[user.role]}</dd>
        </dl>
        <form className="stack" onSubmit={submit}>
          <h2>{user?.hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu (để đăng nhập bằng email + mật khẩu)'}</h2>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          {user?.hasPassword && (
            <label className="field">Mật khẩu hiện tại<input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
          )}
          <label className="field">Mật khẩu mới (tối thiểu 8 ký tự)<input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <div><button className="btn primary" disabled={busy}>Lưu</button></div>
        </form>
      </div>
    </>
  );
}
