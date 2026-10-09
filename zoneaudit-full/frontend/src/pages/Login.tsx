import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import GoogleButton from '../components/GoogleButton';

export default function Login() {
  const { login, loginGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<{ googleClientId: string | null; mock: boolean } | null>(null);

  useEffect(() => {
    api.config().then(setCfg).catch(() => setCfg({ googleClientId: null, mock: false }));
  }, []);

  const onGoogle = useCallback(
    async (credential: string) => {
      setError(null);
      try {
        await loginGoogle(credential);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [loginGoogle],
  );
  const onGoogleError = useCallback((m: string) => setError(m), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card stack">
        <div className="center">
          <div className="brand-mark" style={{ margin: '0 auto .6rem', width: 44, height: 44, fontSize: '1.4rem' }}>✓</div>
          <h1>Zone Audit</h1>
          <p className="muted">Đăng nhập để kiểm tra và khắc phục sự cố</p>
        </div>

        {error && <div className="alert error" role="alert">{error}</div>}

        {cfg?.googleClientId && (
          <>
            <GoogleButton clientId={cfg.googleClientId} onCredential={onGoogle} onError={onGoogleError} />
            <div className="divider">hoặc</div>
          </>
        )}

        <form className="stack" onSubmit={submit}>
          <label className="field">
            Email
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <label className="field">
            Mật khẩu
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>

        {cfg?.mock && (
          <div className="alert info small">
            <strong>Chế độ demo (dữ liệu giả lập).</strong>
            <br />
            auditor@demo.local · fixer@demo.local · admin@demo.local
            <br />
            Mật khẩu: Demo@12345
          </div>
        )}
      </div>
    </div>
  );
}
