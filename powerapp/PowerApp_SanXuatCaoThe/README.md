# Ứng dụng Canvas "Sản xuất cao thế" (Power Apps + Dataverse)

Ứng dụng canvas 2 màn hình, dữ liệu lấy từ tab **`Sản xuất cao thế`** của
`Manufacturing.xlsx` (1.272 bản ghi, 01/01/2026 – 31/07/2026), lưu trong **Dataverse**.

| Màn hình | Nội dung |
|---|---|
| `scrDashboard` | 8 thẻ KPI, biểu đồ sản lượng theo thiết bị và theo tháng, bảng chi tiết theo ngày, bộ lọc Tháng / Loại thiết bị |
| `scrNhapLieu` | Danh sách bản ghi có tìm kiếm + form thêm/sửa/xoá, 4 chỉ số tự tính (SP đạt, Hoàn thành KH, Tỷ lệ lỗi, Năng suất) |

---

## Nội dung bàn giao

```
1_Dataverse/  SanXuatCaoThe_Solution_1_0_0_2.zip   → solution unmanaged, tạo bảng Dataverse
2_CanvasApp/  SanXuatCaoThe_v3.msapp               → ứng dụng canvas
3_DuLieu/     SanXuatCaoThe_Data.csv / .xlsx       → 1.272 dòng để nạp vào bảng
build/                                             → mã nguồn sinh app (xem cuối file)
```

---

## Các bước triển khai trên make.powerapps.com

### Bước 1 — Tạo bảng Dataverse

1. Vào <https://make.powerapps.com> → chọn đúng **Environment** (phải có Dataverse).
2. Menu trái → **Solutions** → **Import solution** → **Browse** →
   chọn `1_Dataverse/SanXuatCaoThe_Solution_1_0_0_2.zip` → **Next** → **Import**.
3. Sau khi import xong, vào **Tables**, tìm bảng **`Sản xuất cao thế`**
   (schema name `mfg_ProductionRecord`).

> Nếu bước import báo lỗi, xem [Phụ lục A](#phụ-lục-a--tạo-bảng-thủ-công) để tạo bảng bằng tay
> (chỉ mất vài phút, và **bắt buộc giữ nguyên tên hiển thị các cột** như bảng liệt kê).

### Bước 2 — Nạp dữ liệu

Trong **Tables → Sản xuất cao thế → Import → Import data from Excel**
(hoặc **Get data → Text/CSV**), chọn `3_DuLieu/SanXuatCaoThe_Data.xlsx`.

Tiêu đề cột trong file **trùng khớp tuyệt đối** với tên hiển thị của cột trong bảng
nên bước *Map columns* sẽ tự khớp hết. Chọn **`Mã bản ghi`** làm cột khoá chính khi được hỏi.

### Bước 3 — Tải ứng dụng canvas lên

1. Vào <https://make.powerapps.com> → **Apps** → **+ New app** → **Canvas** →
   **Blank app / Tablet** để mở Power Apps Studio.
2. Trong Studio: **File → Open → Browse** → chọn `2_CanvasApp/SanXuatCaoThe_v3.msapp`.
   (Studio nhận trực tiếp file `.msapp` từ máy.)
3. **File → Save as → This computer/Cloud** với tên `Sản xuất cao thế`.

### Bước 4 — Gắn nguồn dữ liệu Dataverse

App được đóng gói **không kèm connection** (vì connection gắn với environment cụ thể),
nên phải nối một lần:

1. Trong Studio, thanh trái → **Data** → **Add data**.
2. Gõ `Sản xuất cao thế` → chọn bảng Dataverse vừa tạo → **Connect**.
3. Ngay khi bảng được thêm, toàn bộ công thức đang báo lỗi sẽ tự hết lỗi
   (app tham chiếu nguồn dữ liệu qua đúng tên `'Sản xuất cao thế'`).
4. **File → Save** → **Publish**.

> Nếu hộp thoại Add data hiện bước **"Choose an entity"** kèm dòng *(Current)*, nghĩa là
> app đang dùng connector Common Data Service bản cũ — bấm Cancel và mở lại file
> `SanXuatCaoThe_v3.msapp`. Bản v2 khai `AppPreviewFlagsMap.nativecdsexperimental`
> nên Add data hiện thẳng danh sách **Tables**.

### Bước 5 — Chạy thử

Nhấn **Preview (F5)**. `App.OnStart` sẽ nạp bảng vào collection `colSanXuat`
rồi tính các collection tổng hợp. Nếu mở Studio trước khi làm bước 4,
chạy lại OnStart bằng menu **⋯ trên App → Run OnStart**.

---

## Mô hình dữ liệu

Bảng **`Sản xuất cao thế`** — schema `mfg_ProductionRecord`, entity set `mfg_productionrecords`.

| Tên hiển thị (dùng trong Power Fx) | Schema name | Kiểu |
|---|---|---|
| Mã bản ghi | `mfg_Name` | Text (120) — **cột chính** |
| Ngày sản xuất | `mfg_ProductionDate` | Date Only |
| Thiết bị | `mfg_Equipment` | Text (100) |
| Cấp điện áp | `mfg_VoltageLevel` | Whole Number |
| Dây chuyền | `mfg_Line` | Text (50) |
| SL kế hoạch | `mfg_PlannedQty` | Whole Number |
| SL thực tế | `mfg_ActualQty` | Whole Number |
| SP lỗi | `mfg_DefectQty` | Whole Number |
| SP đạt | `mfg_GoodQty` | Whole Number |
| Giờ vận hành | `mfg_RunHours` | Decimal (2) |
| Giờ dừng máy | `mfg_DowntimeHours` | Decimal (2) |
| Điện năng | `mfg_EnergyKwh` | Decimal (2) |
| Giờ công | `mfg_LaborHours` | Decimal (2) |
| Hoàn thành KH | `mfg_PlanAttainment` | Decimal (4) |
| Tỷ lệ lỗi | `mfg_DefectRate` | Decimal (4) |
| Năng suất | `mfg_Productivity` | Decimal (4) |
| Trạng thái | `mfg_Status` | Text (50) |
| Ghi chú | `mfg_Note` | Multiline Text |

**Lưu ý quan trọng:** canvas app tham chiếu cột Dataverse bằng **tên hiển thị**, không
phải schema name. Đổi tên hiển thị của cột sẽ làm hỏng công thức.

**Cạm bẫy Power Fx:** các hàm nhận tên cột dưới dạng **chuỗi** — `SortByColumns`,
`Search`, `GroupBy`, `ShowColumns` — phân giải theo **logical name** (`mfg_productiondate`),
không nhận display name tiếng Việt. Vì vậy app này:

| Thay vì | Dùng |
|---|---|
| `SortByColumns(t, "Ngày sản xuất", ...)` | `Sort(t, 'Ngày sản xuất', ...)` |
| `Search(t, kw, "Thiết bị")` | `Filter(t, kw in 'Thiết bị')` |
| `GroupBy(t, "Thiết bị", "grp")` | `AddColumns` đổi sang tên ASCII (`TenTB`) rồi mới `GroupBy` |

Các cột phân loại để ở kiểu **Text** (không dùng Choice) cho đơn giản khi import dữ liệu;
app đã ràng buộc giá trị bằng dropdown:

- Thiết bị: Máy biến áp lực · Máy cắt cao áp · Dao cách ly · Chống sét van · Biến dòng điện · Biến điện áp
- Dây chuyền: DC-MBA-01 · DC-MC-01 · DC-DCL-01 · DC-CSV-01 · DC-BI-01 · DC-BU-01
- Cấp điện áp: 110 · 220 · 500
- Trạng thái: Đạt · Cần kiểm tra · Dưới kế hoạch

---

## Logic chính trong app

**`App.OnStart`** — nạp dữ liệu và dựng 3 collection:

| Collection | Nội dung |
|---|---|
| `colSanXuat` | toàn bộ bản ghi từ Dataverse |
| `colLoc` | `colSanXuat` sau khi áp bộ lọc Tháng + Thiết bị |
| `colTB` | tổng hợp `SanLuong` / `SoLoi` theo Thiết bị |
| `colThang` | tổng hợp `SanLuong` theo `ThangSo` |

Bộ lọc thay đổi → `OnChange` của dropdown dựng lại `colLoc`, `colTB`, `colThang`.
Do dữ liệu đã nằm trong collection (1.272 dòng < ngưỡng 2.000 rows) nên không có
cảnh báo delegation, và các hàm `GroupBy`/`Sum`/`Max` chạy cục bộ.

**Ghi dữ liệu** — nút `btnLuu` dùng `Patch` với `Defaults()` khi thêm mới:
`SP đạt`, `Hoàn thành KH`, `Tỷ lệ lỗi`, `Năng suất` được tính lại tại thời điểm lưu,
sau đó kiểm tra `Errors()` và nạp lại collection.

**Biến toàn cục:** `varThang`, `varThietBi` (bộ lọc), `varBanGhi` (bản ghi đang sửa),
`varLaMoi` (thêm mới hay cập nhật), `varReset` (đảo giá trị để reset control trong form).

---

## Xử lý lỗi import solution

### `SecLib::CheckPrivilege failed ... PrivilegeName: prvCreateEntity`

Import dừng ở khoảng 50%, file log `*_import.xml` ghi `Status = Failure`.

**Nguyên nhân:** tài khoản không có quyền tạo bảng trong environment đó. Vai trò
**Environment Maker** (mặc định trong environment *Default*) chỉ cho tạo app và flow,
không cho tạo bảng Dataverse. Không liên quan đến nội dung file solution — nếu dòng
`XSDValidationHandler` trong log ghi `Processed` thì file hoàn toàn hợp lệ.

Cùng lý do này làm [Phụ lục A](#phụ-lục-a--tạo-bảng-thủ-công) cũng không chạy được:
*Tables → New table* dùng đúng privilege `prvCreateEntity`.

**Cách xử lý:**

1. **Tạo Developer environment riêng** (tự làm được, miễn phí theo Power Apps Developer Plan) —
   make.powerapps.com → menu **Environments** → **+ New** → Type = **Developer**,
   bật **Create a database**. Trong environment này bạn là System Administrator.
2. **Xin cấp security role** — admin vào admin.powerplatform.microsoft.com →
   **Environments** → environment → **Settings → Users + permissions → Users** →
   chọn tài khoản → **Manage security roles** → **System Customizer**.
3. **Nhờ admin import hộ**, sau đó bạn chỉ cần quyền đọc/ghi dữ liệu để dùng app.

### `New string attributes must have a max length value`

Đã sửa trong bản solution hiện tại (các cột chuỗi dùng thẻ `<MaxLength>`, không phải
`<Length>`). Nếu gặp lại sau khi bạn tự thêm cột kiểu text vào `gen_solution.py`,
kiểm tra hàm `attr_xml()` — mọi thuộc tính `nvarchar` và `ntext` bắt buộc có `<MaxLength>`.

### `The format dateonly is not valid for the datetime type column`

Đã sửa. Thẻ `<Format>` của cột `datetime` trong customizations.xml chỉ nhận **`date`**
(Date Only) hoặc **`datetime`** (Date and Time) — không phải tên enum `DateOnly` của SDK.
Kiểu Date Only đầy đủ là:

```xml
<Type>datetime</Type>
<Format>date</Format>
<Behavior>2</Behavior>   <!-- 1=UserLocal, 2=DateOnly, 3=TimeZoneIndependent -->
```

---

## Phụ lục A — Tạo bảng thủ công

Nếu không import được solution:

1. **Tables → + New table → Advanced properties**
   - Display name: `Sản xuất cao thế`
   - Plural name: `Sản xuất cao thế`  ← phải sửa, mặc định hệ thống tự thêm hậu tố
   - Primary column → Display name: `Mã bản ghi`
2. Thêm 17 cột còn lại đúng **tên hiển thị và kiểu** trong bảng mô hình dữ liệu ở trên.
3. Tiếp tục Bước 2.

Cách nhanh hơn: **Tables → + New table → From Excel / From CSV**, chọn
`3_DuLieu/SanXuatCaoThe_Data.xlsx`. Wizard sẽ tạo bảng, đặt tên cột theo dòng tiêu đề
và nạp luôn 1.272 dòng — chỉ cần sửa lại *Plural name* thành `Sản xuất cao thế`
và kiểm tra kiểu dữ liệu của từng cột.

---

## Phụ lục B — Sửa và build lại app

Thư mục `build/` chứa mã nguồn sinh ra file `.msapp` (không cần môi trường Power Platform):

```bash
cd build && python gen_app.py && pac canvas pack --sources src --msapp SanXuatCaoThe.msapp --layout Experimental --overwrite
```

- `gen_app.py` — sinh `src/Src/*.fx.yaml` (toàn bộ control và công thức Power Fx)
- `gen_solution.py` — sinh solution zip của bảng Dataverse
- `gen_data.py` — xuất CSV/XLSX từ `Manufacturing.xlsx`
- `src/pkgs/gallery_2.15.0.xml` — định nghĩa template gallery, bắt buộc để packer dựng
  được control `galleryTemplate`

Cần Power Platform CLI (`pac`). Sau khi pack, mở file trong Power Apps Studio để Studio
xác thực lần đầu (đây là yêu cầu của chính `pac canvas pack`).

Để chỉnh trực tiếp bằng YAML thay vì qua script:

```bash
pac canvas unpack --msapp SanXuatCaoThe.msapp --sources src --layout Experimental
```
