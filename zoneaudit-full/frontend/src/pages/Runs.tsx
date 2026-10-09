import { Link } from 'react-router-dom';
import { api } from '../api';
import { Loading, PageHeader, ScoreBadge, fmtDate, useAsync } from '../ui';

export default function Runs() {
  const { data, error } = useAsync(() => api.runs(), []);
  if (!data) return <Loading error={error} />;
  return (
    <>
      <PageHeader title="Lượt kiểm tra" sub={`${data.length} lượt`} actions={<Link to="/audit" className="btn primary">+ Kiểm tra mới</Link>} />
      <section className="card flush table-wrap">
        {data.length === 0 ? (
          <p className="muted pad center">Chưa có lượt kiểm tra nào.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Ngày</th><th>Lượt kiểm tra</th><th>Khu vực</th><th>Auditor</th><th>Điểm</th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.auditDate)}</td>
                  <td><Link to={`/runs/${r.id}`}>{r.title}</Link></td>
                  <td>{r.zoneTitle ?? '—'}</td>
                  <td>{r.auditorName ?? r.auditor ?? '—'}</td>
                  <td><ScoreBadge score={r.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
