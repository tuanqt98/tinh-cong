# 12 – Các câu hỏi cần xác nhận
Ngày 09/10/2026. OPEN cho toàn bộ mục; chưa có câu trả lời HR.
P0: cần để hoàn tất audit/bắt đầu engine; P1: trước backend/workflow; P2: trước nghiệm thu cuối.

| ID | Ưu tiên | Câu hỏi | Chặn |
|---|---|---|---|
| Q01 | P0 | Cung cấp SX.xlsx hoặc đường dẫn; mẫu có đủ ca/ngày và đã được phép xử lý nội bộ? | audit file và đối chiếu thực tế |
| Q02 | P0 | Có code Phase1 hiện có không? Nếu có, repository/branch và lệnh test ở đâu? Nếu chưa có, xác nhận chưa có. | đánh giá phần đã hoàn thành |
| Q03 | P0 | “Ngày chấm công” là ngày bắt đầu ca, ngày vào hay ngày máy ghi? Ca3 vào sau 00:00 gắn ngày nào? | xác định S và ngày vào |
| Q04 | P0 | Với giờ không có ngày ra, quy tắc nào đã được kiểm chứng để xác định ngày ra Ca3? Các ngoại lệ ca ngắn/ra cùng ngày xử lý thế nào? | tránh cộng ngày sai |
| Q05 | P0 | Trùng xác định theo bảy trường hay ID thiết bị? Tái import giữ/thay phiên bản/merge? File sửa một dòng xử lý bản cũ thế nào? Có chấp nhận confirm từng tháng khi file chứa kỳ khóa? | parser chống trùng/phiên bản |
| Q06 | P0 | Nhiều dòng một NV/ngày là split shift hợp lệ hay ngoại lệ? Nếu hợp lệ cộng/ghép thế nào, nghỉ trừ ra sao, L/E lấy mốc nào? | không tự cộng/ghép |
| Q07 | P0 | Tên ca thực tế/alias Ca1/Ca3? Có Ca2 không và quy tắc riêng? | mapping ca |
| Q08 | P0 | Thời lượng bất thường min/max, vào=ra, ra trước mốc, ca kéo nhiều ngày được phân loại/giải quyết thế nào? | validation |
| Q09 | P0 | HR duyệt kỳ vọng “theo công thức” ở ma trận T01–T25? Cung cấp vài dòng thực tế với expected độc lập, không dùng cột tính sẵn chưa xác nhận. | oracle kiểm thử |
| Q10 | P1 | Ai được REVIEWED/APPROVED/LOCKED/PUBLISHED? Có cần người duyệt khác người nhập? Sau khóa chọn reopen hay revision điều chỉnh? | workflow |
| Q11 | P1 | Kỳ toàn công ty hay theo phòng/NV? NV chuyển phòng trong tháng thuộc phạm vi manager nào? | unique period và authorization |
| Q12 | P1 | Một dòng nhiều lỗi có thứ tự ưu tiên trạng thái hiển thị nào? RESOLVED có yêu cầu calculation hợp lệ? NO_ATTENDANCE chặn chốt trong tình huống nào? | trạng thái/chốt |
| Q13 | P1 | Lịch nghỉ/lễ/phép/lịch làm việc và NV vào/nghỉ giữa tháng hiển thị ra sao? Hiện chỉ có quy tắc Ca1/Ca3, chưa có chính sách các ngày này. | ngày trống/UAT |
| Q14 | P1 | Nguồn tài khoản, cấp/reset mật khẩu, phạm vi HR/manager và chính sách đăng nhập? | authentication |
| Q15 | P1 | Cung cấp mẫu PDF/bảng công hiện tại; hiển thị giây, chữ ký, logo, phân trang và quy tắc xác nhận theo revision? | xuất/portal |
| Q16 | P2 | Hạ tầng IT, backup/retention/RPO/RTO, SLA import/tính/export và số người đồng thời? | vận hành/benchmark |
| Q17 | P2 | Phát hành chỉ portal hay có kênh gửi khác? Ai duyệt gửi thật, thời hạn phản hồi, quy trình phản hồi sau phát hành? | phát hành/UAT |

## Cách ghi quyết định
Mỗi câu trả lời phải lưu người xác nhận/ngày/nội dung/ví dụ/phiên bản tài liệu ảnh hưởng.
Thiếu quy tắc → giữ OPEN và chuyển dòng mơ hồ sang NEEDS_REVIEW trong thiết kế; không đặt mặc định nghiệp vụ.
Các mục P0 không ảnh hưởng engine có thể tách scope sau khi HR xác nhận; không coi thời gian chờ là sự đồng ý.
