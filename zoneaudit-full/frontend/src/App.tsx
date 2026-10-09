import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import type { Role } from './types';
import { Loading } from './ui';
import Account from './pages/Account';
import AuditChecklist from './pages/AuditChecklist';
import Dashboard from './pages/Dashboard';
import FindingDetail from './pages/FindingDetail';
import Findings from './pages/Findings';
import Login from './pages/Login';
import NewAudit from './pages/NewAudit';
import RunDetail from './pages/RunDetail';
import Runs from './pages/Runs';
import Users from './pages/Users';

function Guard({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !can(...roles)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <Loading /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Guard><Dashboard /></Guard>} />
      <Route path="/audit" element={<Guard roles={['auditor']}><NewAudit /></Guard>} />
      <Route path="/audit/:id" element={<Guard roles={['auditor']}><AuditChecklist /></Guard>} />
      <Route path="/runs" element={<Guard roles={['auditor']}><Runs /></Guard>} />
      <Route path="/runs/:id" element={<Guard roles={['auditor']}><RunDetail /></Guard>} />
      <Route path="/findings" element={<Guard><Findings /></Guard>} />
      <Route path="/findings/:id" element={<Guard><FindingDetail /></Guard>} />
      <Route path="/users" element={<Guard roles={[]}><Users /></Guard>} />
      <Route path="/account" element={<Guard><Account /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
