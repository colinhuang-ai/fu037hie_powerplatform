import { randomUUID } from 'node:crypto';
import { conflict } from '../errors.js';
import type {
  Finding, FindingFilter, FindingPatch, NewFinding, NewRun, Repo, Run, Template, TemplateItem, Zone,
} from './types.js';

/** In-memory stand-in for Dataverse: local development, demos and tests. */
export class MockRepo implements Repo {
  zones: Zone[] = [];
  templates: Template[] = [];
  items: TemplateItem[] = [];
  runs: Run[] = [];
  findings: Finding[] = [];

  async listZones() {
    return structuredClone(this.zones);
  }
  async listTemplates() {
    return structuredClone(this.templates);
  }
  async listItems(templateId?: string) {
    return structuredClone(this.items.filter((i) => !templateId || i.templateId === templateId).sort((a, b) => a.order - b.order));
  }

  async listRuns(filter?: { auditor?: string }) {
    return structuredClone(
      this.runs
        .filter((r) => !filter?.auditor || r.auditor?.toLowerCase() === filter.auditor.toLowerCase())
        .sort((a, b) => b.createdOn.localeCompare(a.createdOn)),
    );
  }
  async getRun(id: string) {
    const r = this.runs.find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }
  async createRun(input: NewRun) {
    const run: Run = { id: randomUUID(), createdOn: new Date().toISOString(), ...input };
    this.runs.push(run);
    return structuredClone(run);
  }
  async deleteRun(id: string) {
    this.runs = this.runs.filter((r) => r.id !== id);
  }

  async listFindings(filter?: FindingFilter) {
    return structuredClone(
      this.findings
        .filter((f) => !filter?.runId || f.runId === filter.runId)
        .filter((f) => !filter?.assignedTo || f.assignedTo?.toLowerCase() === filter.assignedTo.toLowerCase())
        .sort((a, b) => b.createdOn.localeCompare(a.createdOn)),
    );
  }
  async getFinding(id: string) {
    const f = this.findings.find((x) => x.id === id);
    return f ? structuredClone(f) : null;
  }
  async createFinding(input: NewFinding) {
    const now = new Date().toISOString();
    const f: Finding = { id: randomUUID(), status: 'Open', afterImage: null, createdOn: now, modifiedOn: now, etag: '1', ...input };
    this.findings.push(f);
    return structuredClone(f);
  }
  async updateFinding(id: string, patch: FindingPatch, etag?: string) {
    const f = this.findings.find((x) => x.id === id);
    if (!f) throw new Error('Finding not found');
    if (etag && etag !== f.etag) throw conflict('Sự cố vừa được người khác cập nhật. Hãy tải lại trang rồi thử lại.');
    Object.assign(f, patch, { modifiedOn: new Date().toISOString(), etag: String(Number(f.etag ?? '0') + 1) });
    return structuredClone(f);
  }
  async deleteFinding(id: string) {
    this.findings = this.findings.filter((f) => f.id !== id);
  }
}

export function seedMockRepo(repo: MockRepo = new MockRepo()): MockRepo {
  const z = (title: string, zoneManager: string, description: string): Zone => ({
    id: randomUUID(), title, zoneManager, description, imageUrl: null,
  });
  repo.zones = [
    z('Kho thành phẩm A', 'Nguyễn Văn An', 'Khu lưu trữ thành phẩm trước khi xuất hàng'),
    z('Xưởng sản xuất 1', 'Trần Thị Bình', 'Dây chuyền lắp ráp chính'),
    z('Khu văn phòng', 'Lê Hoàng Cường', 'Văn phòng điều hành tầng 2'),
  ];

  const t5s: Template = { id: randomUUID(), title: 'Kiểm tra 5S hằng tuần', category: '5S' };
  const tSafety: Template = { id: randomUUID(), title: 'Kiểm tra an toàn lao động', category: 'Safety' };
  repo.templates = [t5s, tSafety];

  const items = (tpl: Template, titles: string[]): TemplateItem[] =>
    titles.map((title, i) => ({ id: randomUUID(), templateId: tpl.id, title, order: i + 1 }));
  repo.items = [
    ...items(t5s, [
      'Sàn, lối đi sạch sẽ, không vật cản',
      'Dụng cụ được sắp xếp đúng vị trí quy định',
      'Nhãn, biển báo đầy đủ và dễ đọc',
      'Không có vật dụng cá nhân trong khu vực làm việc',
      'Thùng rác được phân loại và không đầy tràn',
    ]),
    ...items(tSafety, [
      'Bình chữa cháy còn hạn, đặt đúng vị trí',
      'Lối thoát hiểm thông thoáng, đèn exit hoạt động',
      'Nhân viên đội đầy đủ PPE (mũ, kính, găng tay)',
      'Tủ điện đóng kín, có biển cảnh báo',
      'Hóa chất được dán nhãn và lưu trữ đúng quy định',
      'Hộp sơ cứu đầy đủ vật tư',
    ]),
  ];
  return repo;
}
