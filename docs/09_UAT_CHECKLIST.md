# 09 – Checklist nghiệm thu và kế hoạch Phase
Cập nhật 21/10/2026. Tất cả checkbox chưa đánh dấu; chưa có UAT hoặc nghiệm thu. Ba trạng thái engine readiness, real-data readiness và Phase 0 acceptance độc lập.

| Phase | Điều kiện vào | Công việc theo ưu tiên | Điều kiện ra / bằng chứng |
|---|---|---|---|
| 0 | đặc tả và quyết định nghiệp vụ; SX.xlsx/code nếu có | audit tài liệu/đầu vào; đối chiếu công thức; câu hỏi; thiết kế/kế hoạch | ghi riêng `READY_FOR_ENGINE_DEVELOPMENT`, `READY_FOR_REAL_DATA_VALIDATION`, `PHASE0_ACCEPTED`; Chủ dự án nghiệm thu rõ ràng |
| 1 | Phase0 được Chủ dự án xem xét/cho phép; engine core dùng guard fail-closed; tích hợp thực cần mapping/ngày ca; duplicate key đã duyệt | engine giây; parser; unit tests; `BangCong`/`NgoaiLe` | actual/expected PASS thực sau khi chạy; đối chiếu XLSX; source bất biến, tổng mức=W |
| 2 | engine nghiệm thu, mô hình quyền/kỳ/import xác nhận | schema/migration; auth; import; calculation; correction; API | integration DB thật PASS; quyền/lock/concurrency/idempotency PASS |
| 3 | API sẵn, hợp đồng/error ổn định | login/dashboard/import/nhân viên/bảng công/ngoại lệ/cấu hình | 12 màn hình theo giai đoạn kết nối backend; filter/page/loading/error hoạt động |
| 4 | quyền duyệt/reopen và mẫu PDF đã xác nhận | workflow/snapshot; PDF/Excel; publish/portal/feedback/audit | lock đúng, PDF khớp tổng, NV chỉ thấy mình, retry không trùng; không gửi thật |
| 5 | tất cả module tích hợp, dataset và SLA được duyệt | regression; tải; phát hành; backup/restore; UAT HR | bằng chứng unit/integration/E2E/security/performance/restore và biên bản HR |

Phase3 có 8 màn hình HR chính; phê duyệt/phát hành/portal hoàn thiện ở Phase4, nghiệm thu đủ 12 ở cuối Phase4.
Không ấn định thời gian hoàn thành khi chưa audit tệp/code và biết nguồn lực. Thứ tự phụ thuộc như bảng, không thực hiện song song các Phase bị chặn.

## HR xác nhận
- [ ] Cột/định dạng nguồn chính xác; một dòng được truy về sheet/số dòng.
- [ ] Các ví dụ chính thức và kỳ vọng suy ra được duyệt.
- [ ] DEC-001–DEC-006 được áp dụng đúng; khóa trùng dùng `employeeCode,attendanceDate,shiftName`; tiêu chí ngày ra còn OPEN xử lý fail-closed, không tự mặc định.
- [ ] Import có duplicate bị reject toàn bộ; phân biệt trùng với nhiều dòng; một dòng lưu đủ mọi lỗi.
- [ ] Dashboard KPI khớp dữ liệu có cùng bộ lọc.
- [ ] Chi tiết đủ mọi ngày tháng, phân biệt không chấm công và lỗi.
- [ ] Correction có lý do và giữ raw, audit trước/sau.
- [ ] Không khóa khi ngoại lệ mở; ai duyệt/chốt đúng phân quyền.
- [ ] PDF theo mẫu, tiếng Việt đầy đủ, tổng khớp snapshot/Excel.
- [ ] NV A không thấy B, manager chỉ trong phạm vi.
- [ ] Đã xem/xác nhận/feedback đúng revision.
- [ ] Backup restore có đối chiếu hash/tổng/quyền.
- [ ] Benchmark đủ 300–1.000 NV đạt SLA đã xác nhận.
- [ ] HR ký biên bản, ghi lỗi tồn và quyết định chấp nhận.
Production chỉ là bước riêng sau yêu cầu rõ ràng của người dùng, không thuộc hành động Phase0.
