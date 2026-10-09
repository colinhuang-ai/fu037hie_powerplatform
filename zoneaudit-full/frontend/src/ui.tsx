import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { FindingStatus, Role, Severity } from './types';

export const SEVERITY_LABEL: Record<Severity, string> = { Critical: 'Nghiêm trọng', High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' };
export const STATUS_LABEL: Record<FindingStatus, string> = { Open: 'Mở', 'In Progress': 'Đang xử lý', Resolved: 'Chờ xác nhận', Closed: 'Đã đóng' };
export const ROLE_LABEL: Record<Role, string> = { admin: 'Quản trị', auditor: 'Auditor', fixer: 'Fixer' };

export const SeverityBadge = ({ value }: { value: Severity | null }) =>
  value ? <span className={`badge sev-${value.toLowerCase()}`}>{SEVERITY_LABEL[value]}</span> : null;

export const StatusBadge = ({ value }: { value: FindingStatus }) => (
  <span className={`badge st-${value.toLowerCase().replace(' ', '-')}`}>{STATUS_LABEL[value]}</span>
);

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="badge">—</span>;
  const tone = score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
  return <span className={`badge score-${tone}`}>{score}%</span>;
}

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Only same-origin uploads and http(s) URLs are rendered as images. */
export function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src || !(src.startsWith('/api/files/') || /^https?:\/\//i.test(src))) return null;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="img-link">
      <img src={src} alt={alt} className={className} loading="lazy" />
    </a>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return run()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    run()
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [run]);

  return { data, error, loading, reload, setData };
}

export function Loading({ error }: { error?: string | null }) {
  return error ? <div className="alert error">{error}</div> : <div className="muted center pad">Đang tải…</div>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info' | 'success'; children: ReactNode }) {
  return <div className={`alert ${kind}`}>{children}</div>;
}
