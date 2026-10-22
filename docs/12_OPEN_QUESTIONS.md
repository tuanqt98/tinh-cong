# 12 – Câu hỏi và quyết định còn mở

Cập nhật ngày 22/10/2026 sau khi Chủ dự án xác nhận khóa trùng DEC-003. Chi tiết quyết định và phạm vi ảnh hưởng xem `17_PHASE0_BUSINESS_DECISIONS.md`.

Mức ưu tiên: P0-E cần trước khi hoàn tất toàn bộ chức năng engine/import Phase 1; P0-R cần trước kiểm chứng bằng dữ liệu thực; P1/P2 có thể hoãn theo phạm vi đã chốt. `PARTIALLY_CONFIRMED` không được coi là đồng ý cho hệ thống tự suy diễn phần còn mở.

| ID | Ưu tiên | Trạng thái | Nội dung đã chốt / câu hỏi còn lại | Ảnh hưởng |
|---|---|---|---|---|
| Q01 | P0-R | `PARTIALLY_AVAILABLE` | `SX.xlsx` đã ACCEPTED 2.765 raw rows và hiển thị trên web; pipeline tạo 4.505 ngoại lệ fail-closed. Còn cần HR xác nhận mapping 92 mã nhân viên/12 phòng ban, lịch/alias/timestamp evidence và expected độc lập. | liên kết master, chuẩn hóa, tính công và UAT thực tế |
| Q02 | P0-R | `OPEN` | Xác nhận có/không code Phase 1 ngoài repository hiện tại; nếu có, cung cấp repository/branch và lệnh test. | đánh giá phần đã hoàn thành; không chặn viết engine mới nếu được giao |
| Q03 | — | `CONFIRMED` (DEC-001) | Ngày chấm công là ngày bắt đầu ca theo lịch phân công; Ca 3 vào sau 00:00 vẫn có thể thuộc ngày ca trước. Còn cần nguồn lịch và tiêu chí ánh xạ đủ tin cậy. | phần quyết định không còn chặn engine; mapping thực chặn tích hợp dữ liệu |
| Q04 | P0-E/P0-R | `PARTIALLY_CONFIRMED` (DEC-002) | Được xác định ngày ra hôm sau khi có căn cứ phù hợp lịch 22:00–07:00; không cộng ngày vô điều kiện. Cần chốt tiêu chí suy ngày ra, độ ưu tiên bằng chứng và ngoại lệ ca ngắn/ra cùng ngày. | parser timestamp cho dữ liệu chỉ có giờ; dòng thiếu căn cứ phải `NEEDS_REVIEW` |
| Q05 | P0-R | `PARTIALLY_CONFIRMED` (DEC-003; key confirmed) | Đã chốt khóa trùng là `Mã nhân viên + Ngày chấm công + Tên ca` (`employeeCode,attendanceDate,shiftName`), từ chối toàn bộ import có trùng, không merge/overwrite/replace, có log và phân biệt trùng trong file/đã lưu. Còn mở quy trình HR cho file sửa một dòng/file nhiều kỳ. | khóa đã cấu hình; tiếp tục kiểm chứng import thực tế và quy trình sửa |
| Q06 | — | `CONFIRMED` (DEC-004) | Không tự cộng/ghép nhiều dòng cùng NV/ngày ca; giữ từng dòng, tạo ngoại lệ, không tổng hợp trước HR xác nhận. Còn mở quy trình HR xử lý ở Phase sau. | engine có thể phát hiện/chặn; thao tác xử lý có thể hoãn |
| Q07 | P0-E/P0-R | `OPEN` | Tên ca/alias thực tế ánh xạ Ca 1/Ca 3 thế nào? Có Ca 2 trong nguồn không và nếu có xử lý ngoài phạm vi ra sao? | nhận diện ca và mapping Excel |
| Q08 | — | `CONFIRMED` (DEC-005) | `A=B`, duration âm sau chuẩn hóa có căn cứ, hoặc hiện diện >16 giờ cấu hình được đều cần HR kiểm tra. Còn mở quyền/phạm vi hiệu lực của cấu hình và mã lỗi chi tiết. | validation cốt lõi đã đủ; quản trị cấu hình có thể thiết kế sau |
| Q09 | P0-R | `OPEN` | HR xác nhận expected cho ma trận T01–T35 và cung cấp một số dòng thực tế đã ẩn danh với expected độc lập. | oracle đối chiếu/UAT; không được đánh dấu PASS trước khi chạy |
| Q10 | P1 | `OPEN` | Ai được REVIEWED/APPROVED/LOCKED/PUBLISHED? Có yêu cầu tách người nhập/người duyệt? Sau khóa dùng reopen hay adjustment revision? | workflow phát hành ngoài Phase 1 hiện tại |
| Q11 | P1 | `OPEN` | Kỳ toàn công ty hay theo phòng/NV? NV chuyển phòng thuộc manager nào theo thời điểm? | authorization và unique period ở Phase sau |
| Q12 | — | `CONFIRMED` (DEC-006) | Lưu mọi mã lỗi, hiển thị `NEEDS_REVIEW` khi cần HR, lỗi chặn ngăn chốt, `RESOLVED` phải validation/calculation lại. Còn mở taxonomy lỗi chặn, thứ tự hiển thị, quyền xử lý và trường hợp `NO_ATTENDANCE`. | mô hình nhiều lỗi đủ để phát triển; chi tiết UI/workflow có thể bổ sung |
| Q13 | P1 | `OPEN` | Lịch nghỉ/lễ/phép/nghỉ bù và NV vào/nghỉ giữa tháng xử lý thế nào? | ngoài phạm vi Phase 1; hoãn Phase sau |
| Q14 | P1 | `OPEN` | Nguồn tài khoản, cấp/reset mật khẩu, phạm vi HR/manager và chính sách đăng nhập? | backend/portal ngoài phạm vi Phase 1 |
| Q15 | P1 | `OPEN` | Cung cấp mẫu PDF/bảng công, chữ ký/logo/phân trang/quy tắc revision. | phát hành phiếu công ngoài phạm vi Phase 1 |
| Q16 | P2 | `OPEN` | Hạ tầng, backup/retention/RPO/RTO, SLA import/tính/export và số người đồng thời? | vận hành/benchmark Phase sau |
| Q17 | P2 | `OPEN` | Kênh phát hành, quyền gửi thật, thời hạn phản hồi và quy trình sau phát hành? | phát hành/UAT Phase sau |

## Các chi tiết OPEN bắt buộc không được tự mặc định

1. Tiêu chí và nguồn bằng chứng đủ tin cậy để ánh xạ ngày ca/ngày ra khi Excel thiếu ngày.
2. Quy trình HR xử lý file sửa/file nhiều kỳ; khóa trùng đã chốt không tạo quyền thay thế tự động.
3. Alias ca thực tế và cách ly dữ liệu ngoài Ca 1/Ca 3.
4. Expected độc lập của HR và dữ liệu nguồn thực tế để đối chiếu.
5. Taxonomy lỗi chặn đầy đủ và quyền xử lý ngoại lệ; trước khi chốt, mọi lỗi chặn vẫn phải bằng 0.

## Cách ghi quyết định tiếp theo

Mỗi câu trả lời phải lưu người xác nhận, ngày, nội dung, ví dụ, phần còn mở và phiên bản tài liệu ảnh hưởng. Thiếu quy tắc thì giữ `OPEN`, chuyển dữ liệu mơ hồ sang `NEEDS_REVIEW` và không tính công/không import theo đúng chính sách; thời gian chờ không phải sự đồng ý.
