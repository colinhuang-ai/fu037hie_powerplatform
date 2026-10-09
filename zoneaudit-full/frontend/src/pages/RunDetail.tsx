import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import FindingRow from '../components/FindingRow';
import { Loading, PageHeader, ScoreBadge, fmtDate, useAsync } from '../ui';

export default function RunDetail() {
  const { id = '' } = useParams();
  const { data, error } = useAsync(() => api.run(id), [id]);
  if (!data) return <Loading error={error} />;
  const { run, findings } = data;
  const open = findings.filter((f) => f.status === 'Open' || f.status === 'In Progress').length;

  return (
    <>
      <PageHeader title={run.title} sub={<Link to="/runs">← Tất cả lượt kiểm tra</Link>} />
      <div className="card" style={{ marginBottom: '1rem' }}>
        <dl className="dl" style={{ margin: 0 }}>
          <dt>Khu vực</dt><dd>{run.zoneTitle ?? '—'}</dd>
          <dt>Ngày kiểm tra</dt><dd>{fmtDate(run.auditDate)}</dd>
          <dt>Auditor</dt><dd>{run.auditorName ?? run.auditor ?? '—'}</dd>
          <dt>Điểm</dt><dd><ScoreBadge score={run.score} /></dd>
          <dt>Sự cố</dt><dd>{findings.length} (còn mở: {open})</dd>
        </dl>
      </div>
      <section className="card flush">
        {findings.length === 0 && <p className="muted pad center">Không có sự cố nào trong lượt kiểm tra này.</p>}
        {findings.map((f) => <FindingRow key={f.id} f={f} />)}
      </section>
    </>
  );
}
