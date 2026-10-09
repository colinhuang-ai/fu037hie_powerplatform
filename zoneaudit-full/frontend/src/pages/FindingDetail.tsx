import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import PhotoPicker from '../components/PhotoPicker';
import { SEVERITIES, type Finding, type FindingActionBody, type Severity } from '../types';
import { Alert, Img, Loading, PageHeader, SEVERITY_LABEL, SeverityBadge, StatusBadge, fmtDate, fmtDateTime, useAsync } from '../ui';

export default function FindingDetail() {
  const { id = '' } = useParams();
  const { user, can } = useAuth();
  const q = useAsync(() => api.finding(id), [id]);
  const fixers = useAsync(() => (can('auditor') ? api.assignable() : Promise.resolve([])), [can]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);

  const f = q.data;
  if (!f) return <Loading error={q.error} />;

  const mine = !!user && f.assignedTo?.toLowerCase() === user.email.toLowerCase();
  const isAuditor = can('auditor');
  const isFixer = can('fixer');
  const open = f.status === 'Open' || f.status === 'In Progress';

  const run = async (action: FindingActionBody, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      const updated: Finding = await api.findingAction(f.id, action);
      q.setData(updated);
      setNote('');
      setAfterImage(null);
      setAssignee(null);
      setDue(null);
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={f.title} sub={<Link to={f.runId && isAuditor ? `/runs/${f.runId}` : '/findings'}>← {f.runId && isAuditor ? 'Lượt kiểm tra' : 'Danh sách'}</Link>} />

      {error && <div style={{ marginBottom: '1rem' }}><Alert>{error}</Alert></div>}

      <div className="grid cols-2">
        <section className="card stack">
          <div className="row gap wrap">
            <SeverityBadge value={f.severity} />
            <StatusBadge value={f.status} />
            {f.overdue && <span className="badge st-open">Quá hạn</span>}
          </div>
          <dl className="dl" style={{ margin: 0 }}>
            <dt>Khu vực</dt><dd>{f.zoneTitle ?? '—'}</dd>
            <dt>Hạng mục</dt><dd>{f.itemTitle ?? '—'}{f.templateTitle && <span className="muted"> · {f.templateTitle}</span>}</dd>
            <dt>Người xử lý</dt><dd>{f.assignedToName ?? f.assignedTo ?? 'Chưa giao'}</dd>
            <dt>Hạn xử lý</dt><dd className={f.overdue ? 'overdue' : ''}>{fmtDate(f.dueDate)}</dd>
            <dt>Phát hiện lúc</dt><dd>{fmtDateTime(f.createdOn)}</dd>
            <dt>Cập nhật</dt><dd>{fmtDateTime(f.modifiedOn)}</dd>
          </dl>
          <div>
            <h3>Mô tả & nhật ký</h3>
            <div className="timeline pre">{f.description || <span className="muted">Không có mô tả.</span>}</div>
          </div>
        </section>

        <section className="card stack">
          <div>
            <h3>Ảnh hiện trạng (trước)</h3>
            {f.beforeImage ? <Img src={f.beforeImage} alt="Ảnh trước xử lý" className="big-img" /> : <p className="muted">Không có ảnh.</p>}
          </div>
          <div>
            <h3>Ảnh sau xử lý</h3>
            {f.afterImage ? <Img src={f.afterImage} alt="Ảnh sau xử lý" className="big-img" /> : <p className="muted">Chưa có ảnh.</p>}
          </div>
        </section>
      </div>

      {/* ---------- Fixer actions ---------- */}
      {isFixer && f.status === 'Open' && (!f.assignedTo || mine || user?.role === 'admin') && (
        <section className="card stack mt">
          <h2>Xử lý sự cố</h2>
          <p className="muted small">{f.assignedTo ? 'Sự cố đã được giao cho bạn.' : 'Sự cố chưa có người nhận — nhận để bắt đầu xử lý.'}</p>
          <div><button className="btn primary" disabled={busy} onClick={() => run({ type: 'start' })}>{f.assignedTo ? 'Bắt đầu xử lý' : 'Nhận & bắt đầu xử lý'}</button></div>
        </section>
      )}

      {isFixer && f.status === 'In Progress' && (mine || user?.role === 'admin') && (
        <section className="card stack mt">
          <h2>Báo hoàn thành</h2>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: '.3rem' }}>Ảnh sau xử lý *</div>
            <PhotoPicker value={afterImage} onChange={setAfterImage} label="Chụp ảnh sau xử lý" />
          </div>
          <label className="field">
            Ghi chú xử lý
            <textarea value={note} maxLength={800} placeholder="Đã làm gì để khắc phục?" onChange={(e) => setNote(e.target.value)} />
          </label>
          <div>
            <button className="btn good" disabled={busy || !afterImage} onClick={() => run({ type: 'resolve', afterImage: afterImage!, note: note.trim() || undefined })}>
              Báo đã xử lý xong
            </button>
          </div>
        </section>
      )}

      {/* ---------- Auditor actions ---------- */}
      {isAuditor && f.status === 'Resolved' && (
        <section className="card stack mt">
          <h2>Xác nhận kết quả khắc phục</h2>
          <p className="muted small">So sánh ảnh trước/sau rồi quyết định đóng sự cố hoặc yêu cầu làm lại.</p>
          <label className="field">
            Ghi chú (bắt buộc khi mở lại)
            <textarea value={note} maxLength={800} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row gap wrap">
            <button className="btn good" disabled={busy} onClick={() => run({ type: 'close', note: note.trim() || undefined })}>Xác nhận & đóng</button>
            <button className="btn danger" disabled={busy || !note.trim()} onClick={() => run({ type: 'reopen', note: note.trim() })}>Chưa đạt — mở lại</button>
          </div>
        </section>
      )}

      {isAuditor && f.status === 'Closed' && (
        <section className="card stack mt">
          <h2>Mở lại sự cố</h2>
          <label className="field">
            Lý do *
            <textarea value={note} maxLength={800} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div><button className="btn danger" disabled={busy || !note.trim()} onClick={() => run({ type: 'reopen', note: note.trim() })}>Mở lại</button></div>
        </section>
      )}

      {isAuditor && open && (
        <section className="card stack mt">
          <h2>Giao việc & điều chỉnh</h2>
          <div className="form-grid">
            <label className="field">
              Người xử lý
              <select value={assignee ?? f.assignedTo ?? ''} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">— Chưa giao —</option>
                {fixers.data?.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
              </select>
            </label>
            <label className="field">
              Hạn xử lý
              <input type="date" value={due ?? f.dueDate ?? ''} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="field">
              Mức độ
              <select value={f.severity ?? 'Medium'} disabled={busy} onChange={(e) => run({ type: 'update', severity: e.target.value as Severity })}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
          <div>
            <button
              className="btn"
              disabled={busy || (assignee === null && due === null)}
              onClick={() => run({ type: 'assign', assignedTo: (assignee ?? f.assignedTo ?? '') || null, dueDate: (due ?? f.dueDate ?? '') || null })}
            >
              Lưu phân công
            </button>
          </div>
        </section>
      )}
    </>
  );
}
