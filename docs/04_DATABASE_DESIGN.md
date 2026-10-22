# 04 – Thiết kế dữ liệu sơ bộ

Cập nhật ngày 21/10/2026 theo DEC-001–DEC-006. Đây là mô hình logic đề xuất; chưa có schema/migration và chưa kiểm thử DB.

Nguyên tắc: ID UUID; nguồn/audit append-only; cấm cascade delete dữ liệu chấm công; timestamp dùng `TIMESTAMPTZ`, ngày ca dùng `DATE`, thời lượng dùng số nguyên giây. Các tên trường là đề xuất kỹ thuật, không phải xác nhận mapping SX.xlsx.

## Bảng lõi và phạm vi Phase 1

| Bảng | Trường/quan hệ chính | Ràng buộc/index dự kiến |
|---|---|---|
| `departments` | id, code, name | unique(code) |
| `employees` | id, code, name, department_id, active | unique(code); index(department_id,active) |
| `shifts` | id, code, name, active | unique(code); alias chỉ dùng khi được duyệt |
| `shift_rules` | id, shift_id, version, effective_from/to, timezone, start, break, tiers | unique(shift_id,version); không sửa version đã dùng |
| `work_schedules` (đề xuất) | id, employee_id, shift_id, shift_date, source/reference, version | index(employee_id,shift_date); uniqueness còn OPEN theo nguồn lịch |
| `attendance_imports` | id, sha256, mapping_version, status, attempted_by, attempted_at, rejection_reason | index(sha256,status); trạng thái gồm PREVIEW/ACCEPTED/REJECTED |
| `attendance_import_issues` (bổ sung) | id, import_id, sheet, row_no, issue_code, match_scope, evidence | index(import_id,issue_code); dùng cho lỗi/trùng trước commit |
| `attendance_raw` | id, import_id, sheet, row_no, raw_cells, source_identity_hash | unique(import_id,sheet,row_no); bất biến; chỉ tạo khi import được chấp nhận |
| `attendance_normalizations` (bổ sung) | id, raw_id, revision, shift_date, check_in_at, check_out_at, evidence_type/reference, rule_version | unique(raw_id,revision); tách ngày ca khỏi timestamp thực tế |
| `attendance_calculations` | id, raw_id, normalization_id, rule_id, engine_version, revision, input_hash, worked/break/late/early/tier seconds, status | unique(raw_id,revision); CHECK không âm và tier sum=W chỉ khi VALID |
| `attendance_exceptions` | id, raw_id nullable, import_issue_id nullable, calculation_id nullable, code, blocking, status, details | unique theo entity/code/revision phù hợp; index(status,blocking,code) |
| `exception_resolutions` (bổ sung) | id, exception_id, action, before/after, reason, actor_id, created_at | append-only; RESOLVED không tự đổi calculation thành VALID |
| `attendance_adjustments` | id, raw_id, revision, before/after, reason, actor_id, created_at | unique(raw_id,revision); append-only, dùng ở Phase sau nếu được phép |
| `audit_logs` | id, actor_id nullable, action, entity/id, before/after, reason, request_id, created_at | append-only; index(entity,id,created_at) |

## Bảng định hướng Phase sau

`users`, `roles`, `user_roles`, `manager_scopes`, `attendance_periods`, `attendance_approvals`, `timesheets`, `timesheet_lines`, `timesheet_publications`, `employee_feedback`. Các bảng này giữ trong kiến trúc tổng thể nhưng không được kéo authentication, phê duyệt nhiều cấp, PDF/portal hoặc phát hành vào engine Phase 1.

## Ngày ca và timestamp (DEC-001, DEC-002)

- `shift_date` là ngày bắt đầu ca theo lịch; không suy trực tiếp từ `DATE(check_in_at)`.
- `check_in_at` và `check_out_at` giữ ngày/giờ thực tế sau chuẩn hóa; raw value vẫn ở `attendance_raw`.
- Mỗi normalization lưu `evidence_type`, `evidence_reference` và rule/mapping version đã dùng để xác định ngày ca/ngày ra.
- Nếu thiếu căn cứ, normalization có thể lưu null ở trường chưa xác định và tạo exception blocking; không tạo calculation VALID.
- Không có trigger/quy tắc DB mặc định “checkout time < checkin time thì +1 ngày”.

Tiêu chí suy ngày ra chi tiết còn `OPEN`; schema phải lưu được bằng chứng và trạng thái chưa xác định mà không ép dữ liệu giả.

## Import nguyên tử và trùng (DEC-003)

Luồng dữ liệu đề xuất tách staging/preview khỏi raw đã nhận:

1. Tạo `attendance_imports` và dữ liệu staging tạm/transaction-scoped.
2. Kiểm tra trùng trong file (`WITHIN_FILE`) và với raw đã lưu (`STORED_DATA`); lưu dòng/lý do trong `attendance_import_issues` hoặc audit an toàn.
3. Có trùng → đặt import `REJECTED`, rollback toàn bộ raw/normalization/calculation của lần đó. Chỉ metadata attempt và issue/audit được giữ.
4. Không trùng và mọi điều kiện confirm đạt → commit toàn bộ raw trong một transaction.

`sha256`/idempotency key chỉ chống request/file lặp; không đủ thay khóa trùng nghiệp vụ. `source_identity_hash` là SHA-256 của bộ giá trị chuẩn hóa theo `employeeCode,attendanceDate,shiftName`, đã được duyệt ngày 22/10/2026. File đổi một dòng không được đánh dấu active replacement tự động.

## Nhiều dòng cùng nhân viên/ngày ca (DEC-004)

- Không đặt unique `(employee_id, shift_date)` trên raw/normalization vì phải giữ nhiều dòng và bằng chứng.
- Sau khi xác định được `shift_date`, phát hiện nhóm `(employee_code/employee_id, shift_date)` có nhiều dòng.
- Không tự kết luận duplicate; duplicate dùng detector riêng. Nhóm nhiều lượt tạo exception `MULTIPLE_ROWS_SAME_EMPLOYEE_SHIFT_DATE`.
- Không tạo/cộng tổng hợp hợp lệ cho nhóm tới khi HR xác nhận. Thiết kế hành động HR (select/merge/separate) thuộc Phase sau và phải tạo revision, không sửa raw.

## Bất thường và nhiều lỗi (DEC-005, DEC-006)

- Ngưỡng thời lượng mặc định 57.600 giây (16 giờ) phải nằm trong cấu hình/version rule, không hard-code rải rác.
- Một raw/calculation liên kết được nhiều dòng `attendance_exceptions`; không có cột error duy nhất ghi đè lỗi trước.
- Mỗi exception có `blocking` version hóa. Dòng/kỳ không được chốt khi tồn tại exception blocking chưa xử lý.
- `exception_resolutions` ghi đầy đủ hành động. Sau resolution, tạo normalization/calculation revision mới và chạy validation; chỉ revision thành công mới `VALID`.
- `A=B`, âm sau chuẩn hóa tin cậy và > ngưỡng tạo exception riêng. Thiếu timestamp tạo mã chưa xác định, không tạo `NEGATIVE_DURATION` giả.

## Ràng buộc và nghiệm thu thiết kế

- CHECK thời lượng không âm và tổng tier bằng worked seconds chỉ áp dụng cho calculation VALID.
- FK/index/check, transaction rollback và cơ chế cấm UPDATE/DELETE raw/audit phải được kiểm thử trên DB thật ở Phase triển khai.
- Test bắt buộc: rollback import có một dòng trùng, hai loại trùng, nhiều lỗi trên một raw, `RESOLVED` nhưng recalc fail, nhóm nhiều dòng không lọt vào tổng, normalization thiếu bằng chứng và cạnh tranh confirm import.
- Mọi uniqueness kỳ/phòng ban, workflow khóa/phát hành và retention vẫn cần quyết định Phase sau.

Chưa có kiểm tra DB nào được chạy; không có kết quả PASS.
