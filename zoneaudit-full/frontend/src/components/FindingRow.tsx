import { Link } from 'react-router-dom';
import type { Finding } from '../types';
import { Img, SeverityBadge, StatusBadge, fmtDate } from '../ui';

export default function FindingRow({ f }: { f: Finding }) {
  return (
    <Link to={`/findings/${f.id}`} className="list-item row gap">
      {f.beforeImage ? <Img src={f.beforeImage} alt="" className="thumb" /> : null}
      <div className="grow">
        <div className="row gap wrap" style={{ marginBottom: '.2rem' }}>
          <SeverityBadge value={f.severity} />
          <StatusBadge value={f.status} />
          {f.overdue && <span className="badge st-open">Quá hạn</span>}
        </div>
        <div className="title">{f.title}</div>
        <div className="muted small">
          {f.zoneTitle ?? '—'} · {f.assignedToName ?? f.assignedTo ?? 'Chưa giao'}
          {f.dueDate && <> · hạn <span className={f.overdue ? 'overdue' : ''}>{fmtDate(f.dueDate)}</span></>}
        </div>
      </div>
    </Link>
  );
}
