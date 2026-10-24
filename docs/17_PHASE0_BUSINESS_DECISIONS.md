# 17 – Nhật ký quyết định nghiệp vụ Phase 0

Ngày lập: 21/10/2026. Tài liệu này ghi nhận các quyết định do Chủ dự án xác nhận ngày 09/10/2026. Đây là bằng chứng quyết định mới; không thay đổi hay ghi đè bằng chứng audit trước đó.

Quy ước trạng thái đánh giá lại:

- `CONFIRMED`: hướng xử lý nghiệp vụ đã đủ rõ; các tham số kỹ thuật còn lại không thay đổi quyết định.
- `PARTIALLY_CONFIRMED`: đã chốt nguyên tắc an toàn nhưng còn thiếu tiêu chí cần thiết để xử lý tự động một số dữ liệu.
- Chi tiết còn `OPEN` phải xử lý theo hướng fail-closed: không tự suy diễn, không tính công hoặc không nhận import, và chuyển HR kiểm tra khi phù hợp.

## DEC-001 – Q03: Ngày chấm công

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 09/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung lịch sử:** Ngày chấm công là ngày bắt đầu ca trong lịch phân công. Quyết định gốc ghi Ca 3 bắt đầu lúc 22:00; mốc này đã được DEC-008 thay bằng 19:00 từ ngày công 01/09/2026. Nhân viên vào sau 00:00 vẫn thuộc ngày bắt đầu ca trước đó khi có căn cứ phân ca. Phải lưu tách biệt ngày chấm công/ngày ca, thời điểm vào thực tế và thời điểm ra thực tế. Không được tự suy ngày bắt đầu ca khi thiếu lịch hoặc quy tắc ánh xạ đủ tin cậy; dòng đó là `NEEDS_REVIEW` và không có kết quả tính công hợp lệ.
- **Phạm vi ảnh hưởng:** ánh xạ Excel, chuẩn hóa timestamp, mô hình dữ liệu, tính đi muộn/về sớm, nhóm dòng theo ngày ca, báo cáo Bảng Công/Ngoại Lệ và test ca đêm.
- **Chi tiết còn OPEN:** nguồn và cấu trúc lịch phân công; tiêu chí “ánh xạ đủ tin cậy”; cách xử lý khi lịch phân công mâu thuẫn với tên ca/file nguồn.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-002 – Q04: Ngày ra Ca 3

- **Trạng thái:** `PARTIALLY_CONFIRMED`.
- **Ngày xác nhận:** 09/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung lịch sử:** Có thể xác định thời điểm ra ở ngày hôm sau khi bằng chứng phù hợp với phân ca Ca 3; khung 22:00–07:00 ghi ở quyết định gốc đã được DEC-008 thay bằng 19:00–07:00. Không được cộng một ngày vô điều kiện chỉ vì giờ ra nhỏ hơn giờ vào. Phải phân biệt ngày lịch, ngày ca và timestamp quẹt thẻ; lưu bằng chứng đã dùng. Nếu chưa đủ căn cứ thì không tính công và đưa `NEEDS_REVIEW`.
- **Phạm vi ảnh hưởng:** parser Excel, chuẩn hóa timestamp, kiểm tra thời lượng, audit trail, ngoại lệ và test qua đêm.
- **Chi tiết còn OPEN:** tập tiêu chí suy ngày ra chi tiết; độ ưu tiên giữa lịch phân công, ngày trong file và dữ liệu thiết bị; xử lý ca ngắn/ra cùng ngày, quẹt muộn ngoài cửa sổ và dữ liệu mâu thuẫn.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-003 – Q05: Import trùng

- **Trạng thái:** `PARTIALLY_CONFIRMED`; khóa nhận diện trùng đã `CONFIRMED`.
- **Ngày xác nhận:** nguyên tắc ngày 09/10/2026; khóa trùng ngày 22/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung:** Khóa nhận diện trùng chính thức là `Mã nhân viên + Ngày chấm công + Tên ca`, cấu hình kỹ thuật `employeeCode,attendanceDate,shiftName`. Giờ vào/ra không thuộc khóa. Khi phát hiện dữ liệu trùng, từ chối toàn bộ import và yêu cầu HR xử lý. Không overwrite, merge hoặc thay bản cũ tự động. Preview/confirm phải chỉ ra từng dòng trùng, loại trùng (trong file hoặc với dữ liệu đã lưu) và lý do; lần import bị từ chối phải có log. Việc từ chối là nguyên tử, không ghi một phần dữ liệu nghiệp vụ. File thay đổi một dòng không mặc nhiên là phiên bản thay thế được phép.
- **Phạm vi ảnh hưởng:** fingerprint/idempotency, validation trước import, transaction, trạng thái import, audit log, UI preview và test import.
- **Chi tiết còn OPEN:** cách HR xử lý file sửa; quyền/phương thức cho phép một lần import thay thế nếu nghiệp vụ sau này phê duyệt; file nhiều kỳ có kỳ đã khóa.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `03_SYSTEM_ARCHITECTURE.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-004 – Q06: Nhiều dòng cùng nhân viên/ngày

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 09/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung:** Phát hiện nhiều dòng theo mã nhân viên và ngày ca, giữ nguyên từng dòng nguồn, không tự cộng hoặc ghép. Đưa nhóm cần kiểm tra vào danh sách ngoại lệ và không tính tổng công của nhóm trước khi HR xác nhận. Nhiều dòng không mặc nhiên là bản ghi trùng tuyệt đối; phải phân biệt trùng bản ghi với nhiều lượt chấm công. Chức năng HR xử lý có thể thiết kế ở Phase sau.
- **Phạm vi ảnh hưởng:** raw data, phân nhóm theo ngày ca, ngoại lệ, tổng hợp Bảng Công, UI HR và test.
- **Chi tiết còn OPEN:** quy trình HR xác nhận nhiều lượt hợp lệ; sau xác nhận sẽ chọn dòng, ghép hay tính riêng; quy tắc nghỉ và mốc đi muộn/về sớm cho nhiều lượt.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-005 – Q08: Thời gian bất thường

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 09/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung:** `A=B`, thời lượng âm sau khi đã chuẩn hóa timestamp có căn cứ, hoặc thời gian hiện diện lớn hơn ngưỡng cấu hình mặc định 16 giờ đều phải đưa HR kiểm tra, không tự sửa giờ. Tính bằng phút hoặc giây; triển khai thống nhất số nguyên giây. Không dùng so sánh giờ đơn thuần để kết luận ca đêm âm. Nếu chưa đủ dữ liệu xác định timestamp thì ghi lỗi timestamp chưa xác định, không kết luận sai và không giả định ca kéo dài nhiều ngày.
- **Phạm vi ảnh hưởng:** chuẩn hóa timestamp, validation, cấu hình, ngoại lệ, audit và test biên.
- **Chi tiết còn OPEN:** quyền thay đổi ngưỡng, phạm vi áp dụng/hiệu lực của cấu hình và mã lỗi chi tiết cho từng loại bất thường.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-006 – Q12: Một dòng có nhiều lỗi

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 09/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung:** Một dòng có thể lưu nhiều mã lỗi; không bỏ lỗi thứ hai hoặc thứ ba. Khi có lỗi cần HR kiểm tra, trạng thái hiển thị là `NEEDS_REVIEW`. Không cho phép chốt khi còn lỗi chặn. Mọi xử lý ngoại lệ phải được ghi nhận; `RESOLVED` chỉ thể hiện đã xử lý ngoại lệ, không đồng nghĩa kết quả tính công hợp lệ cho tới khi chạy lại validation/calculation thành công.
- **Phạm vi ảnh hưởng:** mô hình ngoại lệ, API/UI, workflow chốt kỳ, audit log và test nhiều lỗi.
- **Chi tiết còn OPEN:** danh mục mã lỗi chặn đầy đủ; thứ tự hiển thị nhiều lỗi; vai trò/quyền và dữ liệu bắt buộc khi xử lý; điều kiện riêng của `NO_ATTENDANCE`.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `07_WORKFLOW.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `15_PHASE0_REAUDIT.md`.

## DEC-007 – Q03/Q04/Q07: Dùng Tên ca trong file làm phân ca

- **Trạng thái:** `CONFIRMED` cho nguồn import hiện tại.
- **Ngày xác nhận:** 22/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Nội dung:** Không quản lý lịch phân ca riêng cho dữ liệu import. Cột `Tên ca` trong bảy trường nguồn là bằng chứng phân ca của chính dòng dữ liệu; `Ngày chấm công` là ngày bắt đầu ca. `Ca1` ánh xạ `CA1`, `Ca3` ánh xạ `CA3`; giá trị trống, `--` hoặc alias khác không được tự suy diễn và phải chuyển ngoại lệ. Với dòng `Ca3` có ngày hợp lệ, đủ giờ vào/ra và giờ ra nhỏ hơn giờ vào, giờ ra thuộc D+1; các trường hợp thiếu hoặc mâu thuẫn vẫn fail-closed. Pipeline không tạo và không yêu cầu bản ghi `work_schedules`.
- **Phạm vi ảnh hưởng:** liên kết import, chuẩn hóa timestamp, lựa chọn quy tắc ca, ngoại lệ và UI lịch sử import.
- **Chi tiết còn OPEN:** Có cho phép tạo hồ sơ nhân viên/phòng ban từ tên và mã trong file hay không; alias ngoài đúng `Ca1`/`Ca3`; expected độc lập để UAT.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `04_DATABASE_DESIGN.md`, `12_OPEN_QUESTIONS.md`, `13_PROGRESS_REPORT.md`.

## DEC-008 – Khung Ca 3 và điều kiện ghi nhận ngoài giờ

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 23/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Hiệu lực tính toán:** từ ngày công 01/09/2026; áp dụng bằng một `shift_rule` version mới, không sửa hoặc xóa rule/calculation lịch sử và không tự backdate cho dữ liệu trước ngày này.
- **Nội dung:** Ca 3 có khung chuẩn `D 19:00–D+1 07:00`, nghỉ `D+1 00:00–01:00`. Timestamp quẹt thẻ thực tế phải được giữ nguyên. Nếu vào trước 19:00 thì thời gian được tính chỉ bắt đầu từ 19:00. Nếu ra sau 07:00 thì phần sau 07:00 chỉ được ghi nhận theo từng khối đủ 30 phút: ra 07:15 tính đến 07:00; ra 07:30 tính thêm 30 phút; phần lẻ tiếp theo chưa đủ khối không được tính. Không làm tròn timestamp nguồn.
- **Phân bổ:** 4 giờ đầu ở mức 100%, 4 giờ tiếp theo ở mức 130%, phần vượt 8 giờ ở mức 210%; mức 150% bằng 0. Vì khung chuẩn có 11 giờ làm việc sau khi trừ nghỉ, một ca đủ 19:00–07:00 tạo 4 giờ 100%, 4 giờ 130% và 3 giờ 210%.
- **Đi muộn/về sớm:** đi muộn tính từ 19:00 theo giờ vào thực tế; về sớm so với 07:00 và không dùng giờ vào thực tế. Hai chỉ tiêu độc lập.
- **Audit/revision:** thay đổi rule phải sinh calculation revision mới có rule/engine version và input hash; raw/normalization timestamp thực tế không bị làm tròn hoặc ghi đè. Kỳ `LOCKED/PUBLISHED` không được tính lại trực tiếp.
- **Quan hệ quyết định:** DEC-008 thay thế phần mốc giờ 22:00 của DEC-001/DEC-002 và tài liệu nguồn trước đó; nguyên tắc ngày ca, evidence D+1 và fail-closed vẫn giữ nguyên.
- **Tài liệu liên quan:** `02_ATTENDANCE_RULES.md`, `08_TEST_CASES.md`, `12_OPEN_QUESTIONS.md`, `13_PROGRESS_REPORT.md`, `TEST_REPORT.md`.

## DEC-009 – Khung Ca 1 và điều kiện ghi nhận ngoài giờ

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 23/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Hiệu lực tính toán:** từ ngày công 01/09/2026; áp dụng bằng một `shift_rule` version mới, không sửa hoặc xóa rule/calculation lịch sử và không tự backdate cho dữ liệu trước ngày này.
- **Nội dung:** Ca 1 có khung chuẩn `D 07:00–D 19:00`, nghỉ `D 12:00–13:00`. Timestamp quẹt thẻ thực tế phải được giữ nguyên. Nếu vào trước 07:00 thì thời gian được tính chỉ bắt đầu từ 07:00. Nếu ra sau 19:00 thì phần sau 19:00 chỉ được ghi nhận theo từng khối đủ 30 phút: ra 19:20 tính đến 19:00; ra 19:30 tính thêm 30 phút; phần lẻ tiếp theo chưa đủ khối không được tính. Không làm tròn timestamp nguồn.
- **Phân bổ:** 8 giờ đầu ở mức 100%, phần vượt 8 giờ ở mức 150%; mức 130% và 210% bằng 0. Vì khung chuẩn có 11 giờ làm việc sau khi trừ nghỉ, một ca đủ 07:00–19:00 tạo 8 giờ 100% và 3 giờ 150%.
- **Đi muộn/về sớm:** đi muộn tính từ 07:00 theo giờ vào thực tế; về sớm so với 19:00 và không dùng giờ vào thực tế. Hai chỉ tiêu độc lập.
- **Audit/revision:** thay đổi rule phải sinh calculation revision mới có rule/engine version và input hash; raw/normalization timestamp thực tế không bị làm tròn hoặc ghi đè. Kỳ `LOCKED/PUBLISHED` không được tính lại trực tiếp.
- **Quan hệ quyết định:** DEC-009 thay thế khung Ca 1 08:00–17:00 trong tài liệu trước đó từ ngày hiệu lực; nguyên tắc evidence và fail-closed vẫn giữ nguyên.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `08_TEST_CASES.md`, `13_PROGRESS_REPORT.md`, `TEST_REPORT.md`.

## DEC-010 – Mức công Chủ nhật cho Ca 1 và Ca 3

- **Trạng thái:** `CONFIRMED`.
- **Ngày xác nhận:** 23/10/2026.
- **Người xác nhận:** Chủ dự án.
- **Hiệu lực tính toán:** từ ngày công 01/09/2026; áp dụng bằng `shift_rule` version 3 cho cả Ca 1 và Ca 3, không sửa hoặc xóa rule/calculation lịch sử và không tự backdate cho dữ liệu trước ngày này.
- **Căn cứ ngày:** Chủ nhật được xác định duy nhất bằng ngày bắt đầu ca `shiftDate` (`D`), không theo ngày lịch của checkout. Vì vậy Ca 3 bắt đầu Chủ nhật và kết thúc vào thứ Hai vẫn áp dụng mức 230%.
- **Phân bổ:** nếu `D` là Chủ nhật, toàn bộ thời gian được tính công `W` của Ca 1 vào mức 200%, toàn bộ `W` của Ca 3 vào mức 230%; tất cả tier còn lại bằng 0. Không chia tiếp theo các mức ngày thường 100%/130%/150%/210%.
- **Phần không đổi:** khung ca, giờ nghỉ, giới hạn phần vào sớm, khối đủ 30 phút sau mốc kết thúc, đi muộn/về sớm và quy tắc giữ nguyên timestamp nguồn tiếp tục theo DEC-008/DEC-009.
- **Dữ liệu và audit:** schema lưu riêng `tier200Seconds`/`tier230Seconds`; tổng sáu tier phải bằng `W`. Tính lại phải tạo revision mới với rule/engine version và input hash; kỳ `LOCKED/PUBLISHED` vẫn không được sửa trực tiếp.
- **Quan hệ quyết định:** DEC-010 chỉ thay phân bổ mức công của DEC-008/DEC-009 khi `D` là Chủ nhật; phân bổ ngày thường của hai quyết định đó vẫn giữ nguyên.
- **Tài liệu liên quan:** `01_BUSINESS_REQUIREMENTS.md`, `02_ATTENDANCE_RULES.md`, `08_TEST_CASES.md`, `13_PROGRESS_REPORT.md`, `TEST_REPORT.md`.

## Tổng hợp

| Quyết định            | Đánh giá                              | Phần vẫn OPEN có ảnh hưởng chính                                |
| --------------------- | ------------------------------------- | --------------------------------------------------------------- |
| DEC-001 / Q03         | `CONFIRMED`                           | nguồn lịch và tiêu chí ánh xạ tin cậy                           |
| DEC-002 / Q04         | `PARTIALLY_CONFIRMED`                 | tiêu chí suy ngày ra chi tiết                                   |
| DEC-003 / Q05         | `PARTIALLY_CONFIRMED; KEY CONFIRMED`  | quy trình file sửa/file nhiều kỳ; khóa nhận diện trùng đã chốt  |
| DEC-004 / Q06         | `CONFIRMED`                           | thao tác HR sau khi xác nhận nhiều lượt                         |
| DEC-005 / Q08         | `CONFIRMED`                           | quản trị cấu hình và mã lỗi chi tiết                            |
| DEC-006 / Q12         | `CONFIRMED`                           | taxonomy lỗi chặn và quyền xử lý                                |
| DEC-007 / Q03/Q04/Q07 | `CONFIRMED` cho nguồn import hiện tại | tạo master nhân viên từ file và alias khác `Ca1`/`Ca3` vẫn OPEN |
| DEC-008 / Ca 3        | `CONFIRMED`                           | expected HR/UAT trên toàn bộ dữ liệu thật vẫn OPEN              |
| DEC-009 / Ca 1        | `CONFIRMED`                           | expected HR/UAT trên toàn bộ dữ liệu thật vẫn OPEN              |
| DEC-010 / Chủ nhật    | `CONFIRMED`                           | expected HR/UAT trên toàn bộ dữ liệu thật vẫn OPEN              |
