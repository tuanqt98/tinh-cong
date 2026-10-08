# Hướng dẫn tiếp tục dự án chấm công In Nhật Hàn

## Phạm vi và trạng thái
- Yêu cầu gốc: đặc tả người dùng ngày 09/10/2026, bản lưu tại docs/00_SOURCE_REQUIREMENTS.txt.
- Hiện chỉ làm Phase 0 – Audit & Planning. Chưa được triển khai Phase 1.
- Đọc docs/13_PROGRESS_REPORT.md và docs/12_OPEN_QUESTIONS.md trước khi làm việc.
- Phase 0 chưa đủ đầu vào: thiếu SX.xlsx; chưa được cung cấp code Phase 1 và mẫu PDF.
- Không tuyên bố hoàn thành Phase 0 hoặc kiểm thử đạt khi chưa có bằng chứng.

## Quy tắc bắt buộc
- Giữ nguyên công thức trong docs/02_ATTENDANCE_RULES.md. Không làm tròn, cắt giờ, tự cộng thời gian hoặc suy diễn ca.
- Chỉ bảy trường nguồn được dùng làm đầu vào tính công. Không dùng Công, Giờ, TC1/2/3, Ký hiệu, Vào trễ, Ra sớm.
- Dữ liệu nguồn bất biến. Điều chỉnh là bản ghi mới có lý do, người thực hiện, thời gian, trước/sau.
- Dùng số nguyên giây; phép tính hệ số lương không thay đổi số giây từng mức.
- Không suy ra ngày ra ca đêm từ giờ ra nhỏ hơn giờ vào khi quy tắc chưa được xác nhận.
- Không chốt kỳ có ngoại lệ chưa giải quyết; không sửa trực tiếp kỳ LOCKED/PUBLISHED.
- Phân quyền ở backend theo vai trò và phạm vi nhân viên; mã NV không phải thông tin xác thực.
- Không triển khai production; không gửi dữ liệu cho nhân viên thật trong môi trường thử nghiệm.
- Không ghi thông tin cá nhân vào log, tài liệu hoặc dịch vụ bên ngoài.
- Không thay đổi kiến trúc sang Apps Script/Sheets nếu chưa có so sánh và xác nhận.

## Cách làm việc
1. Kiểm tra repository, hướng dẫn hiện hành và tất cả tệp được cung cấp; đánh giá code trước khi sửa.
2. Ghi nhận bằng chứng: đường dẫn, hash tệp, phạm vi audit, lệnh kiểm tra, kết quả thực tế.
3. Phân biệt quy tắc đã cung cấp, đề xuất thiết kế và vấn đề cần HR xác nhận.
4. Khi nhận SX.xlsx: đọc an toàn, không chạy macro; lưu bản nguồn và hash; thống kê từng sheet/cột/kiểu ngày giờ/trùng/ngoại lệ; không ghi dữ liệu nhận dạng vào báo cáo.
5. Chỉ bắt đầu Phase 1 sau khi đủ điều kiện đầu vào và người dùng đã xem xét/cho phép.
6. Kiểm thử engine với kỳ vọng xác nhận; có test tính độc lập đi muộn/về sớm, nghỉ giao một phần, ca đêm, tổng phân bổ và bất biến nguồn.
7. Chạy kiểm tra phù hợp từng Phase. Không viết PASS cho test chưa chạy; ghi NOT_RUN/BLOCKED và nguyên nhân.
8. Sau mỗi Phase báo cáo file thay đổi, test/lệnh/kết quả, lỗi, rủi ro, công việc tiếp theo, điều kiện nghiệm thu.
9. Nếu đầu vào thiếu, làm phần độc lập có thể làm và ghi rõ phần bị chặn; không dùng dữ liệu giả để thay bằng chứng thực tế.
