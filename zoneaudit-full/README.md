# Zone Audit — Web app cho Auditor & Fixer

Webapp kiểm tra khu vực (5S / An toàn / Chất lượng / Môi trường) chạy trên **Dataverse** (solution `Zoneauditcontrol`).

- **Auditor**: đi kiểm tra theo checklist, chụp ảnh sự cố, giao việc cho Fixer, xác nhận hoặc từ chối kết quả khắc phục.
- **Fixer**: nhận / được giao sự cố, xử lý, chụp ảnh sau xử lý và báo hoàn thành.
- **Admin**: quản lý người dùng (và làm được mọi việc của hai vai trò trên).

Đăng nhập bằng **Google (Gmail)** hoặc **email + mật khẩu**.

```
 Browser (React SPA)  ──/api──▶  Backend (Express + TypeScript)  ──OAuth2 client-credentials──▶  Dataverse Web API
   frontend/                       backend/                         ├─ 5 bảng: Zone, Audit Template/Item/Run/Finding
                                   ├─ SQLite: users + bản nháp audit
                                   └─ Thư mục uploads/: ảnh hiện trạng / sau xử lý
```

Trình duyệt **không bao giờ** nói chuyện trực tiếp với Dataverse; secret Azure chỉ nằm ở backend.

## Chạy thử nhanh (dữ liệu giả lập, không cần Dataverse)

Yêu cầu Node.js ≥ 22.13.

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Khi chưa cấu hình Dataverse, backend chạy với dữ liệu mẫu trong bộ nhớ và tự tạo 3 tài khoản demo (chỉ ở `NODE_ENV=development`):

| Email | Vai trò | Mật khẩu |
|---|---|---|
| `auditor@demo.local` | Auditor | `Demo@12345` |
| `fixer@demo.local` | Fixer | `Demo@12345` |
| `admin@demo.local` | Admin | `Demo@12345` |

## Nối Dataverse thật

1. **Entra ID (Azure AD)** → App registrations → *New registration*. Ghi lại **Tenant ID** và **Client ID**; *Certificates & secrets* → tạo **client secret**.
2. **Power Platform admin center** → Environments → môi trường của bạn → *Settings → Users + permissions → Application users* → *New app user* → chọn app vừa tạo → gán security role.
   Role chỉ cần quyền trên 5 bảng `crd1a_*`: **Create, Read, Write, Delete** (Delete dùng để rollback khi nộp audit lỗi giữa chừng) và **Append, Append To** (bắt buộc để gán lookup Zone / Run / Item).
3. Tạo `backend/.env` từ mẫu và điền:

   ```bash
   cp backend/.env.example backend/.env
   ```

   ```
   DATAVERSE_URL=https://diencaothe.crm7.dynamics.com
   AZURE_TENANT_ID=...
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   ADMIN_EMAIL=you@company.com      # admin đầu tiên, chỉ tạo khi bảng user còn trống
   ADMIN_PASSWORD=...               # ≥ 8 ký tự
   ```

   Có đủ 4 biến `DATAVERSE_URL` / `AZURE_*` thì backend tự chuyển sang chế độ **live**. Log khi khởi động sẽ ghi `dataverse=live`.

## Đăng nhập Google

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → **Web application**.
2. **Authorized JavaScript origins**: `http://localhost:5173` và URL production của bạn (không cần redirect URI).
3. Điền `GOOGLE_CLIENT_ID` vào `backend/.env`.

Mặc định chỉ email **đã được Admin thêm** (menu *Người dùng*) mới đăng nhập được bằng Google. Muốn tự tạo tài khoản cho email lạ, đặt `GOOGLE_AUTO_PROVISION_ROLE=fixer` (hoặc `auditor`) và nên giới hạn `GOOGLE_ALLOWED_DOMAINS=congty.com`.

Tài khoản chỉ-Google (không có mật khẩu) vẫn có thể tự đặt mật khẩu ở trang *Tài khoản*.

## Luồng nghiệp vụ

```
Auditor chọn Zone + Template ─▶ checklist (Đạt / Không đạt / N/A, tự lưu nháp)
        │ Nộp
        ▼
 AuditRun (điểm = Đạt / (Đạt + Không đạt)) + 1 AuditFinding cho mỗi hạng mục "Không đạt"

 Finding:  Open ──start──▶ In Progress ──resolve (bắt buộc có ảnh)──▶ Resolved ──close──▶ Closed
             ▲                                                         │
             └──────────────── reopen (bắt buộc có lý do) ─────────────┴── (cũng từ Closed)
```

| Hành động | Auditor | Fixer | Admin |
|---|:-:|:-:|:-:|
| Tạo audit, nộp, xem Runs | ✔ | | ✔ |
| Giao việc, đổi mức độ / hạn | ✔ | | ✔ |
| Nhận việc (`start`), báo xong (`resolve`) | | ✔ (việc của mình hoặc chưa giao) | ✔ |
| Xác nhận đóng (`close`), mở lại (`reopen`) | ✔ | | ✔ |
| Quản lý người dùng | | | ✔ |

Fixer chỉ thấy sự cố giao cho mình và "hàng chờ" sự cố Open chưa giao. Mọi quy tắc được **kiểm tra ở backend**, giao diện chỉ ẩn nút cho tiện.

## Ánh xạ với bảng Dataverse

| Bảng | Dùng để |
|---|---|
| `crd1a_zone` | Danh sách khu vực |
| `crd1a_audittemplate` | Mẫu kiểm tra (+ `Category`) |
| `crd1a_audititem` | Hạng mục của mẫu (`Template`, `Order Number`) |
| `crd1a_auditrun` | Một lượt kiểm tra: `Zone`, `Audit Date`, `Auditor` (email), `Score` |
| `crd1a_auditfinding` | Sự cố: `Severity`, `Status`, `Due Date`, `Assigned To` (email), `Before/After Image` |

Web app **chỉ đọc** Zone / Template / Item (quản lý chúng ở model-driven app có sẵn) và **ghi** Run / Finding.

## Chạy production

```bash
npm run build
NODE_ENV=production npm start      # backend phục vụ luôn frontend đã build (cùng origin, không cần CORS)
```

- Đặt `SESSION_SECRET` (≥ 32 ký tự ngẫu nhiên), `APP_ORIGIN=https://app.congty.com`, `NODE_ENV=production`. Production **từ chối khởi động** nếu thiếu `SESSION_SECRET` hoặc đang ở chế độ mock.
- Chạy sau reverse proxy HTTPS và đặt `TRUST_PROXY=true` (rate-limit đăng nhập cần IP thật). Cookie phiên là `HttpOnly; SameSite=Lax; Secure`.
- **Sao lưu `backend/data/`** (SQLite `app.db` chứa user + bản nháp, `uploads/` chứa ảnh).

## Kiểm thử

```bash
npm test          # 69 test: auth, phân quyền, luồng audit → finding, wire-format gửi lên Dataverse
npm run typecheck
```

Test dùng Dataverse giả lập trong bộ nhớ, nên **luồng gọi Dataverse thật chưa được chạy tự động** — hãy thử một vòng audit → fix → close trên môi trường dev sau khi cấu hình `.env`.

## Hạn chế đã biết / đề xuất

- **`Audit Run` không có lookup tới `Audit Template`**: tên mẫu chỉ nằm trong `Title` của run. Nên thêm cột lookup `Template` vào `crd1a_auditrun` nếu cần báo cáo theo mẫu (app chưa tự sửa schema).
- `Before Image` / `After Image` là cột text 100 ký tự, nên ảnh lưu trên đĩa của backend (đường dẫn `/api/files/<id>.jpg`) chứ không nằm trong Dataverse. Chạy nhiều instance thì cần dùng chung thư mục `uploads` và `app.db` (hoặc chuyển sang Azure Blob / DB chung).
- Bản nháp audit và tài khoản người dùng nằm ở SQLite cục bộ (`node:sqlite`, Node in ra cảnh báo "experimental" — vô hại).
- Chưa có thông báo email / Teams khi giao việc.
- Ghi chú xử lý / lý do mở lại được nối vào cột `Description` (giới hạn 2000 ký tự) vì Dataverse không có bảng comment.
- Hai người cùng thao tác một sự cố: app dùng ETag của Dataverse nên người đến sau nhận lỗi 409 "vừa được người khác cập nhật" thay vì ghi đè.
