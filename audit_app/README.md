# Production Zone Audit — Power Platform

Hệ thống audit khu vực sản xuất theo tiêu chuẩn 5S / Safety.

| | |
|---|---|
| **Backend** | SharePoint Online Lists |
| **Environment** | `0872aac4-5297-e7ea-8c45-75aa0d3a17b6` |
| **App 1 — Auditor** | Canvas App, Phone layout — ✅ **đã build**, compile PASSED, đang chạy với mock data. Source: [`auditor-app/`](auditor-app/) |
| **App 2 — Fixer** | Canvas App, Phone layout — chưa bắt đầu |
| **App 3 — Manager** | Canvas App, Tablet layout + Power BI — chưa bắt đầu |

---

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/01-schema-sharepoint.md](docs/01-schema-sharepoint.md) | Cấu trúc 6 list, shadow column, phân quyền, chiến lược lưu ảnh |
| [docs/02-powerfx-auditor.md](docs/02-powerfx-auditor.md) | Toàn bộ Power Fx của app Auditor: OnStart, checklist, popup lỗi, Patch, Compliance % |
| [docs/03-power-automate-flows.md](docs/03-power-automate-flows.md) | 4 flow: upload ảnh, báo Fixer, duyệt Manager, digest quá hạn |
| [docs/04-ux-performance.md](docs/04-ux-performance.md) | Delegation, tối ưu hiệu năng, thiết kế UI cho môi trường xưởng |
| [scripts/Provision-AuditLists.ps1](scripts/Provision-AuditLists.ps1) | Tạo toàn bộ list + column + index tự động (PnP PowerShell) |

---

## Bắt đầu

### 1. Tạo SharePoint site và list

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
```

Đăng ký Entra app một lần cho tenant (PnP 2.x bắt buộc):

```powershell
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP-Audit-Provisioning" -Tenant <tenant>.onmicrosoft.com -Interactive
```

Chạy thử không ghi gì:

```powershell
.\scripts\Provision-AuditLists.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/ProductionAudit" -ClientId "<client-id>" -WhatIf
```

Chạy thật, kèm dữ liệu mẫu (5 zone + 1 template 5S + 8 câu hỏi):

```powershell
.\scripts\Provision-AuditLists.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/ProductionAudit" -ClientId "<client-id>" -IncludeSampleData
```

### ⚠ Không build được canvas app offline rồi import

Đã thử và **không đi được** với `pac` 2.11.2 (kiểm chứng 18/09/2026):

| Lệnh | Kết quả |
|---|---|
| `pac canvas validate` | `Error: 'pac canvas validate' is no longer supported.` |
| `pac canvas pack --layout SourceCode` | `Canvas apps packed using yaml SourceCode must be validated first by opening the app for edit within the Power Apps studio.` |
| `pac canvas pack --disable-load-from-yaml` | `System.FormatException` — crash |

Microsoft đã đóng đường sinh `.msapp` từ YAML ngoài Studio. YAML **bắt buộc** phải được Studio validate. Hệ quả: app phải dựng qua một phiên Studio — hoặc bằng Canvas Authoring MCP (cần App ID), hoặc dựng tay theo tài liệu này.

`pac` vẫn hữu ích cho việc khác: `pac canvas download` để lấy source app có sẵn, `pac canvas list`, `pac auth`.

### 2. Tạo Canvas App rỗng

Trong environment ở trên: **Create → Blank app → Blank canvas app → Phone**, đặt tên `Zone Audit — Auditor`.

### 3. Lấy App ID

Mở app trong Studio, URL có dạng:

```
https://make.powerapps.com/e/<environment-id>/canvas/?action=edit&app-id=%2Fproviders%2F...%2Fapps%2F<APP-ID>
```

Hoặc gọn hơn: **make.powerapps.com → Apps → ⋯ trên app → Details** → trường **App ID**.

---

## App Auditor — trạng thái hiện tại

4 màn hình, 123 control, `compile_canvas` ✓ PASSED, đã sync vào Studio.

| File | Màn hình | Nội dung |
|---|---|---|
| `auditor-app/Screen1.pa.yaml` | Site Inspection | Chọn Zone + Template, Address/Description tự điền |
| `auditor-app/scrChecklist.pa.yaml` | Checklist | Gallery câu hỏi, radio Yes/No/N/A, overlay chi tiết lỗi, overlay camera |
| `auditor-app/scrReview.pa.yaml` | Review | Điểm tuân thủ, KPI, danh sách lỗi, Submit có khoá chống double-tap |
| `auditor-app/scrDone.pa.yaml` | Done | Xác nhận, điểm số, bắt đầu lượt mới |

Kế hoạch build chi tiết (contract control đã verify + brief từng màn): [`docs/build-plan/`](docs/build-plan/)

### Đang chạy bằng mock data

`App.OnStart` seed sẵn `colZones` (5), `colTemplates` (2), `colItems` (8 câu hỏi), `colUsers` (5).
App chạy trọn luồng ngay, chưa cần SharePoint.

**Đổi sang SharePoint** chỉ động vào 3 chỗ, công thức có sẵn ở [docs/02-powerfx-auditor.md](docs/02-powerfx-auditor.md):

1. `App.OnStart` — bỏ 4 `ClearCollect` mock, thêm data source SharePoint
2. Nút `Khảo sát ›` trên Screen1 — `Filter(AuditItems, TemplateId = …)` thay cho `Filter(colItems, …)`
3. Nút `Gửi audit` trên scrReview — `Patch(AuditRuns, …)` + `ForAll(FailList, Patch(AuditFindings, …))`

Ảnh hiện lưu trong collection dạng data URI. Khi đấu SharePoint, thay bằng flow `SaveAuditPhoto` ([docs/03](docs/03-power-automate-flows.md)) rồi lưu URL trả về.

### Vấn đề còn lại (đã cân nhắc, không phải bỏ sót)

| Cảnh báo | Quyết định |
|---|---|
| App checker: 4 × `CollectingReadOnlyTable` | 4 collection mock chỉ đọc. Sẽ tự hết khi thay bằng data source SharePoint — không chuyển sang named formula để rồi phải gỡ ra |
| Accessibility: 3 × missing tab stop trên `ChkImgThumb`, `RevImgFailPhoto`, `DoneIconCheck` | Cả 3 là control trang trí (thumbnail và dấu tích thành công), không có `OnSelect`. Đặt `TabIndex: =-1` để loại khỏi tab order. App checker muốn `>= 0`, nhưng thêm điểm dừng bàn phím vào ảnh không bấm được là làm xấu trải nghiệm người dùng bàn phím |
| Accessibility suggestion: đổi tên `Screen1` | Giữ nguyên. Canvas app yêu cầu màn đầu là `Screen1` để khớp `_EditorState.pa.yaml` và `App.StartScreen` |

---

## Kiến trúc dữ liệu — tóm tắt

```
Zones ──┐
        ├──> AuditRuns ──> AuditFindings ──> AuditPhotos (doc library)
AuditTemplates ──> AuditItems ──┘
```

Ba quyết định thiết kế quan trọng, lý do đầy đủ nằm trong `docs/01`:

1. **Shadow column cho mọi Lookup và Person** (`AuditRunId`, `AssignedToEmail`, `ZoneCode`) — Lookup và Person không delegable trên SharePoint, app sẽ âm thầm mất dữ liệu khi vượt 2000 record.
2. **Ảnh lưu qua Document Library + Flow**, không dùng Attachments — Attachments không `Patch()` được từ Camera.
3. **Auditor làm việc trên collection, ghi 1 lần khi Submit** — mạng xưởng chập chờn, ghi từng câu hỏi sẽ mất dữ liệu giữa chừng.
