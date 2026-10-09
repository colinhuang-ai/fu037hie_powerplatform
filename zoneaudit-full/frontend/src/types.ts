export type Role = 'admin' | 'auditor' | 'fixer';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type FindingStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type AnswerResult = 'pass' | 'fail' | 'na';

export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
export const STATUSES: FindingStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface Assignee {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Zone {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  zoneManager: string | null;
}

export interface Template {
  id: string;
  title: string;
  category: string | null;
  itemCount: number;
}

export interface DraftAnswer {
  result: AnswerResult | null;
  note?: string;
  severity?: Severity;
  photo?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface Draft {
  id: string;
  zoneId: string;
  zoneTitle: string;
  templateId: string;
  templateTitle: string;
  items: { id: string; title: string; order: number }[];
  answers: Record<string, DraftAnswer>;
  createdAt: string;
  updatedAt: string;
  progress: { answered: number; total: number };
}

export interface Run {
  id: string;
  title: string;
  zoneId: string;
  zoneTitle: string | null;
  auditDate: string | null;
  auditor: string | null;
  auditorName: string | null;
  score: number | null;
  createdOn: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string | null;
  severity: Severity | null;
  status: FindingStatus;
  dueDate: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  beforeImage: string | null;
  afterImage: string | null;
  runId: string;
  runTitle: string | null;
  itemId: string;
  itemTitle: string | null;
  templateTitle: string | null;
  zoneId: string | null;
  zoneTitle: string | null;
  overdue: boolean;
  createdOn: string;
  modifiedOn: string;
}

export interface Stats {
  findings: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    overdue: number;
    mine: number;
    bySeverity: Record<Severity, number>;
  };
  runs: null | {
    count30d: number;
    avgScore30d: number | null;
    byZone: { zoneId: string; zoneTitle: string; avgScore: number; runs: number; openFindings: number }[];
    latest: Run[];
  };
}

export type FindingActionBody =
  | { type: 'assign'; assignedTo: string | null; dueDate?: string | null }
  | { type: 'update'; severity?: Severity; dueDate?: string | null }
  | { type: 'start' }
  | { type: 'resolve'; afterImage: string; note?: string }
  | { type: 'close'; note?: string }
  | { type: 'reopen'; note: string };
