# 01 — Data Schema trên SharePoint Online

> Backend: **SharePoint Online Lists** (không cần license Premium).
> Site đề xuất: `https://<tenant>.sharepoint.com/sites/ProductionAudit`

---

## 0. Nguyên tắc thiết kế quan trọng (đọc trước khi tạo list)

SharePoint có 3 "cái bẫy" làm app chết khi dữ liệu lớn. Schema dưới đây đã xử lý sẵn:

| Bẫy | Hậu quả | Cách xử lý trong schema này |
|---|---|---|
| **Lookup column không delegable** | `Filter(AuditFindings, AuditRun.Id = 5)` chỉ quét 500–2000 dòng đầu → mất dữ liệu âm thầm | Mỗi Lookup đi kèm **shadow column dạng Number** (`AuditRunId`, `AuditItemId`) để filter |
| **Person column filter không ổn định** | Màn "My Issues" của Fixer sai khi > 2000 findings | Thêm **shadow column Text** `AssignedToEmail` — `=` trên Text luôn delegable |
| **Attachments không Patch được** | Không thể lưu ảnh chụp từ Camera bằng `Patch()` | Dùng **Document Library + Power Automate** trả về URL, lưu vào cột Text (chi tiết ở §7) |

Quy tắc: **cột nào dùng để `Filter` / `Sort` / `Search` thì phải là Text, Number, Date hoặc Choice** — không bao giờ là Lookup hay Person.

---

## 1. List: `Zones`

Danh mục Zone sản xuất. Dữ liệu tĩnh, số dòng nhỏ (< 200).

| Display Name | Internal Name | Type | Cấu hình |
|---|---|---|---|
| Title | `Title` | Single line of text | Tên Zone, VD: `Zone A — Assembly Line 1` |
| ZoneCode | `ZoneCode` | Single line of text | Mã ngắn duy nhất, VD: `ZA-01`. Enforce unique values = Yes |
| Description | `Description` | Multiple lines of text | Plain text (KHÔNG chọn Rich text — Power Apps xử lý HTML rất tệ) |
| Building | `Building` | Choice | `Factory 1`, `Factory 2`, `Warehouse`, `Utility` |
| ZoneManager | `ZoneManager` | Person or Group | Single selection |
| ZoneManagerEmail | `ZoneManagerEmail` | Single line of text | **Shadow column** — dùng để gửi mail trong Flow |
| IsActive | `IsActive` | Yes/No | Default = Yes. Dropdown chọn Zone chỉ lấy `IsActive = true` |

**Indexed columns:** `ZoneCode`, `IsActive`

---

## 2. List: `AuditTemplates`

Bộ tiêu chuẩn kiểm tra. VD: "5S Checklist", "Safety Walk", "Machine Guarding".

| Display Name | Internal Name | Type | Cấu hình |
|---|---|---|---|
| Title | `Title` | Single line of text | Tên template |
| Category | `Category` | Choice | `5S`, `Safety`, `Quality`, `Environment`, `Maintenance` |
| Version | `Version` | Single line of text | VD: `v1.2` — không sửa item của template đang dùng, tạo version mới |
| IsActive | `IsActive` | Yes/No | Default = Yes |

---

## 3. List: `AuditItems`

Các câu hỏi trong checklist. Đây là list **đọc nhiều nhất** trong app.

| Display Name | Internal Name | Type | Cấu hình |
|---|---|---|---|
| Title | `Title` | Multiple lines of text (plain) | Nội dung câu hỏi. Dùng Multi-line vì câu hỏi dài hơn 255 ký tự là bình thường |
| Template | `Template` | Lookup → `AuditTemplates` | Hiển thị cho người dùng |
| TemplateId | `TemplateId` | Number | **Shadow column** — dùng để Filter delegable |
| OrderNumber | `OrderNumber` | Number | Thứ tự hiển thị. Số nguyên, bước nhảy 10 (10, 20, 30…) để chèn thêm sau này |
| Guidance | `Guidance` | Multiple lines of text (plain) | Gợi ý "thế nào là Pass" — hiện trong info popup |
| IsCritical | `IsCritical` | Yes/No | Nếu Fail ở item này → Severity mặc định = `Critical` |
| IsActive | `IsActive` | Yes/No | Default = Yes |

**Indexed columns:** `TemplateId`, `OrderNumber`

---

## 4. List: `AuditRuns`

Mỗi lần đi audit một Zone = 1 record. Đây là bản ghi "header".

| Display Name | Internal Name | Type | Cấu hình |
|---|---|---|---|
| Title | `Title` | Single line of text | Tự sinh: `ZA-01 / 5S / 2026-09-18 14:30` |
| Zone | `Zone` | Lookup → `Zones` | |
| ZoneId | `ZoneId` | Number | **Shadow** |
| ZoneCode | `ZoneCode` | Single line of text | **Shadow** — hiển thị nhanh không cần join |
| Template | `Template` | Lookup → `AuditTemplates` | |
| TemplateId | `TemplateId` | Number | **Shadow** |
| Auditor | `Auditor` | Person or Group | Single selection |
| AuditorEmail | `AuditorEmail` | Single line of text | **Shadow** — filter "my audits" |
| AuditDate | `AuditDate` | Date and Time | Include time = Yes |
| TotalItems | `TotalItems` | Number | Tổng câu hỏi trong lần audit |
| PassCount | `PassCount` | Number | |
| FailCount | `FailCount` | Number | |
| NACount | `NACount` | Number | |
| Score | `Score` | Number | Compliance % — 2 chữ số thập phân |
| Status | `Status` | Choice | `Draft`, `Submitted`, `Completed` |
| GeneralNotes | `GeneralNotes` | Multiple lines of text (plain) | |

**Indexed columns:** `ZoneId`, `AuditorEmail`, `AuditDate`, `Status`

---

## 5. List: `AuditFindings`

Mỗi lỗi (Fail) = 1 record. **List lớn nhất — delegation ở đây quan trọng nhất.**

| Display Name | Internal Name | Type | Cấu hình |
|---|---|---|---|
| Title | `Title` | Single line of text | Tóm tắt ngắn, tự sinh từ câu hỏi |
| AuditRun | `AuditRun` | Lookup → `AuditRuns` | |
| **AuditRunId** | `AuditRunId` | Number | **Shadow — bắt buộc.** Mọi filter theo audit dùng cột này |
| AuditItem | `AuditItem` | Lookup → `AuditItems` | |
| AuditItemId | `AuditItemId` | Number | **Shadow** |
| QuestionText | `QuestionText` | Multiple lines of text (plain) | **Snapshot** nội dung câu hỏi tại thời điểm audit. Nếu sau này sửa AuditItems, lịch sử không bị đổi nghĩa |
| ZoneCode | `ZoneCode` | Single line of text | **Shadow** — filter theo Zone không cần join |
| Description | `Description` | Multiple lines of text (plain) | Mô tả lỗi do Auditor nhập |
| Severity | `Severity` | Choice | `Low`, `Medium`, `High`, `Critical` |
| Status | `Status` | Choice | `Open`, `In Progress`, `Resolved`, `Closed`, `Rejected` |
| AssignedTo | `AssignedTo` | Person or Group | Single selection |
| **AssignedToEmail** | `AssignedToEmail` | Single line of text | **Shadow — bắt buộc.** Màn "My Issues" filter bằng cột này |
| DueDate | `DueDate` | Date only | Auto-set theo Severity (§6) |
| BeforeImageUrl | `BeforeImageUrl` | Single line of text | URL ảnh trong Document Library (§7). **Dùng Text, không dùng Hyperlink** — Hyperlink là complex type, Patch phiền |
| AfterImageUrl | `AfterImageUrl` | Single line of text | Fixer upload |
| ResolutionNotes | `ResolutionNotes` | Multiple lines of text (plain) | |
| ResolvedDate | `ResolvedDate` | Date and Time | |
| ClosedBy | `ClosedBy` | Person or Group | Manager duyệt |
| ClosedDate | `ClosedDate` | Date and Time | |
| RejectReason | `RejectReason` | Multiple lines of text (plain) | |

**Indexed columns (bắt buộc):**
`AuditRunId`, `AssignedToEmail`, `Status`, `DueDate`, `ZoneCode`, `Severity`

> ⚠️ SharePoint chỉ cho tối đa **20 indexed columns / list**, và index phải tạo **trước khi** list vượt 5000 items. Tạo ngay từ đầu.

---

## 6. Quy tắc SLA tự động cho `DueDate`

Set trong app lúc tạo finding, không cần Flow:

| Severity | DueDate |
|---|---|
| Critical | +1 ngày |
| High | +3 ngày |
| Medium | +7 ngày |
| Low | +14 ngày |

---

## 7. Lưu ảnh: Document Library + Flow (KHÔNG dùng Attachments)

### Vì sao không dùng Attachments của SharePoint

Attachments trong Power Apps **chỉ ghi được qua control `Attachments` nằm trong một Edit Form**. Không có cách nào `Patch()` một ảnh từ `Camera` / `AddPicture` vào Attachments. Ép dùng Attachments sẽ khoá bạn vào UI dạng Form, không làm được luồng "Fail → popup → chụp ảnh" như thiết kế.

### Kiến trúc thay thế

1. Tạo **Document Library** tên `AuditPhotos` trên cùng site.
   - Thêm cột `FindingId` (Number) và `Phase` (Choice: `Before`, `After`) để truy vết.
   - Versioning = No (ảnh không cần version, tiết kiệm dung lượng).
2. App gửi ảnh dạng **base64** sang Power Automate.
3. Flow `SaveAuditPhoto` decode base64 → `Create file` vào `AuditPhotos` → trả về đường dẫn.
4. App nhận URL, `Patch()` vào `BeforeImageUrl` / `AfterImageUrl`.

Chi tiết Flow ở `03-power-automate-flows.md`.

### Convention đặt tên file

```
{ZoneCode}_{AuditRunId}_{FindingIndex}_{Before|After}_{yyyyMMddHHmmss}.jpg
VD: ZA-01_142_3_Before_20260918143022.jpg
```

---

## 8. Phân quyền SharePoint (3 roles)

Tạo 3 **SharePoint Group** trên site `ProductionAudit`:

| Group | Quyền | Ghi chú |
|---|---|---|
| `Audit - Auditors` | Contribute: `AuditRuns`, `AuditFindings`, `AuditPhotos`. Read: `Zones`, `AuditTemplates`, `AuditItems` | |
| `Audit - Fixers` | Contribute: `AuditFindings`, `AuditPhotos`. Read: còn lại | Không sửa được `AuditRuns` |
| `Audit - Managers` | Full Control trên site | Duyệt / đóng issue |

> **Quan trọng:** SharePoint permission là lớp bảo mật thật. Ẩn/hiện màn hình trong Power Apps chỉ là UX, **không phải bảo mật** — người dùng vẫn gọi được data source trực tiếp nếu còn quyền trên list.
>
> Nếu yêu cầu là "Fixer chỉ được **thấy** issue của mình": SharePoint item-level permission không scale (giới hạn ~5000 unique permissions / list). Nếu đây là bắt buộc → đó là lý do chính đáng để chuyển sang **Dataverse** với security role.

---

## 9. Thứ tự tạo list

Lookup yêu cầu list đích tồn tại trước. Tạo đúng thứ tự:

```
1. Zones
2. AuditTemplates
3. AuditItems        (lookup → AuditTemplates)
4. AuditRuns         (lookup → Zones, AuditTemplates)
5. AuditFindings     (lookup → AuditRuns, AuditItems)
6. AuditPhotos       (document library)
```

Script tự động hoá: `scripts/Provision-AuditLists.ps1`
