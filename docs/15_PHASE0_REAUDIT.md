# 15 – Re-audit Phase 0 sau xác nhận nghiệp vụ

Ngày re-audit: 21/10/2026. Múi giờ: `Asia/Ho_Chi_Minh`. Cập nhật quyết định tiếp theo ngày 22/10/2026: khóa trùng DEC-003 đã được duyệt.

## Phạm vi và baseline

Re-audit repository tại commit baseline `2f54fa1` sau khi nhận sáu quyết định của Chủ dự án xác nhận ngày 09/10/2026. Baseline clone không có `15_PHASE0_REAUDIT.md` và `16_PHASE0_REAUDIT_EVIDENCE.json` như mô tả trong yêu cầu mới; vì vậy file 15 này được tạo mới, không phải ghi đè bằng chứng sẵn có. `14_VERIFICATION_REPORT.json` được giữ nguyên.

Phạm vi chỉ gồm tài liệu/readiness. Không có engine/backend/frontend được tạo; không triển khai production; không chuyển Phase tự động.

## Kết quả đối chiếu quyết định

| ID | Q | Kết luận | Đã phản ánh vào thiết kế | Phần còn OPEN |
|---|---|---|---|---|
| DEC-001 | Q03 | `CONFIRMED` | ngày ca lấy theo lịch; tách shift date/check-in/check-out; thiếu căn cứ → review | nguồn lịch, tiêu chí mapping tin cậy |
| DEC-002 | Q04 | `PARTIALLY_CONFIRMED` | có thể D+1 khi hợp lịch 22:00–07:00; lưu evidence; không +1 vô điều kiện | tiêu chí suy ngày, ưu tiên evidence, ca ngắn/mâu thuẫn |
| DEC-003 | Q05 | `PARTIALLY_CONFIRMED; KEY CONFIRMED` | khóa `employeeCode,attendanceDate,shiftName`; reject toàn import có duplicate; không merge/overwrite/replace; audit hai loại trùng | quy trình file sửa, file nhiều kỳ |
| DEC-004 | Q06 | `CONFIRMED` | giữ từng raw, nhóm theo NV/shift date, không cộng/ghép/tổng hợp | thao tác HR sau xác nhận nhiều lượt |
| DEC-005 | Q08 | `CONFIRMED` | A=B, âm có căn cứ, >16h cấu hình → review; không tự sửa | quản trị cấu hình, taxonomy chi tiết |
| DEC-006 | Q12 | `CONFIRMED` | lưu nhiều lỗi; lỗi chặn ngăn chốt; resolution cần revalidation | danh mục blocking, quyền/thứ tự hiển thị |

Không quyết định nào bị diễn giải thành quyền tự suy quy tắc còn thiếu.

## Rà soát công thức đã xác nhận

- Ca 1: bắt đầu 08:00; nghỉ 12:00–13:00; 8 giờ đầu 100%; sau 8 giờ 150%; đủ 8 giờ lúc 17:00.
- Ca 3: bắt đầu 22:00; nghỉ 00:00–01:00; 4 giờ đầu 100%; 4 giờ tiếp 130%; sau 8 giờ 210%; đủ 8 giờ lúc 07:00 hôm sau.
- Đi muộn/về sớm độc lập; thời gian công dựa trên vào/ra thực tế và chỉ trừ phần giao giờ nghỉ.
- Nội bộ số nguyên giây; không làm tròn, không nhân hệ số vào duration.

Kết luận: không có thay đổi công thức trong đợt cập nhật này.

## Rà soát 25 test và bổ sung

- T01–T25 được giữ ID và rà lại expected/căn cứ. T11, T16, T17 và T19 được làm rõ theo quyết định mới.
- Thêm T26–T35 bao phủ đủ 10 tình huống yêu cầu: vào Ca 3 sau 00:00; thiếu căn cứ ngày ra; hai loại duplicate; file sửa một dòng; hai dòng NV/ngày; A=B; >16 giờ; nhiều lỗi; chặn chốt.
- Tất cả 35 test là `NOT_RUN`. Không có engine/môi trường/SX.xlsx, do đó không có PASS/FAIL thực thi.

## OPEN và blocker

### OPEN ảnh hưởng hoàn tất Phase 1

1. Alias/mapping Ca 1/Ca 3 và tình trạng Ca 2 trong dữ liệu thực.
2. Hợp đồng lịch phân công và tiêu chí tin cậy để xác định ngày ca/ngày ra.
3. Hành vi file sửa/file nhiều kỳ; duplicate key đã được duyệt ngày 22/10/2026.
4. Schema/output contract cụ thể của `BangCong` và `NgoaiLe`.

Các mục này không ngăn xây engine công thức độc lập với fixture chuẩn; chúng ngăn hoàn tất parser/import thực tế. Phải giữ fail-closed trong thời gian chờ.

### OPEN ảnh hưởng kiểm chứng dữ liệu thực

1. Thiếu SX.xlsx và quyền/phạm vi xử lý.
2. Thiếu lịch/mapping tương ứng.
3. Thiếu expected độc lập do HR duyệt cho T01–T35/dòng mẫu thực.
4. Chưa xác nhận có/không code Phase 1 ở nguồn khác.

### Có thể hoãn Phase sau

Nghỉ phép, ngày lễ, nghỉ bù, lương/khấu trừ, PDF/phát hành phiếu công, portal, phê duyệt nhiều cấp, authentication, phạm vi manager, hạ tầng/backup/SLA và quy trình phản hồi.

## Đánh giá readiness

### `READY_FOR_ENGINE_DEVELOPMENT`

**YES_WITH_GUARDRAILS.** Đủ quy tắc để viết và unit test engine công thức Ca 1/Ca 3, phân bổ mức, L/E, trừ phần giao nghỉ, validation bất thường, thu thập nhiều lỗi và nhóm nhiều dòng bằng fixture mẫu. Mọi input thiếu căn cứ phải trả ngoại lệ, không tự suy diễn. Điều này không phải quyền bắt đầu Phase 1; vẫn cần lệnh của Chủ dự án.

### `READY_FOR_REAL_DATA_VALIDATION`

**PARTIAL.** Đã có SX.xlsx và duplicate key; còn thiếu lịch/mapping, expected HR và UAT để đối chiếu kết quả thực.

### `PHASE0_ACCEPTED`

**NO_AWAITING_PROJECT_OWNER_ACCEPTANCE.** Tài liệu đã cập nhật nhưng chưa có tuyên bố nghiệm thu của Chủ dự án. Không tự coi readiness của engine là acceptance Phase 0.

## Bằng chứng kiểm tra tài liệu

Bằng chứng cũ `14_VERIFICATION_REPORT.json` không bị sửa. Sau khi hoàn tất chỉnh sửa, inventory, hash, kiểm tra UTF-8, số test và tìm kiếm trạng thái/mâu thuẫn được ghi vào một file evidence mới có timestamp. Bằng chứng đó chỉ chứng minh trạng thái tài liệu, không chứng minh phần mềm hoặc nghiệp vụ trên dữ liệu thật.

## Kết luận

Trạng thái `BLOCKED` chung trước đây được tách chính xác hơn:

- Không còn chặn nghiệp vụ để **thiết kế/viết engine cốt lõi** theo guard đã nêu.
- Vẫn **blocked cho parser/import hoàn chỉnh và real-data validation** ở các đầu vào OPEN.
- Phase 0 **chưa accepted** và Phase 1 **chưa được tự động bắt đầu**.
