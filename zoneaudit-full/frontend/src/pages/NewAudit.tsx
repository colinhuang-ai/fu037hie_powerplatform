import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Alert, Loading, PageHeader, fmtDateTime, useAsync } from '../ui';

export default function NewAudit() {
  const navigate = useNavigate();
  const zones = useAsync(() => api.zones(), []);
  const templates = useAsync(() => api.templates(), []);
  const drafts = useAsync(() => api.drafts(), []);
  const [zoneId, setZoneId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api.createDraft(zoneId, templateId);
      navigate(`/audit/${d.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Xóa bản nháp này? Các câu trả lời chưa nộp sẽ mất.')) return;
    await api.deleteDraft(id);
    drafts.reload();
  };

  if (!zones.data || !templates.data) return <Loading error={zones.error ?? templates.error} />;
  const usable = templates.data.filter((t) => t.itemCount > 0);

  return (
    <>
      <PageHeader title="Kiểm tra mới" sub="Chọn khu vực và mẫu kiểm tra để bắt đầu một lượt audit." />

      <form className="card stack" onSubmit={start}>
        {error && <Alert>{error}</Alert>}
        <div className="form-grid">
          <label className="field">
            Khu vực
            <select required value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">— Chọn khu vực —</option>
              {zones.data.map((z) => (
                <option key={z.id} value={z.id}>{z.title}{z.zoneManager ? ` (${z.zoneManager})` : ''}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Mẫu kiểm tra
            <select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— Chọn mẫu —</option>
              {usable.map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.category ? ` · ${t.category}` : ''} ({t.itemCount} hạng mục)</option>
              ))}
            </select>
          </label>
        </div>
        <div><button className="btn primary" disabled={busy || !zoneId || !templateId}>{busy ? 'Đang tạo…' : 'Bắt đầu kiểm tra'}</button></div>
      </form>

      <section className="card flush mt">
        <div style={{ padding: '1rem 1rem 0' }}><h2>Bản nháp đang làm dở</h2></div>
        {drafts.loading && <p className="muted pad">Đang tải…</p>}
        {drafts.data?.length === 0 && <p className="muted pad">Không có bản nháp nào.</p>}
        {drafts.data?.map((d) => (
          <div key={d.id} className="list-item row gap">
            <Link to={`/audit/${d.id}`} className="grow" style={{ color: 'inherit' }}>
              <div className="title">{d.templateTitle} — {d.zoneTitle}</div>
              <div className="muted small">Đã làm {d.progress.answered}/{d.progress.total} · cập nhật {fmtDateTime(d.updatedAt)}</div>
            </Link>
            <Link to={`/audit/${d.id}`} className="btn sm">Tiếp tục</Link>
            <button className="btn sm danger" onClick={() => remove(d.id)}>Xóa</button>
          </div>
        ))}
      </section>
    </>
  );
}
