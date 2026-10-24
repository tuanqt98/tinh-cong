# 01 – Yêu cầu nghiệp vụ và audit đầu vào

Cập nhật: 21/10/2026. Trạng thái: yêu cầu Phase 0 đã được kế thừa vào implementation Phase 1–6 theo master prompt mới. Kết quả development xem `13_PROGRESS_REPORT.md`; đối chiếu dữ liệu thật và UAT vẫn bị chặn.

## Nguồn và bằng chứng

Đặc tả gốc được lưu nguyên tại `00_SOURCE_REQUIREMENTS.txt`. Sáu quyết định mới được ghi riêng tại `17_PHASE0_BUSINESS_DECISIONS.md`; không sửa bằng chứng cũ để tạo cảm giác các quyết định đã tồn tại từ trước.

Repository hiện đã có ứng dụng development và `SX.xlsx` đã được kiểm tra cấu trúc ngày 22/10/2026. Vẫn thiếu lịch/mapping/expected HR và mẫu PDF chính thức để hoàn tất UAT.

| Đầu vào                                 | Tình trạng                                     | Ảnh hưởng                                                                          |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Đặc tả gốc                              | Đã lưu/đọc                                     | cơ sở công thức và yêu cầu tổng thể                                                |
| DEC-001–DEC-010                         | Chủ dự án xác nhận đến 23/10/2026              | cập nhật ngày ca, ngày ra, trùng, nhiều dòng, bất thường, khung ca và mức Chủ nhật |
| SX.xlsx                                 | Chưa được cung cấp                             | chưa audit/mapping/đối chiếu dữ liệu thực                                          |
| Lịch phân công hoặc quy tắc ánh xạ lịch | Chưa được cung cấp                             | chưa chứng minh ngày ca cho dòng thực tế                                           |
| Code Phase 1                            | Chưa được cung cấp hoặc xác nhận không tồn tại | chưa đối chiếu thuật toán/test hiện có                                             |
| Expected độc lập của HR                 | Chưa có                                        | chưa chạy đối chiếu nghiệp vụ                                                      |
| Mẫu PDF/bảng công                       | Chưa có                                        | ngoài Phase 1 hiện tại; cần ở Phase sau                                            |

## Mục tiêu nghiệp vụ

Ứng dụng nội bộ quản lý chấm công cho Công ty TNHH In Nhật Hàn. Dữ liệu nguồn chỉ dùng bảy trường: mã NV, tên NV, phòng ban, ngày chấm công, giờ vào, giờ ra, tên ca. Không dùng Công, Giờ, TC1/2/3, Ký hiệu, Vào trễ hoặc Ra sớm làm đầu vào/kỳ vọng nếu HR chưa xác nhận độc lập.

Ngày chấm công là ngày bắt đầu ca theo phân ca nguồn đã duyệt (DEC-001/DEC-007), không đồng nghĩa ngày lịch của timestamp vào/ra. Theo DEC-008, Ca 3 hiện hành có khung 19:00–07:00 hôm sau; chỉ suy ngày ra hôm sau khi có bằng chứng phù hợp, dữ liệu mơ hồ chuyển `NEEDS_REVIEW` và không tính (DEC-002). Theo DEC-009, Ca 1 hiện hành có khung 07:00–19:00; không tính phần trước 07:00 và chỉ tính phần sau 19:00 theo từng khối đủ 30 phút.

## Phạm vi Phase 1 đã chốt

Phase 1 chỉ bao gồm:

1. Đọc và chuẩn hóa dữ liệu Excel.
2. Nhận diện Ca 1 và Ca 3.
3. Chuẩn hóa ngày giờ khi có đủ căn cứ, kèm provenance/bằng chứng.
4. Tính giờ làm việc thực tế và phần giao giờ nghỉ.
5. Tính các mức 100%, 130%, 150%, 200%, 210%, 230% theo công thức đã xác nhận. Nếu `shiftDate` là Chủ nhật, toàn bộ công Ca 1 vào 200% và toàn bộ công Ca 3 vào 230%.
6. Tính đi muộn và về sớm độc lập.
7. Phát hiện, tích lũy và phân loại ngoại lệ.
8. Chống import trùng theo chính sách từ chối toàn bộ khi phát hiện trùng.
9. Xuất kết quả `BangCong` và `NgoaiLe`.
10. Unit test và kiểm thử đối chiếu có evidence.

Ngoài Phase 1: nghỉ phép, ngày lễ, nghỉ bù, tiền lương, khấu trừ lương, phát hành phiếu công/PDF, portal nhân viên và phê duyệt nhiều cấp. Các hạng mục này được lưu cho Phase sau; không tự thêm vào engine Phase 1.

## Quy tắc kiểm soát đã xác nhận

- Ca 1/Ca 3, nghỉ, các mức thời lượng và mốc đủ 8 giờ giữ nguyên tại `02_ATTENDANCE_RULES.md`.
- Khi phát hiện trùng, từ chối import nguyên tử; hiển thị dòng/lý do, ghi audit; không merge, overwrite hoặc coi file sửa là bản thay thế (DEC-003).
- Nhiều dòng cùng mã NV/ngày ca được giữ riêng, không cộng/ghép/tổng hợp trước khi HR xác nhận; không đánh đồng với trùng tuyệt đối (DEC-004).
- `A=B`, duration âm sau chuẩn hóa tin cậy hoặc hiện diện lớn hơn ngưỡng cấu hình mặc định 16 giờ đều cần HR kiểm tra; không tự sửa timestamp (DEC-005).
- Một dòng lưu được nhiều lỗi. Lỗi chặn ngăn chốt; `RESOLVED` phải qua validation/calculation lại trước khi kết quả hợp lệ (DEC-006).

## Luồng nghiệp vụ Phase 1

Excel → parse an toàn → preview/mapping → chuẩn hóa có provenance → kiểm tra trùng toàn file và dữ liệu đã lưu → từ chối nguyên tử nếu có trùng, nếu không thì lưu nguồn bất biến → nhận diện ca/ngày ca → tính công → thu thập mọi ngoại lệ → xuất `BangCong` và `NgoaiLe` → đối chiếu actual/expected.

Mọi dòng không đủ căn cứ về ngày ca/timestamp hoặc thuộc nhóm nhiều dòng chưa xác nhận phải bị loại khỏi tổng hợp hợp lệ. Dữ liệu nguồn bất biến; điều chỉnh về sau là revision mới có người, thời gian và lý do.

## Yêu cầu không chức năng liên quan Phase 1

- Múi giờ `Asia/Ho_Chi_Minh`; thời lượng số nguyên giây.
- Truy vết kết quả đến file/sheet/dòng nguồn, mapping/rule/engine version và bằng chứng chuẩn hóa timestamp.
- Import bị từ chối không để lại một phần raw/calculation nghiệp vụ; audit attempt vẫn được giữ.
- Không ghi dữ liệu nhận dạng vào log/bằng chứng tài liệu.
- Test chỉ được đánh dấu PASS khi có actual result. Fixture tổng hợp đã được chạy theo `TEST_REPORT.md` nhưng không thay bằng chứng dữ liệu thực.

## Kế hoạch audit SX.xlsx khi được cung cấp

1. Lưu bản nguồn chỉ đọc; ghi SHA-256, dung lượng, thời điểm và phạm vi được phép xử lý.
2. Liệt kê sheet, header, ô gộp/công thức/dòng tổng/trống và Excel date system 1900/1904.
3. Ánh xạ đúng bảy trường; ghi kiểu serial/text, định dạng ngày, độ chính xác giây và có/không có ngày trên mỗi mốc.
4. Đối chiếu tên ca/alias và lịch phân công để xác định ngày ca; không đủ căn cứ thì `NEEDS_REVIEW`.
5. Dùng khóa trùng đã duyệt `Mã nhân viên + Ngày chấm công + Tên ca`; thống kê riêng trùng trong file, trùng dữ liệu đã lưu và nhiều dòng NV/ngày ca.
6. Thống kê ngoại lệ, bao gồm timestamp chưa xác định, bằng giờ, âm, trên 16 giờ và nhiều lỗi trên dòng.
7. Đối chiếu mẫu ẩn danh với expected độc lập của HR; không dùng cột kết quả cũ làm oracle chưa xác nhận.

Hiện mọi thống kê dữ liệu thực tế là `NOT_RUN/BLOCKED_MISSING_SX_XLSX`, không phải 0.

## Readiness không tương đương

- `READY_FOR_ENGINE_DEVELOPMENT`: **YES_WITH_GUARDRAILS** cho engine công thức, ngoại lệ và fixture mẫu; phần không đủ căn cứ phải fail-closed. Khóa trùng thực tế, alias ca và tiêu chí suy ngày chi tiết vẫn cần trước khi hoàn tất parser/import Phase 1.
- `READY_FOR_REAL_DATA_VALIDATION`: **PARTIAL**; đã có SX.xlsx và khóa trùng được duyệt, còn thiếu lịch/mapping/expected HR và UAT.
- `PHASE0_ACCEPTED`: **NO – AWAITING_PROJECT_OWNER_ACCEPTANCE**; cập nhật tài liệu không tự động chuyển Phase.
