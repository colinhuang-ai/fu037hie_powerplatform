import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../ui';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">✓</span> Zone Audit
          </NavLink>
          <nav className="nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>Tổng quan</NavLink>
            {can('auditor') && <NavLink to="/audit">Kiểm tra mới</NavLink>}
            {can('auditor') && <NavLink to="/runs">Lượt kiểm tra</NavLink>}
            <NavLink to="/findings">{user.role === 'fixer' ? 'Việc cần xử lý' : 'Sự cố'}</NavLink>
            {user.role === 'admin' && <NavLink to="/users">Người dùng</NavLink>}
          </nav>
          <div className="user-chip">
            <div className="who">
              <div>{user.name}</div>
              <div className="muted small">{ROLE_LABEL[user.role]}</div>
            </div>
            <NavLink to="/account" className="btn sm">Tài khoản</NavLink>
            <button
              className="btn sm"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </>
  );
}
