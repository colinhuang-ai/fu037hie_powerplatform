# 04 — Thiết kế giao diện & Hiệu năng

---

## 1. Delegation — thứ giết app Power Apps nhiều nhất

### Cơ chế

Power Apps **không** tải hết dữ liệu về máy. Nó cố dịch công thức `Filter`/`Sort`/`Search` thành query gửi lên SharePoint. Nếu dịch được → server lọc, app nhận đúng kết quả. Nếu **không** dịch được → app tải về `Data row limit` dòng đầu tiên (mặc định **500**, tối đa **2000**) rồi lọc cục bộ.

Hệ quả nguy hiểm: **không có lỗi**. App chạy bình thường, chỉ là thiếu dữ liệu. Ngày đầu 200 findings — đúng. Sáu tháng sau 3000 findings — Fixer không thấy việc của mình và không ai biết tại sao.

### Bảng delegation cho SharePoint

| Thành phần | Delegable? |
|---|---|
| `Filter` với `=`, `<>`, `<`, `>`, `<=`, `>=` trên Text/Number/Date | ✅ |
| `StartsWith` | ✅ |
| `And` / `Or` / `Not` (`&&`, `\|\|`, `!`) | ✅ |
| `in` trên Choice: `Status.Value in ["Open","In Progress"]` | ✅ |
| `Sort` / `SortByColumns` trên 1 cột đơn giản | ✅ |
| `Search` | ✅ (chỉ Text) |
| `LookUp` | ✅ |
| **`Filter` trên Lookup column** (`Zone.Id = 5`) | ❌ |
| **`Filter` trên Person column** (`AssignedTo.Email = …`) | ⚠️ không đáng tin |
| `CountRows` / `Sum` / `Average` | ❌ |
| `In` (chứa chuỗi con) — khác `in` của Choice | ❌ |
| `Search` trên Multi-line text | ❌ |
| `GroupBy` / `AddColumns` / `ShowColumns` | ❌ |
| `IsBlank()` trong Filter | ❌ |
| `User().Email` trực tiếp trong Filter | ❌ |
| Bất kỳ hàm nào có `Today()` **ở vế so sánh** | ✅ (được đánh giá trước) |

### Ba mẫu xử lý

**Mẫu 1 — Shadow column.** Đã áp dụng trong schema: `AssignedToEmail`, `AuditRunId`, `ZoneCode`. Đây là giải pháp gốc, không phải workaround.

**Mẫu 2 — Cache biến trước khi filter.**

```powerfx
// ❌ Không delegable
Filter(AuditFindings, AssignedToEmail = User().Email)

// ✅ Delegable — gblUser.Email là giá trị tĩnh lúc tạo query
Filter(AuditFindings, AssignedToEmail = gblUser.Email)
```

**Mẫu 3 — Thu hẹp trước, tính sau.**

`CountRows` không delegable. Nhưng nếu tập đã được `Filter` delegable thu về dưới 2000 dòng thì `CountRows` trên tập đó là chính xác:

```powerfx
// An toàn: Filter chạy trên server, CountRows chạy trên ~50 dòng kết quả
CountRows(Filter(AuditFindings, AuditRunId = varRun.ID))
```

Với số liệu toàn hệ thống (KPI cho Manager) → **đừng tính trong app**. Dùng Power BI hoặc một flow chạy đêm ghi kết quả vào list `DashboardStats`.

### Kiểm tra trong Studio

Chỗ nào không delegable, Power Apps hiện **chấm xanh gạch chân** kèm cảnh báo. Đừng bỏ qua. Bật **Settings → General → Data row limit = 2000** để giảm rủi ro, nhưng đây là băng dán, không phải chữa bệnh.

---

## 2. Hiệu năng — thứ tự ưu tiên

Đo bằng **Monitor** (Studio → Advanced → Monitor). Đừng đoán.

| Mức | Việc cần làm | Tác động |
|---|---|---|
| 1 | Bật **Delayed load** (Settings → Upcoming features) | Màn hình chỉ load khi mở — cải thiện lớn nhất cho app nhiều màn |
| 2 | Giảm `App.OnStart` xuống dưới 5 dòng | Ảnh hưởng mọi lần mở app |
| 3 | Chuyển `Set()` sang **Named Formula** (`App.Formulas`) | Tính lazy, không chặn lúc mở |
| 4 | Số control / màn hình < 300 | Mỗi control là một đối tượng cần dựng |
| 5 | Tắt **ExplicitColumnSelection = off** → để ON | App chỉ lấy cột đang dùng, giảm payload rõ rệt |
| 6 | Không dùng `Concurrent()` bừa — chỉ khi các lệnh thật sự độc lập | |

### `OnStart` vs Named Formula

```powerfx
// ❌ Chạy lúc mở app, chặn màn hình, dữ liệu đóng băng
Set(varOpenCount, CountRows(Filter(AuditFindings, Status.Value = "Open")))

// ✅ App.Formulas — tính khi có control cần đọc, tự cập nhật
OpenFindingCount = CountRows(Filter(AuditFindings, Status.Value = "Open"));
```

Named Formula không dùng được `Set`, `Collect`, `Navigate` — chỉ biểu thức thuần. Đúng ý đồ: state để dành cho biến, giá trị dẫn xuất để dành cho formula.

### Gallery

- Đặt `galX.TemplateSize` cố định thay vì để tự co giãn theo nội dung.
- Không đặt `LookUp()` vào property của control **trong** gallery template — mỗi row là một request. Gom sẵn bằng `AddColumns` khi tạo collection.
- Dùng `ShowColumns()` khi nạp collection để bỏ cột không dùng.

```powerfx
// ❌ 50 row = 50 request
// lblManager.Text trong gallery:
LookUp(Zones, ID = ThisItem.ZoneId).Title

// ✅ 1 request lúc nạp
ClearCollect(
    colFindings,
    AddColumns(
        Filter(AuditFindings, AuditRunId = varRun.ID),
        ZoneTitle, LookUp(colZones, ID = ZoneId).Title   // colZones đã nạp sẵn
    )
)
```

---

## 3. Ảnh — nguyên nhân số 1 làm app chậm

Ảnh camera điện thoại hiện đại là 3–6 MB. Base64 làm phình thêm 33%. Gửi 10 ảnh như vậy = 80 MB qua 4G trong xưởng.

### Nén trước khi gửi

Control **Add picture** có 2 property điều khiển:

| Property | Giá trị đề xuất | Ý nghĩa |
|---|---|---|
| `MaxImageSize` | `1200` | Cạnh dài tối đa (px). 1200px đủ để thấy rõ vết bẩn / vật cản |
| `MaxUploadSize` | `2` | MB |

Đặt `MaxImageSize = 1200` giảm dung lượng khoảng **90%** mà không ảnh hưởng mục đích sử dụng. Đây là một dòng cấu hình, đổi hẳn trải nghiệm ngoài hiện trường.

### Không hiển thị ảnh full trong gallery

```powerfx
// imgThumb.Image trong gallery — dùng URL, không dùng blob trong bộ nhớ
ThisItem.BeforeImageUrl
```

Ảnh chỉ tải khi row hiện trên màn hình. Nếu nhét base64 vào collection rồi bind, toàn bộ nằm trong RAM.

### Giới hạn số ảnh mỗi finding

1 ảnh Before + 1 ảnh After là đủ cho 95% trường hợp. Nếu cần nhiều hơn → tạo list con `FindingPhotos` thay vì nhồi nhiều cột.

---

## 4. Thiết kế giao diện cho người đi audit

Người dùng thực tế: **đứng trong xưởng, đeo găng tay, một tay cầm điện thoại, ánh sáng gắt hoặc tối**. Thiết kế phải chịu được điều đó.

### Kích thước chạm

| Thành phần | Tối thiểu |
|---|---|
| Nút Pass/Fail/NA | **48 × 48 px** |
| Khoảng cách giữa 2 nút | 8 px |
| Cỡ chữ câu hỏi | 16 px |
| Cỡ chữ nhãn phụ | 13 px |

44px là chuẩn Apple, 48px là chuẩn Material. Chọn 48 vì có găng tay.

### Tương phản

Ngoài trời hoặc dưới đèn xưởng, tương phản 4.5:1 (chuẩn WCAG AA) là **sàn**, không phải mục tiêu. Nhắm 7:1 cho chữ chính.

Đừng dùng **chỉ màu sắc** để phân biệt Pass/Fail — khoảng 8% nam giới bị mù màu đỏ-xanh, và tỉ lệ nam trong xưởng sản xuất cao. Luôn kèm **icon + chữ**:

```
✓ Pass      ✕ Fail      — N/A
```

### Bố cục một câu hỏi

```
┌────────────────────────────────────────┐
│ 3. Lối thoát hiểm có bị cản trở?   (i) │   ← số thứ tự + nút gợi ý
│                                        │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ ✓ Pass│  │✕ Fail│  │— N/A │         │   ← 48px, full width chia 3
│  └──────┘  └──────┘  └──────┘          │
│                                        │
│  ⚠ Critical · Nguyễn Văn A · 19/09  📷 │   ← chỉ hiện khi Fail
└────────────────────────────────────────┘
```

Dòng tóm tắt lỗi chỉ hiện khi `Result = "Fail"` — để người dùng thấy ngay mình đã nhập gì mà không cần mở lại popup.

### Responsive: một app hay hai?

Yêu cầu ban đầu là Auditor dùng mobile, Manager dùng desktop. Hai lựa chọn:

| Cách | Khi nào chọn |
|---|---|
| **Hai app riêng** (Phone layout + Tablet layout) | Chọn cái này. Auditor và Manager có luồng công việc khác hẳn nhau, gộp chung tạo ra một app chứa đầy `If(varRole = …)` — rất khó bảo trì |
| Một app responsive | Chỉ khi 3 role dùng gần như cùng màn hình |

Dùng chung một **Component Library** cho theme, header, badge severity để giao diện đồng nhất giữa 2 app.

### Cấu hình responsive cho app mobile

```
Settings → Display:
  Orientation      = Portrait
  Lock aspect ratio = OFF
  Scale to fit     = OFF
```

Rồi dùng container với AutoLayout, mọi kích thước tính theo `Parent.Width` / `Parent.Height`. Không hardcode `X: 24, Y: 380`.

```powerfx
// Container chính của mọi màn hình
conRoot.Width  = Parent.Width
conRoot.Height = Parent.Height
conRoot.LayoutMode = LayoutMode.Auto
conRoot.LayoutDirection = LayoutDirection.Vertical
```

### Trạng thái rỗng và trạng thái lỗi

Ba trạng thái phải thiết kế, không được bỏ:

1. **Đang tải** — spinner + "Đang tải checklist…"
2. **Rỗng** — "Template này chưa có câu hỏi nào. Liên hệ quản trị viên."
3. **Mất mạng** — banner vàng cố định trên cùng + vẫn cho làm việc offline

App không có 3 thứ này sẽ bị hiểu là "app bị treo" và người dùng bỏ.

---

## 5. Checklist trước khi release

- [ ] Mọi `Filter`/`Sort` không còn cảnh báo delegation (chấm xanh)
- [ ] `App.OnStart` dưới 5 dòng, không có `Navigate`
- [ ] Giá trị dẫn xuất nằm trong `App.Formulas`, không phải `Set` trong `OnStart`
- [ ] `MaxImageSize = 1200` trên mọi control Add picture
- [ ] `ExplicitColumnSelection` = ON
- [ ] Delayed load = ON
- [ ] Nút Submit có khoá chống double-tap (`gblSubmitting`)
- [ ] `Clear(colChecklist)` chỉ chạy **sau** khi Patch thành công
- [ ] Mọi control có `AccessibleLabel`
- [ ] Đã test ở chế độ máy bay (offline) — có `SaveData` / `LoadData`
- [ ] Đã test với tài khoản thuộc từng SharePoint group, không chỉ tài khoản admin
- [ ] App Checker không còn lỗi (Studio → App checker)
- [ ] Indexed column đã tạo **trước khi** list vượt 5000 item
