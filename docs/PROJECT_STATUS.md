# Trạng thái dự án Hệ thống chấm công In Nhật Hàn

Ngày cập nhật: 22/10/2026 (`Asia/Ho_Chi_Minh`).
Checkpoint: **`DEVELOPMENT_COMPLETE_WITH_BLOCKERS`** (Không production-ready).

## 1. Tổng quan trạng thái

Dự án đã hoàn thành toàn bộ phần khung kỹ thuật và logic độc lập từ Phase 1 đến Phase 6 trên môi trường phát triển cục bộ và container hóa. Tất cả các bài kiểm tra tự động với dữ liệu synthetic (mô phỏng) đều đạt 100%.

Hệ thống được bảo vệ bằng các chốt chặn an toàn (fail-closed guards) và **chưa được phép triển khai production hay phát hành bảng công thực tế** cho nhân viên do thiếu dữ liệu thực tế và các quyết định nghiệp vụ cần cấp quản lý phê duyệt.

## 2. Kết quả kiểm thử mới nhất

| Hạng mục kiểm thử                | Lệnh thực hiện                                       | Kết quả thực tế                 | Ghi chú                                                                                              |
| -------------------------------- | ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Engine Unit Tests**            | `pnpm.cmd test:run` (engine)                         | **31/31 PASS** (2 files)        | Tính công số nguyên giây, bảo toàn tier, Ca 1/Ca 3, đi muộn/về sớm độc lập                           |
| **API Unit & Service Tests**     | `pnpm.cmd test:run` (api)                            | **23/23 PASS** (6 files)        | RBAC/scope, Excel parser, duplicate/confirm/process policy, source approval guard, audit, PDF export |
| **PostgreSQL Integration Tests** | migration + seed DB mới; `pnpm.cmd test:integration` | **5/5 PASS** (1 file)           | PostgreSQL 16 thật, RBAC, IDOR isolation, workflow và source provisioning guard                      |
| **Browser E2E Tests**            | `pnpm.cmd test:e2e`                                  | **9/9 PASS** (Chromium)         | Đăng nhập, 12 màn hình, mobile, refresh, confirm một lần, raw history, visual QA ba viewport         |
| **TypeScript Typecheck**         | `pnpm.cmd typecheck`                                 | **PASS** (5 workspace packages) | `@tinh-cong/attendance-engine`, `shared`, `ui`, `api`, `web`                                         |
| **Production Build**             | `pnpm.cmd build`                                     | **PASS** (toàn monorepo)        | Build Vite web bundle và NestJS API distribution                                                     |
| **Docker Runtime & Health**      | `docker compose ps` / health endpoints               | **PARTIAL**                     | Container checkpoint trước healthy; build image mới cho hardening bị treo và chưa được xác minh      |
| **Synthetic Scale Benchmark**    | `pnpm.cmd test:performance`                          | **PASS** (1.000 NV)             | Query: 16,72 ms, Engine: 5,66 ms, Tổng: 2.386,99 ms                                                  |
| **Backup & SHA-256**             | `scripts/backup.ps1`                                 | **PASS**                        | Tạo bản sao lưu SQL và mã băm SHA-256 thành công                                                     |

Tổng số test tự động ở lần chạy cuối sau khi nạp đủ biến môi trường: **68 PASS**, 0 FAIL, 0 SKIP. Lần gọi integration thiếu biến môi trường đã dừng trước assertion và được ghi riêng trong `TEST_REPORT.md`.

Màn Import Excel đã được xây dựng lại theo mockup: sidebar/topbar dùng chung, stepper động, upload kéo-thả, mapping bảy trường, validation summary, preview/search/filter/export lỗi/phân trang, action bar và view lịch sử. Ảnh bằng chứng trước/sau ở `docs/ui-reference/`. Chưa tuyên bố pixel-perfect vì chưa có automated image-diff threshold và chưa có logo chính thức.

## 3. Các lỗi kỹ thuật đã phát hiện và tự động khắc phục

1. **Lỗi xóa tệp kết quả kiểm thử Playwright trên Windows (`EPERM: unlink .last-run.json`)**:
   - _Nguyên nhân_: Thư mục `test-results/` có quyền sở hữu từ phiên sandbox trước đó, tài khoản người dùng hiện tại không có quyền xóa tệp `.last-run.json`.
   - _Khắc phục_: Cấu hình `outputDir: './storage/test-results'` và `outputFolder: './storage/playwright-report'` trong `playwright.config.ts`, cập nhật `.gitignore` để bỏ qua các thư mục này. Mốc sửa lỗi này đạt 6/6; bộ E2E hiện tại đạt 9/9 PASS.
2. **Lỗi dọn dẹp thư mục đầu ra khi build Vite trên Windows (`[vite:prepare-out-dir] EPERM: unlink index-*.css`)**:
   - _Nguyên nhân_: Cơ chế `emptyOutDir: true` mặc định của Vite gọi `rimraf`/`unlinkSync` trên các tệp do tiến trình trước tạo ra.
   - _Khắc phục_: Thêm `build: { sourcemap: true, emptyOutDir: false }` vào `apps/web/vite.config.ts`. Lệnh `pnpm.cmd build` của toàn monorepo vượt qua thành công trong 4.00s.

## 4. Trạng thái các Guard nghiệp vụ bắt buộc

- `WORKFLOW_ENABLED=false`: Chặn chuyển trạng thái kỳ công (`REVIEWED`, `APPROVED`, `LOCKED`, `PUBLISHED`). API trả về HTTP 409 Conflict khi cố chuyển trạng thái.
- `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`: Khóa nhận diện trùng đã được duyệt ngày 22/10/2026; phát hiện trùng sẽ từ chối toàn bộ import.
- `RBAC & Data Scope`: Kiểm tra tại tầng NestJS Guards. Tài khoản EMPLOYEE chỉ được đọc dữ liệu của chính mình (IDOR phòng vệ trả HTTP 404).
- `SOURCE_MASTER_PROVISIONING_ENABLED=false`: chặn API/UI tự tạo master, lịch hoặc suy timestamp từ nguồn trước khi có phê duyệt; ngoại lệ và dashboard đã áp scope backend cho HR/MANAGER.

## 5. Danh sách Blocker cần quyết định / dữ liệu từ bên ngoài

| STT | Mã / Hạng mục          | Trạng thái                             | Yêu cầu / Câu hỏi còn mở                                                                                                                                                                                                                  |
| --- | ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Q01 / SX.xlsx`        | **PARTIAL/BLOCKED**                    | File đã ACCEPTED 2.765 raw rows; còn thiếu mapping master/lịch/alias/timestamp và expected calculation từ HR. DB development có 1.841 calculation phát sinh từ một lần provision không có decision evidence nên phải coi là `UNVERIFIED`. |
| 2   | `DEC-002 / Q04`        | **PARTIALLY_CONFIRMED**                | Cần tiêu chí chi tiết để suy ngày ra hôm sau khi dữ liệu nguồn chỉ có giờ. Hiện tại: dòng thiếu căn cứ chuyển sang `NEEDS_REVIEW`.                                                                                                        |
| 3   | `DEC-003 / Q05`        | **PARTIALLY_CONFIRMED; KEY CONFIRMED** | Đã cấu hình `employeeCode,attendanceDate,shiftName`; còn mở quy trình file sửa/file nhiều kỳ.                                                                                                                                             |
| 4   | `Q10 / Q11`            | **OPEN**                               | Cần duyệt luồng phê duyệt (ai duyệt, tách vai trò lập/duyệt, điều chỉnh sau khóa). Hiện tại: tắt toàn bộ workflow.                                                                                                                        |
| 5   | `Q15 / PDF`            | **PARTIAL**                            | Cần mẫu bảng công chính thức, logo, tiêu đề công ty để thay thế watermark development.                                                                                                                                                    |
| 6   | Docker image hardening | **NOT_VERIFIED**                       | BuildKit treo trong hai lần build; health hiện tại chỉ chứng minh image checkpoint trước.                                                                                                                                                 |

---

Tài liệu liên quan:

- [Hướng dẫn tiếp tục dự án](file:///D:/chamCong/AGENTS.md)
- [Báo cáo kiểm thử chi tiết](file:///D:/chamCong/docs/TEST_REPORT.md)
- [Báo cáo tiến độ chi tiết](file:///D:/chamCong/docs/13_PROGRESS_REPORT.md)
- [Kế hoạch triển khai](file:///D:/chamCong/docs/IMPLEMENTATION_PLAN.md)
- [Sẵn sàng triển khai](file:///D:/chamCong/docs/DEPLOYMENT_READINESS.md)
