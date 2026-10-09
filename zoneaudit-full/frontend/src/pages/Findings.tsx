import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import FindingRow from '../components/FindingRow';
import { SEVERITIES, STATUSES } from '../types';
import { Loading, PageHeader, SEVERITY_LABEL, STATUS_LABEL, useAsync } from '../ui';

export default function Findings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const severity = params.get('severity') ?? '';
  const assignee = params.get('assignee') ?? '';
  const overdue = params.get('overdue') ?? '';
  const q = params.get('q') ?? '';

  // Search is debounced locally; the other filters live in the URL so views are linkable from the dashboard.
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => set('q', search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const set = (key: string, value: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (value) n.set(key, value);
      else n.delete(key);
      return n;
    }, { replace: true });

  const { data, error, loading } = useAsync(() => api.findings({ status, severity, assignee, overdue, q }), [status, severity, assignee, overdue, q]);
  const isFixer = user?.role === 'fixer';

  return (
    <>
      <PageHeader title={isFixer ? 'Việc cần xử lý' : 'Sự cố'} sub={data ? `${data.length} kết quả` : undefined} />

      <div className="filters">
        <label className="field">
          Trạng thái
          <select value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Tất cả</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field">
          Mức độ
          <select value={severity} onChange={(e) => set('severity', e.target.value)}>
            <option value="">Tất cả</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field">
          Người xử lý
          <select value={assignee} onChange={(e) => set('assignee', e.target.value)}>
            <option value="">Tất cả</option>
            <option value="me">Của tôi</option>
            <option value="unassigned">Chưa giao</option>
          </select>
        </label>
        <label className="field">
          Tìm kiếm
          <input type="search" value={search} placeholder="Tiêu đề, khu vực…" onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="row gap small" style={{ paddingBottom: '.65rem' }}>
          <input type="checkbox" checked={!!overdue} onChange={(e) => set('overdue', e.target.checked ? '1' : '')} />
          Chỉ quá hạn
        </label>
      </div>

      {!data ? (
        <Loading error={error} />
      ) : (
        <section className="card flush" style={{ opacity: loading ? 0.6 : 1 }}>
          {data.length === 0 && <p className="muted pad center">Không có sự cố nào khớp bộ lọc.</p>}
          {data.map((f) => <FindingRow key={f.id} f={f} />)}
        </section>
      )}
    </>
  );
}
