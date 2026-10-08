# 11 – Bảo mật và kiểm toán
Thiết kế đề xuất, chưa có security test thực thi.

## Xác thực và quyền
Tài khoản nội bộ, mật khẩu hash mạnh qua thư viện được duy trì; mã NV chỉ là định danh.
Session cookie HttpOnly/Secure/SameSite và CSRF nếu chọn cookie; giới hạn login và thu hồi session khi khóa user.
Quyền backend cho mọi API, job, source file, PDF/Excel; EMPLOYEE employee_id từ tài khoản, không từ client.
MANAGER phải có phạm vi được cấu hình; HR quyền duyệt/chốt chưa đủ rõ; ADMIN không được sửa raw bỏ audit.
Không đưa password/hash/token vào DTO hoặc log.
Chọn cơ chế session, timeout, reset/khôi phục và MFA với IT ở Phase2.

## Dữ liệu và file
Nguồn bất biến, storage private, tải file có authorization mỗi lần; không URL công khai dài hạn.
Upload kiểm tra loại thực/kích thước/sheet/zip decompression limit; không thực thi macro hoặc công thức Excel.
Xuất XLSX/text phải ngăn formula injection từ tên/phòng/feedback; giữ giá trị nguồn riêng để audit.
PDF có font tiếng Việt và từ snapshot, không lấy HTML không tin cậy; tránh tải tài nguyên ngoài khi render.
Ẩn danh dữ liệu test: map mã/tên/phòng khi cần, giữ cấu trúc ngày/giờ và lỗi để kiểm tra.

## Audit
Mỗi mutation: actor từ session, timestamp, action/entity, request_id, reason, before/after hoặc hash/reference, revision.
Raw/audit append-only; giới hạn quyền DB sửa/xóa, cấu hình retention chưa chốt.
Một request phải truy từ file SHA-256/sheet/row → normalization/rule/engine → adjustment → calculation → locked snapshot → publication → feedback.
Không log toàn bộ file hay nội dung PII thường xuyên; audit chi tiết được giới hạn quyền riêng.

## Rủi ro và test cần chạy
- IDOR: thử đổi employee/timesheet/artifact/job ID bằng user khác.
- Race lock: adjustment/import/calculate concurrent với khóa.
- Replay: confirm/publication retry, idempotency xung đột.
- File độc hại: oversized/zip bomb/formula injection, PDF Unicode.
- Audit bị mất: transaction rollback phải không tạo kết quả thiếu liên kết.
- Secret leak: inspect response/log/export trong môi trường thử nghiệm.
Đây là kiểm soát kỹ thuật đề xuất, không kết luận tuân thủ pháp lý; yêu cầu retention/phê duyệt xử lý PII cần phía công ty xác nhận.
