import { conflict } from '../errors.js';
import { DataverseClient, DataverseError } from './client.js';
import { fromDvDate, toDvDate } from './dates.js';
import {
  isGuid,
  type Category,
  type Finding,
  type FindingFilter,
  type FindingPatch,
  type FindingStatus,
  type NewFinding,
  type NewRun,
  type Repo,
  type Run,
  type Severity,
  type Template,
  type TemplateItem,
  type Zone,
} from './types.js';

// Entity sets (plural logical names) of the five tables in solution "Zoneauditcontrol".
const ES = {
  zone: 'crd1a_zones',
  template: 'crd1a_audittemplates',
  item: 'crd1a_audititems',
  run: 'crd1a_auditruns',
  finding: 'crd1a_auditfindings',
} as const;

// Choice values, taken from the unpacked solution (note: the Severity numbers are not in severity order).
const SEVERITY_VALUE: Record<Severity, number> = { High: 982560000, Medium: 982560001, Critical: 982560002, Low: 982560003 };
const STATUS_VALUE: Record<FindingStatus, number> = { Open: 982560000, 'In Progress': 982560001, Resolved: 982560002, Closed: 982560003 };
const CATEGORY_VALUE: Record<Category, number> = { '5S': 982560000, Safety: 982560001, Quality: 982560002, Environment: 982560003 };

const byValue = <K extends string>(map: Record<K, number>, v: number | null | undefined): K | null =>
  v == null ? null : ((Object.keys(map) as K[]).find((k) => map[k] === v) ?? null);

const FINDING_SELECT = [
  'crd1a_auditfindingid', 'crd1a_title', 'crd1a_description', 'crd1a_severity', 'crd1a_status', 'crd1a_duedate',
  'crd1a_assignedto', 'crd1a_beforeimage', 'crd1a_afterimage', '_crd1a_auditrun_value', '_crd1a_audititem_value',
  'createdon', 'modifiedon',
].join(',');
const RUN_SELECT = 'crd1a_auditrunid,crd1a_title,crd1a_auditdate,crd1a_auditor,crd1a_score,_crd1a_zone_value,createdon';

/** OData string literal, percent-encoded so characters like '+', '&' or '#' in emails cannot break the query string. */
const q = (s: string) => `'${encodeURIComponent(s.replace(/'/g, "''"))}'`;
const guid = (s: string) => {
  if (!isGuid(s)) throw new Error(`Invalid GUID: ${s}`);
  return s;
};

type Raw = Record<string, any>;

export class LiveRepo implements Repo {
  constructor(
    private dv: DataverseClient,
    private timezone: string,
  ) {}

  // ---------- mapping ----------
  private toRun = (r: Raw): Run => ({
    id: r.crd1a_auditrunid,
    title: r.crd1a_title ?? '',
    zoneId: r._crd1a_zone_value,
    auditDate: fromDvDate(r.crd1a_auditdate, this.timezone),
    auditor: r.crd1a_auditor ?? null,
    score: r.crd1a_score ?? null,
    createdOn: r.createdon,
  });

  private toFinding = (r: Raw): Finding => ({
    id: r.crd1a_auditfindingid,
    title: r.crd1a_title ?? '',
    description: r.crd1a_description ?? null,
    severity: byValue(SEVERITY_VALUE, r.crd1a_severity),
    status: byValue(STATUS_VALUE, r.crd1a_status) ?? 'Open',
    dueDate: fromDvDate(r.crd1a_duedate, this.timezone),
    assignedTo: r.crd1a_assignedto ?? null,
    beforeImage: r.crd1a_beforeimage ?? null,
    afterImage: r.crd1a_afterimage ?? null,
    runId: r._crd1a_auditrun_value,
    itemId: r._crd1a_audititem_value,
    createdOn: r.createdon,
    modifiedOn: r.modifiedon,
    etag: r['@odata.etag'],
  });

  // ---------- master data ----------
  async listZones(): Promise<Zone[]> {
    const rows = await this.dv.list<Raw>(
      ES.zone,
      '$select=crd1a_zoneid,crd1a_title,crd1a_description,crd1a_imageurl,crd1a_zonemanager&$filter=statecode eq 0&$orderby=crd1a_title asc',
    );
    return rows.map((r) => ({
      id: r.crd1a_zoneid,
      title: r.crd1a_title ?? '',
      description: r.crd1a_description ?? null,
      imageUrl: r.crd1a_imageurl ?? null,
      zoneManager: r.crd1a_zonemanager ?? null,
    }));
  }

  async listTemplates(): Promise<Template[]> {
    const rows = await this.dv.list<Raw>(ES.template, '$select=crd1a_audittemplateid,crd1a_title,crd1a_category&$filter=statecode eq 0&$orderby=crd1a_title asc');
    return rows.map((r) => ({
      id: r.crd1a_audittemplateid,
      title: r.crd1a_title ?? '',
      category: byValue(CATEGORY_VALUE, r.crd1a_category) as Category | null,
    }));
  }

  async listItems(templateId?: string): Promise<TemplateItem[]> {
    const filter = ['statecode eq 0', templateId ? `_crd1a_template_value eq ${guid(templateId)}` : null].filter(Boolean).join(' and ');
    const rows = await this.dv.list<Raw>(
      ES.item,
      `$select=crd1a_audititemid,crd1a_title,crd1a_ordernumber,_crd1a_template_value&$filter=${filter}&$orderby=crd1a_ordernumber asc,crd1a_title asc`,
    );
    return rows.map((r) => ({
      id: r.crd1a_audititemid,
      templateId: r._crd1a_template_value,
      title: r.crd1a_title ?? '',
      order: r.crd1a_ordernumber ?? 0,
    }));
  }

  // ---------- runs ----------
  async listRuns(filter?: { auditor?: string }): Promise<Run[]> {
    const parts = ['statecode eq 0'];
    if (filter?.auditor) parts.push(`crd1a_auditor eq ${q(filter.auditor)}`);
    const rows = await this.dv.list<Raw>(ES.run, `$select=${RUN_SELECT}&$filter=${parts.join(' and ')}&$orderby=createdon desc`);
    return rows.map(this.toRun);
  }

  async getRun(id: string): Promise<Run | null> {
    const r = await this.dv.get<Raw>(ES.run, guid(id), `$select=${RUN_SELECT}`);
    return r ? this.toRun(r) : null;
  }

  async createRun(input: NewRun): Promise<Run> {
    const r = await this.dv.create<Raw>(ES.run, {
      crd1a_title: input.title,
      crd1a_auditdate: toDvDate(input.auditDate),
      crd1a_auditor: input.auditor,
      crd1a_score: input.score,
      'crd1a_Zone@odata.bind': `/${ES.zone}(${guid(input.zoneId)})`,
    });
    return this.toRun(r);
  }

  async deleteRun(id: string): Promise<void> {
    await this.dv.remove(ES.run, guid(id));
  }

  // ---------- findings ----------
  async listFindings(filter?: FindingFilter): Promise<Finding[]> {
    const parts = ['statecode eq 0'];
    if (filter?.runId) parts.push(`_crd1a_auditrun_value eq ${guid(filter.runId)}`);
    if (filter?.assignedTo) parts.push(`crd1a_assignedto eq ${q(filter.assignedTo)}`);
    const rows = await this.dv.list<Raw>(ES.finding, `$select=${FINDING_SELECT}&$filter=${parts.join(' and ')}&$orderby=createdon desc`);
    return rows.map(this.toFinding);
  }

  async getFinding(id: string): Promise<Finding | null> {
    const r = await this.dv.get<Raw>(ES.finding, guid(id), `$select=${FINDING_SELECT}`);
    return r ? this.toFinding(r) : null;
  }

  async createFinding(input: NewFinding): Promise<Finding> {
    const r = await this.dv.create<Raw>(ES.finding, {
      crd1a_title: input.title,
      crd1a_description: input.description,
      crd1a_severity: SEVERITY_VALUE[input.severity],
      crd1a_status: STATUS_VALUE.Open,
      crd1a_duedate: toDvDate(input.dueDate),
      crd1a_assignedto: input.assignedTo,
      crd1a_beforeimage: input.beforeImage,
      'crd1a_AuditRun@odata.bind': `/${ES.run}(${guid(input.runId)})`,
      'crd1a_AuditItem@odata.bind': `/${ES.item}(${guid(input.itemId)})`,
    });
    return this.toFinding(r);
  }

  async updateFinding(id: string, patch: FindingPatch, etag?: string): Promise<Finding> {
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.crd1a_title = patch.title;
    if (patch.description !== undefined) body.crd1a_description = patch.description;
    if (patch.severity !== undefined) body.crd1a_severity = SEVERITY_VALUE[patch.severity];
    if (patch.status !== undefined) body.crd1a_status = STATUS_VALUE[patch.status];
    if (patch.dueDate !== undefined) body.crd1a_duedate = toDvDate(patch.dueDate);
    if (patch.assignedTo !== undefined) body.crd1a_assignedto = patch.assignedTo;
    if (patch.beforeImage !== undefined) body.crd1a_beforeimage = patch.beforeImage;
    if (patch.afterImage !== undefined) body.crd1a_afterimage = patch.afterImage;
    try {
      const r = await this.dv.update<Raw>(ES.finding, guid(id), body, etag ?? '*');
      return this.toFinding(r);
    } catch (e) {
      if (e instanceof DataverseError && e.status === 412) throw conflict('Sự cố vừa được người khác cập nhật. Hãy tải lại trang rồi thử lại.');
      throw e;
    }
  }

  async deleteFinding(id: string): Promise<void> {
    await this.dv.remove(ES.finding, guid(id));
  }
}
