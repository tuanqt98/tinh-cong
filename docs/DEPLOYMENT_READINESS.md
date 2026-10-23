# Deployment readiness

Cập nhật 23/10/2026.

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
- Tạo hồ sơ nhân viên/phòng ban từ file nguồn bị khóa mặc định bằng `SOURCE_MASTER_PROVISIONING_ENABLED=false`; backend trả 409 và UI không cho kích hoạt khi chưa có decision evidence. DEC-007 cho phép dùng `Tên ca` nguồn trực tiếp nên không còn provision lịch phân ca.
- Ngoại lệ, attendance, publication và dashboard áp employee scope ở backend; HR/MANAGER không có scope trả rỗng/fail-closed.
- Màn Import Excel đã được redesign và kiểm chứng responsive bằng Playwright tại 1536×1024, 1440×900 và 1280×800; preview/confirm/history vẫn dùng API và guard hiện hữu.
- Confirm import lớn dùng batch transaction nguyên tử; regression synthetic 2.765 dòng bảo vệ khỏi Prisma interactive timeout 5 giây.
- Quản lý nhân viên có UI responsive và API/database thật: bảng chỉ hiển thị mã, tên, phòng ban, trạng thái, thao tác; form và import map đúng bốn trường. Entry point Import/Tải mẫu và preview/confirm đã được khôi phục; template mới dùng `Tên nhân viên`, parser tương thích `Họ và tên` cũ. Server-side filtering/pagination/KPI theo scope, audit/history và soft deactivation không xóa attendance vẫn giữ. Migration additive đã chạy trên development và DB integration mới; typecheck/build, 8 integration gần nhất và 12 E2E hiện tại đạt.
- Preview nhân viên đếm số dòng dữ liệu đã đọc thay vì chỉ đếm dòng hợp lệ; lỗi phòng ban nêu rõ giá trị nguồn chưa có master. Đây chỉ là cải thiện chẩn đoán, không nới guard hoặc tự tạo phòng ban. Các tên nguồn như `AKO`, `Cơ điện, tạp vụ` vẫn cần được quản trị tạo/map vào master trước khi confirm import.
- ADMIN có dialog quản lý phòng ban trên màn nhân viên để tạo master một cách tường minh trước khi import; quyền tạo vẫn được kiểm tra ở backend. Tính năng này không tự đọc/tạo danh mục từ file và không thay đổi `SOURCE_MASTER_PROVISIONING_ENABLED=false`.
- Processing import trả danh sách mã nhân viên thiếu và UI cảnh báo số mã/số dòng, kèm lối tắt sang Quản lý nhân viên. Phần dữ liệu đủ hồ sơ vẫn xử lý; phần thiếu tạo ngoại lệ blocking và có thể phục hồi khi chạy lại sau khi bổ sung master. Không có auto-provision ngầm.
- ESLint flat config hiện kiểm tra TypeScript/React/Node thật với 0 warning; PATCH nhân viên không có trường hồ sơ hợp lệ bị chặn HTTP 400 trước khi tạo history/audit rỗng. Gate source mới nhất đạt typecheck/build, 31 engine, 26 API, 8 PostgreSQL integration và 12 E2E.

## Cài đặt staging/local Windows

1. Cài Docker Desktop, Node `22.17.0`, pnpm `9.15.9`.
2. Sao chép `.env.example` thành `.env`; tạo password/secret ngẫu nhiên.
3. Giữ `WORKFLOW_ENABLED=false`; đặt `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName` theo DEC-003 ngày 22/10/2026.
4. Giữ `SOURCE_MASTER_PROVISIONING_ENABLED=false` cho tới khi việc tạo hồ sơ nhân viên/phòng ban từ file được phê duyệt; không dùng flag này để tạo lịch phân ca.
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

- Duyệt cách tạo/nạp master cho 92 mã nhân viên/12 phòng ban và expected HR; `Tên ca` nguồn đã được duyệt thay lịch phân ca theo DEC-007. Đối chiếu `SX.xlsx` thực sau khi liên kết master; không dùng kết quả development cũ làm oracle.
- Chốt tiêu chí ngày checkout DEC-002 và quy trình file sửa/file nhiều kỳ còn mở của DEC-003; khóa trùng đã được duyệt.
- Chốt Q10/Q11, quyền duyệt/chốt/phát hành và quy trình chỉnh sau khóa.
- Hoàn tất UAT, mẫu PDF/logo, retention, backup location/RPO/RTO và staging security review.
- Chạy tải đồng thời theo SLA, PDF hàng loạt và restore drill trên staging.
- Chủ dự án phê duyệt rõ ràng việc bật workflow/phát hành.
- Cung cấp logo/brand asset chính thức và thực hiện vòng UAT/visual sign-off; ảnh hiện tại đã đối chiếu thủ công nhưng chưa có automated pixel-diff threshold nên không được coi là chứng nhận pixel-perfect.
- Xác nhận nghiệp vụ dài hạn cho lịch sử hiệu lực phòng ban/chức danh và quy trình khôi phục nhân viên sau trạng thái nghỉ việc; implementation hiện lưu history/effective date, không tự tính lại công quá khứ.
- Rebuild và kiểm chứng image từ đúng source hardening mới nhất sau khi Docker Desktop/buildx hoạt động ổn định; không dùng health của image checkpoint cũ làm bằng chứng cho source mới.

Cho tới lúc đó: giữ workflow và publish thực ở trạng thái tắt.

## Bằng chứng Docker của mốc hardening hiện tại

`docker compose config` render đúng `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false` và `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`. Ngày 22/10/2026, image DEC-007 được build trực tiếp: API digest `sha256:0029e2c6...`, web digest `sha256:1c1ca2e6...`; artifact chứa source-shift/UI mới đã được kiểm tra. Hai container đã recreate; DB/API/web healthy, API trực tiếp/proxy và Nginx `/healthz` đều HTTP 200 trên cổng 8180.

## Bằng chứng rebuild local sau redesign Quản lý nhân viên

Ngày 22/10/2026, `docker compose build api web` hoàn tất với API digest `sha256:5a6fdb096939...` và Web digest `sha256:c68b0980ab7c...`. Hai container được recreate mà không reset PostgreSQL; DB/API/Web đều healthy. Migration deploy báo 2 migration và không có migration chờ. API trực tiếp cổng `3300`, API qua Nginx cổng `8180` và `/healthz` đều HTTP 200. Smoke có xác thực xác nhận `GET /employees`, `GET /employees/statistics` và màn `/employees` hoạt động; ảnh runtime được lưu tại `docs/ui-evidence/employee-management-docker-local.png`. Ba guard bắt buộc vẫn giữ nguyên. Đây chỉ là deployment local development, không phải phê duyệt production.

Sau mốc này, source được bổ sung ESLint và guard PATCH nhân viên. Ngày 22/10/2026, `docker compose config` tiếp tục render đúng ba guard, nhưng Compose build, build trực tiếp API qua BuildKit và lần thử legacy builder đều treo không log/không hoàn tất trong khoảng theo dõi; tiến trình CLI/buildx do các lần thử tạo đã được kết thúc. Vì vậy API vẫn dùng image checkpoint cũ và chưa có bằng chứng container cho guard PATCH mới.

Ngày 23/10/2026, artifact API/web mới đã được chép vào writable layer của container local hiện tại và restart sau khi Docker commit artifact bị treo. DB/API/web cuối cùng đều healthy; API trực tiếp/proxy và Nginx đều HTTP 200. Smoke Chromium có xác thực tại `8180/employees` xác nhận đúng năm cột, có Import/Tải mẫu, dialog mở được và template tải về đúng bốn header; ảnh `docs/ui-evidence/employee-management-import-restored.png`. Image tag vẫn là checkpoint cũ, nên cách cập nhật runtime này chưa thay thế bằng chứng build Dockerfile tái lập; production gate vẫn yêu cầu normal image build.
