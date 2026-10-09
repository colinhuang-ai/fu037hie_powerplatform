import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { SEVERITIES } from '../types';
import { Loading, PageHeader, SEVERITY_LABEL, ScoreBadge, fmtDate, useAsync } from '../ui';

const tone = (s: number) => (s >= 90 ? 'good' : s >= 70 ? 'warn' : 'bad');

export default function Dashboard() {
  const { user, can } = useAuth();
  const { data, error } = useAsync(() => api.stats(), []);
  if (!data) return <Loading error={error} />;
  const f = data.findings;
  const isFixer = user?.role === 'fixer';
  const totalOpenSev = SEVERITIES.reduce((n, s) => n + f.bySeverity[s], 0) || 1;

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user?.name}`}
        sub={isFixer ? 'Các sự cố đã giao cho bạn và hàng chờ chưa ai nhận.' : 'Tình hình kiểm tra và khắc phục trong 30 ngày qua.'}
        actions={can('auditor') && <Link to="/audit" className="btn primary">+ Kiểm tra mới</Link>}
      />

      <div className="grid cols-4">
        {isFixer && (
          <Link to="/findings?assignee=me" className="card kpi">
            <div className="num">{f.mine}</div>
            <div className="lbl">Việc của tôi đang mở</div>
          </Link>
        )}
        <Link to="/findings?status=Open" className="card kpi">
          <div className="num">{f.open}</div>
          <div className="lbl">Mở</div>
        </Link>
        <Link to="/findings?status=In Progress" className="card kpi">
          <div className="num">{f.inProgress}</div>
          <div className="lbl">Đang xử lý</div>
        </Link>
        {!isFixer && (
          <Link to="/findings?status=Resolved" className="card kpi">
            <div className="num">{f.resolved}</div>
            <div className="lbl">Chờ xác nhận</div>
          </Link>
        )}
        <Link to="/findings?overdue=1" className={`card kpi ${f.overdue ? 'bad' : ''}`}>
          <div className="num">{f.overdue}</div>
          <div className="lbl">Quá hạn</div>
        </Link>
      </div>

      <div className="grid cols-2 mt">
        <section className="card">
          <h2>Sự cố đang mở theo mức độ</h2>
          <div className="stack">
            {SEVERITIES.map((s) => (
              <div key={s}>
                <div className="row between small">
                  <span>{SEVERITY_LABEL[s]}</span>
                  <strong>{f.bySeverity[s]}</strong>
                </div>
                <div className={`meter ${s === 'Critical' || s === 'High' ? 'bad' : s === 'Medium' ? 'warn' : ''}`}>
                  <span style={{ width: `${(f.bySeverity[s] / totalOpenSev) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {data.runs && (
          <section className="card">
            <h2>Điểm trung bình theo khu vực (30 ngày)</h2>
            {data.runs.byZone.length === 0 && <p className="muted">Chưa có lượt kiểm tra nào.</p>}
            <div className="stack">
              {data.runs.byZone.map((z) => (
                <div key={z.zoneId}>
                  <div className="row between small">
                    <span>{z.zoneTitle} <span className="muted">· {z.runs} lượt · {z.openFindings} sự cố mở</span></span>
                    <strong>{z.avgScore}%</strong>
                  </div>
                  <div className={`meter ${tone(z.avgScore)}`}><span style={{ width: `${z.avgScore}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {data.runs && (
        <section className="card flush mt">
          <div style={{ padding: '1rem 1rem 0' }} className="row between">
            <h2>Lượt kiểm tra gần đây</h2>
            <Link to="/runs" className="small">Xem tất cả</Link>
          </div>
          {data.runs.latest.length === 0 && <p className="muted pad">Chưa có lượt kiểm tra nào.</p>}
          {data.runs.latest.map((r) => (
            <Link key={r.id} to={`/runs/${r.id}`} className="list-item row between gap">
              <div className="grow">
                <div className="title">{r.title}</div>
                <div className="muted small">{fmtDate(r.auditDate)} · {r.auditorName ?? r.auditor ?? '—'}</div>
              </div>
              <ScoreBadge score={r.score} />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
