export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const CATEGORIES = ['5S', 'Safety', 'Quality', 'Environment'] as const;
export type Category = (typeof CATEGORIES)[number];

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
  category: Category | null;
}

export interface TemplateItem {
  id: string;
  templateId: string;
  title: string;
  order: number;
}

export interface Run {
  id: string;
  title: string;
  zoneId: string;
  auditDate: string | null; // YYYY-MM-DD
  auditor: string | null; // email
  score: number | null;
  createdOn: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string | null;
  severity: Severity | null;
  status: FindingStatus;
  dueDate: string | null; // YYYY-MM-DD
  assignedTo: string | null; // email
  beforeImage: string | null;
  afterImage: string | null;
  runId: string;
  itemId: string;
  createdOn: string;
  modifiedOn: string;
  /** Row version; pass it back to updateFinding so concurrent edits are rejected instead of overwritten. */
  etag?: string;
}

export interface NewRun {
  title: string;
  zoneId: string;
  auditDate: string;
  auditor: string;
  score: number;
}

export interface NewFinding {
  title: string;
  description: string | null;
  severity: Severity;
  dueDate: string | null;
  assignedTo: string | null;
  beforeImage: string | null;
  runId: string;
  itemId: string;
}

export interface FindingPatch {
  title?: string;
  description?: string | null;
  severity?: Severity;
  status?: FindingStatus;
  dueDate?: string | null;
  assignedTo?: string | null;
  beforeImage?: string | null;
  afterImage?: string | null;
}

export interface FindingFilter {
  runId?: string;
  assignedTo?: string;
}

/** Data-access boundary. Implemented by Dataverse (live) and an in-memory mock. */
export interface Repo {
  listZones(): Promise<Zone[]>;
  listTemplates(): Promise<Template[]>;
  /** All active audit items; optionally restricted to one template. */
  listItems(templateId?: string): Promise<TemplateItem[]>;

  listRuns(filter?: { auditor?: string }): Promise<Run[]>;
  getRun(id: string): Promise<Run | null>;
  createRun(input: NewRun): Promise<Run>;
  deleteRun(id: string): Promise<void>;

  listFindings(filter?: FindingFilter): Promise<Finding[]>;
  getFinding(id: string): Promise<Finding | null>;
  createFinding(input: NewFinding): Promise<Finding>;
  /** With `etag`, throws a 409 HttpError if the row changed since it was read. */
  updateFinding(id: string, patch: FindingPatch, etag?: string): Promise<Finding>;
  deleteFinding(id: string): Promise<void>;
}

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (v: unknown): v is string => typeof v === 'string' && GUID_RE.test(v);
