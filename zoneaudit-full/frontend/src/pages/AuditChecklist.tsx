import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import PhotoPicker from '../components/PhotoPicker';
import { SEVERITIES, type AnswerResult, type DraftAnswer, type Finding, type Run, type Severity } from '../types';
import { Alert, Loading, PageHeader, SEVERITY_LABEL, ScoreBadge, useAsync } from '../ui';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the browser's timezone

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function AuditChecklist() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const draftQ = useAsync(() => api.draft(id), [id]);
  const fixers = useAsync(() => api.assignable(), []);

  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; details?: string[] } | null>(null);
  const [result, setResult] = useState<{ run: Run; findings: Finding[] } | null>(null);

  const latest = useRef(answers);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushing = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (draftQ.data) {
      setAnswers(draftQ.data.answers);
      latest.current = draftQ.data.answers;
    }
  }, [draftQ.data]);

  // Saves are serialized so a submit can never overtake an in-flight autosave.
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    if (flushing.current) return flushing.current.then(() => (dirty.current ? flush() : undefined));
    const p = (async () => {
      while (dirty.current) {
        dirty.current = false;
        setSaveState('saving');
        try {
          await api.saveDraft(id, latest.current);
        } catch (e) {
          dirty.current = true;
          setSaveState('error');
          throw e;
        }
      }
      setSaveState('saved');
    })().finally(() => {
      flushing.current = null;
    });
    flushing.current = p;
    return p;
  }, [id]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const patch = (itemId: string, change: Partial<DraftAnswer>) => {
    const next = { ...latest.current, [itemId]: { result: null, ...latest.current[itemId], ...change } as DraftAnswer };
    latest.current = next;
    setAnswers(next);
    dirty.current = true;
    setSaveState('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(() => {}), 800);
  };

  const setResultFor = (itemId: string, r: AnswerResult) => patch(itemId, r === 'fail' ? { result: r, severity: latest.current[itemId]?.severity ?? 'Medium' } : { result: r });

  const draft = draftQ.data;
  const stats = useMemo(() => {
    if (!draft) return null;
    let pass = 0, fail = 0, na = 0, unanswered = 0, missingNote = 0;
    for (const it of draft.items) {
      const a = answers[it.id];
      if (!a?.result) unanswered++;
      else if (a.result === 'pass') pass++;
      else if (a.result === 'na') na++;
      else {
        fail++;
        if (!a.note?.trim()) missingNote++;
      }
    }
    const scored = pass + fail;
    return { pass, fail, na, unanswered, missingNote, score: scored ? Math.round((pass / scored) * 100) : null, total: draft.items.length };
  }, [draft, answers]);

  if (!draft || !stats) return <Loading error={draftQ.error} />;

  if (result) {
    return (
      <>
        <PageHeader title="Đã nộp lượt kiểm tra" sub={result.run.title} />
        <div className="card stack center">
          <div>Điểm: <ScoreBadge score={result.run.score} /></div>
          <p>
            {result.findings.length === 0
              ? 'Không phát hiện sự cố nào. Làm tốt lắm!'
              : `Đã tạo ${result.findings.length} sự cố để theo dõi khắc phục.`}
          </p>
          <div className="row gap" style={{ justifyContent: 'center' }}>
            <Link className="btn primary" to={`/runs/${result.run.id}`}>Xem kết quả</Link>
            <Link className="btn" to="/audit">Kiểm tra khác</Link>
          </div>
        </div>
      </>
    );
  }

  const canSubmit = stats.unanswered === 0 && stats.missingNote === 0 && stats.score !== null && !submitting;

  const submit = async () => {
    if (!confirm(`Nộp lượt kiểm tra? ${stats.fail} sự cố sẽ được tạo. Sau khi nộp không thể chỉnh sửa checklist.`)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flush();
      setResult(await api.submitDraft(id));
    } catch (e) {
      setSubmitError({ message: (e as Error).message, details: e instanceof ApiError ? e.details : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const discard = async () => {
    if (!confirm('Hủy và xóa bản nháp này?')) return;
    clearTimeout(timer.current);
    dirty.current = false;
    await api.deleteDraft(id);
    navigate('/audit');
  };

  const pct = Math.round(((stats.total - stats.unanswered) / stats.total) * 100);

  return (
    <>
      <PageHeader
        title={draft.templateTitle}
        sub={`Khu vực: ${draft.zoneTitle}`}
        actions={<button className="btn sm danger" onClick={discard}>Hủy bản nháp</button>}
      />

      <div className="card stack" style={{ marginBottom: '1rem' }}>
        <div className="row between small">
          <span>Đã đánh giá {stats.total - stats.unanswered}/{stats.total}</span>
          <span className="muted">
            {saveState === 'saving' && 'Đang lưu…'}
            {saveState === 'saved' && '✓ Đã lưu nháp'}
            {saveState === 'error' && <span className="overdue">Lưu thất bại — sẽ thử lại khi bạn chỉnh tiếp</span>}
          </span>
        </div>
        <div className="meter"><span style={{ width: `${pct}%` }} /></div>
        <div className="row gap wrap small muted">
          <span>Đạt: <strong>{stats.pass}</strong></span>
          <span>Không đạt: <strong>{stats.fail}</strong></span>
          <span>N/A: <strong>{stats.na}</strong></span>
          <span>Điểm tạm tính: <ScoreBadge score={stats.score} /></span>
        </div>
      </div>

      <section className="card flush">
        {draft.items.map((item, idx) => {
          const a = answers[item.id];
          return (
            <div className="check-item" key={item.id}>
              <div className="q"><span className="num">{idx + 1}.</span>{item.title}</div>
              <div className="seg" role="group" aria-label={`Kết quả: ${item.title}`}>
                <button type="button" className={a?.result === 'pass' ? 'on-pass' : ''} aria-pressed={a?.result === 'pass'} onClick={() => setResultFor(item.id, 'pass')}>Đạt</button>
                <button type="button" className={a?.result === 'fail' ? 'on-fail' : ''} aria-pressed={a?.result === 'fail'} onClick={() => setResultFor(item.id, 'fail')}>Không đạt</button>
                <button type="button" className={a?.result === 'na' ? 'on-na' : ''} aria-pressed={a?.result === 'na'} onClick={() => setResultFor(item.id, 'na')}>N/A</button>
              </div>

              {a?.result === 'fail' && (
                <div className="fail-panel">
                  <label className="field">
                    Mô tả vấn đề *
                    <textarea value={a.note ?? ''} maxLength={1500} placeholder="Ví dụ: Sàn khu vực B dính dầu, nguy cơ trơn trượt" onChange={(e) => patch(item.id, { note: e.target.value })} />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      Mức độ
                      <select value={a.severity ?? 'Medium'} onChange={(e) => patch(item.id, { severity: e.target.value as Severity })}>
                        {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      Giao cho (Fixer)
                      <select value={a.assignedTo ?? ''} onChange={(e) => patch(item.id, { assignedTo: e.target.value || null })}>
                        <option value="">— Chưa giao (ai cũng nhận được) —</option>
                        {fixers.data?.map((f) => <option key={f.id} value={f.email}>{f.name}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      Hạn xử lý
                      <input type="date" min={today()} value={a.dueDate ?? ''} onChange={(e) => patch(item.id, { dueDate: e.target.value || null })} />
                    </label>
                  </div>
                  <div>
                    <div className="small" style={{ fontWeight: 600, marginBottom: '.3rem' }}>Ảnh hiện trạng</div>
                    <PhotoPicker value={a.photo} onChange={(p) => patch(item.id, { photo: p })} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="sticky-bar">
          <span className="small muted">
            {stats.unanswered > 0 && `Còn ${stats.unanswered} hạng mục chưa đánh giá. `}
            {stats.missingNote > 0 && `${stats.missingNote} hạng mục "Không đạt" thiếu mô tả. `}
            {stats.unanswered === 0 && stats.missingNote === 0 && stats.score === null && 'Cần ít nhất một hạng mục Đạt hoặc Không đạt. '}
            {canSubmit && 'Sẵn sàng nộp.'}
          </span>
          <button className="btn primary" disabled={!canSubmit} onClick={submit}>{submitting ? 'Đang nộp…' : 'Nộp kiểm tra'}</button>
        </div>
      </section>

      {submitError && (
        <div className="mt">
          <Alert>
            {submitError.message}
            {submitError.details && <ul>{submitError.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </Alert>
        </div>
      )}
    </>
  );
}
