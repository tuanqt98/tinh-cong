# 08 – Ma trận kiểm thử và đối chiếu
Trạng thái TẤT CẢ ca dưới đây: NOT_RUN. Chưa có engine, XLSX hoặc môi trường test.
Kỳ vọng số tính bằng phút ở bảng để dễ đọc; test nội bộ giây nguyên. D là ngày ca, ca đêm ra D+1 ghi tường minh.
Cột T là (100%,130%,150%,210%). “Theo công thức” là kỳ vọng suy ra từ đặc tả, cần HR duyệt, không phải kết quả chạy.

| ID | Tình huống | Kỳ vọng | Căn cứ / Phase |
|---|---|---|---|
| T01 | Ca1 08:00–17:00 | W480; T(480,0,0,0); L0 E0 | ví dụ chính thức / 1 |
| T02 | Ca1 08:30–17:00 | W450; T(450,0,0,0); L30 E0 | công thức; L/E ví dụ chính thức / 1 |
| T03 | Ca1 08:00–16:30 | W450; T(450,0,0,0); L0 E30 | theo công thức / 1 |
| T04 | Ca1 08:30–18:00 | W510; T(480,0,30,0); L30 E0 | ví dụ chính thức / 1 |
| T05 | Ca1 08:00–11:00 | R0 W180; T(180,0,0,0); E300 | theo công thức / 1 |
| T06 | Ca1 08:00–12:30 | R30 W240; T(240,0,0,0); E240 | theo công thức / 1 |
| T07 | Ca3 D22:00–D+1 07:00 | W480; T(240,240,0,0); L0 E0 | ví dụ chính thức / 1 |
| T08 | Ca3 D22:15–D+1 07:00 | W465; T(240,225,0,0); L15 E0 | theo công thức / 1 |
| T09 | Ca3 D22:15–D+1 06:30 | W435; T(240,195,0,0); L15 E30 | L/E ví dụ chính thức / 1 |
| T10 | Ca3 D22:00–D+1 09:00 | W600; T(240,240,0,120) | ví dụ chính thức / 1 |
| T11 | Ca3 chỉ giờ 22:00/07:00, chưa rõ ngày ra | NEEDS_REVIEW, không tự cộng ngày | quy tắc nguồn / 1 |
| T12 | Ca3 D22:00–D+1 00:30 | R30 W120; T(120,0,0,0); E360 | theo công thức / 1 |
| T13 | Thiếu vào, có ra | MISSING_CHECKIN; không kết quả hợp lệ | đặc tả / 1 |
| T14 | Có vào, thiếu ra | MISSING_CHECKOUT | đặc tả / 1 |
| T15 | Tên ca không xác định | INVALID_SHIFT, không tự gán | đặc tả / 1 |
| T16 | Trùng dòng/chồng NV ngày | DUPLICATE hoặc NEEDS_REVIEW; không cộng đôi | chính sách Q05/Q06 / 1–2 |
| T17 | Giờ 25:61, ngày sai, B<A rõ ngày | NEEDS_REVIEW, chặn | đặc tả / 1 |
| T18 | NV không có dữ liệu một ngày | NO_ATTENDANCE; hiển thị ngày, không quy nghỉ | đặc tả / 1,3 |
| T19 | Import lại cùng file/tháng | không tăng tổng do trùng; raw/history được giữ | chính sách Q05 / 2 |
| T20 | Correction 08:30→08:00, ra17:00 | W450→480, raw không đổi, revision mới, lý do/actor | theo công thức / 1–2 |
| T21 | Mọi kết quả hợp lệ | tổng bốn mức=W, R bằng giao, không âm | bất biến / 1 |
| T22 | NV A yêu cầu bảng/PDF/job của B | bị từ chối backend, không lộ dữ liệu | đặc tả / 2,4 |
| T23 | Correction/import/calculate vào kỳ LOCKED | bị từ chối; race không xuyên lock | đặc tả / 2,4 |
| T24 | Xem lịch sử sau correction | trước/sau, actor, thời gian, lý do, đủ liên kết nguồn | đặc tả / 2,4 |
| T25 | Xuất PDF, cộng từng dòng | từng mức/tổng khớp snapshot và Excel, Unicode đúng | mẫu PDF chưa có / 4 |

## Ca bổ sung để loại lỗi biên
- Ca1 vào12:30 ra17:00: R30 W240; E0; L270 theo công thức (HR duyệt).
- Ca3 vào D+1 00:30: chỉ tính khi D và ngày vào xác minh; kiểm tra nghỉ giao phần.
- Ra đúng đầu/cuối nghỉ, thời lượng chỉ nằm trong nghỉ, vào trước mốc: không cắt ngầm.
- Dữ liệu có giây: bảo toàn từng giây; input 08:00:01 không làm tròn.
- Excel serial 1900/1904, text nhập nhằng, mã NV có số 0 đầu, sheet nhiều tiêu đề/ô gộp.
- Một dòng đồng thời thiếu giờ và sai ca: giữ nhiều exception codes.
- Kỳ đã khóa trong file nhiều tháng; confirm token cũ; worker job cũ; rule mới không đổi snapshot cũ.
- Tải file nguồn/export/PDF cũng phải kiểm tra quyền; manager ngoài phạm vi bị từ chối.
- Retry job/publication và gọi song song không tạo artifact/bảng công trùng.

## Cách thu bằng chứng theo Phase
Phase1: unit test engine + parser fixtures + đối chiếu SX.xlsx ẩn danh với expected HR, báo cáo actual/expected.
Phase2: integration PostgreSQL thật, migration, unique/FK/check, idempotency và race/authorization.
Phase3–4: E2E browser với API/DB thật, nhân viên A/B/manager/HR, snapshot PDF/Excel.
Phase5: benchmark 300/500/1.000 NV với số ngày/dòng được ghi rõ; backup/restore và UAT.
Báo cáo lưu command, môi trường/version, dataset hash, số tests PASS/FAIL/SKIP, lỗi và artifacts. Fixture tổng hợp chỉ chứng minh test mẫu, không chứng minh dữ liệu thực.
