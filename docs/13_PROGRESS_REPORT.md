# Báo cáo tiến độ dự án

Ngày cập nhật: 23/10/2026, `Asia/Ho_Chi_Minh`.

Trạng thái tổng thể: **`DEVELOPMENT_COMPLETE_WITH_BLOCKERS`**. Không production-ready và chưa có dữ liệu thật/UAT.

## Hoàn thành

- Phase 0: kế thừa tài liệu/audit; ghi DEC-001–DEC-007 và giữ phần chưa duyệt OPEN.
- Phase 1: attendance engine độc lập; Ca 1/Ca 3, break overlap, L/E, validation nhiều lỗi, duplicate/multiple-row guard.
- Phase 2: NestJS, Prisma/PostgreSQL 16, migration, seed synthetic, JWT refresh, lockout, RBAC và data scope, Swagger.
- Phase 3: React/Vite/Tailwind/shadcn-style, responsive và đủ 12 màn hình kết nối API.
- Phase 4 phần độc lập: Excel preview/confirm nguyên tử, ngoại lệ, audit, portal/feedback endpoints, Excel/PDF draft. Workflow chưa đủ quyết định được guard bằng flag.
- Phase 5 phần khả thi: unit/service/security/integration/E2E/export, benchmark synthetic 1.000 NV, backup/restore.
- Phase 6: Docker Compose, Nginx, health checks, volumes, environment template, backup/restore và runbook.

## Kết quả kiểm chứng

- 31/31 engine unit tests PASS.
- 26/26 API unit/service/security/export/import-policy tests PASS, gồm guard PATCH nhân viên rỗng, regression confirm 2.765 dòng và tính trực tiếp từ `Tên ca` không đọc lịch phân ca.
- 8/8 API + PostgreSQL integration tests PASS trên database mới sau migration và seed synthetic; gồm source-shift và quản lý/import nhân viên an toàn.
- 12/12 Playwright Chromium tests PASS, gồm refresh access token, chống confirm lặp, raw import, visual QA Import Excel và màn nhân viên bốn trường + thao tác vẫn có import/template.
- Typecheck và production build toàn monorepo PASS.
- Migration/seed PostgreSQL PASS; Docker API/web build PASS.
- Docker runtime: DB/API/web healthy; login synthetic và dashboard qua Nginx PASS.
- Backup/restore: SHA-256 tạo được, restore DB tạm đủ 25 bảng PASS.
- Synthetic 1.000 NV: query 43,69 ms, engine 6,15 ms, tổng 175,02 ms trong lần đo development (lần đo lại gần nhất: query 16,72 ms, engine 5,66 ms).
- DEC-007: pipeline dùng đúng `Ca1`/`Ca3` trong file làm phân ca và evidence ngày ca, không đọc/tạo `work_schedules`; ca trống, `--` hoặc alias khác vẫn vào ngoại lệ.
- Hardening fail-closed: `SOURCE_MASTER_PROVISIONING_ENABLED=false`; API vẫn từ chối tự tạo hồ sơ nhân viên/phòng ban khi chưa có quyết định, UI vô hiệu hóa thao tác, ngoại lệ và dashboard áp data scope backend.
- Redesign Import Excel hoàn tất ở mức development: layout dùng chung mới, sidebar/topbar, stepper động, upload/mapping/validation/preview/action bar và lịch sử import được tích hợp lại với API hiện hữu. Ảnh before/target/after đã lưu trong `docs/ui-reference/`; chưa tuyên bố pixel-perfect vì chưa có ngưỡng image diff tự động và chưa có logo chính thức.
- Docker config render đúng ba guard. Image web/API hiện tại đã build và recreate thành công; DB/API/web healthy, API trực tiếp/proxy và Nginx đã kiểm tra.
- Confirm import 2.765 dòng từng lỗi Prisma `P2028` do interactive transaction vượt 5 giây; đã đổi sang batch transaction nguyên tử, rollback cũ được xác minh không ghi raw một phần, image API mới đã deploy local.
- Image API/web chứa DEC-007 đã build trực tiếp, artifact được kiểm tra và container local được recreate; API trực tiếp, proxy và Nginx đều HTTP 200.
- Màn Quản lý nhân viên chỉ hiển thị mã, tên, phòng ban, trạng thái và thao tác; form thêm/sửa và file import map đúng bốn trường. Đã khôi phục nút Import, tải file mẫu và dialog preview/confirm theo xác nhận của Chủ dự án; file mẫu cũ dùng `Họ và tên` vẫn tương thích. KPI, filter/sort/pagination, CRUD, audit/history và soft deactivation bảo toàn attendance vẫn giữ.
- Lint monorepo nay là kiểm tra ESLint thực với flat config TypeScript/React/Node và `--max-warnings 0`, không còn exit 0 rỗng. Sáu lỗi lint ban đầu đã được sửa mà không đổi quy tắc tính công.
- PATCH nhân viên không có trường hồ sơ hợp lệ nay fail-fast HTTP 400 trước truy vấn/transaction, không tạo history/audit rỗng; có unit regression và integration PostgreSQL.
- Preview import nhân viên nay đếm đúng số dòng đã đọc kể cả khi mapping phòng ban lỗi và trả message kèm giá trị nguồn. Regression với `AKO` đạt `rowCount=1`, `canConfirm=false`; integration PostgreSQL 8/8 trên DB mới và runtime preview-only qua Nginx PASS. Development DB vẫn chỉ có `SYN-FACTORY`; không tự provision các phòng ban `AKO`, `Cơ điện, tạp vụ` khi guard đang tắt.
- ADMIN nay có nút `Quản lý phòng ban` ngay trên màn nhân viên để xem danh mục và tạo master mã/tên trước khi import. E2E tạo `AKO` trên mock API và integration PostgreSQL xác nhận ADMIN được tạo, EMPLOYEE bị 403; toàn bộ gate vẫn 77 PASS. Runtime local đã cập nhật, dialog smoke PASS và không ghi dữ liệu thử vào development DB. Đây là thao tác thủ công có chủ đích, không bật source-master auto-provision.
- Khi xử lý attendance import có hồ sơ nhân viên thiếu, API nay trả danh sách mã duy nhất và UI cảnh báo rõ số mã/số dòng, hiển thị từng mã cùng nút mở Quản lý nhân viên. Hệ thống xử lý phần đủ hồ sơ, không tự tạo phần thiếu và cho phép chạy xử lý lại sau khi người dùng bổ sung. Gate vẫn 77 PASS; runtime smoke cảnh báo dùng request intercept nên 2.765 raw development không bị thay đổi.
- Pipeline nay tự chuẩn bị coverage kỹ thuật cho ngày nguồn: chỉ mở rộng rule Ca1/Ca3 nếu rule hiện hữu khớp tuyệt đối định nghĩa đã duyệt và không chồng lấn, đồng thời tạo kỳ tương ứng ở trạng thái DRAFT. Regression nguồn tháng 09 trên DB mới PASS; không tạo lịch phân ca, nhân viên hay phòng ban.
- `SX.xlsx` đã được chạy lại sau backup development. Kết quả: 2.495 dòng liên kết, 1.726 normalization/calculation đều `VALID` (CA1 1.116, CA3 610), 0 tier mismatch, 0 thời gian âm, 0 evidence thiếu trong normalization và 0 work schedule. Chín mã/270 dòng còn thiếu master vẫn OPEN; 1.726 lỗi rule cũ đã được revalidation sang RESOLVED. Đây là validation development, chưa phải expected HR/UAT.

Gate của mốc Quản lý nhân viên ngày 22/10/2026: lint command exit 0 nhưng repo chưa có script lint ở workspace; typecheck PASS; build PASS; unit/service 56/56 PASS; PostgreSQL integration 8/8 PASS trên DB mới; Playwright 12/12 PASS. Tổng 76 PASS, 0 FAIL, 0 SKIP ở lần chạy cuối. Dữ liệu test/visual là synthetic.

Gate hardening mới nhất ngày 22/10/2026: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới sau migration + seed; Playwright 12/12. Tổng **77 PASS**, 0 FAIL, 0 SKIP. Lần integration đầu của mốc đạt 7/8 và phát hiện PATCH rỗng trả 200; sau khi thêm guard, lần chạy lại trên DB mới khác đạt 8/8. Cả hai DB tạm đều đã xóa trong `finally`.

Gate khôi phục import mới nhất ngày 23/10/2026: ESLint PASS 0 warning; typecheck PASS; build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới; Playwright 12/12. Ảnh `employee-management-import-restored.png` xác nhận bố cục năm cột, hai entry point import/template và dialog import trên runtime local.

Runtime local ngày 23/10 đã được cập nhật bằng build artifact đã kiểm thử trong writable layer của container API/web hiện tại sau khi `docker commit` bị treo; tiến trình commit được kết thúc có kiểm tra và không reset DB. DB/API/web healthy; API trực tiếp/proxy và Nginx đều HTTP 200. Smoke đăng nhập trên cổng `8180` xác nhận đúng năm cột, Import/Tải mẫu, dialog và bốn header Excel. Image tag vẫn là checkpoint cũ nên bằng chứng Dockerfile tái lập vẫn PARTIAL.

Gate của mốc UI ngày 22/10/2026: lint command exit 0 nhưng repo chưa có script lint ở các workspace; typecheck PASS; production build PASS; unit/service 54/54 PASS; PostgreSQL integration 5/5 PASS; Playwright 9/9 PASS. Dữ liệu visual là synthetic.

Checkpoint reset DB ngày 22/10/2026: Chủ dự án xác nhận không cần backup; migration và synthetic seed PASS. Kiểm tra sau reset xác nhận các bảng import/raw/issue/normalization/calculation/exception/work schedule đều 0, proxy health `ok`, đăng nhập admin synthetic PASS.

Chi tiết và các lần lỗi đã sửa: [TEST_REPORT](file:///D:/chamCong/docs/TEST_REPORT.md) và [PROJECT_STATUS](file:///D:/chamCong/docs/PROJECT_STATUS.md).

## Trạng thái quyết định

| Quyết định            | Trạng thái                         | Guard hiện tại                                                                            |
| --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| DEC-001 / Q03         | CONFIRMED                          | yêu cầu evidence lịch cho ngày ca                                                         |
| DEC-002 / Q04         | PARTIALLY_CONFIRMED                | không tự D+1 nếu thiếu evidence                                                           |
| DEC-003 / Q05         | PARTIALLY_CONFIRMED; key confirmed | `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`; trùng từ chối nguyên import |
| DEC-004 / Q06         | CONFIRMED                          | không tự cộng/ghép nhiều dòng                                                             |
| DEC-005 / Q08         | CONFIRMED                          | `A=B`, âm, `>16h` cần review                                                              |
| DEC-006 / Q12         | CONFIRMED                          | lưu tất cả lỗi; blocking ngăn chốt                                                        |
| DEC-007 / Q03/Q04/Q07 | CONFIRMED cho nguồn hiện tại       | dùng `Tên ca` từ file; không yêu cầu lịch phân ca; alias khác vẫn fail-closed             |

## Blocker

1. `SX.xlsx` đã `ACCEPTED` với 2.765 raw rows và đã tạo 1.726 calculation hợp lệ cho 83/92 mã nguồn có master. Còn 9 mã/270 dòng thiếu hồ sơ, 694 dòng ca không hỗ trợ, 65 dòng thiếu evidence timestamp và 10 dòng nhiều bản ghi cùng nhân viên/ngày ca; không tự provision hay tính các dòng bị chặn.
2. DEC-002 đã đủ cho trường hợp `Ca3` nguồn hiện tại theo DEC-007; các trường hợp checkout khác ngoài tiêu chí đã chốt vẫn OPEN.
3. Q10/Q11 và quyền/luồng chốt, phát hành, chỉnh sau khóa chưa duyệt.
4. Thiếu mẫu PDF/logo chính thức, UAT và staging security/load theo SLA.

## Việc tiếp theo

1. Khi sẵn sàng, Chủ dự án/HR nạp thủ công 9 hồ sơ còn thiếu (`NV00084`, `NV00100`, `NV00115`, `NV00129`, `NV00200`, `NV00209`, `NV00210`, `NV00212`, `NV00227`) rồi chạy xử lý lại. Hệ thống không tự tạo master và không cần lịch phân ca.
2. HR cung cấp bộ dữ liệu ẩn danh + expected và chốt các trường hợp còn lại của DEC-002; DEC-003 còn quy trình file sửa/file nhiều kỳ.
3. Chủ dự án duyệt Q10/Q11; sau đó mới viết/bật phần transition/publish tương ứng.
4. Chạy đối chiếu dữ liệu thật, UAT, PDF hàng loạt và tải đồng thời trên staging.
5. Khi có logo/brand asset chính thức, thay monogram tạm trong sidebar và bổ sung baseline image-diff nếu cần duyệt pixel-level.
6. Chỉ sau khi các cổng trong `docs/DEPLOYMENT_READINESS.md` đạt mới đánh giá production readiness.

Không có production deployment hoặc thông báo đến nhân viên thật trong checkpoint này.

## Checkpoint Docker local mới nhất — 23/10/2026

- Đã rebuild và recreate API/Web từ source redesign Quản lý nhân viên; image digest local lần lượt là `sha256:5a6fdb096939...` và `sha256:c68b0980ab7c...`.
- DB/API/Web healthy; migration deploy không còn migration chờ; health API trực tiếp, API qua proxy và Nginx đều HTTP 200.
- Login và API danh sách/thống kê nhân viên PASS. Browser smoke trên cổng `8180` xác nhận giao diện mới hiển thị đầy đủ và không có API response lỗi.
- Database development hiện có 123 employee và 19 department đang hoạt động; 83/92 mã nguồn `SX.xlsx` đã khớp master do người dùng nạp, còn 9 mã không được tự provision khi `SOURCE_MASTER_PROVISIONING_ENABLED=false`.
- Backup trước xử lý có SHA-256 `21722B107EAF2EA952DAEB2CA98AE653BE9D54392754DF09C712BFC2B1328FA6`. Artifact API mới được cập nhật vào writable layer và restart; sau bootstrap DB/API/web healthy, health trực tiếp/proxy/Nginx đều HTTP 200. Image tag vẫn là checkpoint cũ nên Dockerfile build tái lập còn PARTIAL.
- Rebuild toàn bộ source hardening vẫn chưa hoàn tất qua Compose/Dockerfile API do Docker CLI treo; các tiến trình do lần build tạo đã được dừng. Riêng web UI tinh gọn hiện đã chạy bằng image artifact mới `sha256:f2f77e63dc9...`; API vẫn là image checkpoint `sha256:5a6fdb096939...`, vì vậy bằng chứng container toàn stack vẫn là PARTIAL.
- Trạng thái tổng thể không đổi: `DEVELOPMENT_COMPLETE_WITH_BLOCKERS`, không production-ready.
