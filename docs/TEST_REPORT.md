# Báo cáo kiểm thử

Ngày chạy gần nhất: 24/10/2026, timezone `Asia/Ho_Chi_Minh`. Test tự động dùng dữ liệu **synthetic**. File `SX.xlsx` người dùng upload đã được xử lý trên development để kiểm tra vận hành nhưng không phải oracle độc lập và không thay thế expected của HR/UAT.

## Kết quả cuối

| Nhóm                                           | Lệnh/bằng chứng                                  | Kết quả                                                                                          |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Engine unit                                    | `pnpm.cmd test:run`                              | 38/38 PASS, 2 files; gồm biên ca, khối 30 phút, rule lịch sử và Chủ nhật 200%/230%               |
| API unit/service/security/export/import policy | `pnpm.cmd --filter @tinh-cong/api test:run`      | 32/32 PASS, 8 files; gồm revision bất biến và guard kỳ LOCKED                                    |
| PostgreSQL integration                         | `pnpm.cmd test:integration`                      | 13/13 PASS trên DB mới; gồm năm migration, rule v3, Chủ nhật 200%/230% và RBAC/report            |
| Browser E2E                                    | `pnpm.cmd test:e2e`                              | 20/20 PASS, Chromium; thêm Màn 06, năm tab, PDF, mobile và visual 1536×1024                      |
| ESLint                                         | `pnpm.cmd lint`                                  | PASS, 0 warning; ESLint flat config kiểm tra TypeScript/React/Node toàn monorepo                 |
| TypeScript                                     | `pnpm.cmd typecheck`                             | PASS, 5 workspace packages có script                                                             |
| Production build                               | `pnpm.cmd build`                                 | PASS, API + web + engine + UI + shared                                                           |
| Prisma                                         | `prisma validate`; `prisma migrate deploy`; seed | PASS, đủ 5 migration đến `20261023183000_sunday_tiers_200_230` và synthetic seed                 |
| Docker build/runtime                           | Buildx + artifact packaging; health endpoints    | Web UI mới runtime PASS; Dockerfile/API rebuild vẫn NOT_COMPLETED do build daemon treo           |
| Docker runtime                                 | API direct, Nginx `/healthz`, proxy API và web   | PASS; DB/API/web healthy; API direct/proxy và Nginx HTTP 200; smoke runtime import/template PASS |
| Backup/restore                                 | `backup.ps1`, `restore.ps1` vào DB tạm           | PASS, SHA-256 tạo được, restore 25 bảng; DB tạm đã xóa                                           |
| Synthetic scale                                | `pnpm.cmd test:performance`                      | PASS, 1.000 NV: query 43,69 ms; engine 6,15 ms; tổng 175,02 ms                                   |

Tổng test tự động ở lần chạy cuối đạt: **103 PASS** (`38 + 32 + 13 + 20`), **0 FAIL**, **0 SKIP**. Các kiểm tra build/migration/Docker/backup/performance được ghi riêng, không cộng vào số test case.

## Mốc DEC-010 – Mức Chủ nhật 200%/230% ngày 24/10/2026

- Chủ nhật được xác định bằng `shiftDate`/ngày bắt đầu ca. Toàn bộ `W` của Ca 1 vào `tier200Seconds`; toàn bộ `W` của Ca 3 vào `tier230Seconds`; năm tier còn lại bằng 0. Ca 3 bắt đầu Chủ nhật và checkout thứ Hai vẫn ở 230%. Giờ nghỉ, biên vào sớm và khối đủ 30 phút tiếp tục theo DEC-008/DEC-009.
- Migration additive `20261023183000_sunday_tiers_200_230` thêm hai cột nullable để giữ calculation lịch sử và tạo rule version 3 cho cả hai ca từ 01/09/2026. Engine version là `2026-10-23-dec010`; input hash tiếp tục mang rule snapshot để tính lại tạo revision mới thay vì ghi đè.
- API/dashboard, Bảng công tổng hợp, Chi tiết bảng công, Excel và PDF đều trả/hiển thị hai mức mới. Bảng tổng hợp có 20 cột, chín KPI; chi tiết có 12 KPI. Tổng sáu tier được kiểm tra bằng `W`.
- Gate cuối: ESLint PASS 0 warning; Prisma validate PASS; typecheck PASS; production build PASS; engine **38/38**, API **32/32**, PostgreSQL integration **13/13**, Playwright Chromium **20/20**; tổng **103 PASS**, 0 FAIL, 0 SKIP.
- PostgreSQL mới áp đủ năm migration và seed synthetic. Regression DB xác nhận Ca 1 Chủ nhật `06:30–19:30` có 41.400 giây ở 200%, Ca 3 bắt đầu Chủ nhật `18:45–07:30` có 41.400 giây ở 230%, đều chọn rule v3 và giữ nguyên ngày ca. Database tạm của lần PASS đã xóa.
- Lần integration đầu sau migration/seed chỉ đạt 10/13 vì API dùng engine `dist` cũ từ checkpoint; ba failure cho thấy hai cột còn `null` và chưa áp dụng Chủ nhật. Không ghi lần đó là PASS. Sau khi build lại workspace, chạy lại toàn bộ trên database mới khác đạt 13/13; database tạm đầu cũng đã xóa.
- Chưa rebuild image Dockerfile, chưa migrate/tính lại development `SX.xlsx` và chưa có expected độc lập của HR/UAT. Runtime DEC-010 và production readiness vẫn PARTIAL/BLOCKED.

## Mốc DEC-009 – Ca 1 07:00–19:00 và khối ngoài giờ ngày 23/10/2026

- Engine giữ nguyên timestamp nguồn nhưng giới hạn phần được tính của Ca 1 từ 07:00; phần vào sớm không được cộng. Phần sau 19:00 chỉ được ghi nhận theo từng khối đủ 1.800 giây, không làm tròn timestamp nguồn. Ca đủ 07:00–19:00 sau nghỉ 12:00–13:00 có 39.600 giây: 28.800 giây 100% và 10.800 giây 150%. Đi muộn tính từ 07:00; về sớm so với 19:00 và độc lập với giờ vào.
- Migration additive `20261023170000_ca1_0700_overtime_blocks` tạo rule Ca 1 version 2 hiệu lực từ 01/09/2026, không sửa rule/raw/calculation lịch sử. Engine version mới là `2026-10-23-dec009`; pipeline đã có input hash chứa rule snapshot nên lần tính với rule mới sinh revision thay vì ghi đè.
- Unit regression xác nhận `06:30–19:20` chỉ tính `07:00–19:00`, `06:30–19:30` tính thêm đúng 30 phút, `19:59:59` vẫn chỉ tính đến 19:30; rule lịch sử 08:00–17:00 vẫn chạy được khi truyền cấu hình versioned.
- Gate nguồn: ESLint PASS 0 warning; Prisma schema validate PASS; typecheck PASS; production build PASS; engine **34/34**, API **32/32**, Playwright Chromium **20/20**.
- PostgreSQL mới áp đủ bốn migration và seed synthetic PASS. Integration **12/12 PASS** xác nhận chọn Ca 1 rule v2, giữ normalization raw `06:30/19:20` và `06:30/19:30`, nhưng calculation lần lượt ghi nhận 39.600 và 41.400 giây. Dữ liệu 31/08 bị fail-closed 409 và không thể kéo lùi rule trước ngày hiệu lực 01/09. Database tạm đã được xóa và xác nhận không còn tồn tại.
- Chưa rebuild image runtime, chưa migrate/tính lại development `SX.xlsx` theo DEC-008/DEC-009 và chưa có expected độc lập của HR/UAT; Docker/runtime và production readiness vẫn PARTIAL/BLOCKED.

## Mốc DEC-008 – Ca 3 19:00–07:00 và revision bất biến ngày 23/10/2026

- Engine giữ nguyên timestamp nguồn nhưng giới hạn phần được tính của Ca 3 từ 19:00; phần vào sớm không được cộng. Phần sau 07:00 chỉ được ghi nhận theo từng khối đủ 1.800 giây, không làm tròn timestamp nguồn. Ca đủ 19:00–07:00 sau nghỉ 00:00–01:00 có 39.600 giây: 14.400 giây 100%, 14.400 giây 130% và 10.800 giây 210%. Đi muộn tính từ 19:00; về sớm vẫn so với 07:00 và độc lập với giờ vào.
- Migration additive `20261023143000_ca3_1900_overtime_blocks` tạo rule Ca 3 version 2 hiệu lực từ 01/09/2026, không sửa raw hoặc calculation cũ. Pipeline đưa rule snapshot vào input hash; khi rule hiệu lực thay đổi, hệ thống tạo normalization/calculation revision mới thay vì ghi đè. Kỳ `LOCKED`/`PUBLISHED` bị chặn trước khi chuẩn bị coverage hoặc tính lại trực tiếp.
- Gate nguồn: ESLint PASS 0 warning; typecheck PASS; production build PASS; Prisma schema validate PASS; engine **32/32**, API **32/32**, Playwright **20/20**.
- Migration và seed chạy trên database PostgreSQL mới: đủ ba migration, ba tài khoản synthetic và một rule Ca 3 v2. Integration **10/10 PASS**, gồm ca vào 18:45/ra 07:15 chỉ tính 19:00–07:00, chọn rule v2 và tạo revision 2 khi xuất hiện rule mới cùng hiệu lực. Database tạm đã được xóa và xác nhận không còn tồn tại.
- Lần wrapper gộp migration/seed/integration không trả kết quả sau khi migration và seed đã hoàn tất nên đã bị dừng; không ghi lần đó là PASS. Suite integration được chạy tách riêng trên chính DB mới và đạt 10/10 trước khi cleanup.
- Đây là gate source/synthetic. Lần thử `docker compose build api web` cho DEC-008 không phát log/kết quả trong cửa sổ theo dõi; lệnh và đúng tiến trình `docker-buildx` còn sót của workspace đã được dừng. Container DB/API/web hiện hữu vẫn healthy, nhưng không được coi là image source mới. Chưa migrate/tính lại development `SX.xlsx` theo rule mới và chưa có expected độc lập của HR/UAT; Docker/runtime và production readiness vì vậy không được nâng trạng thái.

## Mốc Màn 06 – Chi tiết bảng công ngày 23/10/2026

- `GET /attendance/employee/:id` nay trả contract chi tiết theo nhân viên + kỳ: hồ sơ, period, revision mới nhất của từng raw, normalization/tier/L-E, ngoại lệ mở, đúng bảy trường nguồn và lịch sử điều chỉnh. Data scope được kiểm tra trước truy vấn; EMPLOYEE chỉ đọc chính mình, HR/MANAGER vẫn fail-closed nếu không có scope.
- Aggregate chi tiết chỉ cộng calculation `VALID`; dòng chưa tính/cần review vẫn hiển thị để HR kiểm tra. `workingDays=null`, UI `N/A`; hệ thống không tạo ngày nghỉ từ khoảng trống dữ liệu. Không thêm endpoint sửa/duyệt/chốt khi Q10/Q11 còn OPEN.
- `GET /attendance/employee/:id/pdf` dùng cùng contract/scope, có font tiếng Việt và đóng dấu `BẢN NHÁP PHÁT TRIỂN – CHƯA PHÊ DUYỆT PHÁT HÀNH`; không thay thế mẫu PDF chính thức.
- UI 1536×1024 có hồ sơ, 12 KPI, tháng trước/sau, bảng chi tiết + tổng, tab Tổng hợp/Biểu đồ/Dữ liệu nguồn/Lịch sử điều chỉnh, sidebar tóm tắt, phân trang và cuộn ngang mobile. Visual evidence synthetic: `docs/ui-evidence/attendance-detail-after.png`; target: `docs/ui-reference/attendance-detail-target.png`. Chỉ đối chiếu thủ công, chưa có image-diff threshold/UAT nên không tuyên bố pixel-perfect 100%.
- Unit/service mới 2/2 và bộ API đầy đủ **31/31 PASS**; engine **31/31 PASS**. PostgreSQL integration cuối **9/9 PASS** trên DB mới sau hai migration + synthetic seed; Playwright cuối **20/20 PASS**.
- Lần integration đầu của mốc không chạy test vì lệnh PowerShell ghép `$dbName?schema` thành URL sai, migration fail và DB tạm được xóa. Lần hai chạy thật đạt 8/9; lỗi là assertion yêu cầu nested `source` bằng tuyệt đối trong khi API trả đúng đủ bảy field. Sửa assertion partial-match, lần ba trên DB mới khác đạt 9/9; DB tạm được xóa trong mọi lần.
- Playwright đầu đạt 19/20 vì test tìm `columnheader` trong snapshot nơi browser biểu diễn header là `cell`; UI đã chuyển tab đúng. Sửa selector test theo `thead`, chạy lại 20/20. Không thay logic/validation để né lỗi.
- Runtime local được cập nhật bằng artifact đã kiểm thử, không reset DB. DB/API/web healthy; health API trực tiếp/proxy/Nginx đều HTTP 200. Smoke có xác thực qua `8180` xác nhận PDF 200 và chi tiết kỳ 09/2026 có 31 dòng/25 ngày có mặt cho một nhân viên đã tính, không trùng `rawId`; `workingDaysAvailable=false` đúng fail-closed. Đây là development smoke, không thay UAT/dữ liệu expected của HR.

## Mốc Màn 05 – Bảng công tổng hợp ngày 23/10/2026

- Thay trang JSON `/attendance` bằng UI tổng hợp thật: chọn kỳ/phòng ban/trạng thái kỳ, chín KPI, tìm kiếm, lọc ca/trạng thái xử lý, sort và phân trang server-side 10/20/50/100, bảng 20 cột, chọn dòng, tổng cộng toàn bộ tập lọc và điều hướng chi tiết bằng `employeeId + periodId`.
- API `GET /attendance/summary` áp RBAC/data scope backend. Mỗi raw chỉ lấy revision calculation mới nhất; chỉ calculation `VALID` được cộng thời gian. `NEEDS_REVIEW` được tách khỏi trạng thái kỳ; phòng ban trong kỳ ưu tiên snapshot raw. `Số ngày làm việc` trả `null`/UI `N/A` vì chưa có lịch/policy được duyệt, không tự suy diễn.
- `GET /attendance/export` xuất toàn bộ tập lọc thay vì chỉ trang hiện tại, có công ty/tiêu đề/kỳ/bộ lọc/timestamp/phiên bản engine-revision/dòng tổng, định dạng `[h]:mm:ss`, nhãn `DỮ LIỆU TẠM, CHƯA CHỐT` cho kỳ chưa khóa/phát hành và chống formula injection.
- Unit regression mới đạt 3/3: bỏ revision cũ khỏi aggregate, giữ phòng ban trong kỳ, tách trạng thái xử lý, tìm tên không dấu và kiểm tra workbook/formula injection. Bộ API đầy đủ đạt 29/29; engine giữ 31/31.
- Integration lần đầu đã migrate + seed DB mới nhưng **0 PASS / 9 SKIP** vì process thiếu hai biến `INTEGRATION_*`; database tạm đã được xóa. Chạy lại trên DB mới khác với credential synthetic được ánh xạ trong process đạt **9/9 PASS**; DB tạm cũng đã xóa.
- Playwright chuẩn của repo đạt **17/17 PASS**, gồm 5 kịch bản màn tổng hợp: render/aggregate, filter + URL + sort + page size, export không mang page, detail chỉ mang hai ID và mobile cuộn ngang. Lần chạy trực tiếp trước đó hoàn tất test nhưng tiến trình webServer không tự thoát trước timeout nên không được ghi PASS; chạy lại bằng `scripts/run-e2e.ps1` đạt và dọn server.
- Visual evidence synthetic tại `docs/ui-evidence/attendance-summary-after.png`; target do người dùng cung cấp tại `docs/ui-reference/attendance-summary-target.png`. Đã đối chiếu thủ công ở 1536×1024; chưa có automated image-diff threshold nên không tuyên bố pixel-perfect 100%.
- Gate cuối: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 29/29; PostgreSQL integration 9/9; Playwright 17/17. Tổng **86 PASS**, 0 FAIL, 0 SKIP ở lần chạy cuối đầy đủ.
- Artifact API/web đã kiểm thử được chép vào writable layer runtime local và restart, không reset PostgreSQL. API trực tiếp, API qua Nginx và `/healthz` đều HTTP 200. Smoke có xác thực: kỳ 09/2026 trả 124 hồ sơ trong scope, 83 đã tính, 65.579.700 giây và 2.202 ngoại lệ mở; tìm tên bỏ dấu trả đúng cùng employee ID; kỳ 10/2026 chưa có calculation nên trả 0 đúng dữ liệu. Đây là kiểm chứng development, không phải UAT/oracle HR; image Dockerfile tái lập vẫn PARTIAL.

## Mốc xử lý lại `SX.xlsx` sau khi nạp master nhân viên ngày 23/10/2026

- Trước khi ghi dữ liệu, tạo backup development `storage/backups/tinhcong-20261023-093925.sql`, SHA-256 `21722B107EAF2EA952DAEB2CA98AE653BE9D54392754DF09C712BFC2B1328FA6`.
- Snapshot trước xử lý: import `4c14bdd5-6a91-47a5-a63c-737f049f5047` ở trạng thái `ACCEPTED`, 2.765 raw rows, 1.740 source issues, 92 mã nguồn; 2.495 dòng thuộc 83 mã đã liên kết và 270 dòng thuộc 9 mã chưa có master. Không tự tạo hồ sơ/phòng ban.
- Lần chạy đầu trả `calculatedRows=0` và tạo 1.726 `SHIFT_RULE_NOT_FOUND`. Nguyên nhân kỹ thuật: nguồn thuộc 09/2026 nhưng seed development chỉ có kỳ 10/2026 và rule bắt đầu 09/10/2026. Pipeline fail-closed, không tạo calculation sai.
- Sửa pipeline để trước khi tính chỉ mở rộng rule Ca1/Ca3 đã khớp tuyệt đối định nghĩa được duyệt và tạo kỳ nguồn ở trạng thái `DRAFT`; nếu thiếu ca, rule khác định nghĩa hoặc chồng lấn thì vẫn conflict/fail-closed. Không tạo `work_schedules`, employee hoặc department; có audit `IMPORT_CALCULATION_COVERAGE_PREPARED`.
- Regression PostgreSQL dùng ngày nguồn 10/09/2026 xác nhận rule CA1 được mở rộng, kỳ 09/2026 được tạo DRAFT, calculation được sinh và `work_schedules=0`. Lần integration đầu migration/seed PASS nhưng `beforeAll` vượt 30 giây nên **0 test PASS / 8 SKIP**; database tạm đã xóa. Tăng riêng `hookTimeout` integration lên 60 giây, chạy lại trên database mới khác đạt **8/8 PASS**, database tạm đã xóa.
- Gate cuối: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8; Playwright 12/12. Tổng 77 PASS, 0 FAIL, 0 SKIP ở lần chạy cuối đầy đủ.
- Artifact API đã kiểm thử được chép vào writable layer của container development. Vòng health đầu hết thời gian trong lúc API bootstrap kéo dài; pipeline chưa được gọi ở thời điểm đó. Sau khi Nest hoàn tất khởi động, artifact marker PASS, DB/API/web healthy và API trực tiếp, proxy, Nginx đều HTTP 200. Image tag vẫn là checkpoint cũ, không thay thế bằng chứng Dockerfile build tái lập.
- Kết quả chạy lại: 1.726 normalization và 1.726 calculation, tất cả `VALID`; CA1 1.116 dòng, CA3 610 dòng. Có 0 tier mismatch, 0 giá trị thời gian âm, 0 normalization thiếu timestamp/evidence và 0 work schedule. Rule hiệu lực từ 01/09/2026 cho CA1, 03/09/2026 cho CA3; kỳ 09/2026 vẫn `DRAFT`.
- 1.726 `SHIFT_RULE_NOT_FOUND` cũ được revalidation sang `RESOLVED`. Còn blocking OPEN đúng guard: 694 `UNSUPPORTED_SHIFT_FOR_CALCULATION`, 270 `EMPLOYEE_NOT_FOUND`, 65 `TIMESTAMP_EVIDENCE_REQUIRED`, 10 `MULTIPLE_ROWS_SAME_EMPLOYEE_DATE`. Chín mã thiếu là `NV00084`, `NV00100`, `NV00115`, `NV00129`, `NV00200`, `NV00209`, `NV00210`, `NV00212`, `NV00227`.
- Raw/source vẫn là 2.765 dòng và 1.740 issue, import vẫn `ACCEPTED`; số master hoạt động giữ nguyên 123 nhân viên/19 phòng ban. Kết quả development này chưa phải UAT/expected HR và không được phát hành.

## Mốc chẩn đoán mapping phòng ban import nhân viên ngày 23/10/2026

- Database development chỉ có master phòng ban synthetic `SYN-FACTORY / Phòng sản xuất mẫu`; các giá trị nguồn như `AKO` và `Cơ điện, tạp vụ` chưa có master nên preview bị chặn đúng guard `SOURCE_MASTER_PROVISIONING_ENABLED=false`. Không tự tạo phòng ban từ file.
- Sửa lỗi hiển thị `Đã đọc 0 dòng` khi các dòng đã đọc nhưng không map được phòng ban: `rowCount` nay đếm mọi dòng dữ liệu không rỗng, độc lập với số dòng hợp lệ để confirm.
- Lỗi phòng ban nay chứa chính giá trị nguồn và phân biệt trường trống, tên không duy nhất, hoặc master chưa tồn tại/không hoạt động.
- Regression PostgreSQL tạo file một dòng dùng `AKO`, xác nhận `rowCount=1`, `canConfirm=false` và message cụ thể; migration + seed trên DB mới và 8/8 integration PASS, DB tạm đã xóa. Lint, typecheck, build, 31 engine và 26 API tests đều PASS.
- Artifact API đã được cập nhật vào container local và restart; smoke preview-only qua Nginx PASS với `rowCount=1` và lỗi `Phòng ban "AKO" chưa tồn tại hoặc không hoạt động trong hệ thống.` API trực tiếp/proxy đều HTTP 200. Smoke không ghi employee/department vào DB.

## Mốc quản lý phòng ban trên UI ngày 23/10/2026

- Bổ sung nút và dialog `Quản lý phòng ban` trên màn Quản lý nhân viên, chỉ hiển thị cho ADMIN. Dialog liệt kê mã, tên, trạng thái và cho tạo master phòng ban bằng thao tác rõ ràng trước khi import.
- Đây là tạo master thủ công qua API `POST /departments`, không phải tự provision từ file; `SOURCE_MASTER_PROVISIONING_ENABLED=false` được giữ nguyên. HR vẫn quản lý nhân viên/import nhưng không thấy nút quản lý phòng ban; backend tiếp tục chỉ cho ADMIN tạo.
- E2E mock tạo `AKO`, xác nhận danh mục tăng từ 1 lên 2 rồi tiếp tục luồng template/import và responsive. PostgreSQL integration xác nhận EMPLOYEE nhận 403, ADMIN tạo thành công và cleanup dữ liệu sau test.
- Gate: ESLint PASS 0 warning; typecheck và production build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới; Playwright 12/12. DB integration tạm đã xóa.
- Web artifact đã cập nhật vào container local và restart. Smoke Chromium có xác thực trên `8180/employees` xác nhận nút/dialog cùng hai input xuất hiện và danh mục development vẫn có đúng 1 phòng ban; smoke không tạo dữ liệu. Ảnh: `docs/ui-evidence/department-management-runtime.png`.

## Mốc cảnh báo nhân viên thiếu khi xử lý import ngày 23/10/2026

- API processing giữ hành vi fail-closed và nay trả thêm `missingEmployeeCodes`: danh sách mã duy nhất, sắp xếp ổn định. `missingEmployees` tiếp tục là số dòng raw chưa liên kết để không phá hợp đồng cũ.
- Lịch sử import hiển thị cảnh báo nổi bật khi có mã thiếu: số mã, số dòng chưa liên kết, danh sách mã, khẳng định không tự tạo master và nút `Mở Quản lý nhân viên`. Sau khi bổ sung hồ sơ, người dùng được hướng dẫn quay lại bấm `Xử lý dữ liệu` lần nữa; các dòng đủ hồ sơ vẫn được xử lý ở lần đầu.
- Thông báo sau confirm import mới cũng nêu số mã thiếu và hướng người dùng sang Lịch sử import. Không bật `SOURCE_MASTER_PROVISIONING_ENABLED` và không thay đổi raw/duplicate/calculation rules.
- Gate: ESLint PASS 0 warning; typecheck/build PASS; engine 31/31; API 26/26; PostgreSQL integration 8/8 trên DB mới; Playwright 12/12. Integration chứng minh một mã thiếu được trả trong `missingEmployeeCodes`; DB tạm đã xóa.
- API/web container local đã cập nhật và health trực tiếp/proxy/web đều HTTP 200. Smoke runtime dùng route intercept cho request process để xác nhận UI cảnh báo 9 mã mà không xử lý hay ghi dữ liệu development; ảnh `docs/ui-evidence/missing-employees-warning-runtime.png`.

## Mốc ESLint và hardening PATCH nhân viên ngày 22/10/2026

- Thay lệnh lint thành công rỗng bằng ESLint flat config thực cho TypeScript, React hooks và Node; thêm devDependencies ở root và giữ `--max-warnings 0`.
- Lần lint đầu phát hiện 6 lỗi thật: ba import/biến thừa, hai biểu thức điều kiện chỉ dùng side effect và một effect React cập nhật state đồng bộ. Đã bỏ mã thừa, đổi hai biểu thức thành `if/else` và remount panel nhân viên theo `mode + employeeId`; hành vi nghiệp vụ không đổi.
- Lần integration đầu trên DB PostgreSQL mới áp đủ hai migration và seed synthetic đạt **7/8**, FAIL vì PATCH chỉ chứa field lạ `phone` trả 200 thay vì 400. Database tạm `tinhcong_it_lint_20261022162900` đã được drop trong `finally`.
- Nguyên nhân: service chấp nhận update không có trường hồ sơ hỗ trợ, tạo history/audit rỗng khi validation metadata không loại field lạ ở integration runner. Đã thêm guard `BadRequestException` trước truy vấn/transaction và unit regression cho payload chỉ có `reason`.
- Lần chạy lại trên DB mới khác đạt **8/8 PASS**; DB tạm `tinhcong_it_lint_20261022163133` đã được drop. Gate cuối: lint PASS 0 warning; typecheck PASS; build PASS; engine 31/31; API 26/26; Playwright 12/12.
- `docker compose config` vẫn xác nhận ba guard bắt buộc. Rebuild Compose, build trực tiếp API qua BuildKit và lần thử legacy builder cho source mới đều không trả log/không hoàn tất trong khoảng theo dõi nên đã dừng, đồng thời kết thúc đúng các PID Docker CLI/buildx do lần chạy tạo. Không ghi Docker build PASS cho mốc này. Image checkpoint Quản lý nhân viên vẫn là API `sha256:5a6fdb096939...`, Web `sha256:c68b0980ab7c...`; container cũ vẫn healthy và health API trực tiếp/proxy/Nginx đều HTTP 200. Source mới chưa có bằng chứng image tương ứng.

## Mốc khôi phục import nhân viên và map bốn trường ngày 23/10/2026

- Theo yêu cầu Chủ dự án, bảng danh sách chỉ còn `Mã nhân viên`, `Tên nhân viên`, `Phòng ban`, `Trạng thái` và `Thao tác`; đã bỏ cột số thứ tự.
- Form thêm/sửa chỉ map đúng bốn trường trên. Audit history vẫn giữ ở tab riêng vì không phải trường hồ sơ và cần cho truy vết.
- Đã khôi phục `Import danh sách`, `Tải file mẫu` và dialog preview/confirm. File mẫu mới chỉ có đúng bốn cột trên; parser vẫn chấp nhận header cũ `Họ và tên` để tương thích file đã tải trước đây.
- Regression E2E xác nhận tải template, preview, confirm import, header bảng đúng năm cột và mobile 390×844 không tràn ngang. Ảnh runtime: `docs/ui-evidence/employee-management-import-restored.png`.
- Gate thực chạy: ESLint PASS 0 warning; typecheck PASS; production build PASS; engine 31/31; API 26/26; Playwright 12/12; PostgreSQL integration 8/8 trên DB mới sau cả hai migration và seed synthetic. DB tạm đã xóa.
- Lần integration đầu của mốc đạt 7/8 vì assertion vẫn kỳ vọng tên header cũ; implementation trả đúng `Tên nhân viên`. Đã cập nhật assertion, thêm regression chấp nhận header cũ và chạy lại 8/8 PASS. Một lần chuẩn bị trước đó chưa chạy test vì URI DB tạm bị PowerShell nội suy sai; DB tạm cũng đã được xóa.
- Docker commit artifact API bị treo và tiến trình commit đã được kết thúc có kiểm tra. Build artifact đã kiểm thử được chép vào writable layer của đúng container API/web hiện tại và hai container được restart; không reset PostgreSQL. Đây là bằng chứng runtime local, chưa phải image build tái lập.
- Smoke Chromium có đăng nhập trên đúng URL `http://127.0.0.1:8180/employees` PASS: năm cột đúng, hai nút hiện diện, dialog mở được, file tải về có đúng bốn header. API trực tiếp, API proxy và Nginx đều HTTP 200; DB/API/web cuối cùng đều healthy.

## Mốc Quản lý nhân viên ngày 22/10/2026

- Màn `Quản lý nhân viên` hiện có header/action, bốn KPI, tìm kiếm và bộ lọc server-side, sorting, pagination 10/20/50, bảng năm cột (bốn trường + thao tác), status badge, panel responsive hai tab và trạng thái loading/empty/error.
- API/database thực được mở rộng bằng migration additive `20261022193000_employee_management`: trạng thái `ACTIVE/ON_LEAVE/RESIGNED`, hồ sơ liên hệ/công việc/ca hiện tại, ngày vào/nghỉ và bảng `employee_history`. Migration không sửa/xóa attendance, import hoặc kết quả công cũ.
- Create/update/deactivate có validation, RBAC, backend data scope, audit log và history thật. Mã nhân viên không có endpoint chỉnh sửa. DELETE UI/API chỉ chuyển `RESIGNED`, trả số attendance giữ nguyên và không hard-delete/cascade.
- Backend import master nhân viên vẫn là luồng riêng preview/confirm và được mở từ màn Quản lý nhân viên; template/preview/confirm chỉ map bốn trường hồ sơ. Policy duplicate của attendance không thay đổi.
- Visual evidence: `docs/ui-reference/employee-management-before.png`, mockup `docs/ui-reference/employee-management-target.png` và `docs/ui-evidence/employee-management-after.png` tại 1536×1024. Ảnh after dùng mock API synthetic để visual QA, không phải dữ liệu thật.
- Lần E2E đầu đạt 8/12: ba locator test mơ hồ và smoke fixture thiếu contract KPI/phòng ban. Lần hai đạt 10/12 và phát hiện pagination thật tự quay về trang 1 khi query mới loading; đã bỏ reset phụ thuộc dữ liệu loading. Lần cuối 12/12 PASS.
- Lần integration đầu trên PostgreSQL mới đạt 6/8: `pageSize` từ query còn là chuỗi khi xuống Prisma và binary response test chưa có parser. Service nay ép `page/pageSize` về số, test dùng binary parser; tạo lại DB mới hoàn toàn, áp cả hai migration, seed synthetic và chạy lại 8/8 PASS. DB tạm được drop trong `finally`.
- Lần typecheck sau khi bổ sung semantics xóa trường tùy chọn bằng `null` FAIL vì helper reference-data chưa nhận kiểu nullable. Đã sửa chữ ký helper, bổ sung integration xóa phân ca có ngày hiệu lực và chạy lại typecheck/build PASS, integration 8/8 trên một DB mới khác; không bỏ validation để đạt PASS.
- Gate cuối: `pnpm.cmd lint` exit 0 nhưng không workspace nào khai báo lint script; `pnpm.cmd typecheck` PASS; `pnpm.cmd build` PASS; engine 31/31; API unit/service 25/25; integration 8/8; Playwright 12/12.
- Chưa tuyên bố pixel-perfect/100%: chưa chạy automated pixel-diff threshold, logo/avatar chính thức chưa có và typography/wordmark tạm vẫn khác mockup. UAT/dữ liệu thật vẫn BLOCKED.

## Mốc redesign Import Excel ngày 22/10/2026

- Xây dựng lại màn Import Excel theo ảnh mục tiêu 1536×1024: app shell/sidebar/topbar dùng chung, stepper động, upload kéo-thả thật, mapping bảy trường, trạng thái kiểm tra cấu trúc, KPI/toolbar/bảng preview/phân trang và action bar.
- Giữ nguyên API/backend/database/engine và khóa trùng. Luồng preview/confirm vẫn chờ phản hồi backend; mapping thay đổi sẽ hủy preview cũ; confirm lặp vẫn bị khóa.
- Chuyển lịch sử import sang view riêng trong cùng màn hình; các thao tác xem raw, xử lý dữ liệu và guard tạo hồ sơ nguồn được giữ nguyên. Sau DEC-007, nhãn guard là `Chờ duyệt hồ sơ NV` vì lịch phân ca không còn bắt buộc.
- Visual fixture chỉ là **synthetic mock API data**, không phải dữ liệu thật và không hard-code vào production UI.
- Đã chụp và kiểm tra trực quan tại `1536×1024`, `1440×900`, `1280×800`. Ảnh trước, ảnh mục tiêu và ba ảnh sau nằm trong `docs/ui-reference/`.
- Kết quả gate tại checkpoint: `pnpm.cmd typecheck` PASS; `pnpm.cmd build` PASS; `pnpm.cmd test:run` 54/54 PASS; `pnpm.cmd test:e2e` 9/9 PASS; integration 5/5 PASS sau khi nạp biến môi trường development.
- Lần gọi integration đầu tiên không có `DATABASE_URL`/credential nên suite dừng với **1 suite FAIL, 5 test SKIP** trước khi assertion chạy. Đã chạy lại bằng biến môi trường hiện có, không in/hard-code secret, và đạt 5/5; lần lỗi cấu hình không bị ghi thành PASS.
- Không tuyên bố pixel-perfect/100%: chưa có automated image-diff threshold; logo chính thức chưa được cung cấp; ở viewport thấp nội dung dùng cuộn/stack responsive và thanh hành động ghim cuối màn hình thay vì ép toàn bộ bảng vào một khung hình.

## Mốc hardening fail-closed ngày 22/10/2026

- Phát hiện API/UI có thao tác tự tạo master nhân viên/phòng ban, lịch phân ca, alias ca và suy Ca 3 D+1 từ file nguồn dù Q01/Q04/Q07 chưa có phê duyệt được ghi nhận. Đã thêm `SOURCE_MASTER_PROVISIONING_ENABLED=false`, backend trả `409 SOURCE_MASTER_APPROVAL_REQUIRED` trước khi đọc/ghi DB. DEC-007 sau đó chỉ gỡ dependency lịch phân ca; guard tạo master vẫn giữ và UI hiển thị `Chờ duyệt hồ sơ NV`.
- API ngoại lệ nay áp data scope tại backend. ADMIN được xem toàn bộ; HR không có `ManagerScope` trả tập rỗng và không thể resolve ngoại lệ ngoài scope. Tài khoản HR/MANAGER không còn tự nhận scope cá nhân chỉ vì có `employeeId`.
- Dashboard đã scope số kỳ chờ và publication theo tập nhân viên được phép thay vì đếm toàn hệ thống cho HR/MANAGER.
- `pnpm.cmd typecheck`, `pnpm.cmd build`, `pnpm.cmd test:run`, format check các tệp đã chạm và `pnpm.cmd test:e2e` đều PASS. Migration `20261021145100_init`, seed synthetic và 5 integration tests chạy trên database mới `tinhcong_it_*` PASS; database tạm được xóa trong `finally`.
- Lần integration đầu trên DB development có **1 FAIL / 4 PASS** vì test cũ giả định dashboard luôn trống. DB thực tế đã có dữ liệu; test đã được sửa để kiểm tra contract mà không phụ thuộc trạng thái tồn lưu, rồi chạy lại trên DB mới đạt 5/5. Lần FAIL này không được ghi thành PASS.
- `docker compose config` xác nhận `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false` và khóa trùng vẫn đúng. Image web/API hiện tại đã build và recreate; DB/API/web healthy, API trực tiếp/proxy trả `ok` và Nginx trả HTTP 200.

## Reset dữ liệu development ngày 22/10/2026

Kiểm tra read-only trước reset phát hiện DB development có **93 nhân viên, 1.908 lịch, 1.841 normalization và 1.841 calculation `VALID`**, cùng một audit provision không khớp decision log. Chủ dự án đã yêu cầu reset toàn bộ database development `tinhcong_dev` và xác nhận không cần backup.

- `prisma migrate reset --force --skip-seed` áp lại migration `20261021145100_init` thành công; synthetic seed chạy thành công.
- Sau reset: 0 import, 0 raw, 0 import issue, 0 normalization, 0 calculation, 0 exception, 0 work schedule; còn 1 phòng ban, 1 nhân viên, 3 user và 1 audit synthetic.
- PostgreSQL/API/web đều healthy; proxy `/api/v1/health` trả `ok`; đăng nhập `admin.synthetic` thành công; web vẫn phục vụ bundle redesign `index-D0RB9qw7.js`.
- Không có backup theo chỉ thị rõ ràng của Chủ dự án. Dữ liệu đã xóa không thể khôi phục từ checkpoint này.

## Kiểm tra file SX.xlsx ngày 22/10/2026 — evidence trước reset

Các số liệu dưới đây mô tả lần import trước reset để phục vụ audit. Chúng không còn là dữ liệu hiện tồn trong DB development.

- SHA-256 đã được lưu trong bản ghi import; file nằm trong private upload volume, không đưa vào Git/tài liệu.
- Sheet `Xuất lưới`, 2.769 dòng vật lý, header thực ở dòng 3 với 21 cột.
- Parser mới nhận đúng bảy trường nguồn qua alias `Mã N.Viên`, `Tên N.Viên`, `Phòng ban`, `Ngày`, `Vào`, `Ra`, `Tên ca`.
- Kết quả đọc: 2.765 dòng dữ liệu; **0 lỗi cấu trúc blocking**.
- Cảnh báo: 105 `MISSING_CHECKOUT`, 849 `INVALID_SHIFT` (ca trống/`--`), 786 `NO_ATTENDANCE`. Một dòng có thể có hơn một cảnh báo.
- Khóa trùng được Chủ dự án duyệt ngày 22/10/2026: `employeeCode,attendanceDate,shiftName`. Kiểm tra trên 2.765 dòng cho kết quả 0 nhóm trùng.
- Người dùng đã confirm: import `ACCEPTED`, 2.765 raw rows. Backfill pipeline idempotent tạo 4.505 ngoại lệ = 1.740 cảnh báo nguồn + 2.765 `EMPLOYEE_NOT_FOUND`.
- Dữ liệu nguồn có 92 mã nhân viên/12 phòng ban; master development chỉ có 1 nhân viên synthetic và 0 lịch phân ca. Kết quả an toàn: 0 linked, 0 normalization, 0 calculation; không tự tạo master hoặc suy lịch/timestamp.
- Web/API mới hiển thị lịch sử import, raw rows, số ngoại lệ/trạng thái xử lý; các lần confirm sau tự chạy pipeline và giữ raw nếu bước xử lý phụ thất bại.

## Sửa lỗi confirm import lớn sau reset

- Lần confirm lại `SX.xlsx` sau reset trả HTTP 500. Log API xác định Prisma `P2028`: interactive transaction hết hạn 5 giây khi `attendanceRaw.createMany` ghi 2.765 dòng; thời gian thực tế 5.894 giây.
- Transaction đã rollback đúng: import vẫn `PREVIEW`, raw rows bằng 0 và không có ghi một phần.
- Đã thay callback interactive transaction bằng sequential batch transaction của Prisma cho cả nhánh ACCEPTED và REJECTED. Tính nguyên tử/all-or-nothing và duplicate policy không đổi.
- Thêm regression synthetic 2.765 dòng; API tests tăng lên 24/24 PASS. Full gate sau sửa: typecheck PASS, build PASS, unit/service 55/55 PASS, integration 5/5 PASS, E2E 9/9 PASS.
- API image mới đã build trực tiếp từ `infra/docker/api.Dockerfile`, artifact được kiểm tra có bản sửa, container được recreate và healthy. Preview lỗi trước đó vẫn sẵn sàng để người dùng bấm `Xác nhận import` lại; hệ thống không tự confirm thay người dùng.

## Mốc dùng Tên ca nguồn thay lịch phân ca — DEC-007

- Chủ dự án xác nhận không quản lý lịch phân ca riêng; pipeline nay dùng đúng `Ca1`/`Ca3` trong cột `Tên ca` làm phân ca của dòng, `Ngày chấm công` làm ngày bắt đầu ca và không truy vấn/tạo `work_schedules`.
- Dữ liệu hiện tại: 1.252 dòng `Ca1`, 664 dòng `Ca3`, 63 dòng `--`, 786 dòng ca trống. Ca trống/`--`/alias khác vẫn chuyển `UNSUPPORTED_SHIFT_FOR_CALCULATION`, không tự đoán.
- Regression synthetic chứng minh dòng Ca1 đủ hồ sơ được normalization/calculation trực tiếp với evidence `SOURCE_SHIFT_ASSIGNMENT`, không có Prisma mock `workSchedule`; API suite tăng từ 24 lên 25 test.
- Gate cuối: typecheck PASS; build PASS; engine 31/31; API 25/25; integration 6/6 trên DB mới sau migration/seed; E2E 9/9. Tổng 71 PASS, 0 FAIL, 0 SKIP.
- Lần typecheck đầu của mốc FAIL vì regression test gọi method private và fixture thiếu trường type bắt buộc. Đã sửa bằng test adapter typed/cast fixture, chạy lại typecheck PASS; không sửa code nghiệp vụ để né lỗi.
- `docker compose build api web` không phát log và không hoàn tất trong khoảng theo dõi nên đã dừng. Build trực tiếp hai Dockerfile PASS; artifact API/web được grep kiểm tra, container recreate thành công; API trực tiếp, proxy và Nginx health đều HTTP 200.
- DB development sau deploy vẫn có 2.765 raw, 1 employee synthetic, 0 work schedule, 0 normalization và 0 calculation. Nguyên nhân còn lại là 92 mã nguồn chưa có employee master; `SOURCE_MASTER_PROVISIONING_ENABLED=false` vẫn đúng vì người dùng chưa quyết định tạo master từ file hay nạp master riêng.

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
16. Lệnh lint root từng chỉ chạy `--if-present` và không package nào có script lint nên exit 0 mà không kiểm tra rule: thêm ESLint flat config, sửa 6 lỗi ban đầu và chạy lại 0 warning.
17. Integration trên DB mới phát hiện PATCH nhân viên chỉ có field không hỗ trợ vẫn trả 200 và tạo audit rỗng: thêm service guard + unit regression; lần đầu 7/8, lần sau 8/8 PASS trên DB mới khác.

Không test nào bị xóa hoặc validation/phân quyền bị tắt để đạt PASS.

## Chưa chạy / bị chặn

| Hạng mục                                    | Trạng thái               | Lý do                                                                                              |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| Đối chiếu `SX.xlsx` thật                    | PARTIAL/BLOCKED          | phân ca nguồn đã duyệt; còn thiếu master nhân viên và expected HR để đối chiếu kết quả             |
| UAT với HR/nhân viên                        | BLOCKED                  | chưa có người nghiệm thu và dữ liệu đã ẩn danh                                                     |
| Duplicate key nghiệp vụ thật                | PASS_POLICY/PARTIAL_DATA | Khóa đã duyệt và cấu hình; 0 nhóm trùng trên `SX.xlsx`; chưa thực hiện confirm/UAT thay người dùng |
| Workflow chốt/phát hành end-to-end thật     | BLOCKED                  | Q10/Q11 và hậu kiểm sau khóa chưa được duyệt; flag mặc định tắt                                    |
| PDF hàng loạt và mẫu chính thức             | PARTIAL/BLOCKED          | PDF cá nhân synthetic đã test; thiếu mẫu/logo và approval phát hành                                |
| Pen-test độc lập, tải đồng thời/SLA dài hạn | NOT_RUN                  | cần môi trường staging và tiêu chí SLA được duyệt                                                  |

Do các mục trên, báo cáo này không tuyên bố 100% acceptance hoặc production-ready.

## Rebuild Docker local sau redesign Quản lý nhân viên — 22/10/2026

- `docker compose build api web` PASS. Image local mới: API `sha256:5a6fdb096939...`, Web `sha256:c68b0980ab7c...`.
- Hai container API/Web được recreate từ image mới; PostgreSQL được giữ nguyên, không reset hoặc xóa dữ liệu. `docker compose ps` xác nhận DB/API/Web đều `healthy`.
- `pnpm db:migrate` trong container API PASS: Prisma nhận 2 migration và không còn migration chờ áp dụng.
- Health runtime PASS: API trực tiếp `http://127.0.0.1:3300/api/v1/health` HTTP 200; API qua Nginx `http://127.0.0.1:8180/api/v1/health` HTTP 200; Nginx `/healthz` HTTP 200.
- Guard runtime được kiểm tra lại và giữ nguyên: `WORKFLOW_ENABLED=false`, `SOURCE_MASTER_PROVISIONING_ENABLED=false`, `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName`.
- Smoke API có xác thực PASS: login synthetic, `GET /employees` và `GET /employees/statistics` đều thành công; database hiện có đúng 1 hồ sơ synthetic `SYN-001`, trạng thái đang làm việc.
- Smoke Chromium trên đúng Docker URL `http://127.0.0.1:8180/employees` của checkpoint image cũ PASS: heading/subtitle, KPI, bộ lọc và dòng `SYN-001` hiển thị. Ảnh `docs/ui-evidence/employee-management-docker-local.png` là bằng chứng lịch sử; bằng chứng mới nhất là `employee-management-import-restored.png`.
