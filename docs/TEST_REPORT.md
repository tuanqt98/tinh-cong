# Báo cáo kiểm thử

Ngày chạy gần nhất: 22/10/2026, timezone `Asia/Ho_Chi_Minh`. Test tự động dùng dữ liệu **synthetic**. File `SX.xlsx` người dùng upload chỉ được dùng để kiểm tra parser/cấu trúc, chưa dùng làm oracle tính công và không thay thế UAT.

## Kết quả cuối

| Nhóm                                           | Lệnh/bằng chứng                                  | Kết quả                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Engine unit                                    | `pnpm.cmd test:run`                              | 31/31 PASS, 2 files                                                                                                             |
| API unit/service/security/export/import policy | `pnpm.cmd --filter @tinh-cong/api test:run`      | 23/23 PASS, 6 files                                                                                                             |
| PostgreSQL integration                         | `pnpm.cmd test:integration`                      | 5/5 PASS, PostgreSQL 16 thật; lần chạy UI checkpoint dùng DB development đã cấu hình                                            |
| Browser E2E                                    | `pnpm.cmd test:e2e`                              | 9/9 PASS, Chromium; login, 12 màn hình, mobile, refresh phiên, confirm một lần, xem raw import và 3 viewport visual QA          |
| Lint command                                   | `pnpm.cmd lint`                                  | Exit 0; hiện không workspace package nào khai báo script lint, vì vậy không coi đây là bằng chứng rule-level lint               |
| TypeScript                                     | `pnpm.cmd typecheck`                             | PASS, 5 workspace packages có script                                                                                            |
| Production build                               | `pnpm.cmd build`                                 | PASS, API + web + engine + UI + shared                                                                                          |
| Prisma                                         | `prisma validate`; `prisma migrate deploy`; seed | PASS, migration `20261021145100_init` và synthetic seed                                                                         |
| Docker build                                   | `docker compose build api web`                   | **NOT VERIFIED cho thay đổi hiện tại**: hai lần build không phát log và bị dừng sau 244 giây / hơn 7 phút; image cũ vẫn tồn tại |
| Docker runtime                                 | API direct + Nginx proxy + web                   | PASS trên image checkpoint trước: health `ok`, HTTP 200; không dùng làm bằng chứng cho image mới                                |
| Backup/restore                                 | `backup.ps1`, `restore.ps1` vào DB tạm           | PASS, SHA-256 tạo được, restore 25 bảng; DB tạm đã xóa                                                                          |
| Synthetic scale                                | `pnpm.cmd test:performance`                      | PASS, 1.000 NV: query 43,69 ms; engine 6,15 ms; tổng 175,02 ms                                                                  |

Tổng test tự động ở lần chạy cuối đạt: **68 PASS** (`31 + 23 + 5 + 9`), **0 FAIL**, **0 SKIP** sau lần chạy lại đầy đủ môi trường. Các kiểm tra build/migration/Docker/backup/performance được ghi riêng, không cộng vào số test case.

## Mốc redesign Import Excel ngày 22/10/2026

- Xây dựng lại màn Import Excel theo ảnh mục tiêu 1536×1024: app shell/sidebar/topbar dùng chung, stepper động, upload kéo-thả thật, mapping bảy trường, trạng thái kiểm tra cấu trúc, KPI/toolbar/bảng preview/phân trang và action bar.
- Giữ nguyên API/backend/database/engine và khóa trùng. Luồng preview/confirm vẫn chờ phản hồi backend; mapping thay đổi sẽ hủy preview cũ; confirm lặp vẫn bị khóa.
- Chuyển lịch sử import sang view riêng trong cùng màn hình; các thao tác xem raw, xử lý dữ liệu và guard `Chờ duyệt master/lịch` được giữ nguyên.
- Visual fixture chỉ là **synthetic mock API data**, không phải dữ liệu thật và không hard-code vào production UI.
- Đã chụp và kiểm tra trực quan tại `1536×1024`, `1440×900`, `1280×800`. Ảnh trước, ảnh mục tiêu và ba ảnh sau nằm trong `docs/ui-reference/`.
- Kết quả gate tại checkpoint: `pnpm.cmd typecheck` PASS; `pnpm.cmd build` PASS; `pnpm.cmd test:run` 54/54 PASS; `pnpm.cmd test:e2e` 9/9 PASS; integration 5/5 PASS sau khi nạp biến môi trường development.
- Lần gọi integration đầu tiên không có `DATABASE_URL`/credential nên suite dừng với **1 suite FAIL, 5 test SKIP** trước khi assertion chạy. Đã chạy lại bằng biến môi trường hiện có, không in/hard-code secret, và đạt 5/5; lần lỗi cấu hình không bị ghi thành PASS.
- Không tuyên bố pixel-perfect/100%: chưa có automated image-diff threshold; logo chính thức chưa được cung cấp; ở viewport thấp nội dung dùng cuộn/stack responsive và thanh hành động ghim cuối màn hình thay vì ép toàn bộ bảng vào một khung hình.

## Mốc hardening fail-closed ngày 22/10/2026

- Phát hiện API/UI có thao tác tự tạo master nhân viên/phòng ban, lịch phân ca, alias ca và suy Ca 3 D+1 từ file nguồn dù Q01/Q04/Q07 chưa có phê duyệt được ghi nhận. Đã thêm `SOURCE_MASTER_PROVISIONING_ENABLED=false`, backend trả `409 SOURCE_MASTER_APPROVAL_REQUIRED` trước khi đọc/ghi DB và UI chỉ hiển thị nút vô hiệu hóa `Chờ duyệt master/lịch`.
- API ngoại lệ nay áp data scope tại backend. ADMIN được xem toàn bộ; HR không có `ManagerScope` trả tập rỗng và không thể resolve ngoại lệ ngoài scope. Tài khoản HR/MANAGER không còn tự nhận scope cá nhân chỉ vì có `employeeId`.
- Dashboard đã scope số kỳ chờ và publication theo tập nhân viên được phép thay vì đếm toàn hệ thống cho HR/MANAGER.
- `pnpm.cmd typecheck`, `pnpm.cmd build`, `pnpm.cmd test:run`, format check các tệp đã chạm và `pnpm.cmd test:e2e` đều PASS. Migration `20261021145100_init`, seed synthetic và 5 integration tests chạy trên database mới `tinhcong_it_*` PASS; database tạm được xóa trong `finally`.
- Lần integration đầu trên DB development có **1 FAIL / 4 PASS** vì test cũ giả định dashboard luôn trống. DB thực tế đã có dữ liệu; test đã được sửa để kiểm tra contract mà không phụ thuộc trạng thái tồn lưu, rồi chạy lại trên DB mới đạt 5/5. Lần FAIL này không được ghi thành PASS.
- `docker compose config` xác nhận `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false` và khóa trùng vẫn đúng. Health của container cũ đạt qua API trực tiếp, Nginx và proxy. Build image mới chưa có bằng chứng hoàn tất do BuildKit treo; không tuyên bố Docker PASS cho code mới.

## Sai lệch dữ liệu development cần quyết định

Kiểm tra read-only sau khi integration phát hiện DB development hiện có **93 nhân viên, 1.908 lịch, 1.841 normalization và 1.841 calculation `VALID`**, cùng một audit `IMPORT_SOURCE_APPROVED_AND_MASTER_PROVISIONED` lúc `2026-10-22T04:00:36.573Z` (11:00:36 `Asia/Ho_Chi_Minh`). Hồ sơ quyết định hiện hành vẫn ghi thiếu phê duyệt master/lịch/alias/tiêu chí D+1. Vì vậy:

- Không dùng 1.841 calculation này làm oracle/UAT hoặc bằng chứng dữ liệu thật.
- Không tự xóa/rollback vì đó là thay đổi dữ liệu phá hủy và cần chủ dự án xác nhận phạm vi phục hồi.
- Giữ workflow/publish tắt; cần quyết định tái tạo DB development từ backup/checkpoint sạch hoặc đánh dấu và xử lý lại dữ liệu đã provision.

## Kiểm tra file SX.xlsx ngày 22/10/2026

- SHA-256 đã được lưu trong bản ghi import; file nằm trong private upload volume, không đưa vào Git/tài liệu.
- Sheet `Xuất lưới`, 2.769 dòng vật lý, header thực ở dòng 3 với 21 cột.
- Parser mới nhận đúng bảy trường nguồn qua alias `Mã N.Viên`, `Tên N.Viên`, `Phòng ban`, `Ngày`, `Vào`, `Ra`, `Tên ca`.
- Kết quả đọc: 2.765 dòng dữ liệu; **0 lỗi cấu trúc blocking**.
- Cảnh báo: 105 `MISSING_CHECKOUT`, 849 `INVALID_SHIFT` (ca trống/`--`), 786 `NO_ATTENDANCE`. Một dòng có thể có hơn một cảnh báo.
- Khóa trùng được Chủ dự án duyệt ngày 22/10/2026: `employeeCode,attendanceDate,shiftName`. Kiểm tra trên 2.765 dòng cho kết quả 0 nhóm trùng.
- Người dùng đã confirm: import `ACCEPTED`, 2.765 raw rows. Backfill pipeline idempotent tạo 4.505 ngoại lệ = 1.740 cảnh báo nguồn + 2.765 `EMPLOYEE_NOT_FOUND`.
- Dữ liệu nguồn có 92 mã nhân viên/12 phòng ban; master development chỉ có 1 nhân viên synthetic và 0 lịch phân ca. Kết quả an toàn: 0 linked, 0 normalization, 0 calculation; không tự tạo master hoặc suy lịch/timestamp.
- Web/API mới hiển thị lịch sử import, raw rows, số ngoại lệ/trạng thái xử lý; các lần confirm sau tự chạy pipeline và giữ raw nếu bước xử lý phụ thất bại.

## Phạm vi đã chứng minh

- Công thức Ca 1/Ca 3, break overlap, tier, đi muộn/về sớm độc lập, bảo toàn giây.
- Thiếu timestamp/evidence, ca lạ, `A=B`, duration âm, `>16h`, một dòng nhiều lỗi.
- Duplicate trong file, duplicate so với fingerprint đã lưu, multiple rows, fail-closed khi chưa cấu hình khóa.
- Parser chỉ đọc bảy trường, từ chối formula ở trường nguồn và mapping thiếu cột.
- RBAC guard, endpoint private trả 401, EMPLOYEE IDOR trả 404, EMPLOYEE không vào dashboard HR.
- Workflow chuyển kỳ trả 409 khi `WORKFLOW_ENABLED=false`.
- Excel chặn formula injection; PDF tạo được với font tiếng Việt và watermark development.
- 12 màn hình render trong Chromium; layout mobile mở menu.
- Web lưu refresh token theo phiên, tự xoay token và thử lại request một lần khi access token hết hạn; refresh thất bại thì xóa phiên và quay về đăng nhập.
- Migration chạy trên PostgreSQL, seed không dùng mật khẩu mặc định, API đăng nhập và truy vấn dashboard qua Nginx.

## Lỗi tìm thấy và đã sửa

1. Playwright locator mật khẩu khớp cả nút hiện/ẩn: đổi sang input selector rõ ràng.
2. Playwright/Vite trên Windows không dừng process con: thêm `scripts/run-e2e.ps1` quản lý PID bằng `try/finally`.
3. Docker API build được nhưng runtime thiếu `dist/generated/prisma`: thêm bước copy Prisma client vào artifact build, rebuild và health đạt.
4. Cổng 3000 bị tiến trình công cụ cục bộ chiếm: thêm biến host port Compose; kiểm thử ở API `3300`, web `8180`.
5. Integration test đầu tiên kỳ vọng sai nội dung thông báo guard: giữ hành vi API, sửa assertion theo hợp đồng thực tế và chạy lại 4/4 PASS.
6. Performance script ban đầu dùng sai tên export/field engine: sửa theo API package và chạy lại PASS.
7. Playwright E2E gặp lỗi quyền xóa tệp trên Windows (`EPERM: unlink .last-run.json`): cấu hình chuyển outputDir và html report vào `./storage/`, thêm vào `.gitignore`, chạy lại PASS.
8. Vite build gặp lỗi dọn dẹp thư mục trên Windows (`[vite:prepare-out-dir] EPERM: unlink index-*.css`): thêm cấu hình `build.emptyOutDir = false` vào `apps/web/vite.config.ts`, `pnpm build` toàn monorepo PASS.
9. Web giữ thông tin người dùng sau khi access token hết hạn nhưng không dùng refresh token, khiến import trả `Unauthorized`: lưu/luân chuyển refresh token, thử lại request sau refresh và thêm E2E hồi quy; 4/4 PASS.
10. Lần chạy integration đầu tiên ngày 22/10/2026 không thực thi 4 test do PowerShell chưa nạp `DATABASE_URL`/credential synthetic; chạy lại với biến development đúng, 4/4 test thực sự PASS. Không ghi lần bị skip là PASS.
11. Confirm `SX.xlsx` lần đầu đã ghi thành công 2.765 raw rows nhưng UI vẫn cho bấm lại, khiến API trả `Not Found` do import không còn ở trạng thái `PREVIEW`: frontend khóa request lặp, hiển thị `Đã import`; backend trả `IMPORT_ALREADY_PROCESSED` rõ ràng; E2E hồi quy 5/5 PASS.
12. Raw đã import nhưng Bảng công/Ngoại lệ trống vì thiếu pipeline và UI raw: bổ sung API lịch sử/detail/rows/process, pipeline liên kết exact-code + evidence fail-closed, chuyển import issues sang ngoại lệ, màn hình lịch sử/raw và E2E; 6/6 PASS. Backfill thực tạo đúng 4.505 ngoại lệ, không tạo calculation thiếu căn cứ.
13. Luồng `approve-source-and-process` có thể tự ghi nhận phê duyệt chưa tồn tại và tạo master/lịch/calculation: khóa mặc định bằng feature flag backend, vô hiệu hóa thao tác UI và thêm unit/integration/E2E regression.
14. `GET /exceptions` và resolve ngoại lệ chưa lọc scope HR; `employeeScope` còn cộng scope cá nhân cho HR/MANAGER không có cấu hình: áp scope ở query/mutation và thêm unit test fail-closed.
15. Integration dashboard phụ thuộc DB phải trống nên FAIL khi development DB có dữ liệu: đổi assertion sang contract/type và chứng minh lại trên DB PostgreSQL mới 5/5 PASS.

Không test nào bị xóa hoặc validation/phân quyền bị tắt để đạt PASS.

## Chưa chạy / bị chặn

| Hạng mục                                                       | Trạng thái               | Lý do                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Đối chiếu `SX.xlsx` thật                                       | PARTIAL/BLOCKED          | đã đọc cấu trúc file; thiếu mapping/lịch được duyệt và expected HR để đối chiếu kết quả                                                |
| UAT với HR/nhân viên                                           | BLOCKED                  | chưa có người nghiệm thu và dữ liệu đã ẩn danh                                                                                         |
| Duplicate key nghiệp vụ thật                                   | PASS_POLICY/PARTIAL_DATA | Khóa đã duyệt và cấu hình; 0 nhóm trùng trên `SX.xlsx`; chưa thực hiện confirm/UAT thay người dùng                                     |
| Workflow chốt/phát hành end-to-end thật                        | BLOCKED                  | Q10/Q11 và hậu kiểm sau khóa chưa được duyệt; flag mặc định tắt                                                                        |
| PDF hàng loạt và mẫu chính thức                                | PARTIAL/BLOCKED          | PDF cá nhân synthetic đã test; thiếu mẫu/logo và approval phát hành                                                                    |
| Pen-test độc lập, tải đồng thời/SLA dài hạn                    | NOT_RUN                  | cần môi trường staging và tiêu chí SLA được duyệt                                                                                      |
| Xử lý 1.841 calculation development không có decision evidence | BLOCKED/UNVERIFIED       | cần chủ dự án chọn rollback DB development hoặc quy trình đánh dấu/revalidate; không tự xóa dữ liệu                                    |
| Docker image cho mốc hardening hiện tại                        | NOT_VERIFIED             | BuildKit không phát log/không hoàn tất trong hai lần thử; container image checkpoint trước vẫn healthy nhưng không chứng minh code mới |

Do các mục trên, báo cáo này không tuyên bố 100% acceptance hoặc production-ready.
