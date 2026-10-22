# Deployment readiness

Cập nhật 22/10/2026.

## Kết luận

**`DEVELOPMENT_COMPLETE_WITH_BLOCKERS` — KHÔNG PRODUCTION-READY.**

Build và runtime cục bộ đã được chứng minh, nhưng không được triển khai production hoặc phát hành bảng công thật trước khi đóng các blocker nghiệp vụ/UAT.

## Thành phần đã sẵn sàng kỹ thuật

- Docker Compose: PostgreSQL `16.4-alpine`, NestJS API, Nginx web.
- Image API/web build thành công; container health thành công.
- Prisma migration tự chạy khi API container khởi động.
- Host port chỉ bind `127.0.0.1` theo mặc định.
- Health endpoints: API `/api/v1/health`, Nginx `/healthz`.
- Config bằng environment; secret và seed password không hard-code.
- Backup/restore PowerShell có SHA-256 và yêu cầu cờ xác nhận restore.
- Volume riêng cho PostgreSQL, source imports và exports.
- Nginx có giới hạn upload 10 MB, security headers và SPA fallback.
- Web tự refresh access token theo phiên; refresh không hợp lệ/hết hạn sẽ xóa phiên và yêu cầu đăng nhập lại.
- Import history/raw rows hiển thị trên web; pipeline idempotent chuyển cảnh báo sang ngoại lệ và chỉ tính khi có master + lịch + timestamp/evidence đầy đủ.
- Provision master/lịch từ file nguồn bị khóa mặc định bằng `SOURCE_MASTER_PROVISIONING_ENABLED=false`; backend trả 409 và UI không cho kích hoạt khi chưa có decision evidence.
- Ngoại lệ, attendance, publication và dashboard áp employee scope ở backend; HR/MANAGER không có scope trả rỗng/fail-closed.
- Màn Import Excel đã được redesign và kiểm chứng responsive bằng Playwright tại 1536×1024, 1440×900 và 1280×800; preview/confirm/history vẫn dùng API và guard hiện hữu.

## Cài đặt staging/local Windows

1. Cài Docker Desktop, Node `22.17.0`, pnpm `9.15.9`.
2. Sao chép `.env.example` thành `.env`; tạo password/secret ngẫu nhiên.
3. Giữ `WORKFLOW_ENABLED=false`; đặt `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName` theo DEC-003 ngày 22/10/2026.
4. Giữ `SOURCE_MASTER_PROVISIONING_ENABLED=false` cho tới khi master, lịch, alias và tiêu chí timestamp được phê duyệt và ghi vào decision log.
5. Chạy `pnpm.cmd install --frozen-lockfile`, `pnpm.cmd db:generate`.
6. Chạy `docker compose up -d --build`.
7. Chạy seed synthetic thủ công chỉ ở development với sáu biến `SEED_*`.
8. Kiểm tra `docker compose ps`, `/api/v1/health`, `/healthz`, login và scope.

Không tái sử dụng credential synthetic trong production. Seed sẽ từ chối placeholder hoặc password ngắn hơn 14 ký tự.

## Backup và restore

```powershell
$env:POSTGRES_DB='tinhcong'
$env:POSTGRES_USER='tinhcong'
powershell -File scripts/backup.ps1 -OutputDirectory D:\backups\tinhcong

# Chỉ chạy sau khi xác nhận đúng môi trường/backup.
powershell -File scripts/restore.ps1 -BackupFile D:\backups\tinhcong\file.sql -ConfirmRestore
```

Sau restore phải kiểm tra migration, số bản ghi, khóa ngoại, login và report trước khi mở truy cập.

## Rollback

1. Dừng luồng ghi/import và cô lập người dùng.
2. Lưu log, image digest, migration hiện tại và tạo backup trước rollback nếu DB còn đọc được.
3. Quay lại image API/web đã kiểm chứng bằng tag/digest; không tự rollback migration phá hủy dữ liệu.
4. Nếu cần phục hồi DB, tạo DB kiểm chứng riêng, restore và chạy integrity checks trước khi thay endpoint.
5. Chỉ mở lại sau health, login, scope, dashboard, import guard và checksum artifact đạt.

## Monitoring tối thiểu trước production

- Theo dõi container health/restart, HTTP 5xx/latency, kết nối DB, dung lượng volume và backup age.
- Cảnh báo failed login/lockout, import rejected, blocking exception, transition/release và restore.
- Log phải có request ID nhưng không ghi password, token, file gốc hoặc dữ liệu cá nhân không cần thiết.

## Cổng bắt buộc trước production

- Duyệt mapping 92 mã nhân viên/12 phòng ban vào master, lịch/alias/timestamp evidence và expected HR; đối chiếu `SX.xlsx` thực đạt. Không dùng 4.505 ngoại lệ hiện tại làm oracle tính công.
- Xử lý database development đã có một lần source provisioning không khớp decision log: chọn rollback/rebuild hoặc revalidate có audit; không công nhận 1.841 calculation hiện có là dữ liệu thật hợp lệ.
- Chốt tiêu chí ngày checkout DEC-002 và quy trình file sửa/file nhiều kỳ còn mở của DEC-003; khóa trùng đã được duyệt.
- Chốt Q10/Q11, quyền duyệt/chốt/phát hành và quy trình chỉnh sau khóa.
- Hoàn tất UAT, mẫu PDF/logo, retention, backup location/RPO/RTO và staging security review.
- Chạy tải đồng thời theo SLA, PDF hàng loạt và restore drill trên staging.
- Chủ dự án phê duyệt rõ ràng việc bật workflow/phát hành.
- Cung cấp logo/brand asset chính thức và thực hiện vòng UAT/visual sign-off; ảnh hiện tại đã đối chiếu thủ công nhưng chưa có automated pixel-diff threshold nên không được coi là chứng nhận pixel-perfect.

Cho tới lúc đó: giữ workflow và publish thực ở trạng thái tắt.

## Bằng chứng Docker của mốc hardening hiện tại

`docker compose config` đã render đúng `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false` và `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`. API trực tiếp, Nginx `/healthz` và proxy API của container checkpoint trước vẫn healthy. Tuy nhiên `docker compose build api web` và lần retry riêng API không hoàn tất/không phát log trong giới hạn theo dõi; các tiến trình build do phiên này tạo đã được dừng. Vì vậy image mới chứa hardening **chưa được xác minh**, không được suy diễn PASS từ health của image cũ.
