# 08 – Ma trận kiểm thử và đối chiếu

Cập nhật ngày 24/10/2026. Đã rà soát T01–T25, bổ sung T26–T35 cho DEC-001–DEC-006, T36 cho DEC-008, T37 cho DEC-009 và T38–T39 cho DEC-010. Các trạng thái `PASS_SYNTHETIC` bên dưới là kết quả test tự động đã chạy bằng fixture synthetic; chúng không thay thế đối chiếu `SX.xlsx` hay UAT. Xem lệnh và bằng chứng tại `TEST_REPORT.md`.

Kỳ vọng số tính bằng phút để dễ đọc; triển khai/test nội bộ phải dùng số nguyên giây. `D` là ngày bắt đầu ca. Cột `T` là `(100%,130%,150%,200%,210%,230%)`. Các con số “theo công thức” là oracle tài liệu cần HR xác nhận/đối chiếu, không phải actual result.

## 25 test đã rà soát

| ID  | Tình huống                                                   | Kỳ vọng                                                                          | Căn cứ                                 | Trạng thái             |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------- |
| T01 | Ca1 D 07:00–19:00                                            | W660; T(480,0,180,0,0,0); L0 E0                                                  | DEC-009                                | PASS_SYNTHETIC         |
| T02 | Ca1 D 07:30–19:00                                            | W630; T(480,0,150,0,0,0); L30 E0                                                 | DEC-009                                | PASS_SYNTHETIC         |
| T03 | Ca1 D 07:00–18:30                                            | W630; T(480,0,150,0,0,0); L0 E30                                                 | DEC-009                                | PASS_SYNTHETIC         |
| T04 | Ca1 D 07:30–19:30                                            | W660; T(480,0,180,0,0,0); L30 E0                                                 | DEC-009, đủ một khối 30 phút sau 19:00 | PASS_SYNTHETIC         |
| T05 | Ca1 D 07:00–11:00                                            | R0 W240; T(240,0,0,0,0,0); E420                                                  | DEC-009                                | PASS_SYNTHETIC         |
| T06 | Ca1 D 07:00–12:30                                            | R30 W300; T(300,0,0,0,0,0); E360                                                 | phần giao giờ nghỉ + DEC-009           | PASS_SYNTHETIC         |
| T07 | Ca3 D 19:00–D+1 07:00, timestamp rõ                          | W660; T(240,240,0,0,180,0); L0 E0                                                | DEC-008                                | PASS_SYNTHETIC         |
| T08 | Ca3 D 19:15–D+1 07:00                                        | W645; T(240,240,0,0,165,0); L15 E0                                               | DEC-008                                | PASS_SYNTHETIC         |
| T09 | Ca3 D 19:15–D+1 06:30                                        | W615; T(240,240,0,0,135,0); L15 E30                                              | DEC-008                                | PASS_SYNTHETIC         |
| T10 | Ca3 D 19:00–D+1 08:00                                        | W720; T(240,240,0,0,240,0)                                                       | DEC-008, đủ hai khối 30 phút           | PASS_SYNTHETIC         |
| T11 | Ca3 chỉ có giờ 19:00/07:00, không có evidence ngày ra        | `UNRESOLVED_CHECKOUT_DATE` + `NEEDS_REVIEW`; không tính, không tự +1 ngày        | DEC-002/DEC-008                        | PASS_SYNTHETIC         |
| T12 | Ca3 D 19:00–D+1 00:30                                        | R30 W300; T(240,60,0,0,0,0); E360                                                | phần giao giờ nghỉ + DEC-008           | PASS_SYNTHETIC         |
| T13 | Thiếu vào, có ra                                             | `MISSING_CHECKIN`; không có calculation hợp lệ                                   | quy tắc nguồn                          | PASS_SYNTHETIC         |
| T14 | Có vào, thiếu ra                                             | `MISSING_CHECKOUT`; không có calculation hợp lệ                                  | quy tắc nguồn                          | PASS_SYNTHETIC         |
| T15 | Tên ca không xác định                                        | `INVALID_SHIFT`; không tự gán                                                    | fail-closed                            | PASS_SYNTHETIC         |
| T16 | Các dòng giống nhau/chồng NV-ngày                            | detector phân biệt duplicate với multiple rows; không cộng đôi                   | DEC-003/004                            | PASS_SYNTHETIC         |
| T17 | Giờ 25:61, ngày sai, hoặc B<A sau normalization có căn cứ    | lưu đủ lỗi áp dụng; `NEEDS_REVIEW`, chặn tính                                    | DEC-005/006                            | PASS_SYNTHETIC         |
| T18 | NV không có dữ liệu một ngày                                 | `NO_ATTENDANCE`; không tự quy nghỉ; blocking còn OPEN theo lịch                  | ngoài phạm vi nghỉ/phép                | PASS_SYNTHETIC         |
| T19 | Import lại cùng file, detector xác định trùng dữ liệu đã lưu | từ chối toàn import; raw/calculation không tăng; giữ audit attempt và dòng/lý do | DEC-003                                | PARTIAL_UNIT_PASS      |
| T20 | Correction 08:30→08:00, ra17:00                              | W450→480; raw không đổi; revision/lý do/actor; revalidate                        | bất biến nguồn                         | NOT_RUN                |
| T21 | Mọi calculation hợp lệ                                       | tổng sáu mức=W; R bằng giao; tất cả giây không âm                                | bất biến                               | PASS_SYNTHETIC         |
| T22 | NV A yêu cầu dữ liệu/job của B                               | backend từ chối, không lộ dữ liệu                                                | Phase sau/security                     | PASS_DB_INTEGRATION    |
| T23 | Correction/import/calculate vào kỳ LOCKED                    | từ chối; race không xuyên lock                                                   | Phase sau/workflow                     | PARTIAL_GUARD_PASS     |
| T24 | Xem lịch sử sau correction                                   | đủ trước/sau, actor, thời gian, lý do và liên kết nguồn                          | audit                                  | NOT_RUN                |
| T25 | Xuất PDF và cộng từng dòng                                   | tổng khớp snapshot/Excel, Unicode đúng; BLOCKED thiếu mẫu/ngoài Phase 1          | Phase sau                              | PARTIAL_SYNTHETIC_PASS |

## 13 test bổ sung bắt buộc

| ID  | Tình huống                                                           | Kỳ vọng                                                                                                                        | Quyết định      | Trạng thái                   |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------------------------- |
| T26 | Phân ca nguồn Ca3 ngày D; vào thực tế D+1 00:30, ra D+1 07:00        | `shift_date=D`, giữ `check_in_at=D+1 00:30`; W360, T(240,120,0,0,0,0), L330 E0 nếu không lỗi khác; evidence trỏ dòng nguồn     | DEC-001/007/008 | PASS_SYNTHETIC               |
| T27 | Ca3 có giờ ra 07:00 nhưng thiếu ngày/lịch/mapping đủ tin cậy         | `UNRESOLVED_CHECKOUT_DATE`, `NEEDS_REVIEW`; không calculation hợp lệ; evidence thiếu được ghi rõ                               | DEC-002         | PASS_SYNTHETIC               |
| T28 | Hai bản ghi trùng trong cùng file                                    | đánh dấu `WITHIN_FILE` với cả dòng/lý do; từ chối toàn import; không ghi raw một phần                                          | DEC-003         | PASS_SYNTHETIC               |
| T29 | Một bản ghi trùng với dữ liệu đã lưu                                 | đánh dấu `STORED_DATA` và tham chiếu an toàn; từ chối toàn import; audit attempt                                               | DEC-003         | PASS_SYNTHETIC               |
| T30 | File mới giống lần trước nhưng một dòng thay đổi                     | không tự coi là replacement/merge; các dòng trùng phát hiện được làm toàn import bị từ chối; dòng thay đổi không ghi đè bản cũ | DEC-003         | NOT_RUN                      |
| T31 | Một NV có hai dòng cùng `shift_date`, không phải duplicate tuyệt đối | giữ hai raw; tạo `MULTIPLE_ROWS_SAME_EMPLOYEE_SHIFT_DATE`; không cộng/ghép và không tạo tổng hợp hợp lệ                        | DEC-004         | PASS_SYNTHETIC               |
| T32 | `A=B` sau normalization có căn cứ                                    | `EQUAL_CHECK_TIMES`, `NEEDS_REVIEW`; không tự sửa/không VALID                                                                  | DEC-005         | PASS_SYNTHETIC               |
| T33 | Hiện diện 16:00:01 với ngưỡng cấu hình 16 giờ                        | `EXCESSIVE_DURATION`, `NEEDS_REVIEW`; không VALID; kiểm tra cạnh đúng 16:00:00 không bị lỗi `>`                                | DEC-005         | PASS_SYNTHETIC               |
| T34 | Một dòng đồng thời sai ca, thiếu checkout và ngày ca không xác định  | lưu đủ ba mã lỗi; trạng thái tổng hợp `NEEDS_REVIEW`; không bỏ lỗi sau lỗi đầu                                                 | DEC-006         | PASS_SYNTHETIC               |
| T35 | Yêu cầu chốt/LOCKED khi còn ít nhất một lỗi blocking                 | từ chối chuyển trạng thái; ghi audit; sau `RESOLVED` vẫn phải revalidate/recalculate trước khi chốt                            | DEC-006         | PARTIAL_GUARD_PASS           |
| T36 | Ca3 vào 18:45, ra 07:15 và 07:30                                     | giữ raw 18:45/07:15 hoặc 07:30; lượt 07:15 tính như 19:00–07:00, lượt 07:30 tính thêm đúng 30 phút; tổng tier bằng W           | DEC-008         | PASS_UNIT_AND_DB_INTEGRATION |
| T37 | Ca1 vào 06:30, ra 19:20 và 19:30                                     | giữ raw 06:30/19:20 hoặc 19:30; lượt 19:20 tính như 07:00–19:00, lượt 19:30 tính thêm đúng 30 phút; tổng tier bằng W           | DEC-009         | PASS_UNIT_AND_DB_INTEGRATION |
| T38 | Ca1 có `D` là Chủ nhật, vào 06:30 và ra 19:30                        | W690; T(0,0,0,690,0,0); vẫn giới hạn vào sớm và chỉ nhận khối đủ 30 phút sau 19:00                                             | DEC-010         | PASS_UNIT_AND_DB_INTEGRATION |
| T39 | Ca3 có `D` là Chủ nhật, ra vào thứ Hai 07:30                         | W690; T(0,0,0,0,0,690); mức dựa trên `D`, vẫn giới hạn vào sớm và khối đủ 30 phút sau 07:00                                    | DEC-010         | PASS_UNIT_AND_DB_INTEGRATION |

## Ca biên vẫn phải bao phủ

- Ca1 vào 12:30 ra19:00: R30 W360; E0; L330 theo công thức, cần HR xác nhận oracle.
- Ra đúng đầu/cuối nghỉ; thời lượng chỉ nằm trong nghỉ; vào trước mốc; không cắt ngầm.
- Dữ liệu có giây phải bảo toàn từng giây; input 08:00:01 không làm tròn.
- Excel serial 1900/1904, text nhập nhằng, mã NV có số 0 đầu, sheet có nhiều header/ô gộp.
- Thiếu căn cứ timestamp không được đồng thời kết luận âm chỉ từ so sánh giờ.
- Ngưỡng >16 giờ phải đọc từ cấu hình/version, không hard-code trong nhiều nơi.
- Retry import song song không tạo dữ liệu một phần/trùng; audit không chứa thông tin cá nhân không cần thiết.

## Cách thu bằng chứng

Phase 1: unit test engine/parser bằng fixture có hash; test transaction import; đối chiếu SX.xlsx ẩn danh với expected HR; lưu command, môi trường/version, actual/expected, số PASS/FAIL/SKIP và artifact. Fixture tổng hợp chỉ chứng minh logic mẫu, không chứng minh dữ liệu thực.

Integration/E2E/PDF/security/performance/backup đã chạy trên môi trường và dữ liệu synthetic như `TEST_REPORT.md`. UAT và đối chiếu dữ liệu thật tiếp tục `BLOCKED`.
