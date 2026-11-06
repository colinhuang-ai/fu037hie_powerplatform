# 05 — UI Spec app Auditor (bám theo mockup đã upload)

Tài liệu này mô tả chính xác giao diện cần dựng, lấy từ mockup 3 màn hình khách hàng cung cấp.
Đây là **design contract** cho bước build — mọi lệch khỏi mockup phải ghi rõ lý do ở §6.

---

## 1. Design tokens

| Token | Giá trị | Dùng ở đâu |
|---|---|---|
| `HeaderBg` | `RGBA(0, 0, 0, 1)` | Thanh header đen |
| `HeaderText` | `RGBA(255, 255, 255, 1)` | Chữ "Site Inspection" |
| `AvatarBg` | `RGBA(240, 214, 138, 1)` | Nền tròn chữ viết tắt (AF) |
| `PageBg` | `RGBA(255, 255, 255, 1)` | Nền màn hình |
| `FieldFill` | `RGBA(242, 242, 242, 1)` | Nền ô nhập |
| `FieldBorder` | `RGBA(214, 214, 214, 1)` | Viền ô nhập |
| `TextMain` | `RGBA(32, 31, 30, 1)` | Chữ chính |
| `TextMuted` | `RGBA(120, 120, 125, 1)` | Nhãn phụ, placeholder |
| `BtnSecondary` | `RGBA(255, 255, 255, 1)` nền + viền `FieldBorder` | Nút Cancel |
| `BtnPrimary` | `RGBA(60, 74, 82, 1)` | Nút Survey / Submit khi bật |
| `BtnDisabled` | `RGBA(200, 203, 206, 1)` | Nút Submit khi chưa đủ điều kiện |
| `OverlayScrim` | `RGBA(0, 0, 0, 0.55)` | Nền mờ sau modal camera |

Font: mặc định (Open Sans). Cỡ: tiêu đề header 17, nhãn field 12, nội dung 14, câu hỏi 14.

---

## 2. Header dùng chung (mọi màn hình)

Chiều cao **64px**, nền đen, full width.

| Control | Vị trí | Nội dung |
|---|---|---|
| Icon Home | trái, cách mép 16px | glyph nhà, màu trắng, 24px — `OnSelect` quay về màn 1 (có xác nhận nếu đang dở audit) |
| Tiêu đề | căn giữa | `"Site Inspection"`, trắng, 17px |
| Avatar | phải, cách mép 16px | hình tròn 36px, nền `AvatarBg`, chữ viết tắt tên người đăng nhập |

Chữ viết tắt lấy từ tài khoản hiện tại:

```powerfx
// lblAvatarInitials.Text
Concat(
    FirstN(Split(gblUser.Name, " "), 2),
    Left(Value, 1)
)
```

---

## 3. Màn hình 1 — Chọn khu vực (mockup ảnh trái)

Cuộn dọc, từ trên xuống:

| # | Thành phần | Chi tiết |
|---|---|---|
| 1 | **Ảnh bản đồ** | Khối ảnh cao ~150px, bo góc 4px, full width trừ lề 16px. Hiện ảnh vị trí Zone. Không có ảnh → khối xám kèm chữ "Chưa có sơ đồ khu vực" |
| 2 | **Site Name** | Nhãn 12px phía trên + **Dropdown** chọn Zone (mockup vẽ như ô text, nhưng dữ liệu phải lấy từ list `Zones` nên dùng dropdown). Nền `FieldFill`, cao 40px |
| 3 | **Address** | Nhãn + ô text **read-only**, tự điền từ Zone đã chọn. Trống khi chưa chọn |
| 4 | **Description** | Nhãn + ô text nhiều dòng **read-only**, cao ~110px, tự điền `Zones.Description` |
| 5 | **Template** | *(thêm so với mockup)* Dropdown chọn bộ checklist. Lý do ở §6 |
| 6 | **Footer** | Hai nút cùng hàng, căn phải, cách đáy 20px: `Cancel` (secondary) và `Survey ›` (primary) |

Nút `Survey ›` chỉ bật khi đã chọn cả Zone và Template.

---

## 4. Màn hình 2 — Checklist (mockup ảnh phải)

Gallery dọc, mỗi row là một câu hỏi. Row cao **động** theo nội dung (câu hỏi 1–2 dòng, có/không có ảnh).

### Bố cục một row

```
┌──────────────────────────────────────────────────┐
│  Is all safety equipment properly installed      │   ← câu hỏi, 14px, wrap
│  and in good condition?                          │
│                                                  │
│   ○     ○     ○                      [📷]  [📎]  │   ← radio + 2 icon
│  Yes    No   N/A                                 │
│                                                  │
│                                    ┌──────────┐  │   ← chỉ hiện khi có ảnh
│                              [×]   │  thumb   │  │
│                                    └──────────┘  │
└──────────────────────────────────────────────────┘
```

| Thành phần | Chi tiết |
|---|---|
| Câu hỏi | `ModernText`, wrap, chiếm ~90% chiều ngang |
| Nhóm chọn | 3 radio: **Yes / No / N/A**. Vùng chạm mỗi lựa chọn tối thiểu 48×48px kể cả khi vòng tròn chỉ 16px |
| Icon camera | phải, mở modal chụp ảnh cho đúng câu hỏi đó |
| Icon kẹp giấy | phải, mở `Add picture` chọn ảnh có sẵn trong máy |
| Thumbnail | 90×90px, bo góc 2px, viền mảnh. Nút `×` tròn bên trái ảnh để xoá |

### Ánh xạ nhãn hiển thị ↔ dữ liệu lưu

Mockup dùng **Yes / No / N/A**; schema dùng **Pass / Fail / NA**. Giữ nguyên cả hai:

| Nhãn trên UI | Giá trị lưu `colChecklist.Result` | Hành vi |
|---|---|---|
| Yes | `"Pass"` | Xoá mọi dữ liệu lỗi đã nhập của câu đó |
| No | `"Fail"` | Mở panel nhập chi tiết lỗi |
| N/A | `"NA"` | Không tính vào mẫu số Compliance % |

Lý do giữ `Pass/Fail/NA` trong dữ liệu: cột `Result` còn dùng cho Power BI và báo cáo, `Yes/No` mất nghĩa khi tách khỏi câu hỏi.

### Footer cố định đáy màn hình

Ba nút một hàng: `Cancel` (trái) · `‹` (giữa, quay lại) · `Submit` (phải).
`Submit` ở trạng thái `BtnDisabled` cho tới khi trả lời hết câu hỏi.

Trên thanh footer thêm dòng nhỏ: `"Còn N câu chưa trả lời"` khi chưa xong.

---

## 5. Modal chụp ảnh (mockup ảnh giữa)

Overlay phủ toàn màn hình, **không phải screen riêng** — giữ nguyên state checklist phía dưới.

| Thành phần | Chi tiết |
|---|---|
| Scrim | phủ kín, `OverlayScrim`, chặn tương tác phía dưới |
| Panel | căn giữa ngang, rộng ~88% màn hình |
| Thanh tiêu đề | nền xám nhạt, chữ `"Click inside the frame to capture"`, 13px |
| Khung camera | control `Camera`, tỉ lệ 4:3, `OnSelect` = chụp |
| Nút Close | full width dưới panel, nền xám |

Sau khi chụp: ảnh upload ngay qua flow `SaveAuditPhoto`, hiện spinner trong lúc chờ, xong thì đóng modal và thumbnail xuất hiện ở đúng row câu hỏi.

`MaxImageSize = 1200` — xem lý do ở [04-ux-performance §3](04-ux-performance.md).

---

## 6. Những chỗ lệch khỏi mockup — và lý do

| Lệch | Lý do |
|---|---|
| **Site Name là dropdown, không phải ô text** | Mockup vẽ ô text đã điền sẵn "Grandlucky, SCBD". Nếu để gõ tay, Zone không khớp bản ghi trong list `Zones` → không join được dữ liệu, không ra được báo cáo theo Zone. Bắt buộc chọn từ danh mục |
| **Address / Description là read-only** | Đây là thuộc tính của Zone, không phải của lần audit. Cho sửa sẽ tạo dữ liệu mâu thuẫn giữa các lần audit cùng một Zone |
| **Thêm dropdown Template** | Mockup chỉ có một bộ câu hỏi cố định. Yêu cầu nghiệp vụ có nhiều tiêu chuẩn (5S, Safety, Quality) nên phải chọn được. Nếu chỉ dùng một template, ẩn dropdown này đi |
| **Thêm panel nhập chi tiết khi chọn "No"** | Mockup chỉ có ảnh, không có ô nhập mức độ rủi ro / người khắc phục / mô tả. Không có 3 thứ này thì Flow không biết gửi cho ai và hạn bao giờ — toàn bộ luồng Fixer không chạy được |
| **Thêm màn review trước khi Submit** | Submit thẳng từ checklist khiến người dùng không xem lại được các lỗi đã ghi. Với audit 30 câu, đây là nguồn sai sót thường gặp |
| **Nút chọn ảnh nằm ở hàng ảnh, không nằm cạnh icon camera** | Mockup đặt kẹp giấy sát icon camera trên hàng trả lời. Thêm control 44px thứ ba vào hàng đó bóp nhóm radio xuống 132px ở bề rộng 320px, làm cắt chữ Yes/No/N/A. Chuyển xuống hàng ảnh (control `AddMedia`, nhãn "Chọn ảnh" / "Đổi ảnh") giữ nguyên chức năng browse, thêm được khả năng thay ảnh, và thay luôn nhãn chết "Chưa có ảnh" bằng một nút bấm được |

> Nếu bạn muốn bám mockup 100% và bỏ panel chi tiết lỗi, luồng B (Fixer) phải đổi: lỗi sẽ vào một hàng đợi chung để Manager phân công thủ công, thay vì Auditor gán trực tiếp.

---

## 7. Danh sách màn hình cần dựng

| Thứ tự | File | Tên logic | Nội dung |
|---|---|---|---|
| 1 | `Screen1.pa.yaml` | `scrSiteSelect` | §3 — chọn Zone + Template |
| 2 | `scrChecklist.pa.yaml` | `scrChecklist` | §4 + §5 + panel chi tiết lỗi |
| 3 | `scrReview.pa.yaml` | `scrReview` | Tóm tắt điểm, danh sách lỗi, nút Submit |
| 4 | `scrDone.pa.yaml` | `scrDone` | Xác nhận đã gửi, điểm số, nút bắt đầu lượt mới |
