# 05 – API sơ bộ
REST /api/v1; tài liệu thiết kế, chưa có endpoint chạy. JSON ngày ISO, thời điểm có offset, thời lượng *_seconds integer.

| Endpoint dự kiến | Quyền | Hành vi |
|---|---|---|
| POST /auth/login; POST /auth/logout; GET /auth/me | tài khoản nội bộ | session/token bảo mật, không dùng mã NV làm mật khẩu |
| GET /dashboard | HR/ADMIN; MANAGER theo phạm vi | month/year/department/employee/status |
| GET /employees; GET /employees/:id | HR/ADMIN/MANAGER | tìm kiếm, phân trang, phạm vi backend |
| POST /imports/preview | HR/ADMIN | multipart XLSX; lưu staging, mapping, lỗi, preview_token/hash |
| POST /imports/:id/confirm | HR/ADMIN | preview version + idempotency key; kiểm tra lại tất cả tháng/kỳ |
| GET /imports; GET /imports/:id/source | HR/ADMIN | lịch sử và download có quyền |
| POST /periods/:id/calculate | HR/ADMIN | job id, kiểm tra version/kỳ; chưa giải quyết chính sách tái import |
| GET /attendance | HR/ADMIN/MANAGER scoped | lọc, phân trang, calculation revision |
| GET /exceptions | HR/ADMIN scoped | code/status/month/employee |
| POST /attendance/:id/adjustments | HR/ADMIN theo quyền | before version, correction, reason bắt buộc; giữ raw |
| GET /attendance/:id/history | HR/ADMIN | nguồn/điều chỉnh/tính lại/audit |
| POST /periods/:id/transitions | quyền workflow cần xác nhận | expected_version, target_state, reason |
| GET /timesheets/:id | chủ sở hữu hoặc HR/manager scoped | revision/snapshot; nhân viên chỉ bản được phát hành |
| GET /timesheets/:id/pdf; GET /attendance/export | quyền theo dữ liệu | artifact cùng snapshot, job khi lớn |
| POST /periods/:id/publications | HR/ADMIN theo quyền | chỉ kỳ LOCKED, job idempotent; không gửi thật trong test |
| GET /me/timesheets | EMPLOYEE | employee_id lấy từ session |
| POST /me/publications/:id/view; /confirm; /feedback | EMPLOYEE chủ sở hữu | sự kiện xem, xác nhận hoặc phản hồi có audit |
| GET /shifts; GET /shift-rules | người có quyền | phiên bản và hiệu lực |
| POST /shift-rules | ADMIN hoặc HR được cấp quyền | cần xác nhận quyền; không đổi bản đã dùng |
| GET /audit-logs | ADMIN/HR theo quyền | phân trang, dữ liệu đã giảm nhạy cảm |

## Hợp đồng
Preview trả source sheet/row, đúng bảy trường, error codes, thống kê mỗi tháng, không dùng cột tính sẵn.
Calculation trả presence_seconds, break_seconds, work_seconds, tier100/130/150/210_seconds, late_seconds, early_seconds, status, exception codes, rule/engine/revision.
Đề xuất job API GET /jobs/:id và artifact API GET /artifacts/:id; cả hai kiểm tra quyền của dữ liệu gốc.
Không cho phép client ghi actor_id/employee_id owner/result seconds tùy ý.

## Lỗi và concurrency
400 cấu trúc request sai; 401 chưa xác thực; 403 thiếu quyền; 404 tài nguyên không tồn tại/không được tiết lộ; 409 phiên bản/kỳ/idempotency xung đột; 422 dữ liệu nghiệp vụ chưa đủ; 413 vượt giới hạn upload được cấu hình.
Error body: code, message tiếng Việt, request_id, lỗi từng dòng; không lộ thông tin cá nhân không thuộc phạm vi.
Confirm và mutation yêu cầu expected_version; API kiểm tra quyền, lock và ngoại lệ trong transaction. Xuất file không đi đường tắt bỏ authorization.
