import type {
  Assignee, Draft, DraftAnswer, Finding, FindingActionBody, Run, Stats, Template, User, Zone,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export const setUnauthorizedHandler = (fn: UnauthorizedHandler) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, body?: unknown, opts: { form?: FormData; silent401?: boolean } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !opts.silent401) onUnauthorized();
    throw new ApiError(res.status, data.error ?? `Lỗi ${res.status}`, Array.isArray(data.details) ? data.details : undefined);
  }
  return data as T;
}

const get = <T>(p: string) => request<T>('GET', p);
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {});

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

export const api = {
  // auth
  config: () => get<{ googleClientId: string | null; mock: boolean }>('/auth/config'),
  me: () => request<{ user: User }>('GET', '/auth/me', undefined, { silent401: true }),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/auth/login', { email, password }, { silent401: true }),
  loginGoogle: (credential: string) => request<{ user: User }>('POST', '/auth/google', { credential }, { silent401: true }),
  logout: () => post<void>('/auth/logout'),
  changePassword: (currentPassword: string | undefined, newPassword: string) => post<void>('/auth/change-password', { currentPassword, newPassword }),

  // master data
  zones: () => get<Zone[]>('/master/zones'),
  templates: () => get<Template[]>('/master/templates'),

  // drafts
  drafts: () => get<Draft[]>('/drafts'),
  draft: (id: string) => get<Draft>(`/drafts/${id}`),
  createDraft: (zoneId: string, templateId: string) => post<Draft>('/drafts', { zoneId, templateId }),
  saveDraft: (id: string, answers: Record<string, DraftAnswer>) => request<Draft>('PUT', `/drafts/${id}`, { answers }),
  deleteDraft: (id: string) => request<void>('DELETE', `/drafts/${id}`),
  submitDraft: (id: string) => post<{ run: Run; findings: Finding[] }>(`/drafts/${id}/submit`),

  // runs
  runs: () => get<Run[]>('/runs'),
  run: (id: string) => get<{ run: Run; findings: Finding[] }>(`/runs/${id}`),

  // findings
  findings: (f: { status?: string; severity?: string; assignee?: string; overdue?: string; q?: string; runId?: string } = {}) =>
    get<Finding[]>(`/findings${qs(f)}`),
  finding: (id: string) => get<Finding>(`/findings/${id}`),
  findingAction: (id: string, action: FindingActionBody) => post<Finding>(`/findings/${id}/actions`, action),

  // stats, users, uploads
  stats: () => get<Stats>('/stats'),
  assignable: () => get<Assignee[]>('/users/assignable'),
  users: () => get<User[]>('/users'),
  createUser: (u: { email: string; name: string; role: string; password?: string }) => post<User>('/users', u),
  updateUser: (id: string, patch: { name?: string; role?: string; active?: boolean; password?: string }) => request<User>('PATCH', `/users/${id}`, patch),
  upload: async (file: Blob, filename = 'photo.jpg') => {
    const form = new FormData();
    form.append('file', file, filename);
    return request<{ path: string }>('POST', '/uploads', undefined, { form });
  },
};
