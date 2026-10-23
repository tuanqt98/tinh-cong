# Trạng thái dự án Hệ thống chấm công In Nhật Hàn

Ngày cập nhật: 23/10/2026 (`Asia/Ho_Chi_Minh`).
Checkpoint: **`DEVELOPMENT_COMPLETE_WITH_BLOCKERS`** (Không production-ready).

## 1. Tổng quan trạng thái

Dự án đã hoàn thành toàn bộ phần khung kỹ thuật và logic độc lập từ Phase 1 đến Phase 6 trên môi trường phát triển cục bộ và container hóa. Tất cả các bài kiểm tra tự động với dữ liệu synthetic (mô phỏng) đều đạt 100%.

Hệ thống được bảo vệ bằng các chốt chặn an toàn (fail-closed guards) và **chưa được phép triển khai production hay phát hành bảng công thực tế** cho nhân viên do thiếu dữ liệu thực tế và các quyết định nghiệp vụ cần cấp quản lý phê duyệt.

## 2. Kết quả kiểm thử mới nhất

| Hạng mục kiểm thử                | Lệnh thực hiện                                       | Kết quả thực tế                 | Ghi chú                                                                                              |
| -------------------------------- | ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Engine Unit Tests**            | `pnpm.cmd test:run` (engine)                         | **31/31 PASS** (2 files)        | Tính công số nguyên giây, bảo toàn tier, Ca 1/Ca 3, đi muộn/về sớm độc lập                           |
| **API Unit & Service Tests**     | `pnpm.cmd test:run` (api)                            | **26/26 PASS** (6 files)        | Có guard PATCH nhân viên rỗng, regression confirm 2.765 dòng, source-shift, RBAC/scope và export     |
| **PostgreSQL Integration Tests** | migration + seed DB mới; `pnpm.cmd test:integration` | **8/8 PASS** (1 file)           | PostgreSQL 16 thật; coverage rule/kỳ DRAFT tháng nguồn và quản lý/import nhân viên an toàn           |
| **Browser E2E Tests**            | `pnpm.cmd test:e2e`                                  | **12/12 PASS** (Chromium)       | Màn nhân viên 4 trường + thao tác, import/template, responsive và visual QA Import Excel             |
| **ESLint**                       | `pnpm.cmd lint`                                      | **PASS, 0 warning**             | Flat config kiểm tra TypeScript/React/Node thật; không còn lint no-op                                |
| **TypeScript Typecheck**         | `pnpm.cmd typecheck`                                 | **PASS** (5 workspace packages) | `@tinh-cong/attendance-engine`, `shared`, `ui`, `api`, `web`                                         |
| **Production Build**             | `pnpm.cmd build`                                     | **PASS** (toàn monorepo)        | Build Vite web bundle và NestJS API distribution                                                     |
| **Docker Runtime & Health**      | `docker compose ps` / health endpoints               | **PARTIAL**                     | Container local mới healthy và smoke PASS; image Dockerfile tái lập vẫn bị chặn do commit/build treo |
| **Synthetic Scale Benchmark**    | `pnpm.cmd test:performance`                          | **PASS** (1.000 NV)             | Query: 16,72 ms, Engine: 5,66 ms, Tổng: 2.386,99 ms                                                  |
| **Backup & SHA-256**             | `scripts/backup.ps1`                                 | **PASS**                        | Tạo bản sao lưu SQL và mã băm SHA-256 thành công                                                     |

Tổng số test tự động ở lần chạy cuối sau khi nạp đủ biến môi trường: **77 PASS**, 0 FAIL, 0 SKIP. Lần integration đầu của mốc hardening đạt 7/8 và phát hiện PATCH nhân viên rỗng trả 200; sau khi thêm guard, chạy lại trên DB mới khác đạt 8/8. Chi tiết ở `TEST_REPORT.md`.

Màn Import Excel đã được xây dựng lại theo mockup: sidebar/topbar dùng chung, stepper động, upload kéo-thả, mapping bảy trường, validation summary, preview/search/filter/export lỗi/phân trang, action bar và view lịch sử. Ảnh bằng chứng trước/sau ở `docs/ui-reference/`. Chưa tuyên bố pixel-perfect vì chưa có automated image-diff threshold và chưa có logo chính thức.

## 3. Các lỗi kỹ thuật đã phát hiện và tự động khắc phục

1. **Lỗi xóa tệp kết quả kiểm thử Playwright trên Windows (`EPERM: unlink .last-run.json`)**:
   - _Nguyên nhân_: Thư mục `test-results/` có quyền sở hữu từ phiên sandbox trước đó, tài khoản người dùng hiện tại không có quyền xóa tệp `.last-run.json`.
   - _Khắc phục_: Cấu hình `outputDir: './storage/test-results'` và `outputFolder: './storage/playwright-report'` trong `playwright.config.ts`, cập nhật `.gitignore` để bỏ qua các thư mục này. Mốc sửa lỗi này đạt 6/6; bộ E2E hiện tại đạt 9/9 PASS.
2. **Lỗi dọn dẹp thư mục đầu ra khi build Vite trên Windows (`[vite:prepare-out-dir] EPERM: unlink index-*.css`)**:
   - _Nguyên nhân_: Cơ chế `emptyOutDir: true` mặc định của Vite gọi `rimraf`/`unlinkSync` trên các tệp do tiến trình trước tạo ra.
   - _Khắc phục_: Thêm `build: { sourcemap: true, emptyOutDir: false }` vào `apps/web/vite.config.ts`. Lệnh `pnpm.cmd build` của toàn monorepo vượt qua thành công trong 4.00s.
3. **Confirm 2.765 dòng trả HTTP 500 (`Prisma P2028`)**:
   - _Nguyên nhân_: `createMany` vượt timeout 5 giây của interactive transaction; transaction rollback, không có raw row ghi dở.
   - _Khắc phục_: Chuyển sang batch transaction nguyên tử, thêm regression 2.765 dòng và deploy lại API image local. Full build, 55 unit/service, 5 integration và 9 E2E đều PASS.
4. **Dữ liệu tháng 09 không tạo calculation dù đã có master**:
   - _Nguyên nhân_: seed development chỉ có kỳ tháng 10 và rule Ca1/Ca3 bắt đầu 09/10/2026; 1.726 dòng bị `SHIFT_RULE_NOT_FOUND` đúng fail-closed.
   - _Khắc phục_: pipeline chỉ mở rộng rule hiện hữu khớp tuyệt đối định nghĩa đã duyệt, không chồng lấn và tạo kỳ tháng nguồn ở trạng thái DRAFT. Regression integration tháng 09 PASS; chạy lại development tạo 1.726 calculation `VALID`, 0 tier mismatch, 0 thời gian âm, 0 thiếu evidence và 0 work schedule.

## 4. Trạng thái các Guard nghiệp vụ bắt buộc

- `WORKFLOW_ENABLED=false`: Chặn chuyển trạng thái kỳ công (`REVIEWED`, `APPROVED`, `LOCKED`, `PUBLISHED`). API trả về HTTP 409 Conflict khi cố chuyển trạng thái.
- `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`: Khóa nhận diện trùng đã được duyệt ngày 22/10/2026; phát hiện trùng sẽ từ chối toàn bộ import.
- `RBAC & Data Scope`: Kiểm tra tại tầng NestJS Guards. Tài khoản EMPLOYEE chỉ được đọc dữ liệu của chính mình (IDOR phòng vệ trả HTTP 404).
- DEC-007 cho phép dùng đúng `Ca1`/`Ca3` trong file làm phân ca và evidence timestamp, không tạo/đọc lịch phân ca. `SOURCE_MASTER_PROVISIONING_ENABLED=false` vẫn chặn API/UI tự tạo hồ sơ nhân viên/phòng ban từ nguồn.

## 5. Danh sách Blocker cần quyết định / dữ liệu từ bên ngoài

| STT | Mã / Hạng mục   | Trạng thái                             | Yêu cầu / Câu hỏi còn mở                                                                                                                           |
| --- | --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Q01 / SX.xlsx` | **PARTIAL/BLOCKED**                    | File đã ACCEPTED 2.765 raw rows; 83/92 mã đã có master và tạo 1.726 calculation hợp lệ. Còn 9 mã/270 dòng thiếu master và chưa có expected HR/UAT. |
| 2   | `DEC-002 / Q04` | **PARTIALLY_CONFIRMED**                | Trường hợp `Ca3` hiện tại đã có tiêu chí D+1 theo DEC-007; các dạng checkout khác thiếu căn cứ vẫn `NEEDS_REVIEW`.                                 |
| 3   | `DEC-003 / Q05` | **PARTIALLY_CONFIRMED; KEY CONFIRMED** | Đã cấu hình `employeeCode,attendanceDate,shiftName`; còn mở quy trình file sửa/file nhiều kỳ.                                                      |
| 4   | `Q10 / Q11`     | **OPEN**                               | Cần duyệt luồng phê duyệt (ai duyệt, tách vai trò lập/duyệt, điều chỉnh sau khóa). Hiện tại: tắt toàn bộ workflow.                                 |
| 5   | `Q15 / PDF`     | **PARTIAL**                            | Cần mẫu bảng công chính thức, logo, tiêu đề công ty để thay thế watermark development.                                                             |

---

Tài liệu liên quan:

- [Hướng dẫn tiếp tục dự án](file:///D:/chamCong/AGENTS.md)
- [Báo cáo kiểm thử chi tiết](file:///D:/chamCong/docs/TEST_REPORT.md)
- [Báo cáo tiến độ chi tiết](file:///D:/chamCong/docs/13_PROGRESS_REPORT.md)
- [Kế hoạch triển khai](file:///D:/chamCong/docs/IMPLEMENTATION_PLAN.md)
- [Sẵn sàng triển khai](file:///D:/chamCong/docs/DEPLOYMENT_READINESS.md)
