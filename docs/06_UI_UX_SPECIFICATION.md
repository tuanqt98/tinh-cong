# 06 – UI/UX
Thiết kế sơ bộ tiếng Việt, sidebar trái, header trên, KPI cards, bộ lọc rõ, bảng dễ đọc, responsive desktop/tablet/mobile.

| Màn hình | Nội dung và hành vi bắt buộc |
|---|---|
| 1. Đăng nhập | tài khoản nội bộ, lỗi rõ, không tiết lộ tài khoản tồn tại |
| 2. Dashboard | bảy KPI: NV, dòng, NV đã tính, ngoại lệ, đã chốt, đã xem, phản hồi mở; lọc tháng/năm/phòng/NV/trạng thái |
| 3. Import Excel | upload, mapping cột, preview, lỗi theo sheet/dòng, xác nhận riêng, lịch sử/tải nguồn |
| 4. Nhân viên | mã, tên, phòng ban, trạng thái, tìm/lọc/phân trang |
| 5. Bảng công tổng hợp | mã NV, tên, phòng, ca, ngày, vào/ra, công, muộn/sớm, bốn mức, trạng thái; xuất Excel |
| 6. Chi tiết NV | toàn bộ ngày tháng kể cả NO_ATTENDANCE; tổng từng mức, số lần/thời gian muộn/sớm; PDF |
| 7. Ngoại lệ | nguyên nhân, nguồn, correction riêng, lý do bắt buộc, kết quả tính lại, lịch sử |
| 8. Phê duyệt/chốt | trạng thái, ngoại lệ chặn, người/phạm vi duyệt, version, xác nhận khóa |
| 9. Phát hành | revision khóa, job PDF từng người/hàng loạt, lỗi/retry, thống kê phát hành |
| 10. Portal NV | chỉ bảng của mình đã phát hành, xem, xác nhận, phản hồi gắn revision |
| 11. Cấu hình ca | Ca 1/Ca 3, mốc/nghỉ/tier, hiệu lực/rule version, alias/ngưỡng được duyệt |
| 12. Lịch sử | actor, lúc sửa, lý do, trước/sau, rule/import/calculation version |

## Trạng thái UI
Loading, rỗng, lỗi API, thiếu quyền, phiên bản thay đổi, kỳ khóa phải có thông báo.
Không hiển thị 0 giờ cho dòng không tính được: dùng “Chưa tính – cần kiểm tra”.
Ngoại lệ có chữ và biểu tượng kèm màu, không dùng màu đơn độc.
Thời lượng h:mm:ss hoặc phút/giây đầy đủ; không làm tròn kết quả. Nhãn ngày ra hiển thị rõ ngày khi qua đêm.
Ngày trống không suy thành nghỉ không phép; phần tổng loại dòng chưa hợp lệ phải nói rõ và chặn chốt.
Mobile: bộ lọc thu gọn, bảng cuộn ngang/chi tiết từng dòng; thao tác bàn phím và nhãn input.
Các nút mutation bám trạng thái backend; disable UI không thay kiểm tra quyền backend.
Mẫu PDF chưa cung cấp, chưa chốt layout; không dùng bảng giả để nghiệm thu chức năng.
