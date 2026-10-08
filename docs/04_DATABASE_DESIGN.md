# 04 – Database sơ bộ
Đây là mô hình logic đề xuất, chưa có Prisma schema hay migration đã chạy.
ID dùng UUID; FK bắt buộc nơi có quan hệ, cấm cascade delete dữ liệu chấm công/audit; nhân viên ngừng làm việc chuyển inactive.

| Bảng | Trường/quan hệ chính | Ràng buộc/index dự kiến |
|---|---|---|
| departments | id, code, name | unique(code) |
| employees | id, code, name, department_id FK, active | unique(code); index(department_id,active) |
| users | id, login, password_hash, employee_id FK nullable, active | unique(login), unique(employee_id) nếu portal 1:1 |
| roles | id, code | unique(code): ADMIN/HR/MANAGER/EMPLOYEE |
| user_roles (bổ sung) | user_id FK, role_id FK | PK kép |
| manager_scopes (bổ sung) | user_id FK, department_id/employee_id FK | quyền phạm vi; lịch sử hiệu lực cần xác nhận |
| shifts | id, code, name, active | unique(code); alias có cấu hình duyệt |
| shift_rules | id, shift_id FK, version, effective_from/to, start, break, tiers, timezone | unique(shift_id,version); không sửa bản đã dùng |
| attendance_imports | id, file_key, sha256, mapping_version, status, imported_by FK, confirmed_at | index(sha256,status); idempotency key unique |
| attendance_raw | id, import_id FK, sheet, row_no, raw_cells, source_identity_hash | unique(import_id,sheet,row_no); bất biến |
| attendance_periods | id, month, year, status, version, timezone | unique(year,month) theo mô hình kỳ toàn công ty đề xuất |
| attendance_adjustments | id, raw_id FK, revision, before/after, reason, actor_id FK, created_at | unique(raw_id,revision); append-only |
| attendance_calculations | id, raw_id FK, period_id FK, adjustment_id FK nullable, rule_id FK, engine_version, revision, input_hash, seconds các mức | unique(raw_id,revision); index(period_id); CHECK không âm và tổng mức=W |
| attendance_exceptions | id, raw_id FK, calculation_id FK nullable, code, status, resolved_by FK, reason | index(status,code), index(raw_id) |
| attendance_approvals | id, period_id FK, from/to, actor_id FK, reason, period_version, created_at | index(period_id,created_at) |
| timesheets | id, period_id FK, employee_id FK, revision, snapshot, total_seconds, locked_at | unique(period_id,employee_id,revision) |
| timesheet_publications | id, timesheet_id FK, artifact_key, sha256, status, published_by FK, published_at | unique(timesheet_id) cho một publication idempotent mỗi revision |
| employee_feedback | id, publication_id FK, employee_id FK, type, body, status, viewed/confirmed_at | index(employee_id,status); kiểm tra chủ sở hữu ở backend |
| audit_logs | id, actor_id FK nullable, action, entity/id, before/after, reason, request_id, created_at | index(entity,id,created_at); append-only |

## Chi tiết cần chốt
- Raw chứa đúng ô gốc và bảy trường trích xuất chưa hiệu chỉnh; giá trị chuẩn hóa/correction lưu riêng có version.
- Unique NV/ngày không được đặt trên raw vì phải giữ nhiều dòng và trùng để audit.
- Nên có bảng liên kết import-period vì một file nhiều tháng; thêm import_versions/active source revision sau xác nhận Q05.
- Đề xuất timesheet_lines liên kết snapshot với calculation revision; tổng tính từ từng dòng, không đọc calculation mới khi tải PDF cũ.
- Ngày làm việc PostgreSQL DATE; thời điểm vào/ra và audit TIMESTAMPTZ; lưu timezone=Asia/Ho_Chi_Minh riêng, hiển thị cùng múi giờ.
- Seconds INTEGER/BIGINT phù hợp dung lượng, không dùng FLOAT cho thời lượng. CHECK tier sum chỉ áp dụng khi kết quả hợp lệ.
- Quy tắc uniqueness theo tháng/phòng ban, snapshot ngày không có chấm công, lịch sử phòng ban cần HR xác nhận.
- Migration Phase 2 phải có FK/index/check và cơ chế chặn UPDATE/DELETE raw/audit, chặn thay đổi kỳ đã khóa tại service và DB thích hợp.
- Snapshot bám rule/import/correction versions; giới hạn retention và chính sách hủy chưa xác định.

## Nghiệm thu thiết kế
ERD/migration cuối phải đối chiếu tất cả bảng trên, rollback trên DB thử nghiệm, thử duplicate/FK/check/transaction race và quyền đọc. Chưa có kiểm tra DB nào được chạy.
