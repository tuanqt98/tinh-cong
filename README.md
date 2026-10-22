# Hệ thống quản lý chấm công In Nhật Hàn

Monorepo ứng dụng chấm công nội bộ: React/Vite, NestJS, PostgreSQL 16, Prisma, Docker Compose và Nginx.

Trạng thái hiện tại: `DEVELOPMENT_COMPLETE_WITH_BLOCKERS`. Engine, API, 12 màn hình, import/export, RBAC, migration, Docker, E2E và backup/restore đã được triển khai. File `SX.xlsx` đã ACCEPTED 2.765 raw rows; lịch sử/raw hiển thị trên web và 4.505 ngoại lệ đã được tạo fail-closed. Chưa có phép tính công vì 92 mã nhân viên nguồn chưa được duyệt vào master và chưa có lịch phân ca/evidence. Hệ thống chưa được phép dùng production hoặc phát hành bảng công thật vì còn các blocker dữ liệu/UAT và workflow Q10/Q11.

## Cấu trúc

- `apps/api`: NestJS API, auth/RBAC/scope, import, workflow guard, Excel/PDF.
- `apps/web`: React/Vite, giao diện tiếng Việt và 12 màn hình.
- `packages/attendance-engine`: engine độc lập dùng số nguyên giây.
- `packages/ui`, `packages/shared`: UI và hợp đồng dùng chung.
- `prisma`: schema, migration PostgreSQL và seed synthetic.
- `infra`: Dockerfile và Nginx.
- `tests/e2e`: Playwright.
- `docs`: yêu cầu, quyết định, test report và deployment readiness.

## Chạy local trên Windows

Yêu cầu Node.js `22.17.0`, pnpm `9.15.9`, Docker Desktop và PowerShell.

```powershell
Copy-Item .env.example .env
# Điền secret/password ngẫu nhiên trong .env, không commit file này.
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:generate
docker compose up -d db
pnpm.cmd db:migrate
pnpm.cmd db:seed
pnpm.cmd dev
```

Seed từ chối chạy nếu chưa cấu hình đủ sáu biến `SEED_*` và password tối thiểu 14 ký tự. Ba username development mặc định do người vận hành tự đặt qua môi trường; không có mật khẩu mặc định trong source.

Chạy toàn bộ stack đóng gói:

```powershell
docker compose up -d --build
```

URL mặc định:

- Web: `http://localhost:8080`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- Health: `http://localhost:3000/api/v1/health`

Có thể đổi host port bằng `COMPOSE_WEB_PORT`, `COMPOSE_API_PORT`, `POSTGRES_HOST_PORT`.

## Kiểm thử

```powershell
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test:run
pnpm.cmd test:e2e

# Cần PostgreSQL đã migrate + seed synthetic và biến môi trường integration.
pnpm.cmd test:integration
pnpm.cmd test:performance
```

Kết quả thực tế và lệnh đầy đủ nằm tại [TEST_REPORT](docs/TEST_REPORT.md). Hướng dẫn triển khai/rollback và blocker nằm tại [DEPLOYMENT_READINESS](docs/DEPLOYMENT_READINESS.md).

## Nguyên tắc an toàn

- `WORKFLOW_ENABLED=false` theo mặc định; không chốt/phát hành thật khi Q10/Q11 chưa được duyệt.
- `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName` theo DEC-003; phát hiện trùng sẽ từ chối nguyên import, không merge/overwrite.
- `SOURCE_MASTER_PROVISIONING_ENABLED=false` theo mặc định; không tự tạo master/lịch hoặc suy timestamp từ file nguồn trước khi có phê duyệt được ghi nhận.
- Không suy ngày ca/checkout khi thiếu evidence; bản ghi chuyển `NEEDS_REVIEW`.
- Không dùng dữ liệu cá nhân thật trong development, log hoặc tài liệu.
- Không triển khai production từ trạng thái hiện tại.
