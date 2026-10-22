# Kế hoạch triển khai

Cập nhật: 21/10/2026. Master prompt mới cho phép bắt đầu phát triển tuần tự Phase 1–6. Repo thực tế ở `D:\chamCong`; đường dẫn `D:\tinhCong` trong prompt không tồn tại trên máy tại thời điểm audit.

## Nguyên tắc cổng

- Engine chỉ tính trên timestamp đầy đủ có offset, ngày ca và evidence đã xác định.
- Dữ liệu mơ hồ trả ngoại lệ chặn; không suy ngày ra hoặc alias ca.
- Duplicate detector chỉ hoạt động khi có chiến lược khóa được cấu hình; thiếu cấu hình thì cấm confirm import.
- Workflow chưa đủ quyết định để phát hành thật, vì vậy build chức năng nhưng mặc định tắt bằng cấu hình.
- Synthetic fixtures được phép cho development test và phải được ghi rõ; không thay thế SX.xlsx/UAT.

## Mốc triển khai

1. **Phase 1 – Engine:** package TypeScript độc lập, Ca 1/Ca 3, overlap, L/E, validation nhiều lỗi, duplicate/multiple-row guard, unit test.
2. **Phase 2 – Backend:** NestJS, Prisma/PostgreSQL, auth/RBAC/scope, CRUD lõi, Swagger, import staging/transaction, unit/integration test.
3. **Phase 3 – Frontend:** React/Vite/Tailwind/shadcn-style components, 12 màn hình, API client và trạng thái loading/empty/error.
4. **Phase 4 – Workflow:** ngoại lệ/revision, transition guard, Excel/PDF draft, portal/feedback/audit; tính năng chưa đủ quyết định mặc định disabled.
5. **Phase 5 – Hardening:** security tests, E2E, benchmark synthetic 300–1.000 NV; real-data validation tiếp tục BLOCKED nếu thiếu SX.xlsx.
6. **Phase 6 – Readiness:** Docker Compose/PostgreSQL 16/Nginx, healthcheck, backup/restore scripts và runbook; không production deploy.

## Bằng chứng bắt buộc

Mỗi checkpoint ghi command, version, số test PASS/FAIL/SKIP, artifact và blocker vào `docs/TEST_REPORT.md` cùng `docs/13_PROGRESS_REPORT.md`. Chỉ đánh dấu phase đạt với lệnh chạy thực tế.
