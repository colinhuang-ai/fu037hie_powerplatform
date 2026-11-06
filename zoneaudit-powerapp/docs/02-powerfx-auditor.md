# 02 — Power Fx cho Auditor App (SharePoint backend)

Toàn bộ công thức dưới đây viết cho **SharePoint Online** — cú pháp Patch của Person / Choice / Lookup khác Dataverse, đừng copy nhầm.

---

## 0. Kiến trúc state của app

Auditor làm việc **offline-first trên collection**, chỉ ghi xuống SharePoint đúng 1 lần khi bấm Submit. Điều này quan trọng vì:

- Trong xưởng sóng wifi chập chờn — ghi từng câu hỏi sẽ mất dữ liệu giữa chừng.
- Ghi 30 lần `Patch` lẻ tẻ chậm hơn 1 lần ghi gộp rất nhiều.

| State | Loại | Nội dung |
|---|---|---|
| `colChecklist` | Collection | Bản sao câu hỏi + kết quả đang làm dở. **Nguồn sự thật khi đang audit** |
| `varZone` | Variable | Record Zone đang chọn |
| `varTemplate` | Variable | Record Template đang chọn |
| `varCurrentItem` | Variable | Câu hỏi đang mở popup Fail |
| `varShowFailPanel` | Variable | Bật/tắt popup nhập lỗi |
| `varSubmitting` | Variable | Khoá nút Submit chống double-tap |

---

## 1. `App.OnStart`

> Giữ `OnStart` **mỏng**. Mọi thứ nặng đưa vào `OnVisible` của màn hình cần nó. `OnStart` chậm = app mở chậm ở mọi lần dùng.

```powerfx
// Theme tokens — đổi 1 chỗ, đổi cả app
Set(
    gblTheme,
    {
        Primary:    RGBA(17, 17, 17, 1),
        Surface:    RGBA(255, 255, 255, 1),
        Bg:         RGBA(245, 246, 248, 1),
        TextMain:   RGBA(32, 31, 30, 1),
        TextMuted:  RGBA(110, 110, 115, 1),
        Border:     RGBA(225, 227, 231, 1),
        Pass:       RGBA(16, 124, 16, 1),
        Fail:       RGBA(196, 43, 28, 1),
        NA:         RGBA(140, 140, 145, 1),
        Critical:   RGBA(164, 38, 44, 1),
        High:       RGBA(202, 80, 16, 1),
        Medium:     RGBA(234, 168, 0, 1),
        Low:        RGBA(0, 120, 212, 1)
    }
);

// Người dùng hiện tại — cache lại, đừng gọi User() lặp trong gallery
Set(
    gblUser,
    {
        Email: Lower(User().Email),
        Name:  User().FullName,
        Image: User().Image
    }
);

Set(gblSubmitting, false);
```

**Không** đặt `Navigate()` trong `OnStart` — dùng `App.StartScreen = Screen1`.

---

## 2. Màn 1 — Chọn Zone

### Dropdown Zone (delegable)

```powerfx
// ddZone.Items
Sort(
    Filter(Zones, IsActive = true),
    Title,
    SortOrder.Ascending
)
```

`IsActive = true` và `Sort` theo Text đều delegable trên SharePoint. An toàn kể cả khi có 5000 zone.

### Dropdown Template

```powerfx
// ddTemplate.Items
Sort(Filter(AuditTemplates, IsActive = true), Title)
```

### Hiển thị mô tả Zone khi chọn

```powerfx
// lblZoneDesc.Text
Coalesce(ddZone.Selected.Description, "Chưa có mô tả cho khu vực này.")
```

### Nút "Bắt đầu Audit" — `OnSelect`

Đây là bước nạp checklist vào collection.

```powerfx
Set(varZone, ddZone.Selected);
Set(varTemplate, ddTemplate.Selected);

ClearCollect(
    colChecklist,
    AddColumns(
        // Filter theo shadow column TemplateId (Number) — delegable.
        // Nếu filter theo Template.Id (Lookup) sẽ KHÔNG delegable.
        SortByColumns(
            Filter(
                AuditItems,
                TemplateId = ddTemplate.Selected.ID,
                IsActive = true
            ),
            "OrderNumber",
            SortOrder.Ascending
        ),
        // Các cột làm việc, chỉ tồn tại trong bộ nhớ app
        Result,        Blank(),   // "Pass" | "Fail" | "NA"
        FailDesc,      "",
        FailSeverity,  "",
        FailAssignee,  Blank(),
        FailPhotoUrl,  "",
        FailPhotoPreview, Blank()
    )
);

Set(varAuditStart, Now());
Navigate(scrChecklist, ScreenTransition.Fade);
```

> `AddColumns` với `Blank()` cho cột record (`FailAssignee`) đôi khi làm Power Fx suy ra kiểu sai. Nếu gặp lỗi type, khai báo rõ:
> `FailAssignee, If(false, First(Office365Users.SearchUser({searchTerm:"x"})), Blank())`

---

## 3. Màn 2 — Checklist

### Gallery items

```powerfx
// galChecklist.Items
colChecklist
```

Collection nằm trong bộ nhớ → **không có giới hạn delegation**. Đây là lý do chính để nạp vào collection thay vì bind thẳng data source.

### Segmented control Pass / Fail / N/A

Ba nút trong mỗi row. Ví dụ nút **Pass**:

```powerfx
// btnPass.OnSelect
Patch(
    colChecklist,
    ThisItem,
    {
        Result: "Pass",
        // Xoá dữ liệu lỗi nếu trước đó chọn Fail rồi đổi ý
        FailDesc: "",
        FailSeverity: "",
        FailAssignee: Blank(),
        FailPhotoUrl: "",
        FailPhotoPreview: Blank()
    }
)
```

```powerfx
// btnPass.Fill
If(ThisItem.Result = "Pass", gblTheme.Pass, RGBA(0,0,0,0))

// btnPass.Color
If(ThisItem.Result = "Pass", RGBA(255,255,255,1), gblTheme.TextMuted)
```

Nút **N/A** tương tự với `Result: "NA"`.

Nút **Fail** mở popup:

```powerfx
// btnFail.OnSelect
Patch(colChecklist, ThisItem, {Result: "Fail"});
Set(varCurrentItem, ThisItem);

// Câu hỏi đánh dấu IsCritical thì mặc định Severity = Critical
Set(
    varFailSeverity,
    Coalesce(
        Blank(),
        If(ThisItem.IsCritical, "Critical", ThisItem.FailSeverity)
    )
);
Set(varShowFailPanel, true)
```

### Thanh tiến độ

```powerfx
// lblProgress.Text
$"{CountRows(Filter(colChecklist, !IsBlank(Result)))} / {CountRows(colChecklist)} câu hỏi"
```

```powerfx
// recProgressFill.Width
Parent.Width *
    (CountRows(Filter(colChecklist, !IsBlank(Result))) / Max(CountRows(colChecklist), 1))
```

---

## 4. Popup nhập chi tiết lỗi

### Chọn mức độ rủi ro

```powerfx
// ddSeverity.Items
["Low", "Medium", "High", "Critical"]

// ddSeverity.Default
varFailSeverity
```

Màu badge theo severity:

```powerfx
// lblSeverityBadge.Fill
Switch(
    ddSeverity.Selected.Value,
    "Critical", gblTheme.Critical,
    "High",     gblTheme.High,
    "Medium",   gblTheme.Medium,
    gblTheme.Low
)
```

### Chọn người khắc phục (Office365Users)

```powerfx
// cmbAssignee.Items
Office365Users.SearchUserV2(
    {
        searchTerm: cmbAssignee.SearchText,
        top: 15
    }
).value
```

```powerfx
// cmbAssignee.DisplayFields    → ["DisplayName"]
// cmbAssignee.SearchFields     → ["DisplayName"]
// cmbAssignee.SelectMultiple   → false
```

> Dùng `SearchUserV2` chứ không phải `SearchUser`. V2 có phân trang và `top`, tránh timeout khi tenant lớn.
> Đặt `top: 15` — không ai cuộn quá 15 kết quả trên điện thoại.

### Chụp ảnh và upload ngay

**Thiết kế then chốt:** upload ảnh **ngay lúc chụp**, không đợi đến lúc Submit.

Lý do: `ForAll` trong Power Fx không chạy tuần tự và **không cho phép `Set()` bên trong**, nên không thể "upload từng ảnh rồi lấy URL" ở bước Submit. Upload ngay còn cho Auditor thấy ảnh đã lưu thành công, và chia tải mạng ra nhiều thời điểm thay vì dồn vào một cú Submit nặng.

```powerfx
// btnCapture.OnSelect  (control: AddPicture / Camera)
Set(varUploading, true);

Set(
    varPhotoResult,
    SaveAuditPhoto.Run(
        // Tên file: GUID vì lúc này chưa có FindingId
        $"{varZone.ZoneCode}_{Text(GUID())}_Before_{Text(Now(), ""yyyymmddhhmmss"")}.jpg",
        // JSON base64 — bỏ phần header "data:image/jpeg;base64,"
        Substitute(
            JSON(addPicFail.Media, JSONFormat.IncludeBinaryData),
            """",
            ""
        ),
        "Before"
    )
);

Patch(
    colChecklist,
    LookUp(colChecklist, ID = varCurrentItem.ID),
    {
        FailPhotoUrl: varPhotoResult.fileurl,
        FailPhotoPreview: addPicFail.Media
    }
);

Set(varUploading, false)
```

```powerfx
// imgFailPreview.Image
Coalesce(
    LookUp(colChecklist, ID = varCurrentItem.ID).FailPhotoPreview,
    SampleImage
)

// imgFailPreview.Visible
!IsBlank(LookUp(colChecklist, ID = varCurrentItem.ID).FailPhotoUrl)
```

### Nút "Lưu lỗi" trong popup

```powerfx
// btnSaveFail.OnSelect
Patch(
    colChecklist,
    LookUp(colChecklist, ID = varCurrentItem.ID),
    {
        FailDesc:     txtFailDesc.Text,
        FailSeverity: ddSeverity.Selected.Value,
        FailAssignee: cmbAssignee.Selected
    }
);
Set(varShowFailPanel, false);
Reset(txtFailDesc);
Reset(cmbAssignee)
```

```powerfx
// btnSaveFail.DisplayMode
If(
    !IsBlank(txtFailDesc.Text)
        && !IsBlank(ddSeverity.Selected)
        && !IsBlank(cmbAssignee.Selected),
    DisplayMode.Edit,
    DisplayMode.Disabled
)
```

### Huỷ popup — trả câu hỏi về trạng thái chưa trả lời

```powerfx
// btnCancelFail.OnSelect
If(
    IsBlank(LookUp(colChecklist, ID = varCurrentItem.ID).FailDesc),
    Patch(colChecklist, LookUp(colChecklist, ID = varCurrentItem.ID), {Result: Blank()})
);
Set(varShowFailPanel, false)
```

---

## 5. Tính Compliance %

Chuẩn ngành: **N/A không tính vào mẫu số**. Một Zone có 5 câu N/A không nên bị phạt điểm.

```powerfx
// Số câu áp dụng được
With(
    {
        applicable: CountRows(Filter(colChecklist, Result in ["Pass", "Fail"])),
        passed:     CountRows(Filter(colChecklist, Result = "Pass"))
    },
    If(applicable = 0, 100, Round(passed / applicable * 100, 2))
)
```

Đặt vào một named formula để dùng lại khắp nơi (App → Formulas):

```powerfx
// App.Formulas  — tính lại tự động, không cần Set()
ComplianceScore =
    With(
        {
            applicable: CountRows(Filter(colChecklist, Result in ["Pass", "Fail"])),
            passed:     CountRows(Filter(colChecklist, Result = "Pass"))
        },
        If(applicable = 0, 100, Round(passed / applicable * 100, 2))
    );

AnsweredCount  = CountRows(Filter(colChecklist, !IsBlank(Result)));
FailList       = Filter(colChecklist, Result = "Fail");
IsAuditComplete = AnsweredCount = CountRows(colChecklist);
```

> **Named Formulas** (`App.Formulas`) tốt hơn `Set()` trong `OnStart`: tính lazy, tự cập nhật khi nguồn đổi, và không làm chậm lúc mở app. Dùng cho mọi giá trị dẫn xuất.

Hiển thị:

```powerfx
// lblScore.Text
$"{Text(ComplianceScore, "[$-en-US]0.0")}%"

// lblScore.Color
If(ComplianceScore >= 90, gblTheme.Pass,
   ComplianceScore >= 75, gblTheme.Medium,
   gblTheme.Fail)
```

---

## 6. Submit — ghi xuống SharePoint

Đây là công thức quan trọng nhất. Ghi theo 2 bước: header trước, lấy ID, rồi ghi findings.

```powerfx
// btnSubmit.OnSelect
If(gblSubmitting, Notify("Đang gửi, vui lòng đợi…", NotificationType.Warning), 

Set(gblSubmitting, true);

// ---------- Bước 1: ghi AuditRuns (header) ----------
Set(
    varAuditRun,
    Patch(
        AuditRuns,
        Defaults(AuditRuns),
        {
            Title: $"{varZone.ZoneCode} / {varTemplate.Title} / {Text(Now(), "yyyy-mm-dd hh:mm")}",

            // Lookup: cần Id + Value
            Zone:   {Id: varZone.ID,     Value: varZone.Title},
            ZoneId: varZone.ID,
            ZoneCode: varZone.ZoneCode,

            Template:   {Id: varTemplate.ID, Value: varTemplate.Title},
            TemplateId: varTemplate.ID,

            // Person: BẮT BUỘC có @odata.type, thiếu là lỗi 400
            Auditor: {
                '@odata.type': "#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser",
                Claims:      "i:0#.f|membership|" & gblUser.Email,
                DisplayName: gblUser.Name,
                Email:       gblUser.Email,
                Department:  "",
                JobTitle:    "",
                Picture:     ""
            },
            AuditorEmail: gblUser.Email,

            AuditDate:  Now(),
            TotalItems: CountRows(colChecklist),
            PassCount:  CountRows(Filter(colChecklist, Result = "Pass")),
            FailCount:  CountRows(Filter(colChecklist, Result = "Fail")),
            NACount:    CountRows(Filter(colChecklist, Result = "NA")),
            Score:      ComplianceScore,

            // Choice: chỉ cần {Value: "..."}
            Status: {Value: "Submitted"},
            GeneralNotes: txtGeneralNotes.Text
        }
    )
);

// ---------- Bước 2: ghi từng Finding ----------
ForAll(
    FailList As f,
    Patch(
        AuditFindings,
        Defaults(AuditFindings),
        {
            Title: Left(f.Title, 200),

            AuditRun:   {Id: varAuditRun.ID, Value: varAuditRun.Title},
            AuditRunId: varAuditRun.ID,

            AuditItem:   {Id: f.ID, Value: Left(f.Title, 200)},
            AuditItemId: f.ID,

            QuestionText: f.Title,
            ZoneCode:     varZone.ZoneCode,
            Description:  f.FailDesc,

            Severity: {Value: f.FailSeverity},
            Status:   {Value: "Open"},

            AssignedTo: {
                '@odata.type': "#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser",
                Claims:      "i:0#.f|membership|" & Lower(f.FailAssignee.Mail),
                DisplayName: f.FailAssignee.DisplayName,
                Email:       f.FailAssignee.Mail,
                Department:  "",
                JobTitle:    "",
                Picture:     ""
            },
            AssignedToEmail: Lower(f.FailAssignee.Mail),

            // SLA tự động theo mức độ
            DueDate: DateAdd(
                Today(),
                Switch(f.FailSeverity, "Critical", 1, "High", 3, "Medium", 7, 14),
                TimeUnit.Days
            ),

            BeforeImageUrl: f.FailPhotoUrl
        }
    )
);

// ---------- Bước 3: kích hoạt thông báo ----------
NotifyNewFindings.Run(varAuditRun.ID);

Set(gblSubmitting, false);
Notify(
    $"Đã gửi audit. Điểm: {Text(ComplianceScore, "0.0")}% — {CountRows(FailList)} lỗi cần khắc phục.",
    NotificationType.Success,
    4000
);
Clear(colChecklist);
Navigate(scrDone, ScreenTransition.Fade)

)
```

### Ghi chú về `ForAll` + `Patch`

`ForAll(…, Patch(…))` gửi **một request cho mỗi finding**. Với audit thực tế (thường < 20 lỗi / lượt) thì hoàn toàn chấp nhận được và đây là pattern đáng tin cậy nhất.

Nếu số finding lớn (> 50), đổi sang batch:

```powerfx
Collect(
    AuditFindings,
    ForAll(FailList As f, { /* cùng record shape như trên */ })
)
```

`Collect` với một table gộp request lại, nhanh hơn đáng kể. Đánh đổi: nếu một record lỗi, khó biết record nào.

### Khoá nút chống double-tap

```powerfx
// btnSubmit.DisplayMode
If(
    gblSubmitting || !IsAuditComplete,
    DisplayMode.Disabled,
    DisplayMode.Edit
)

// lblSubmitHint.Text
If(
    !IsAuditComplete,
    $"Còn {CountRows(colChecklist) - AnsweredCount} câu chưa trả lời",
    ""
)
```

---

## 7. Filter theo người đăng nhập (màn Fixer)

**Sai — không delegable, âm thầm mất dữ liệu:**

```powerfx
Filter(AuditFindings, AssignedTo.Email = User().Email)     // ❌ Person column
Filter(AuditFindings, AuditRun.Id = varRun.ID)             // ❌ Lookup column
```

**Đúng — dùng shadow column, delegable hoàn toàn:**

```powerfx
// galMyIssues.Items
SortByColumns(
    Filter(
        AuditFindings,
        AssignedToEmail = gblUser.Email,        // Text = Text → delegable
        Status.Value in ["Open", "In Progress"] // Choice → delegable
    ),
    "DueDate",
    SortOrder.Ascending
)
```

> `User().Email` không delegable nếu gọi trực tiếp trong `Filter` — Power Apps phải biết giá trị trước khi tạo query. Vì vậy phải cache vào `gblUser.Email` ở `OnStart` (đã làm ở §1).

### Bộ lọc trạng thái có Overdue

`Overdue` không phải giá trị Status trong list — nó là trạng thái dẫn xuất. Xử lý bằng cách ghép điều kiện:

```powerfx
// galMyIssues.Items
With(
    {baseSet: Filter(AuditFindings, AssignedToEmail = gblUser.Email)},
    SortByColumns(
        Switch(
            ddStatusFilter.Selected.Value,
            "Pending",     Filter(baseSet, Status.Value = "Open"),
            "In Progress", Filter(baseSet, Status.Value = "In Progress"),
            "Resolved",    Filter(baseSet, Status.Value = "Resolved"),
            "Overdue",     Filter(baseSet, DueDate < Today(), Status.Value in ["Open","In Progress"]),
            baseSet
        ),
        "DueDate",
        SortOrder.Ascending
    )
)
```

Cả 4 nhánh đều delegable: `Status.Value =` (Choice), `DueDate < Today()` (Date) — Today() được đánh giá trước khi gửi query nên hợp lệ.

---

## 8. Bảng tra cứu cú pháp Patch của SharePoint

Đây là chỗ hay sai nhất. In ra dán cạnh màn hình:

| Kiểu cột | Cú pháp Patch | Sai thường gặp |
|---|---|---|
| Single line text | `Title: "abc"` | — |
| Number | `Score: 87.5` | Truyền text `"87.5"` → lỗi |
| Yes/No | `IsActive: true` | Truyền `"Yes"` |
| Date only | `DueDate: Today()` | — |
| Date and Time | `AuditDate: Now()` | — |
| **Choice** | `Status: {Value: "Open"}` | Truyền thẳng `"Open"` |
| **Multi-Choice** | `Tags: Table({Value:"A"}, {Value:"B"})` | Truyền mảng text |
| **Lookup** | `Zone: {Id: 5, Value: "Zone A"}` | Thiếu `Value` → lookup rỗng |
| **Multi-Lookup** | `Zones: Table({Id:1,Value:"A"}, {Id:2,Value:"B"})` | |
| **Person** | record đầy đủ + `'@odata.type'` (xem §6) | Thiếu `@odata.type` → HTTP 400 |
| Hyperlink | `Link: {Value: "https://…", Description: "text"}` | Truyền chuỗi thuần |
| Attachments | **Không Patch được** | Xem `01-schema §7` |

### Chuỗi Claims của Person

```
"i:0#.f|membership|" & Lower(email)
```

Phải **lowercase** email. `i:0#.f|membership|Nguyen.Van.A@ct.com` và `…|nguyen.van.a@ct.com` bị SharePoint coi là 2 người khác nhau trong một số cấu hình.

---

## 9. Xử lý lỗi khi Submit

`Patch` thất bại sẽ không dừng công thức. Phải kiểm tra chủ động:

```powerfx
Set(varAuditRun, Patch(AuditRuns, Defaults(AuditRuns), { /* … */ }));

If(
    IsBlank(varAuditRun) || !IsBlank(Errors(AuditRuns)),
    // Thất bại — giữ nguyên colChecklist để người dùng thử lại
    Set(gblSubmitting, false);
    Notify(
        $"Không lưu được audit: {First(Errors(AuditRuns)).Message}",
        NotificationType.Error
    ),

    // Thành công — đi tiếp
    ForAll(FailList As f, Patch(AuditFindings, Defaults(AuditFindings), { /* … */ }));
    NotifyNewFindings.Run(varAuditRun.ID);
    Clear(colChecklist);
    Navigate(scrDone)
)
```

> Điểm quan trọng: **chỉ `Clear(colChecklist)` sau khi ghi thành công.** Nếu xoá trước, người audit mất toàn bộ 30 phút đi kiểm tra khi mạng rớt — đây là lỗi hay gặp và làm người dùng bỏ app.

---

## 10. Lưu nháp khi mất mạng (tuỳ chọn, rất nên có)

```powerfx
// btnSaveDraft.OnSelect  /  galChecklist.OnChange
SaveData(colChecklist, "auditDraft");
SaveData(
    Table({zone: varZone, template: varTemplate, started: varAuditStart}),
    "auditDraftMeta"
)
```

```powerfx
// scrHome.OnVisible — khôi phục nháp
LoadData(colDraftCheck, "auditDraft", true);
If(
    CountRows(colDraftCheck) > 0,
    Set(varHasDraft, true)
)
```

`SaveData` / `LoadData` ghi vào bộ nhớ thiết bị, chạy được cả khi offline. Giới hạn ~1MB trên web player, không giới hạn rõ trên mobile — **đừng lưu ảnh base64 vào đây**, chỉ lưu URL.

Kiểm tra kết nối:

```powerfx
// lblOffline.Visible
!Connection.Connected

// lblOffline.Text
"Đang ngoại tuyến — dữ liệu sẽ lưu vào máy và gửi khi có mạng."
```
