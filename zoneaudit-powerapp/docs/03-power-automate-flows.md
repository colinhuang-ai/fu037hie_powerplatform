# 03 — Power Automate Flows

4 flow cần thiết. Flow 1 và 2 được app gọi trực tiếp; flow 3 và 4 chạy nền.

| # | Flow | Trigger | Ai dùng |
|---|---|---|---|
| 1 | `SaveAuditPhoto` | PowerApps (V2) | Auditor, Fixer |
| 2 | `NotifyNewFindings` | PowerApps (V2) | Auditor (khi Submit) |
| 3 | `NotifyResolvedForApproval` | SharePoint — When an item is modified | Tự động |
| 4 | `DailyOverdueDigest` | Recurrence 07:00 hàng ngày | Tự động |

> Đặt tất cả flow trong **cùng một Solution** với app. Nếu để ngoài solution, khi export/import sang môi trường khác sẽ đứt liên kết và phải nối tay lại từng flow.

---

## 1. `SaveAuditPhoto` — upload ảnh, trả về URL

### Trigger: **PowerApps (V2)**

Khai báo 3 input text:

| Tên | Kiểu | Mô tả |
|---|---|---|
| `fileName` | Text | `ZA-01_<guid>_Before_20260918143022.jpg` |
| `fileContentBase64` | Text | Chuỗi base64 thuần, đã bỏ header |
| `phase` | Text | `Before` hoặc `After` |

### Action 2: **SharePoint — Create file**

| Field | Giá trị |
|---|---|
| Site Address | `https://<tenant>.sharepoint.com/sites/ProductionAudit` |
| Folder Path | `/AuditPhotos` |
| File Name | `@{triggerBody()['text']}` (fileName) |
| File Content | biểu thức bên dưới |

```
base64ToBinary(triggerBody()?['text_1'])
```

> `text_1` là tên nội bộ của input thứ hai. Bấm vào ô rồi chọn từ dynamic content để chắc chắn — tên nội bộ đánh số theo thứ tự khai báo, không theo tên hiển thị.

### Action 3: **Respond to a PowerApp or flow**

| Output | Giá trị |
|---|---|
| `fileurl` (Text) | `@{outputs('Create_file')?['body/Path']}` |
| `fileid` (Text) | `@{outputs('Create_file')?['body/Id']}` |

App nhận về qua `SaveAuditPhoto.Run(...).fileurl`.

### Phía app phải gửi base64 sạch

Control `AddPicture` trả về một blob URI, không phải base64. Chuyển đổi:

```powerfx
Substitute(
    JSON(addPicFail.Media, JSONFormat.IncludeBinaryData),
    """",
    ""
)
```

`JSON()` trả chuỗi có dấu nháy kép bao ngoài **và** header `data:image/jpeg;base64,`. Cần bỏ cả hai:

```powerfx
With(
    {raw: JSON(addPicFail.Media, JSONFormat.IncludeBinaryData)},
    Last(Split(Substitute(raw, """", ""), ",")).Value
)
```

Hoặc để Flow tự cắt — thêm **Compose** trước Create file:

```
last(split(triggerBody()?['text_1'], ','))
```

Cách thứ hai an toàn hơn: app chỉ việc gửi nguyên chuỗi `JSON()`, flow tự xử lý.

---

## 2. `NotifyNewFindings` — báo Fixer khi có lỗi mới

### Trigger: **PowerApps (V2)** — input `auditRunId` (Number)

### Action 2: **SharePoint — Get items**

| Field | Giá trị |
|---|---|
| List Name | `AuditFindings` |
| Filter Query | `AuditRunId eq @{triggerBody()['number']}` |
| Top Count | 100 |

> Dùng **Filter Query** ở phía server, không dùng Filter array sau khi lấy hết. Lấy 5000 item về rồi lọc là cách phổ biến nhất làm flow hết hạn mức 30 giây.

### Action 3: **Apply to each** → `value`

Bên trong, dùng **Condition** để tách Critical/High (báo Teams ngay) khỏi Medium/Low (chỉ email).

#### 3a. Post message in a chat or channel (Teams)

| Field | Giá trị |
|---|---|
| Post as | Flow bot |
| Post in | Chat with Flow bot |
| Recipient | `@{items('Apply_to_each')?['AssignedToEmail']}` |
| Message | HTML bên dưới |

```html
<b>🔧 Bạn có lỗi cần khắc phục</b><br><br>
<b>Zone:</b> @{items('Apply_to_each')?['ZoneCode']}<br>
<b>Hạng mục:</b> @{items('Apply_to_each')?['QuestionText']}<br>
<b>Mức độ:</b> @{items('Apply_to_each')?['Severity/Value']}<br>
<b>Hạn xử lý:</b> @{formatDateTime(items('Apply_to_each')?['DueDate'], 'dd/MM/yyyy')}<br><br>
<b>Mô tả:</b> @{items('Apply_to_each')?['Description']}<br><br>
<a href="https://apps.powerapps.com/play/e/@{parameters('EnvironmentId')}/a/@{parameters('AppId')}?FindingId=@{items('Apply_to_each')?['ID']}">
Mở trong app →
</a>
```

> Chú ý cú pháp lấy Choice column: `['Severity/Value']`, không phải `['Severity']`. Lấy sai sẽ ra `[object Object]`.

#### 3b. Adaptive Card thay cho HTML (khuyến nghị)

Dùng **Post adaptive card and wait for a response** để Fixer bấm "Nhận việc" ngay trong Teams — không cần mở app. Sau khi nhận response, thêm **Update item** đặt `Status = In Progress`. Đây là thứ làm người dùng thật sự dùng flow, thay vì bỏ qua notification.

#### 3c. Deep link vào app

```
https://apps.powerapps.com/play/e/{environmentId}/a/{appId}?FindingId={id}
```

Phía app đọc tham số:

```powerfx
// App.OnStart
If(
    !IsBlank(Param("FindingId")),
    Set(varDeepLinkFinding, LookUp(AuditFindings, ID = Value(Param("FindingId"))));
    Set(varStartScreen, "FixerDetail")
)
```

Không gọi `Navigate()` trong `OnStart`. Đặt cờ rồi để `Screen1.OnVisible` điều hướng.

---

## 3. `NotifyResolvedForApproval` — Fixer báo xong, Manager duyệt

### Trigger: **SharePoint — When an item is created or modified**, list `AuditFindings`

### Action 2: **Condition** — chỉ chạy khi vừa chuyển sang Resolved

```
@equals(triggerOutputs()?['body/Status/Value'], 'Resolved')
```

> Trigger này bắn **mỗi lần** item đổi, kể cả khi flow của chính bạn cập nhật item — dễ tạo vòng lặp vô hạn. Hai cách chặn:
>
> 1. Thêm **Trigger Condition** (Settings của trigger):
>    `@equals(triggerOutputs()?['body/Status/Value'], 'Resolved')`
>    Flow chỉ khởi tạo khi đúng điều kiện — không tốn lượt chạy.
> 2. Thêm cột `LastModifiedBy` check khác service account.

### Action 3: **Get item** → lấy `AuditRuns` để biết Zone Manager

Dùng `AuditRunId` từ trigger.

### Action 4: **Start and wait for an approval**

| Field | Giá trị |
|---|---|
| Approval type | Approve/Reject — First to respond |
| Title | `Duyệt khắc phục: @{triggerOutputs()?['body/Title']}` |
| Assigned to | `@{outputs('Get_item')?['body/ZoneManagerEmail']}` |
| Details | Markdown có ảnh Before/After |

```markdown
**Zone:** @{triggerOutputs()?['body/ZoneCode']}
**Mức độ:** @{triggerOutputs()?['body/Severity/Value']}
**Mô tả lỗi:** @{triggerOutputs()?['body/Description']}
**Giải pháp:** @{triggerOutputs()?['body/ResolutionNotes']}

| Trước | Sau |
|---|---|
| ![before](@{triggerOutputs()?['body/BeforeImageUrl']}) | ![after](@{triggerOutputs()?['body/AfterImageUrl']}) |
```

> Ảnh trong approval card chỉ hiện nếu URL truy cập được **mà không cần đăng nhập**. SharePoint yêu cầu auth → ảnh sẽ hiện ô trắng. Hai lựa chọn:
> - Chấp nhận: để link text `[Xem ảnh trước](url)` thay vì nhúng.
> - Hoặc nhúng base64 trực tiếp vào Adaptive Card (nặng, giới hạn 28KB payload).
>
> Thực tế nên dùng **Adaptive Card trong Teams** với `Action.OpenUrl` — người duyệt bấm mở SharePoint, đã sẵn session đăng nhập.

### Action 5: **Condition** theo `Outcome`

| Nhánh | Update item |
|---|---|
| `Approve` | `Status = Closed`, `ClosedBy = approver`, `ClosedDate = utcNow()` |
| `Reject` | `Status = Rejected`, `RejectReason = @{body('Start_and_wait…')?['responses'][0]['comments']}` |

Nhánh Reject gửi tiếp Teams message cho Fixer kèm lý do.

---

## 4. `DailyOverdueDigest` — nhắc việc quá hạn

### Trigger: **Recurrence** — 07:00, Mon–Fri, timezone `SE Asia Standard Time`

### Action 2: **Get items** trên `AuditFindings`

```
Filter Query:
DueDate lt '@{formatDateTime(utcNow(), 'yyyy-MM-dd')}' and (Status eq 'Open' or Status eq 'In Progress')
```

> Filter theo Choice trong OData dùng `Status eq 'Open'` — **không** dùng `Status/Value eq 'Open'` trong Filter Query (khác với cách đọc output). Đây là điểm không nhất quán của connector SharePoint, rất hay nhầm.

### Action 3: **Select** → gom theo người

Dùng **Select** đổi shape rồi `union()` để lấy danh sách email duy nhất:

```
From:  @{body('Get_items')?['value']}
Map:   @{item()?['AssignedToEmail']}
```

```
Compose - unique emails:
@{union(body('Select'), body('Select'))}
```

`union()` với chính nó là cách gọn nhất để khử trùng lặp trong Power Automate.

### Action 4: **Apply to each** email → gửi 1 email tổng hợp

Bên trong lọc lại findings của người đó bằng **Filter array**, rồi tạo bảng HTML bằng **Create HTML table**.

> Gửi **1 email tổng hợp mỗi người**, không phải 1 email mỗi lỗi. Người có 12 lỗi quá hạn nhận 12 email sẽ lập filter rule xoá hết — và bạn mất luôn kênh thông báo.

### Action 5: **Send an email (V2)** cho Manager

Bảng tổng hợp theo Zone, sort theo số lỗi quá hạn giảm dần.

---

## 5. Gọi flow từ Power Apps

Thêm flow vào app: **Power Automate** pane → **Add flow**.

```powerfx
// Gọi và lấy kết quả trả về
Set(varPhotoResult, SaveAuditPhoto.Run(fileName, base64, "Before"));
Set(varUrl, varPhotoResult.fileurl)

// Gọi không cần kết quả (fire and forget)
NotifyNewFindings.Run(varAuditRun.ID)
```

### Ba điều dễ sai

1. **Thứ tự tham số `.Run()` = thứ tự khai báo trong trigger**, không phải tên. Đổi thứ tự input trong flow sẽ làm hỏng app một cách âm thầm.
2. **Timeout 120 giây.** Flow chạy lâu hơn → app nhận lỗi dù flow vẫn chạy tiếp. Flow gọi từ app phải nhẹ.
3. **Mỗi `.Run()` là một API call tính vào giới hạn request/ngày** của license. Đừng gọi flow trong `Gallery.Items` hay `OnVisible` chạy lặp.

### Bắt lỗi khi gọi flow

```powerfx
IfError(
    Set(varPhotoResult, SaveAuditPhoto.Run(fileName, base64, "Before")),
    Notify("Không tải được ảnh lên. Kiểm tra kết nối mạng.", NotificationType.Error);
    Set(varPhotoResult, Blank())
);

If(
    !IsBlank(varPhotoResult),
    Patch(colChecklist, LookUp(colChecklist, ID = varCurrentItem.ID),
          {FailPhotoUrl: varPhotoResult.fileurl})
)
```

---

## 6. Connection reference khi deploy

Khi export solution sang môi trường UAT/PROD, connection **không** đi theo. Chuẩn bị trước:

1. Trong solution, dùng **Connection References** (không dùng connection trực tiếp).
2. Lúc import, Power Platform hỏi map từng connection reference.
3. Với flow chạy nền (flow 3, 4) → dùng **service account** chuyên dụng, không dùng tài khoản cá nhân. Người nghỉ việc là flow chết.

Đặt Site Address và tên list vào **Environment Variables** trong solution:

| Environment Variable | Dev | Prod |
|---|---|---|
| `AuditSiteUrl` | `…/sites/ProductionAudit-Dev` | `…/sites/ProductionAudit` |
| `AuditAppId` | GUID dev | GUID prod |

Flow đọc bằng `@{parameters('AuditSiteUrl')}`. Không hardcode URL vào action.
