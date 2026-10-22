# Báo cáo tiến độ dự án

Ngày cập nhật: 22/10/2026, `Asia/Ho_Chi_Minh`.

Trạng thái tổng thể: **`DEVELOPMENT_COMPLETE_WITH_BLOCKERS`**. Không production-ready và chưa có dữ liệu thật/UAT.

## Hoàn thành

- Phase 0: kế thừa tài liệu/audit; ghi DEC-001–DEC-006 và giữ phần chưa duyệt OPEN.
- Phase 1: attendance engine độc lập; Ca 1/Ca 3, break overlap, L/E, validation nhiều lỗi, duplicate/multiple-row guard.
- Phase 2: NestJS, Prisma/PostgreSQL 16, migration, seed synthetic, JWT refresh, lockout, RBAC và data scope, Swagger.
- Phase 3: React/Vite/Tailwind/shadcn-style, responsive và đủ 12 màn hình kết nối API.
- Phase 4 phần độc lập: Excel preview/confirm nguyên tử, ngoại lệ, audit, portal/feedback endpoints, Excel/PDF draft. Workflow chưa đủ quyết định được guard bằng flag.
- Phase 5 phần khả thi: unit/service/security/integration/E2E/export, benchmark synthetic 1.000 NV, backup/restore.
- Phase 6: Docker Compose, Nginx, health checks, volumes, environment template, backup/restore và runbook.

## Kết quả kiểm chứng

- 31/31 engine unit tests PASS.
- 23/23 API unit/service/security/export/import-policy tests PASS.
- 5/5 API + PostgreSQL integration tests PASS trên database mới sau migration và seed synthetic.
- 9/9 Playwright Chromium tests PASS, gồm refresh access token, chống confirm lặp, xem raw import và visual QA Import Excel tại ba viewport.
- Typecheck và production build toàn monorepo PASS.
- Migration/seed PostgreSQL PASS; Docker API/web build PASS.
- Docker runtime: DB/API/web healthy; login synthetic và dashboard qua Nginx PASS.
- Backup/restore: SHA-256 tạo được, restore DB tạm đủ 25 bảng PASS.
- Synthetic 1.000 NV: query 43,69 ms, engine 6,15 ms, tổng 175,02 ms trong lần đo development (lần đo lại gần nhất: query 16,72 ms, engine 5,66 ms).
- Hardening fail-closed: `SOURCE_MASTER_PROVISIONING_ENABLED=false`; API từ chối provision master/lịch khi chưa có quyết định, UI vô hiệu hóa thao tác, ngoại lệ và dashboard áp data scope backend.
- Redesign Import Excel hoàn tất ở mức development: layout dùng chung mới, sidebar/topbar, stepper động, upload/mapping/validation/preview/action bar và lịch sử import được tích hợp lại với API hiện hữu. Ảnh before/target/after đã lưu trong `docs/ui-reference/`; chưa tuyên bố pixel-perfect vì chưa có ngưỡng image diff tự động và chưa có logo chính thức.
- Docker config render đúng ba guard; container checkpoint trước vẫn healthy. Image mới cho mốc hardening chưa build xong do BuildKit treo, nên trạng thái Docker mới là `NOT_VERIFIED`.

Gate của mốc UI ngày 22/10/2026: lint command exit 0 nhưng repo chưa có script lint ở các workspace; typecheck PASS; production build PASS; unit/service 54/54 PASS; PostgreSQL integration 5/5 PASS; Playwright 9/9 PASS. Dữ liệu visual là synthetic.

Chi tiết và các lần lỗi đã sửa: [TEST_REPORT](file:///D:/chamCong/docs/TEST_REPORT.md) và [PROJECT_STATUS](file:///D:/chamCong/docs/PROJECT_STATUS.md).

## Trạng thái quyết định

| Quyết định    | Trạng thái                         | Guard hiện tại                                                                            |
| ------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| DEC-001 / Q03 | CONFIRMED                          | yêu cầu evidence lịch cho ngày ca                                                         |
| DEC-002 / Q04 | PARTIALLY_CONFIRMED                | không tự D+1 nếu thiếu evidence                                                           |
| DEC-003 / Q05 | PARTIALLY_CONFIRMED; key confirmed | `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`; trùng từ chối nguyên import |
| DEC-004 / Q06 | CONFIRMED                          | không tự cộng/ghép nhiều dòng                                                             |
| DEC-005 / Q08 | CONFIRMED                          | `A=B`, âm, `>16h` cần review                                                              |
| DEC-006 / Q12 | CONFIRMED                          | lưu tất cả lỗi; blocking ngăn chốt                                                        |

## Blocker

1. `SX.xlsx` đã ACCEPTED 2.765 raw rows. Checkpoint an toàn ban đầu có 4.505 ngoại lệ và 0 calculation do thiếu master/lịch. DB development hiện đã có một lần provision không có decision evidence trong tài liệu, tạo tổng 93 nhân viên, 1.908 lịch và 1.841 calculation `VALID`; toàn bộ kết quả này là `UNVERIFIED`, không dùng làm oracle/UAT và cần quyết định rollback hoặc revalidation.
2. Tiêu chí chi tiết suy ngày checkout DEC-002 chưa chốt.
3. Q10/Q11 và quyền/luồng chốt, phát hành, chỉnh sau khóa chưa duyệt.
4. Thiếu mẫu PDF/logo chính thức, UAT và staging security/load theo SLA.
5. Docker BuildKit chưa tạo được image mới cho mốc hardening; hai lần thử không phát log/không hoàn tất. Container từ checkpoint trước vẫn healthy nhưng không thay thế bằng chứng build mới.

## Việc tiếp theo

1. Chủ dự án quyết định cách xử lý dữ liệu provision ngoài checkpoint trong DB development (khôi phục DB sạch hoặc đánh dấu/revalidate); không phát hành 1.841 calculation hiện có.
2. HR cung cấp bộ dữ liệu ẩn danh + expected và chốt phần còn lại của DEC-002; DEC-003 còn quy trình file sửa/file nhiều kỳ.
3. Chủ dự án duyệt Q10/Q11; sau đó mới viết/bật phần transition/publish tương ứng.
4. Khắc phục/restart BuildKit ngoài phiên thay đổi này rồi build lại image API/web và kiểm tra health trên chính image mới.
5. Chạy đối chiếu dữ liệu thật, UAT, PDF hàng loạt và tải đồng thời trên staging.
6. Khi có logo/brand asset chính thức, thay monogram tạm trong sidebar và bổ sung baseline image-diff nếu cần duyệt pixel-level.
7. Chỉ sau khi các cổng trong `docs/DEPLOYMENT_READINESS.md` đạt mới đánh giá production readiness.

Không có production deployment hoặc thông báo đến nhân viên thật trong checkpoint này.
