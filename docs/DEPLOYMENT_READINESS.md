# Deployment readiness

Cập nhật 26/10/2026.

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
- Import history/raw rows hiển thị trên web; pipeline idempotent chuyển cảnh báo sang ngoại lệ và chỉ tính khi có master + `Ca1`/`Ca3` nguồn + timestamp/evidence đầy đủ.
- Tạo hồ sơ nhân viên/phòng ban từ file nguồn bị khóa mặc định bằng `SOURCE_MASTER_PROVISIONING_ENABLED=false`; backend trả 409 và UI không cho kích hoạt khi chưa có decision evidence. DEC-007 cho phép dùng `Tên ca` nguồn trực tiếp nên không còn provision lịch phân ca.
- Ngoại lệ, attendance, publication và dashboard áp employee scope ở backend; HR/MANAGER không có scope trả rỗng/fail-closed.
- Màn Import Excel đã được redesign và kiểm chứng responsive bằng Playwright tại 1536×1024, 1440×900 và 1280×800; preview/confirm/history vẫn dùng API và guard hiện hữu.
- Màn Bảng công tổng hợp đã có UI/API thật thay trang JSON: aggregate revision mới nhất, chín KPI, 20 cột, filter/sort/pagination backend, tổng toàn tập lọc, detail theo employee + period và Excel toàn tập lọc có nhãn tạm/chống formula injection. Backend vẫn áp scope; `Số ngày làm việc` fail-closed thành `N/A` khi chưa có policy. Visual 1536×1024 dùng synthetic và chỉ được đối chiếu thủ công, chưa có automated image-diff/UAT nên không phải chứng nhận pixel-perfect.
- Màn Chi tiết bảng công đã có UI/API thật: hồ sơ + 12 KPI, revision mới nhất, từng ngày công, tổng hợp/biểu đồ, bảy trường nguồn, lịch sử điều chỉnh và PDF bản nháp. Backend áp scope cho cả dữ liệu và PDF; dòng `VALID` mới được cộng. Ngày trống không bị tự gán nghỉ, số ngày làm việc giữ `N/A`, không mở chỉnh/chốt khi Q10/Q11 còn OPEN. Visual 1536×1024 và mobile dùng synthetic; chưa có image-diff/UAT/mẫu PDF chính thức.
- Màn Xử lý ngoại lệ đã có UI/API đọc thật: KPI theo bản ghi và mã lỗi, filter/pagination server-side, nhiều mã lỗi trên một raw, detail raw/normalized/history, preview engine read-only và Excel toàn tập lọc. Backend áp scope; EMPLOYEE/MANAGER không vào màn quản trị. Mutation vẫn khóa đúng `WORKFLOW_ENABLED=false`, không tự ghi `RESOLVED`. Visual target/before/after 1536×1024 và mobile đã kiểm thử synthetic; PostgreSQL integration mới đạt 14/14. Phần adjustment/revalidate vẫn PARTIAL/BLOCKED bởi Q10/Q11.
- Confirm import lớn dùng batch transaction nguyên tử; regression synthetic 2.765 dòng bảo vệ khỏi Prisma interactive timeout 5 giây.
- Quản lý nhân viên có UI responsive và API/database thật: bảng chỉ hiển thị mã, tên, phòng ban, trạng thái, thao tác; form và import map đúng bốn trường. Entry point Import/Tải mẫu và preview/confirm đã được khôi phục; template mới dùng `Tên nhân viên`, parser tương thích `Họ và tên` cũ. Server-side filtering/pagination/KPI theo scope, audit/history và soft deactivation không xóa attendance vẫn giữ. Migration additive đã chạy trên development và DB integration mới; typecheck/build, 8 integration gần nhất và 12 E2E hiện tại đạt.
- Preview nhân viên đếm số dòng dữ liệu đã đọc thay vì chỉ đếm dòng hợp lệ; lỗi phòng ban nêu rõ giá trị nguồn chưa có master. Đây chỉ là cải thiện chẩn đoán, không nới guard hoặc tự tạo phòng ban. Các tên nguồn như `AKO`, `Cơ điện, tạp vụ` vẫn cần được quản trị tạo/map vào master trước khi confirm import.
- ADMIN có dialog quản lý phòng ban trên màn nhân viên để tạo master một cách tường minh trước khi import; quyền tạo vẫn được kiểm tra ở backend. Tính năng này không tự đọc/tạo danh mục từ file và không thay đổi `SOURCE_MASTER_PROVISIONING_ENABLED=false`.
- Processing import trả danh sách mã nhân viên thiếu và UI cảnh báo số mã/số dòng, kèm lối tắt sang Quản lý nhân viên. Phần dữ liệu đủ hồ sơ vẫn xử lý; phần thiếu tạo ngoại lệ blocking và có thể phục hồi khi chạy lại sau khi bổ sung master. Không có auto-provision ngầm.
- Khi ngày nguồn nằm trước coverage development hiện tại, pipeline chỉ được mở rộng rule Ca1/Ca3 hiện hữu nếu toàn bộ định nghĩa khớp quyết định đã duyệt và không chồng lấn, đồng thời tạo kỳ nguồn ở trạng thái DRAFT. Thiếu/khác rule vẫn fail-closed; không tạo work schedule hoặc source master. Integration nguồn tháng 09 trên DB mới xác nhận hành vi này.
- DEC-008 đã được triển khai ở source bằng rule Ca 3 version 2 hiệu lực 01/09/2026: khung 19:00–07:00, nghỉ 00:00–01:00, không tính phần vào sớm, chỉ nhận từng khối đủ 30 phút sau 07:00 và phân bổ 4 giờ 100% + 4 giờ 130% + phần vượt 8 giờ 210%. Timestamp raw không bị sửa; input hash mang rule snapshot để tạo revision mới, và kỳ LOCKED/PUBLISHED bị chặn tính lại trực tiếp.
- DEC-009 đã được triển khai ở source bằng rule Ca 1 version 2 hiệu lực 01/09/2026: khung 07:00–19:00, nghỉ 12:00–13:00, không tính phần vào sớm, chỉ nhận từng khối đủ 30 phút sau 19:00 và phân bổ 8 giờ 100% + phần vượt 8 giờ 150%. Timestamp raw không bị sửa; rule cũ vẫn được giữ để tái hiện lịch sử.
- DEC-010 đã được triển khai ở source bằng rule version 3 hiệu lực 01/09/2026 cho cả hai ca: Chủ nhật được xác định theo `shiftDate`; toàn bộ Ca 1 vào 200%, toàn bộ Ca 3 vào 230%, tier khác bằng 0. Hai cột mới được đưa xuyên schema, API, UI, Excel/PDF và tổng sáu tier phải bằng thời gian công.
- DEC-011 đã được triển khai bằng Ca 1 rule version 4 hiệu lực 01/09/2026: giờ ra dùng để tính công được hạ xuống block 30 phút gần nhất trong toàn ca; timestamp raw và chỉ tiêu về sớm vẫn dùng giờ thực tế. Engine version `2026-10-24-dec011` và input hash tạo revision mới.
- Development `SX.xlsx` hiện có 1.726 latest calculation sau khi xử lý theo DEC-008–DEC-012. Có 296 dòng Chủ nhật trống được coi là ngày nghỉ: 0 ngoại lệ OPEN và 0 calculation, raw/import evidence giữ nguyên. Các dòng làm việc thiếu master/ca/evidence hoặc multiple-row vẫn fail-closed; kết quả development không phải oracle, chưa có expected HR/UAT và không được phát hành.
- ESLint flat config hiện kiểm tra TypeScript/React/Node thật với 0 warning. Gate Màn 07 đạt typecheck/build, 39 engine, 34 API, 14 PostgreSQL integration và 22 E2E; tổng **109 PASS**, 0 FAIL, 0 SKIP. Database integration tạm đã được xóa và xác minh sạch.
- Runtime local đã nhận artifact API/web Màn 07 qua writable layer; DB/API/web healthy, health API trực tiếp/proxy/Nginx HTTP 200 và smoke có xác thực xác nhận list/summary ngoại lệ hoạt động. Đây chưa phải bằng chứng image Dockerfile tái lập.
- DEC-012 đã được triển khai và kiểm thử: parser/pipeline bỏ qua ngoại lệ cho Chủ nhật trống cả hai giờ, giữ audit bằng revalidation `RESOLVED`; runtime API writable layer đã cập nhật sau backup.
- DEC-013 đã có source/migration/API/UI và full gate 113 PASS: HR/ADMIN cấu hình ngày lễ, dòng trống không ngoại lệ/calculation, revalidation có audit, guard kỳ khóa và xóa an toàn. Migration thứ bảy đã kiểm chứng trên DB tạm và áp development sau backup; runtime artifact API/web health + authenticated smoke PASS. Chưa cấu hình ngày lễ thật. Image Dockerfile tái lập vẫn PARTIAL.
- DEC-014 đã có source/migration/API/UI/export và full gate 113 PASS: đi muộn/về sớm là số lượt; biên Ca 1 sau 08:01, Ca 3 sau 22:01; mốc về sớm giữ 19:00/07:00. Migration thứ tám, Ca 1 rule v5/Ca 3 rule v4 và engine `2026-10-26-dec014` đã kiểm chứng trên PostgreSQL mới; DB tạm đã xóa. Runtime development đã backup, migrate, cập nhật artifact và tính lại `SX.xlsx`; health đạt. Dockerfile image tái lập vẫn chưa được rebuild.

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

- Nạp/xác minh 9 master nhân viên còn thiếu và expected độc lập của HR; `Tên ca` nguồn đã được duyệt thay lịch phân ca theo DEC-007. Đối chiếu toàn bộ `SX.xlsx` sau khi đủ master; không dùng 1.726 kết quả development hiện tại làm oracle.
- Chốt tiêu chí ngày checkout DEC-002 và quy trình file sửa/file nhiều kỳ còn mở của DEC-003; khóa trùng đã được duyệt.
- Chốt Q10/Q11, quyền duyệt/chốt/phát hành và quy trình chỉnh sau khóa.
- Hoàn tất UAT, mẫu PDF/logo, retention, backup location/RPO/RTO và staging security review.
- Chạy tải đồng thời theo SLA, PDF hàng loạt và restore drill trên staging.
- Chủ dự án phê duyệt rõ ràng việc bật workflow/phát hành.
- Cung cấp logo/brand asset chính thức và thực hiện vòng UAT/visual sign-off; ảnh hiện tại đã đối chiếu thủ công nhưng chưa có automated pixel-diff threshold nên không được coi là chứng nhận pixel-perfect.
- Xác nhận nghiệp vụ dài hạn cho lịch sử hiệu lực phòng ban/chức danh và quy trình khôi phục nhân viên sau trạng thái nghỉ việc; implementation hiện lưu history/effective date, không tự tính lại công quá khứ.
- Rebuild và kiểm chứng image từ đúng source hardening mới nhất sau khi Docker Desktop/buildx hoạt động ổn định; không dùng health của image checkpoint cũ làm bằng chứng cho source mới.
- Chạy migration DEC-008–DEC-011 và tính lại có kiểm soát trên bản sao/staging trước; đối chiếu độc lập kết quả block giờ ra Ca 1, Ca 3 và Chủ nhật 200%/230% từ 01/09/2026 với HR. Không coi calculation development là oracle và không tính lại trực tiếp kỳ đã LOCKED/PUBLISHED.

Cho tới lúc đó: giữ workflow và publish thực ở trạng thái tắt.

## Bằng chứng Docker của mốc hardening hiện tại

`docker compose config` render đúng `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false` và `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`. Ngày 22/10/2026, image DEC-007 được build trực tiếp: API digest `sha256:0029e2c6...`, web digest `sha256:1c1ca2e6...`; artifact chứa source-shift/UI mới đã được kiểm tra. Hai container đã recreate; DB/API/web healthy, API trực tiếp/proxy và Nginx `/healthz` đều HTTP 200 trên cổng 8180.

## Bằng chứng rebuild local sau redesign Quản lý nhân viên

Ngày 22/10/2026, `docker compose build api web` hoàn tất với API digest `sha256:5a6fdb096939...` và Web digest `sha256:c68b0980ab7c...`. Hai container được recreate mà không reset PostgreSQL; DB/API/Web đều healthy. Migration deploy báo 2 migration và không có migration chờ. API trực tiếp cổng `3300`, API qua Nginx cổng `8180` và `/healthz` đều HTTP 200. Smoke có xác thực xác nhận `GET /employees`, `GET /employees/statistics` và màn `/employees` hoạt động; ảnh runtime được lưu tại `docs/ui-evidence/employee-management-docker-local.png`. Ba guard bắt buộc vẫn giữ nguyên. Đây chỉ là deployment local development, không phải phê duyệt production.

Sau mốc này, source được bổ sung ESLint và guard PATCH nhân viên. Ngày 22/10/2026, `docker compose config` tiếp tục render đúng ba guard, nhưng Compose build, build trực tiếp API qua BuildKit và lần thử legacy builder đều treo không log/không hoàn tất trong khoảng theo dõi; tiến trình CLI/buildx do các lần thử tạo đã được kết thúc. Vì vậy API vẫn dùng image checkpoint cũ và chưa có bằng chứng container cho guard PATCH mới.

Ngày 23/10/2026, artifact API/web mới đã được chép vào writable layer của container local hiện tại và restart sau khi Docker commit artifact bị treo. DB/API/web cuối cùng đều healthy; API trực tiếp/proxy và Nginx đều HTTP 200. Smoke Chromium có xác thực tại `8180/employees` xác nhận đúng năm cột, có Import/Tải mẫu, dialog mở được và template tải về đúng bốn header; ảnh `docs/ui-evidence/employee-management-import-restored.png`. Image tag vẫn là checkpoint cũ, nên cách cập nhật runtime này chưa thay thế bằng chứng build Dockerfile tái lập; production gate vẫn yêu cầu normal image build.

Cùng ngày, trước khi xử lý lại `SX.xlsx`, backup SQL được tạo với SHA-256 `21722B107EAF2EA952DAEB2CA98AE653BE9D54392754DF09C712BFC2B1328FA6`. Artifact API có coverage tháng nguồn đã được chép vào writable layer; vòng health đầu hết thời gian trong lúc bootstrap, sau đó artifact marker và ba endpoint health đều PASS, container healthy. Pipeline chỉ được gọi sau health và tạo 1.726 calculation hợp lệ; image tag vẫn không phải bằng chứng build Dockerfile tái lập.

Sau mốc Màn 05 ngày 23/10/2026, artifact API/web đã kiểm thử tiếp tục được chép vào writable layer và hai service restart mà không reset PostgreSQL. API trực tiếp, API qua Nginx và `/healthz` đều HTTP 200. Smoke có xác thực của endpoint summary cho kỳ 09/2026 trả 124 hồ sơ trong scope, 83 đã tính và 65.579.700 giây; kỳ 10/2026 chưa có calculation nên trả 0. Đây chỉ là runtime development; image tag chưa được rebuild từ Dockerfile nên trạng thái Docker vẫn **PARTIAL** và production gate không đổi.

Sau mốc Màn 06 ngày 23/10/2026, artifact API/web đã kiểm thử được chép vào writable layer và restart mà không reset PostgreSQL. DB/API/web healthy; API trực tiếp, proxy và Nginx đều HTTP 200. Smoke có xác thực xác nhận detail/PDF qua proxy hoạt động; kỳ 09/2026 trả 31 dòng revision mới nhất cho một nhân viên đã tính, 25 ngày có mặt và giữ `workingDaysAvailable=false`. Đây vẫn là runtime development; image tag chưa rebuild từ Dockerfile, PDF là mẫu nháp và production gate không đổi.

Sau gate source DEC-008 ngày 23/10/2026, `docker compose build api web` được thử lại nhưng không phát log/kết quả trong cửa sổ theo dõi. Lệnh và đúng tiến trình `docker-buildx` còn sót đọc workspace `D:\chamCong` đã được dừng; `docker compose ps` sau cleanup xác nhận DB/API/web hiện hữu vẫn healthy. Không recreate container, không reset/migrate development DB và không tính lại `SX.xlsx`. Vì vậy 94 test PASS chỉ là bằng chứng source/synthetic; image Dockerfile, runtime DEC-008 và đối chiếu HR vẫn **PARTIAL/BLOCKED**.

Gate source DEC-009 ngày 23/10/2026 đạt 98 test PASS và migration PostgreSQL mới đã được kiểm chứng trên DB tạm rồi cleanup. Guard hiệu lực từ 01/09 trả 409 cho dữ liệu cũ hơn và không tự backdate rule. Do image Dockerfile mới nhất vẫn chưa rebuild ổn định, không migrate/tính lại development DB và không dùng container cũ làm bằng chứng cho Ca 1 mới. Runtime DEC-008/DEC-009 và đối chiếu HR vẫn **PARTIAL/BLOCKED**.

Gate source DEC-010 ngày 24/10/2026 đạt 103 test PASS; năm migration và seed được kiểm chứng trên PostgreSQL mới, regression Chủ nhật đạt 13/13 integration và DB tạm đã cleanup. Lần integration trước build dùng engine `dist` cũ chỉ đạt 10/13 và không được ghi PASS.

Runtime development DEC-010 sau đó được cập nhật bằng artifact API/web trong writable layer, không recreate/reset PostgreSQL. Cả năm migration đã áp dụng và `SX.xlsx` được xử lý lại thành 1.726 latest calculation; 39 dòng có tổng 1.161.300 giây ở 200%, một dòng có 38.820 giây ở 230%. Smoke có xác thực qua proxy xác nhận NV0001 ngày 06/09 dùng revision 3/rule v3, 36.480 giây đều ở 200%, còn 100%/150% bằng 0. DB/API/web healthy; API trực tiếp/proxy, Nginx và bundle UI 200%/230% PASS. `docker compose build api web` vẫn treo không log và tiến trình buildx đã được dừng có kiểm tra, nên image Dockerfile tái lập cùng expected HR/UAT vẫn **PARTIAL/BLOCKED**.

Gate source DEC-011 ngày 24/10/2026 đạt 104 test PASS; sáu migration + seed và regression `06:37–18:11` đạt 13/13 integration trên PostgreSQL mới, DB tạm đã cleanup. Runtime development được cập nhật bằng artifact API/engine trong writable layer, không recreate/reset DB; migration thứ sáu và Ca 1 rule v4 đã áp dụng, `SX.xlsx` được xử lý lại thành 1.726 latest calculation. Smoke có xác thực qua proxy xác nhận NV0001 ngày 25/09 giữ raw `06:37/18:11`, revision 4/engine DEC-011, 36.000 giây công và 2.940 giây về sớm. DB/API/web healthy, ba health endpoint HTTP 200. Image Dockerfile tái lập và expected HR/UAT vẫn **PARTIAL/BLOCKED**.

Gate source DEC-014 ngày 26/10/2026 đạt 113 test PASS; tám migration + seed và 15/15 integration trên PostgreSQL mới, DB tạm đã cleanup. Trước cập nhật development đã tạo backup SHA-256 `0D99F75E3452E2C22ACE31743D8503492091141FFCA46AD437564660E2192B7C`; migration thứ tám và artifact API/engine/web được áp không reset DB. `SX.xlsx` được xử lý lại thành 1.726 latest calculation; summary tháng 09 trả 3 lượt đi muộn/730 lượt về sớm và engine DEC-014. DB/API/web healthy, ba health endpoint HTTP 200. Image Dockerfile tái lập và expected HR/UAT vẫn **PARTIAL/BLOCKED**.
