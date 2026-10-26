# Báo cáo tiến độ dự án

Ngày cập nhật: 26/10/2026, `Asia/Ho_Chi_Minh`.

Trạng thái tổng thể: **`DEVELOPMENT_COMPLETE_WITH_BLOCKERS`**. Không production-ready và chưa có dữ liệu thật/UAT.

## Hoàn thành

- Phase 0: kế thừa tài liệu/audit; ghi DEC-001–DEC-014 và giữ phần chưa duyệt OPEN.
- Phase 1: attendance engine độc lập; Ca 1/Ca 3, break overlap, L/E, validation nhiều lỗi, duplicate/multiple-row guard.
- Phase 2: NestJS, Prisma/PostgreSQL 16, migration, seed synthetic, JWT refresh, lockout, RBAC và data scope, Swagger.
- Phase 3: React/Vite/Tailwind/shadcn-style, responsive và đủ 12 màn hình kết nối API.
- Phase 4 phần độc lập: Excel preview/confirm nguyên tử, ngoại lệ, audit, portal/feedback endpoints, Excel/PDF draft. Workflow chưa đủ quyết định được guard bằng flag.
- Phase 5 phần khả thi: unit/service/security/integration/E2E/export, benchmark synthetic 1.000 NV, backup/restore.
- Phase 6: Docker Compose, Nginx, health checks, volumes, environment template, backup/restore và runbook.

## Kết quả kiểm chứng

- 39/39 engine unit tests PASS, gồm Ca 1 07:00–19:00 với block giờ ra toàn ca, Ca 3 19:00–07:00, không tính vào sớm, rule lịch sử và phân bổ Chủ nhật Ca 1 200%/Ca 3 230% theo `shiftDate`.
- 36/36 API unit/service/security/export/import-policy tests PASS, gồm guard PATCH nhân viên rỗng, regression import, source-shift, report, Màn 07, nghỉ Chủ nhật và preview ngày lễ không dữ liệu.
- 15/15 API + PostgreSQL integration tests PASS trên database mới sau đủ tám migration và seed synthetic; gồm rule lượt muộn/sớm và ngày lễ.
- 23/23 Playwright Chromium tests PASS, gồm refresh access token, import, nhân viên, Bảng công tổng hợp, Chi tiết bảng công, Màn 07 và cấu hình ngày nghỉ lễ.
- Typecheck và production build toàn monorepo PASS.
- Migration/seed PostgreSQL PASS; production build API/web PASS. Image Dockerfile cho DEC-011 chưa rebuild.
- Docker runtime: DB/API/web healthy; login synthetic và dashboard qua Nginx PASS.
- Backup/restore: SHA-256 tạo được, restore DB tạm đủ 25 bảng PASS.
- Synthetic 1.000 NV: query 43,69 ms, engine 6,15 ms, tổng 175,02 ms trong lần đo development (lần đo lại gần nhất: query 16,72 ms, engine 5,66 ms).
- DEC-007: pipeline dùng đúng `Ca1`/`Ca3` trong file làm phân ca và evidence ngày ca, không đọc/tạo `work_schedules`; ca trống, `--` hoặc alias khác vẫn vào ngoại lệ.
- DEC-008: rule Ca 3 version 2 hiệu lực từ 01/09/2026 dùng khung 19:00–07:00, nghỉ 00:00–01:00; không tính trước 19:00, phần sau 07:00 chỉ nhận từng khối đủ 30 phút, phân bổ 4 giờ 100% + 4 giờ 130% + phần còn lại 210%. Raw giữ nguyên; thay đổi rule tạo revision mới và kỳ LOCKED/PUBLISHED không được tính lại trực tiếp.
- DEC-009: rule Ca 1 version 2 hiệu lực từ 01/09/2026 dùng khung 07:00–19:00, nghỉ 12:00–13:00; không tính trước 07:00, phần sau 19:00 chỉ nhận từng khối đủ 30 phút, phân bổ 8 giờ 100% + phần còn lại 150%. Raw giữ nguyên; rule lịch sử không bị sửa và kỳ LOCKED/PUBLISHED không được tính lại trực tiếp.
- DEC-010: rule version 3 của cả Ca 1/Ca 3 hiệu lực từ 01/09/2026 phân bổ toàn bộ `W` vào 200% cho Ca 1 và 230% cho Ca 3 khi `shiftDate` là Chủ nhật; tier khác bằng 0. Ca 3 kết thúc thứ Hai vẫn dùng Chủ nhật của ngày bắt đầu ca. Schema/API/UI/Excel/PDF đã có hai trường mới; tổng sáu tier bằng `W`.
- DEC-011: Ca 1 rule version 4 hiệu lực từ 01/09/2026 hạ giờ ra dùng để tính công xuống mốc 30 phút gần nhất trong toàn ca. Raw timestamp giữ nguyên; về sớm vẫn dùng giờ ra thực tế. `06:37–18:11` tính `07:00–18:00`, còn 10 giờ sau nghỉ.
- DEC-012: Chủ nhật trống cả giờ vào/ra là ngày nghỉ; giữ raw/import evidence nhưng không tạo/promote ngoại lệ hoặc calculation. Ngoại lệ lịch sử được revalidate có actor/reason; có một giờ hoặc có chấm công vẫn kiểm tra/tính bình thường.
- DEC-013: HR/ADMIN cấu hình ngày nghỉ lễ toàn công ty theo ngày + tên. Dòng ngày lễ trống cả giờ vào/ra không cảnh báo preview, không promote ngoại lệ/calculation; ngoại lệ lịch sử được resolve có audit. Có chấm công vẫn xử lý bình thường và chưa tự gán hệ số ngày lễ. Kỳ LOCKED/PUBLISHED không sửa; ngày đã có raw không được xóa cấu hình.
- DEC-014: đi muộn/về sớm chuyển sang lượt 0/1. Ca 1 tính muộn khi giờ vào sau 08:01; Ca 3 sau 22:01. Về sớm giữ mốc raw 19:00/07:00. Ca 1 rule v5, Ca 3 rule v4 và engine `2026-10-26-dec014` hiệu lực từ 01/09/2026; API/UI/Excel không còn hiển thị duration muộn/sớm.
- Hardening fail-closed: `SOURCE_MASTER_PROVISIONING_ENABLED=false`; API vẫn từ chối tự tạo hồ sơ nhân viên/phòng ban khi chưa có quyết định, UI vô hiệu hóa thao tác, ngoại lệ và dashboard áp data scope backend.
- Redesign Import Excel hoàn tất ở mức development: layout dùng chung mới, sidebar/topbar, stepper động, upload/mapping/validation/preview/action bar và lịch sử import được tích hợp lại với API hiện hữu. Ảnh before/target/after đã lưu trong `docs/ui-reference/`; chưa tuyên bố pixel-perfect vì chưa có ngưỡng image diff tự động và chưa có logo chính thức.
- Màn 05 Bảng công tổng hợp đã thay trang JSON bằng UI/API thật: chín KPI, kỳ/phòng ban/trạng thái, search/ca/trạng thái xử lý, sort + phân trang server-side, bảng 20 cột, tổng toàn tập lọc, detail theo employee + period và Excel toàn tập lọc. Aggregate chỉ cộng revision mới nhất `VALID`; workdays giữ `N/A`, period status tách processing status và backend scope vẫn fail-closed. Ảnh target/after ở `docs/ui-reference/attendance-summary-target.png` và `docs/ui-evidence/attendance-summary-after.png`; đối chiếu thủ công 1536×1024, chưa có image-diff tự động nên không tuyên bố pixel-perfect 100%.
- Màn 06 Chi tiết bảng công đã thay bảng thô bằng UI/API thật theo mockup: hồ sơ nhân viên, 12 KPI, điều hướng kỳ, bảng ngày công, tổng hợp, biểu đồ, đúng bảy trường dữ liệu nguồn và lịch sử điều chỉnh. API chỉ dùng revision mới nhất, chỉ cộng dòng `VALID`, gộp ngoại lệ mở không trùng và áp backend scope cho ADMIN/HR/MANAGER/EMPLOYEE. Không tự tạo dòng ngày nghỉ hoặc suy diễn số ngày làm việc; thao tác chỉnh/chốt vẫn khóa. PDF chi tiết có thể tải nhưng đóng dấu bản nháp phát triển do mẫu/logo/phê duyệt phát hành còn thiếu. Ảnh target/after ở `docs/ui-reference/attendance-detail-target.png` và `docs/ui-evidence/attendance-detail-after.png`; đối chiếu thủ công 1536×1024, chưa có automated image-diff/UAT.
- Màn 07 Xử lý ngoại lệ đã được xây dựng lại trên module hiện hữu: KPI record/code, filter/pagination URL+backend, bảng gộp đầy đủ nhiều lỗi, drawer raw/normalized/error/history, preview attendance-engine không ghi và Excel toàn bộ tập lọc. `WORKFLOW_ENABLED=false` khóa lưu; endpoint resolve cũ không còn tự chuyển `RESOLVED` thiếu revalidation. Không có migration mới. Target/before/after 1536×1024 đã lưu; chưa có image-diff/UAT và adjustment/revalidate vẫn BLOCKED bởi Q10/Q11.
- Runtime local Màn 07 đã được cập nhật bằng artifact API/web trong writable layer, chỉ restart API/web và không reset PostgreSQL. DB/API/web healthy; API trực tiếp/proxy và Nginx đều HTTP 200. Smoke xác thực qua cổng 8180 xác nhận bundle mới và contract list/summary hoạt động trên dữ liệu development.
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
- Trước DEC-008/DEC-009/DEC-010, `SX.xlsx` đã được chạy lại sau backup development và tạo 1.726 normalization/calculation `VALID` (CA1 1.116, CA3 610). Kết quả lịch sử này chưa được tính lại theo các rule mới và không được dùng làm oracle. Chín mã/270 dòng còn thiếu master vẫn OPEN; raw và các guard không thay đổi.

Gate của mốc Quản lý nhân viên ngày 22/10/2026: lint command exit 0 nhưng repo chưa có script lint ở workspace; typecheck PASS; build PASS; unit/service 56/56 PASS; PostgreSQL integration 8/8 PASS trên DB mới; Playwright 12/12 PASS. Tổng 76 PASS, 0 FAIL, 0 SKIP ở lần chạy cuối. Dữ liệu test/visual là synthetic.

Gate hardening mới nhất ngày 22/10/2026: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới sau migration + seed; Playwright 12/12. Tổng **77 PASS**, 0 FAIL, 0 SKIP. Lần integration đầu của mốc đạt 7/8 và phát hiện PATCH rỗng trả 200; sau khi thêm guard, lần chạy lại trên DB mới khác đạt 8/8. Cả hai DB tạm đều đã xóa trong `finally`.

Gate khôi phục import mới nhất ngày 23/10/2026: ESLint PASS 0 warning; typecheck PASS; build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới; Playwright 12/12. Ảnh `employee-management-import-restored.png` xác nhận bố cục năm cột, hai entry point import/template và dialog import trên runtime local.

Gate Màn 05 ngày 23/10/2026: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 29/29; PostgreSQL integration 9/9 trên DB mới; Playwright 17/17. Tổng **86 PASS**, 0 FAIL, 0 SKIP ở lần chạy cuối đầy đủ. Lần integration đầu migrate/seed thành công nhưng 0/9 chạy vì thiếu alias credential integration; DB tạm đã xóa, lần chạy lại trên DB mới khác đạt 9/9 và DB cũng đã xóa. Runtime writable layer API/web đã cập nhật, ba health endpoint 200; smoke kỳ 09/2026 trả 124 hồ sơ trong scope, 83 đã tính, 65.579.700 giây và 2.202 ngoại lệ mở. Đây là development validation, không thay thế HR/UAT; Dockerfile image build tái lập vẫn PARTIAL.

Gate Màn 06 ngày 23/10/2026: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 31/31; PostgreSQL integration 9/9 trên DB mới; Playwright 20/20. Tổng **91 PASS**, 0 FAIL, 0 SKIP ở lần chạy cuối đầy đủ. Lần integration đầu không chạy test vì URL database tạm bị PowerShell ghép sai và migration fail; lần hai chạy 8/9 do assertion test lồng quá chặt dù API trả đúng đủ dữ liệu; lần ba trên DB mới khác đạt 9/9. Tất cả DB tạm đã xóa. Playwright lần đầu đạt 19/20 do selector test kỳ vọng sai semantic role, sau khi sửa selector đạt 20/20. Không hạ validation hoặc đổi quy tắc tính công để đạt PASS.

Gate DEC-008 ngày 23/10/2026: ESLint PASS 0 warning; Prisma schema validate PASS; typecheck PASS; production build PASS; engine 32/32; API 32/32; PostgreSQL integration 10/10 trên DB mới sau đủ ba migration + seed synthetic; Playwright 20/20. Tổng **94 PASS**, 0 FAIL, 0 SKIP. Wrapper gộp đầu tiên đã hoàn tất migration/seed nhưng không trả kết quả integration nên bị dừng và không được ghi PASS; suite tách riêng đạt 10/10, sau đó DB tạm được xóa và xác nhận không còn tồn tại. Lần thử `docker compose build api web` tiếp tục treo không log/kết quả; lệnh và đúng tiến trình buildx còn sót đã được dừng, container cũ vẫn healthy. Chưa có image Dockerfile mới hoặc lần tính lại `SX.xlsx` theo DEC-008, vì vậy runtime evidence và đối chiếu HR vẫn OPEN/PARTIAL.

Gate DEC-009 ngày 23/10/2026: ESLint PASS 0 warning; Prisma schema validate PASS; typecheck PASS; production build PASS; engine 34/34; API 32/32; PostgreSQL integration 12/12 trên DB mới sau đủ bốn migration + seed synthetic; Playwright 20/20. Tổng **98 PASS**, 0 FAIL, 0 SKIP. Regression PostgreSQL giữ raw `06:30/19:20` và `06:30/19:30`, chọn Ca 1 rule v2 và ghi nhận đúng khối 30 phút; dữ liệu 31/08 bị fail-closed, không kéo lùi rule trước 01/09. DB tạm đã xóa và xác nhận không còn tồn tại. Chưa rebuild image runtime hoặc tính lại `SX.xlsx` theo DEC-008/DEC-009, vì vậy runtime evidence và đối chiếu HR vẫn OPEN/PARTIAL.

Gate DEC-010 ngày 24/10/2026: ESLint PASS 0 warning; Prisma schema validate PASS; typecheck PASS; production build PASS; engine 38/38; API 32/32; PostgreSQL integration 13/13 trên DB mới sau đủ năm migration + seed synthetic; Playwright 20/20. Tổng **103 PASS**, 0 FAIL, 0 SKIP ở lần chạy đạt cuối. Regression unit/DB xác nhận Ca 1 Chủ nhật 41.400 giây đều ở 200% và Ca 3 bắt đầu Chủ nhật/kết thúc thứ Hai 41.400 giây đều ở 230%, vẫn giữ biên vào sớm và khối 30 phút. Lần integration đầu đạt migration/seed nhưng 10/13 do API nạp engine `dist` cũ; kết quả đó không được ghi PASS. Sau production build, lần chạy lại trên DB mới khác đạt 13/13; cả hai DB tạm đều được xóa.

Runtime development DEC-010 ngày 24/10 đã được cập nhật bằng artifact API/web trong writable layer sau khi `docker compose build api web` tiếp tục treo không log và đúng tiến trình buildx được dừng có kiểm tra. Không recreate/reset PostgreSQL. Hai migration Ca 1/Chủ nhật đã áp dụng, nâng tổng số migration lên năm; import `SX.xlsx` đã `ACCEPTED` được xử lý lại thành công với 1.726 latest calculation. Tháng 09 có 39 dòng/1.161.300 giây ở 200% và một dòng/38.820 giây ở 230%; NV0001 ngày 06/09 dùng revision 3/rule v3 và toàn bộ 36.480 giây ở 200%. DB/API/web healthy; API trực tiếp, proxy và Nginx HTTP 200; bundle mới có cả 200%/230%. Image Dockerfile tái lập và đối chiếu HR/UAT vẫn OPEN/PARTIAL.

Gate DEC-011 ngày 24/10/2026: ESLint PASS 0 warning; Prisma validate PASS; typecheck PASS; production build PASS; engine 39/39; API 32/32; PostgreSQL integration 13/13 trên DB mới sau đủ sáu migration + seed; Playwright 20/20. Tổng **104 PASS**, 0 FAIL, 0 SKIP. Regression unit/DB giữ raw `06:37/18:11`, chọn Ca 1 rule v4 và tính đúng 36.000 giây với về sớm 2.940 giây; DB tạm đã xóa trong `finally`.

Gate Màn 07 ngày 24/10/2026: ESLint PASS 0 warning; Prisma validate PASS; typecheck PASS; production build PASS; engine 39/39; API 34/34; PostgreSQL integration 14/14 trên database mới sau đủ sáu migration + seed; Playwright 22/22. Tổng **109 PASS**, 0 FAIL, 0 SKIP. Lần chuẩn bị đầu bị skip toàn bộ do thiếu alias credential nên không ghi PASS. Lần chạy thật đầu đạt 13/14 và phát hiện phân trang query string chưa được ép số trước Prisma; sau khi thêm normalization + unit regression, tạo lại DB mới và đạt 14/14. Các database integration tạm đã xóa và truy vấn xác nhận không còn tồn tại.

Gate DEC-012 ngày 24/10/2026: ESLint PASS 0 warning; typecheck/build PASS; engine 39/39; API 35/35; PostgreSQL integration 14/14 trên DB mới sau đủ sáu migration + seed; Playwright giữ 22/22 từ gate UI vì không đổi UI. Tổng **110 PASS**, 0 FAIL, 0 SKIP. DB integration tạm đã xóa và xác minh sạch. Backup development được tạo trước xử lý; runtime API cập nhật qua writable layer, health direct/proxy HTTP 200. Xử lý lại `SX.xlsx` xác nhận 296 dòng Chủ nhật trống có 0 ngoại lệ OPEN và 0 calculation, raw/import evidence không đổi; danh sách tháng 09 `status=OPEN` còn 743 bản ghi.

Gate DEC-013 ngày 24/10/2026: ESLint PASS 0 warning; typecheck/build PASS; engine 39/39; API 36/36; PostgreSQL integration 15/15 trên DB mới sau đủ bảy migration + seed; Playwright 23/23. Tổng **113 PASS**, 0 FAIL, 0 SKIP. Unit xác nhận preview bỏ cảnh báo chấm công cho ngày lễ trống. Integration xác nhận EMPLOYEE bị 403, HR tạo ngày lễ và resolve hai ngoại lệ cũ, process không promote issue/không calculation, xóa bị 409 khi đã có raw. Database tạm được xóa trong `finally`.

Gate DEC-014 ngày 26/10/2026: ESLint PASS 0 warning; typecheck và production build PASS; engine 39/39; API 36/36; PostgreSQL integration 15/15 trên DB mới sau đủ tám migration + seed; Playwright 23/23. Tổng **113 PASS**, 0 FAIL, 0 SKIP. Unit bao phủ đúng/sau 08:01 và 22:01; visual E2E xác nhận summary/detail dùng số lượt. Database tạm `tinhcong_it_dec014_20261026` đã xóa sau test.

Runtime development DEC-014 đã được backup trước migration tại `storage/backups/tinhcong-20261026-084126.sql`, SHA-256 `0D99F75E3452E2C22ACE31743D8503492091141FFCA46AD437564660E2192B7C`. Migration thứ tám áp thành công, artifact API/engine/web được cập nhật qua writable layer và restart không reset DB. `SX.xlsx` được xử lý lại với 2.765 raw và 1.726 latest calculation; summary tháng 09 có 3 lượt đi muộn, 730 lượt về sớm, chỉ engine `2026-10-26-dec014`, max revision 5. DB/API/web healthy; API trực tiếp/proxy và Nginx HTTP 200. Image Dockerfile tái lập và expected HR/UAT vẫn PARTIAL/BLOCKED.

Runtime development DEC-013 được backup trước migration tại `storage/backups/tinhcong-20261024-172208.sql`, SHA-256 `4B4715B46FC54F5E8841F5DFFDE95DDD42789C1F35DCD220D4BE3EF8AA247B63`. Migration thứ bảy đã áp dụng; artifact API/web được chép vào writable layer và restart không reset PostgreSQL. API trực tiếp/proxy và web health đều HTTP 200; smoke có xác thực xác nhận `GET /company-holidays?month=2026-10` hoạt động và trả 0 ngày. Chưa cấu hình ngày lễ thật vì HR chưa cung cấp ngày cụ thể; image Dockerfile tái lập vẫn PARTIAL.

Runtime development DEC-011 đã được cập nhật bằng artifact API/engine trong writable layer, không recreate/reset PostgreSQL. Migration thứ sáu áp dụng thành công và `SX.xlsx` được xử lý lại thành 1.726 latest calculation. API proxy của NV0001 ngày 25/09 trả revision 4, engine `2026-10-24-dec011`, raw `06:37/18:11`, 36.000 giây công gồm 28.800 giây 100% + 7.200 giây 150%, về sớm 2.940 giây. Tổng tháng 09 còn 64.134.180 giây; DB/API/web healthy và API trực tiếp/proxy/Nginx đều HTTP 200. Image Dockerfile tái lập và đối chiếu HR/UAT vẫn OPEN/PARTIAL.

Runtime local Màn 06 đã được cập nhật bằng artifact API/web đã kiểm thử trong writable layer, không reset PostgreSQL. DB/API/web healthy; API trực tiếp, API qua proxy và Nginx đều HTTP 200. Smoke có xác thực qua cổng `8180` xác nhận PDF HTTP 200 và kỳ 09/2026 trả 31 dòng chi tiết cho một nhân viên đã tính, 25 ngày có mặt, không lặp `rawId` và `workingDaysAvailable=false`. Image tag chưa rebuild từ Dockerfile nên readiness Docker vẫn PARTIAL.

Runtime local ngày 23/10 đã được cập nhật bằng build artifact đã kiểm thử trong writable layer của container API/web hiện tại sau khi `docker commit` bị treo; tiến trình commit được kết thúc có kiểm tra và không reset DB. DB/API/web healthy; API trực tiếp/proxy và Nginx đều HTTP 200. Smoke đăng nhập trên cổng `8180` xác nhận đúng năm cột, Import/Tải mẫu, dialog và bốn header Excel. Image tag vẫn là checkpoint cũ nên bằng chứng Dockerfile tái lập vẫn PARTIAL.

Gate của mốc UI ngày 22/10/2026: lint command exit 0 nhưng repo chưa có script lint ở các workspace; typecheck PASS; production build PASS; unit/service 54/54 PASS; PostgreSQL integration 5/5 PASS; Playwright 9/9 PASS. Dữ liệu visual là synthetic.

Checkpoint reset DB ngày 22/10/2026: Chủ dự án xác nhận không cần backup; migration và synthetic seed PASS. Kiểm tra sau reset xác nhận các bảng import/raw/issue/normalization/calculation/exception/work schedule đều 0, proxy health `ok`, đăng nhập admin synthetic PASS.

Chi tiết và các lần lỗi đã sửa: [TEST_REPORT](file:///D:/chamCong/docs/TEST_REPORT.md) và [PROJECT_STATUS](file:///D:/chamCong/docs/PROJECT_STATUS.md).

## Trạng thái quyết định

| Quyết định                | Trạng thái                         | Guard hiện tại                                                                            |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| DEC-001 / Q03             | CONFIRMED                          | yêu cầu evidence lịch cho ngày ca                                                         |
| DEC-002 / Q04             | PARTIALLY_CONFIRMED                | không tự D+1 nếu thiếu evidence                                                           |
| DEC-003 / Q05             | PARTIALLY_CONFIRMED; key confirmed | `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`; trùng từ chối nguyên import |
| DEC-004 / Q06             | CONFIRMED                          | không tự cộng/ghép nhiều dòng                                                             |
| DEC-005 / Q08             | CONFIRMED                          | `A=B`, âm, `>16h` cần review                                                              |
| DEC-006 / Q12             | CONFIRMED                          | lưu tất cả lỗi; blocking ngăn chốt                                                        |
| DEC-007 / Q03/Q04/Q07     | CONFIRMED cho nguồn hiện tại       | dùng `Tên ca` từ file; không yêu cầu lịch phân ca; alias khác vẫn fail-closed             |
| DEC-008 / Ca 3            | CONFIRMED, hiệu lực 01/09/2026     | 19:00–07:00; không tính vào sớm; sau 07:00 theo khối đủ 30 phút; revision bất biến        |
| DEC-009 / Ca 1            | CONFIRMED, hiệu lực 01/09/2026     | 07:00–19:00; không tính vào sớm; sau 19:00 theo khối đủ 30 phút; revision bất biến        |
| DEC-010 / Chủ nhật        | CONFIRMED, hiệu lực 01/09/2026     | theo `shiftDate`; Ca 1 toàn bộ 200%, Ca 3 toàn bộ 230%; tổng sáu tier bằng thời gian công |
| DEC-011 / block Ca 1      | CONFIRMED, hiệu lực 01/09/2026     | giờ ra tính công hạ theo block 30 phút toàn ca; raw/về sớm dùng timestamp thực tế         |
| DEC-012 / nghỉ Chủ nhật   | CONFIRMED                          | cả giờ vào/ra trống: giữ raw nhưng không tạo ngoại lệ/calculation                         |
| DEC-013 / nghỉ lễ công ty | CONFIRMED                          | HR/ADMIN cấu hình; dòng trống không ngoại lệ/calculation; hệ số đi làm ngày lễ còn OPEN   |
| DEC-014 / lượt muộn, sớm  | CONFIRMED, hiệu lực 01/09/2026     | Ca 1 sau 08:01; Ca 3 sau 22:01; về sớm trước 19:00/07:00; tổng hợp theo lượt              |

## Blocker

1. `SX.xlsx` đã `ACCEPTED` với 2.765 raw rows và 1.726 latest calculation theo DEC-014 trên runtime development. DEC-012 loại 296 dòng nghỉ Chủ nhật khỏi tập cần xử lý; các dòng này có 0 ngoại lệ OPEN và 0 calculation. Đây không phải oracle HR/UAT. Các dòng làm việc còn thiếu hồ sơ/ca/evidence hoặc nhiều bản ghi cùng nhân viên/ngày vẫn fail-closed; không tự provision hay tính dòng bị chặn.
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
