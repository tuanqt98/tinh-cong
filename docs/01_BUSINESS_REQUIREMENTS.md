# 01 – Yêu cầu nghiệp vụ và audit đầu vào
Ngày: 09/10/2026. Trạng thái: bản phân tích Phase 0, chưa nghiệm thu.

## Nguồn và bằng chứng
Đã đọc toàn bộ Pasted text.txt (UTF-8, 18.256 byte) trong thư mục đính kèm f654a4ef-16dd-4e96-8b32-3d7962e11b58.
Đã kiểm tra đệ quy D:\tinhCong, kể cả tệp ẩn: không có tệp, mã nguồn hoặc .git trước khi tạo tài liệu.
Trong thư mục đính kèm của yêu cầu chỉ có Pasted text.txt. Không tìm thấy SX.xlsx, code Phase 1, mẫu bảng công/PDF tại hai phạm vi đã kiểm tra.
Không kết luận các tệp này không tồn tại ở nơi khác trên máy.

| Đầu vào | Tình trạng | Ảnh hưởng |
|---|---|---|
| Đặc tả | Đã đọc | Là cơ sở tài liệu |
| SX.xlsx | Chưa được cung cấp tại phạm vi kiểm tra | Chưa audit sheet, cột, ngày giờ, số dòng, trùng, ngoại lệ |
| Code Phase 1 | Chưa được cung cấp | Chưa đối chiếu thuật toán/test hiện có |
| Mẫu bảng công/PDF | Chưa có | Chưa xác nhận bố cục và tiêu chí đối chiếu PDF |
| Dữ liệu kỳ vọng HR | Chỉ có ví dụ trong đặc tả | Chưa có đối chiếu thực tế |

## Mục tiêu và phạm vi
Ứng dụng nội bộ cho Công ty TNHH In Nhật Hàn, khoảng 300 nhân viên và định hướng 500–1.000.
Tám module: Dashboard HR, import Excel, bảng công tổng hợp, chi tiết nhân viên, ngoại lệ, chốt kỳ, phát hành/portal, quản lý người dùng.
Mười hai màn hình bắt buộc được mô tả trong 06_UI_UX_SPECIFICATION.md.
Phạm vi hiện tại chỉ audit, thiết kế sơ bộ, kế hoạch, tiêu chí nghiệm thu, tài liệu. Không lập trình hệ thống trong lượt này.

## Luồng nghiệp vụ
Excel → xem trước/kiểm tra → xác nhận import → chuẩn hóa có truy vết → tính công → ngoại lệ → HR kiểm tra → phê duyệt/khóa → phát hành → nhân viên xem/xác nhận/phản hồi.
Nguồn chỉ dùng: mã NV, tên NV, phòng ban, ngày chấm công, giờ vào, giờ ra, tên ca.
Không dùng các cột kết quả cũ để tính công; cũng không coi chúng là kỳ vọng chuẩn nếu HR chưa xác nhận.

## Yêu cầu không chức năng
- Thời gian nghiệp vụ theo Asia/Ho_Chi_Minh, tính bằng số nguyên.
- Truy vết từ kết quả đến dòng nguồn, rule version, engine version và điều chỉnh.
- Quyền truy cập đến từng nhân viên/tệp xuất.
- Chống import trùng, kiểm soát phiên bản, giao dịch khi chốt kỳ.
- Responsive tiếng Việt, tìm kiếm/lọc/phân trang.
- Kiểm thử 300–1.000 nhân viên, backup/restore và UAT; ngưỡng thời gian đáp ứng cần xác nhận.

## Kế hoạch audit SX.xlsx khi được cung cấp
1. Lưu bản gốc chỉ đọc; hash SHA-256, dung lượng, thời điểm tiếp nhận.
2. Liệt kê sheet, vùng dữ liệu, dòng tiêu đề, ô gộp, công thức, dòng tổng, dòng trống.
3. Lập ánh xạ tên cột thực tế vào đúng bảy trường; cột thiếu/không rõ chặn xác nhận.
4. Thống kê Excel date system 1900/1904, serial/text, định dạng dd/MM hay MM/dd, độ chính xác giây, ngày vào/ra.
5. Thống kê theo tháng/phòng ban/ca; đếm thiếu giờ, sai kiểu, trùng chính xác, nhiều dòng NV/ngày, không rõ ca, ca đêm mơ hồ.
6. Đối chiếu mẫu ẩn danh với HR, bao gồm các trường hợp biên. Xuất báo cáo theo sheet và số dòng nguồn.
Hiện mọi thống kê dữ liệu thực tế là CHƯA KIỂM TRA, không phải 0.

## Khả thi và rủi ro
Kiến trúc đề xuất phù hợp về chức năng; khả năng tải là giả thuyết cần benchmark, chưa là kết quả đo.
Rủi ro cao: ngày ca đêm sai → sai công; tái import → cộng trùng; điều chỉnh sau khóa → mất kiểm toán; quyền theo ID → lộ bảng công; dùng kết quả cũ → sai công thức.
Biện pháp: đầu vào rõ ngày, ngoại lệ chặn, idempotency/version, snapshot khóa và kiểm tra quyền backend.
