# 10 – Hướng dẫn triển khai local/staging

Trạng thái: Docker Compose đã build/chạy cục bộ; hướng dẫn này không cho phép production deployment. Xem cổng readiness tại `DEPLOYMENT_READINESS.md`.

## Yêu cầu

- Windows + PowerShell, Docker Desktop.
- Node.js `22.17.0`, pnpm `9.15.9` nếu chạy/test ngoài container.
- Ít nhất 4 GB RAM trống cho stack development.

## Chuẩn bị cấu hình

```powershell
Copy-Item .env.example .env
```

Thay mọi giá trị `replace-*`; JWT secret tối thiểu 32 ký tự, seed password tối thiểu 14 ký tự. Không commit `.env`. Giữ:

```text
WORKFLOW_ENABLED=false
DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName
SOURCE_MASTER_PROVISIONING_ENABLED=false
```

Giữ workflow tắt cho tới khi Q10/Q11 được duyệt. Không thay đổi khóa trùng đã được duyệt ngày 22/10/2026 nếu chưa có quyết định nghiệp vụ mới.

## Chạy bằng Docker Compose

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

API container tự chạy `prisma migrate deploy`. Seed không tự chạy để tránh tạo account ngoài ý muốn. Với development, cấu hình sáu biến `SEED_*` rồi chạy `pnpm.cmd db:seed` từ host hoặc command one-off được kiểm soát.

URL mặc định:

- Web/Nginx: `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3000/api/v1`
- Swagger: `http://127.0.0.1:3000/api/docs`
- Health API: `http://127.0.0.1:3000/api/v1/health`
- Health Nginx: `http://127.0.0.1:8080/healthz`

Nếu cổng bận, đặt `COMPOSE_API_PORT`, `COMPOSE_WEB_PORT`, `POSTGRES_HOST_PORT` trong `.env`.

## Kiểm tra sau khởi động

1. Cả `db`, `api`, `web` ở trạng thái healthy.
2. Health API trực tiếp và qua `/api/` của Nginx trả `status=ok`.
3. Login synthetic development hoạt động; request không token trả 401.
4. EMPLOYEE không xem được ID của nhân viên khác.
5. Dashboard và 12 route render; preview import hiển thị khóa trùng đã cấu hình và chỉ cho confirm khi không có lỗi blocking.

## Backup/restore

```powershell
powershell -File scripts/backup.ps1 -OutputDirectory D:\backups\tinhcong
powershell -File scripts/restore.ps1 -BackupFile D:\backups\tinhcong\file.sql -ConfirmRestore
```

Restore là thao tác phá hủy target DB: phải xác nhận đúng môi trường, kiểm tra hash, thử trên DB cách ly và chạy integrity checks trước.

## Dừng local

```powershell
docker compose stop
```

Không dùng `down -v` nếu cần giữ database/volume. Không xóa volume hoặc rollback DB tự động.

## Rollback ứng dụng

Pin image digest/tag đã kiểm chứng, backup trước, quay lại image web/API tương thích schema rồi chạy health/login/scope/report checks. Rollback app không đồng nghĩa rollback migration; DB restore chỉ theo runbook và phê duyệt riêng.
