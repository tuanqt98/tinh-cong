# 09 – Checklist nghiệm thu và kế hoạch Phase
Tất cả checkbox chưa đánh dấu; chưa có UAT hoặc nghiệm thu.

| Phase | Điều kiện vào | Công việc theo ưu tiên | Điều kiện ra / bằng chứng |
|---|---|---|---|
| 0 | đặc tả, SX.xlsx, code hiện có nếu có | P0 audit tệp/ngày/cột; đối chiếu công thức; câu hỏi; P1 thiết kế/kế hoạch | audit đủ đầu vào, HR xác nhận câu hỏi chặn, duyệt ma trận expected, review tài liệu |
| 1 | Phase0 được xem xét; người dùng cho phép; mapping/ngày ca/chống trùng đủ rõ | engine giây; parser; unit tests; report công/ngoại lệ | ví dụ và expected xác nhận PASS thực; đối chiếu XLSX; source bất biến, tổng mức=W |
| 2 | engine nghiệm thu, mô hình quyền/kỳ/import xác nhận | schema/migration; auth; import; calculation; correction; API | integration DB thật PASS; quyền/lock/concurrency/idempotency PASS |
| 3 | API sẵn, hợp đồng/error ổn định | login/dashboard/import/nhân viên/bảng công/ngoại lệ/cấu hình | 12 màn hình theo giai đoạn kết nối backend; filter/page/loading/error hoạt động |
| 4 | quyền duyệt/reopen và mẫu PDF đã xác nhận | workflow/snapshot; PDF/Excel; publish/portal/feedback/audit | lock đúng, PDF khớp tổng, NV chỉ thấy mình, retry không trùng; không gửi thật |
| 5 | tất cả module tích hợp, dataset và SLA được duyệt | regression; tải; phát hành; backup/restore; UAT HR | bằng chứng unit/integration/E2E/security/performance/restore và biên bản HR |

Phase3 có 8 màn hình HR chính; phê duyệt/phát hành/portal hoàn thiện ở Phase4, nghiệm thu đủ 12 ở cuối Phase4.
Không ấn định thời gian hoàn thành khi chưa audit tệp/code và biết nguồn lực. Thứ tự phụ thuộc như bảng, không thực hiện song song các Phase bị chặn.

## HR xác nhận
- [ ] Cột/định dạng nguồn chính xác; một dòng được truy về sheet/số dòng.
- [ ] Các ví dụ chính thức và kỳ vọng suy ra được duyệt.
- [ ] Ngày vào/ra ca đêm, nhiều dòng/ngày, tái import, ngưỡng bất thường đã rõ.
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
