import type { User } from '../db.js';
import type { Finding, FindingPatch, Severity } from '../dataverse/types.js';
import { badRequest, conflict, forbidden } from '../errors.js';

/** Images are only accepted from our own upload endpoint, never arbitrary URLs. */
export const IMAGE_PATH_RE = /^\/api\/files\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
export const DESCRIPTION_MAX = 2000;

const sameEmail = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

/** Auditors/admins see everything; fixers see what is assigned to them plus the unassigned pool of open findings. */
export function canSeeFinding(user: User, f: Finding): boolean {
  if (user.role !== 'fixer') return true;
  return sameEmail(f.assignedTo, user.email) || (!f.assignedTo && f.status === 'Open');
}

export type FindingAction =
  | { type: 'assign'; assignedTo: string | null; dueDate?: string | null }
  | { type: 'update'; severity?: Severity; dueDate?: string | null; title?: string; description?: string | null }
  | { type: 'start' }
  | { type: 'resolve'; afterImage: string; note?: string }
  | { type: 'close'; note?: string }
  | { type: 'reopen'; note: string };

function appendLog(description: string | null, user: User, text: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 10);
  const next = `${description ? `${description}\n\n` : ''}[${stamp} · ${user.name}] ${text}`;
  if (next.length > DESCRIPTION_MAX) throw badRequest(`Mô tả đã đạt giới hạn ${DESCRIPTION_MAX} ký tự, không thể ghi thêm ghi chú`);
  return next;
}

const isAuditor = (u: User) => u.role === 'auditor' || u.role === 'admin';
const isFixer = (u: User) => u.role === 'fixer' || u.role === 'admin';

/**
 * Open ──start──▶ In Progress ──resolve──▶ Resolved ──close──▶ Closed
 *  ▲                                          │
 *  └────────────────reopen────────────────────┴───── (also from Closed)
 *
 * Fixers move findings forward to Resolved; only auditors verify (close) or reject (reopen).
 * Returns the patch to persist, or throws an HttpError. `assigneeIsFixer` is resolved by the caller for `assign`.
 */
export function planTransition(user: User, f: Finding, action: FindingAction, now = new Date()): FindingPatch {
  switch (action.type) {
    case 'assign': {
      if (!isAuditor(user)) throw forbidden();
      if (f.status !== 'Open' && f.status !== 'In Progress') throw conflict('Chỉ giao việc được khi sự cố đang Mở hoặc Đang xử lý');
      const patch: FindingPatch = { assignedTo: action.assignedTo ? action.assignedTo.toLowerCase() : null };
      if (action.dueDate !== undefined) patch.dueDate = action.dueDate;
      return patch;
    }

    case 'update': {
      if (!isAuditor(user)) throw forbidden();
      if (f.status === 'Closed') throw conflict('Sự cố đã đóng, hãy mở lại trước khi chỉnh sửa');
      const patch: FindingPatch = {};
      if (action.severity !== undefined) patch.severity = action.severity;
      if (action.dueDate !== undefined) patch.dueDate = action.dueDate;
      if (action.title !== undefined) patch.title = action.title;
      if (action.description !== undefined) patch.description = action.description;
      if (!Object.keys(patch).length) throw badRequest('Không có thay đổi nào');
      return patch;
    }

    case 'start': {
      if (!isFixer(user)) throw forbidden();
      if (f.status !== 'Open') throw conflict('Chỉ bắt đầu xử lý được sự cố đang Mở');
      if (f.assignedTo && !sameEmail(f.assignedTo, user.email) && user.role !== 'admin') throw forbidden('Sự cố này đã giao cho người khác');
      return { status: 'In Progress', assignedTo: f.assignedTo ?? user.email.toLowerCase() };
    }

    case 'resolve': {
      if (!isFixer(user)) throw forbidden();
      if (f.status !== 'In Progress') throw conflict('Chỉ báo hoàn thành được sự cố đang Đang xử lý');
      if (!sameEmail(f.assignedTo, user.email) && user.role !== 'admin') throw forbidden('Sự cố này không được giao cho bạn');
      if (!IMAGE_PATH_RE.test(action.afterImage)) throw badRequest('Ảnh sau xử lý không hợp lệ');
      const patch: FindingPatch = { status: 'Resolved', afterImage: action.afterImage };
      if (action.note?.trim()) patch.description = appendLog(f.description, user, `Đã xử lý: ${action.note.trim()}`, now);
      return patch;
    }

    case 'close': {
      if (!isAuditor(user)) throw forbidden();
      if (f.status !== 'Resolved') throw conflict('Chỉ đóng được sự cố đã được báo Hoàn thành');
      const patch: FindingPatch = { status: 'Closed' };
      if (action.note?.trim()) patch.description = appendLog(f.description, user, `Xác nhận đóng: ${action.note.trim()}`, now);
      return patch;
    }

    case 'reopen': {
      if (!isAuditor(user)) throw forbidden();
      if (f.status !== 'Resolved' && f.status !== 'Closed') throw conflict('Chỉ mở lại được sự cố đã Hoàn thành hoặc Đã đóng');
      return { status: 'Open', description: appendLog(f.description, user, `Mở lại: ${action.note.trim()}`, now) };
    }
  }
}
