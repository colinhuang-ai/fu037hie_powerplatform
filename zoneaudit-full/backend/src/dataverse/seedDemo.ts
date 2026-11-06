/**
 * Demo dataset layered on top of `seedMockRepo`.
 *
 * `seedMockRepo` only provides master data (zones, templates, items) and is what the test-suite asserts on;
 * this module adds the *transactional* history a demo needs - audit runs with scores spread over the last
 * ~45 days, and findings in every state of the workflow, including before/after photos written to disk.
 *
 * Only ever called for the in-memory mock repo, never against live Dataverse.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { todayIn } from './dates.js';
import { asciiFold, renderDemoPhoto } from './demoImages.js';
import type { MockRepo } from './mockRepo.js';
import type { Category, Finding, FindingStatus, Run, Severity, Template, TemplateItem, Zone } from './types.js';

export const DEMO_USERS = [
  { email: 'admin@demo.local', name: 'Demo Admin', role: 'admin' as const },
  { email: 'auditor@demo.local', name: 'Demo Auditor', role: 'auditor' as const },
  { email: 'auditor2@demo.local', name: 'Ngô Văn Sơn', role: 'auditor' as const },
  { email: 'fixer@demo.local', name: 'Demo Fixer', role: 'fixer' as const },
  { email: 'fixer2@demo.local', name: 'Đỗ Quang Huy', role: 'fixer' as const },
  { email: 'fixer3@demo.local', name: 'Bùi Thị Lan', role: 'fixer' as const },
];

const AUDITOR = 'auditor@demo.local';
const AUDITOR2 = 'auditor2@demo.local';
const FIXER = 'fixer@demo.local';
const FIXER2 = 'fixer2@demo.local';
const FIXER3 = 'fixer3@demo.local';

const NAME_OF: Record<string, string> = Object.fromEntries(DEMO_USERS.map((u) => [u.email, u.name]));

/** Keys used by the spec below; resolved to real rows once the master data exists. */
type ZoneKey = 'kho' | 'xuong' | 'vanphong' | 'hoachat' | 'cangtin';
type TplKey = '5S' | 'SAFETY' | 'QUALITY' | 'ENV';

interface FindingSpec {
  /** 0-based index into the run template's item list. */
  item: number;
  severity: Severity;
  status: FindingStatus;
  note: string;
  assignedTo?: string;
  /** Due date as an offset in days from the audit date; negative values are deliberately overdue. */
  due?: number;
  photo?: boolean;
  /** Appended to the description as workflow log lines, the way the real transitions do it. */
  log?: { day: number; who: string; text: string }[];
}

interface RunSpec {
  zone: ZoneKey;
  tpl: TplKey;
  /** Days before today. */
  ago: number;
  auditor: string;
  score: number;
  findings: FindingSpec[];
}

const RUNS: RunSpec[] = [
  {
    zone: 'xuong', tpl: '5S', ago: 1, auditor: AUDITOR, score: 60,
    findings: [
      {
        item: 0, severity: 'High', status: 'Open', due: 3, photo: true,
        note: 'Pallet rỗng để tràn ra lối đi giữa chuyền 2 và 3, xe nâng không qua được.',
      },
      {
        item: 3, severity: 'Low', status: 'Open',
        note: 'Cốc nước và áo khoác cá nhân để trên bàn thao tác chuyền 3.',
      },
    ],
  },
  {
    zone: 'hoachat', tpl: 'SAFETY', ago: 2, auditor: AUDITOR2, score: 67,
    findings: [
      {
        item: 4, severity: 'Critical', status: 'In Progress', assignedTo: FIXER, due: 2, photo: true,
        note: 'Can dung môi 20L không dán nhãn, để sát cửa ra vào kho dầu.',
        log: [{ day: 1, who: FIXER, text: 'Đã liên hệ kho để lấy nhãn chuẩn, dự kiến xong trong hôm nay.' }],
      },
      {
        item: 0, severity: 'High', status: 'Open', assignedTo: FIXER2, due: 5,
        note: 'Bình chữa cháy số 7 hết hạn kiểm định từ tháng trước.',
      },
    ],
  },
  {
    zone: 'kho', tpl: '5S', ago: 3, auditor: AUDITOR, score: 80,
    findings: [
      {
        item: 2, severity: 'Medium', status: 'In Progress', assignedTo: FIXER3, due: 6,
        note: 'Nhãn kệ B4-B6 bị mờ, không đọc được mã lô.',
      },
    ],
  },
  {
    zone: 'cangtin', tpl: '5S', ago: 5, auditor: AUDITOR2, score: 80,
    findings: [
      {
        item: 4, severity: 'Medium', status: 'Open',
        note: 'Thùng rác khu rửa tay đầy tràn, chưa phân loại rác hữu cơ.',
      },
    ],
  },
  { zone: 'vanphong', tpl: '5S', ago: 7, auditor: AUDITOR, score: 100, findings: [] },
  {
    zone: 'xuong', tpl: 'QUALITY', ago: 8, auditor: AUDITOR2, score: 60,
    findings: [
      {
        item: 0, severity: 'High', status: 'In Progress', assignedTo: FIXER, due: 4, photo: true,
        note: 'Thước cặp tại trạm QC2 quá hạn hiệu chuẩn 3 tuần.',
        log: [{ day: 2, who: FIXER, text: 'Đã gửi thiết bị đi hiệu chuẩn, chờ kết quả.' }],
      },
      {
        item: 3, severity: 'Critical', status: 'Open', assignedTo: FIXER2, due: -2, photo: true,
        note: 'Hàng lỗi chưa được tách khỏi khu vực hàng đạt, không có nhãn nhận biết.',
      },
    ],
  },
  {
    zone: 'hoachat', tpl: 'ENV', ago: 10, auditor: AUDITOR, score: 40,
    findings: [
      {
        item: 1, severity: 'Critical', status: 'Resolved', assignedTo: FIXER, due: 5, photo: true,
        note: 'Phuy dầu thủy lực không có khay hứng tràn, nền đã thấm dầu.',
        log: [{ day: 4, who: FIXER, text: 'Đã xử lý: lắp khay hứng tràn và làm sạch nền bằng vật liệu thấm dầu.' }],
      },
      {
        item: 2, severity: 'High', status: 'In Progress', assignedTo: FIXER3, due: 9,
        note: 'Rãnh thoát nước mưa phía sau kho có váng dầu.',
      },
      {
        item: 3, severity: 'Medium', status: 'Resolved', assignedTo: FIXER2, due: 7,
        note: 'Nhật ký bàn giao chất thải nguy hại bỏ trống 2 tuần gần nhất.',
        log: [{ day: 6, who: FIXER2, text: 'Đã xử lý: cập nhật đầy đủ nhật ký và dán quy trình ghi chép tại kho.' }],
      },
    ],
  },
  {
    zone: 'kho', tpl: 'SAFETY', ago: 12, auditor: AUDITOR2, score: 83,
    findings: [
      {
        item: 1, severity: 'High', status: 'Resolved', assignedTo: FIXER, due: 4, photo: true,
        note: 'Lối thoát hiểm số 2 bị chắn bởi thùng carton chờ xuất.',
        log: [{ day: 3, who: FIXER, text: 'Đã xử lý: chuyển toàn bộ thùng sang khu chờ xuất và kẻ vạch cấm để hàng.' }],
      },
    ],
  },
  {
    zone: 'xuong', tpl: 'SAFETY', ago: 15, auditor: AUDITOR, score: 67,
    findings: [
      {
        item: 2, severity: 'High', status: 'Closed', assignedTo: FIXER2, due: 5, photo: true,
        note: 'Hai công nhân chuyền 1 không đeo kính bảo hộ khi mài.',
        log: [
          { day: 2, who: FIXER2, text: 'Đã xử lý: họp nhắc nhở ca và bổ sung kính bảo hộ tại đầu chuyền.' },
          { day: 4, who: AUDITOR, text: 'Xác nhận đóng: kiểm tra lại, toàn bộ ca đã đeo đủ PPE.' },
        ],
      },
      {
        item: 3, severity: 'Medium', status: 'Closed', assignedTo: FIXER3, due: 7,
        note: 'Tủ điện E3 không khóa, thiếu biển cảnh báo điện áp.',
        log: [
          { day: 5, who: FIXER3, text: 'Đã xử lý: lắp khóa và dán biển cảnh báo theo mẫu.' },
          { day: 6, who: AUDITOR, text: 'Xác nhận đóng: đạt yêu cầu.' },
        ],
      },
    ],
  },
  { zone: 'vanphong', tpl: 'SAFETY', ago: 18, auditor: AUDITOR2, score: 100, findings: [] },
  {
    zone: 'kho', tpl: 'QUALITY', ago: 21, auditor: AUDITOR, score: 80,
    findings: [
      {
        item: 2, severity: 'Medium', status: 'Closed', assignedTo: FIXER, due: 6, photo: true,
        note: 'Hồ sơ kiểm tra đầu ca ngày 12 và 13 không có chữ ký ca trưởng.',
        log: [
          { day: 3, who: FIXER, text: 'Đã xử lý: bổ sung chữ ký và phổ biến lại quy định ghi hồ sơ.' },
          { day: 5, who: AUDITOR, text: 'Xác nhận đóng: hồ sơ đã đầy đủ.' },
        ],
      },
    ],
  },
  {
    zone: 'cangtin', tpl: 'ENV', ago: 25, auditor: AUDITOR2, score: 80,
    findings: [
      {
        item: 4, severity: 'Low', status: 'Closed', assignedTo: FIXER3, due: 10,
        note: 'Quạt hút khu bếp kêu to, lưu lượng yếu.',
        log: [
          { day: 7, who: FIXER3, text: 'Đã xử lý: vệ sinh và thay bạc quạt hút.' },
          { day: 9, who: AUDITOR2, text: 'Xác nhận đóng: đo lại lưu lượng đạt yêu cầu.' },
        ],
      },
    ],
  },
  {
    zone: 'hoachat', tpl: '5S', ago: 29, auditor: AUDITOR, score: 60,
    findings: [
      {
        item: 0, severity: 'High', status: 'Closed', assignedTo: FIXER, due: 7, photo: true,
        note: 'Lối đi trong kho dầu bị chiếm bởi phuy rỗng chờ thanh lý.',
        log: [
          { day: 4, who: FIXER, text: 'Đã xử lý: chuyển 18 phuy rỗng ra khu thanh lý.' },
          { day: 6, who: AUDITOR, text: 'Xác nhận đóng: lối đi đã thông thoáng.' },
        ],
      },
      {
        item: 1, severity: 'Medium', status: 'Resolved', assignedTo: FIXER2, due: 12, photo: true,
        note: 'Dụng cụ phòng tràn đổ để lẫn với dụng cụ vệ sinh thường.',
        log: [{ day: 10, who: FIXER2, text: 'Đã xử lý: tách riêng tủ dụng cụ ứng phó tràn đổ và dán nhãn.' }],
      },
    ],
  },
  {
    zone: 'xuong', tpl: '5S', ago: 38, auditor: AUDITOR, score: 80,
    findings: [
      {
        item: 1, severity: 'Medium', status: 'Closed', assignedTo: FIXER3, due: 7,
        note: 'Bộ cờ lê chuyền 2 không về đúng bảng treo sau ca.',
        log: [
          { day: 3, who: FIXER3, text: 'Đã xử lý: kẻ lại hình bóng dụng cụ trên bảng treo.' },
          { day: 5, who: AUDITOR, text: 'Xác nhận đóng: kiểm tra cuối ca đạt.' },
        ],
      },
    ],
  },
  {
    zone: 'kho', tpl: '5S', ago: 45, auditor: AUDITOR2, score: 80,
    findings: [
      {
        item: 4, severity: 'Low', status: 'Closed', assignedTo: FIXER, due: 10,
        note: 'Thùng rác khu đóng gói chưa dán nhãn phân loại.',
        log: [
          { day: 4, who: FIXER, text: 'Đã xử lý: dán nhãn 3 loại tái chế / thường / nguy hại.' },
          { day: 6, who: AUDITOR2, text: 'Xác nhận đóng: đạt.' },
        ],
      },
    ],
  },
];

// ---------- helpers ----------

const shiftDay = (day: string, delta: number): string => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** 02:30Z is mid-morning in Asia/Ho_Chi_Minh, so the timestamps read sensibly in the app. */
const at = (day: string, hhmm: string) => `${day}T${hhmm}:00.000Z`;

/** Stable 32-hex name so re-seeding reuses the same file instead of filling the uploads folder. */
const photoName = (key: string) => `${createHash('md5').update(key).digest('hex')}.png`;

function writePhoto(dir: string, kind: 'before' | 'after', key: string, caption: string): string {
  const name = photoName(`${kind}:${key}`);
  const file = resolve(dir, name);
  if (!existsSync(file)) writeFileSync(file, renderDemoPhoto(kind, caption));
  return `/api/files/${name}`;
}

const logLines = (base: string, entries: { day: string; who: string; text: string }[]): string =>
  entries.reduce((acc, e) => `${acc}\n\n[${e.day} · ${NAME_OF[e.who] ?? e.who}] ${e.text}`, base);

// ---------- master data the demo adds on top of seedMockRepo ----------

function extendMaster(repo: MockRepo): { zones: Record<ZoneKey, Zone>; templates: Record<TplKey, Template> } {
  const byTitle = (t: string) => repo.zones.find((z) => z.title === t)!;

  const addZone = (title: string, zoneManager: string, description: string): Zone => {
    const existing = repo.zones.find((z) => z.title === title);
    if (existing) return existing;
    const z: Zone = { id: randomUUID(), title, zoneManager, description, imageUrl: null };
    repo.zones.push(z);
    return z;
  };

  const addTemplate = (title: string, category: Category, items: string[]): Template => {
    const existing = repo.templates.find((t) => t.title === title);
    if (existing) return existing;
    const t: Template = { id: randomUUID(), title, category };
    repo.templates.push(t);
    const rows: TemplateItem[] = items.map((itemTitle, i) => ({ id: randomUUID(), templateId: t.id, title: itemTitle, order: i + 1 }));
    repo.items.push(...rows);
    return t;
  };

  const zones: Record<ZoneKey, Zone> = {
    kho: byTitle('Kho thành phẩm A'),
    xuong: byTitle('Xưởng sản xuất 1'),
    vanphong: byTitle('Khu văn phòng'),
    hoachat: addZone('Khu hóa chất & kho dầu', 'Phạm Minh Đức', 'Kho dung môi, dầu nhớt và khu pha hóa chất'),
    cangtin: addZone('Căng tin & khu thay đồ', 'Võ Thị Hà', 'Căng tin ca, khu vệ sinh và tủ đồ công nhân'),
  };

  const templates: Record<TplKey, Template> = {
    '5S': repo.templates.find((t) => t.category === '5S')!,
    SAFETY: repo.templates.find((t) => t.category === 'Safety')!,
    QUALITY: addTemplate('Kiểm tra chất lượng đầu ca', 'Quality', [
      'Thiết bị đo còn hạn hiệu chuẩn',
      'Mẫu đối chứng có sẵn tại chuyền',
      'Hồ sơ kiểm tra đầu ca được ghi và ký đầy đủ',
      'Sản phẩm lỗi được tách riêng và dán nhãn',
      'Thông số máy khớp với lệnh sản xuất',
    ]),
    ENV: addTemplate('Kiểm tra môi trường & chất thải', 'Environment', [
      'Chất thải nguy hại lưu đúng khu vực có mái che',
      'Thùng chứa dầu có khay hứng tràn',
      'Rãnh thoát nước mưa không nhiễm dầu, hóa chất',
      'Nhật ký bàn giao chất thải được cập nhật',
      'Quạt hút, hệ thống xử lý khí thải hoạt động bình thường',
    ]),
  };

  return { zones, templates };
}

export interface DemoSeedResult {
  zones: number;
  templates: number;
  runs: number;
  findings: number;
}

/** Idempotent: a repo that already holds runs is left untouched. */
export function seedDemoData(repo: MockRepo, opts: { uploadsDir: string; timezone: string }): DemoSeedResult {
  const count = (): DemoSeedResult => ({
    zones: repo.zones.length,
    templates: repo.templates.length,
    runs: repo.runs.length,
    findings: repo.findings.length,
  });
  if (repo.runs.length) return count();

  const { zones, templates } = extendMaster(repo);
  mkdirSync(opts.uploadsDir, { recursive: true });
  const today = todayIn(opts.timezone);

  for (const [runIdx, spec] of RUNS.entries()) {
    const zone = zones[spec.zone];
    const tpl = templates[spec.tpl];
    const items = repo.items.filter((i) => i.templateId === tpl.id).sort((a, b) => a.order - b.order);
    const auditDate = shiftDay(today, -spec.ago);

    const run: Run = {
      id: randomUUID(),
      title: `${tpl.title} - ${zone.title} - ${auditDate}`,
      zoneId: zone.id,
      auditDate,
      auditor: spec.auditor,
      score: spec.score,
      createdOn: at(auditDate, '02:30'),
    };
    repo.runs.push(run);

    for (const [fIdx, f] of spec.findings.entries()) {
      const item = items[f.item];
      if (!item) continue;
      const logs = (f.log ?? []).map((l) => ({ day: shiftDay(auditDate, l.day), who: l.who, text: l.text }));
      const lastDay = logs.length ? logs[logs.length - 1]!.day : auditDate;
      const hasAfter = f.status === 'Resolved' || f.status === 'Closed';
      const caption = asciiFold(`${zone.title} ${auditDate}`);

      const finding: Finding = {
        id: randomUUID(),
        title: item.title,
        description: logLines(f.note, logs),
        severity: f.severity,
        status: f.status,
        dueDate: f.due === undefined ? null : shiftDay(auditDate, f.due),
        assignedTo: f.assignedTo ?? null,
        beforeImage: f.photo ? writePhoto(opts.uploadsDir, 'before', `${runIdx}:${fIdx}`, caption) : null,
        afterImage: hasAfter ? writePhoto(opts.uploadsDir, 'after', `${runIdx}:${fIdx}`, caption) : null,
        runId: run.id,
        itemId: item.id,
        createdOn: at(auditDate, '02:45'),
        modifiedOn: at(lastDay, '07:10'),
        etag: String(logs.length + 1),
      };
      repo.findings.push(finding);
    }
  }

  return count();
}
