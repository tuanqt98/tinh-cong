# 02 – Quy tắc tính công
Cơ sở: mục 5–7 đặc tả. Công thức dưới đây là chuyển đổi sang số nguyên giây, không bổ sung chính sách công.

## Biểu diễn
Ngày chấm công dùng ngày địa phương Asia/Ho_Chi_Minh. I/O là thời điểm có ngày và múi giờ rõ ràng.
A: vào; B: ra; S: mốc bắt đầu ca; R0/R1: bắt đầu/kết thúc nghỉ.
overlap(A,B,R0,R1) = max(0, min(B,R1) - max(A,R0)).
P = B - A; R = overlap(A,B,R0,R1); W = P - R.
Chỉ áp dụng công thức khi đầu vào hợp lệ và B ≥ A, ngày vào/ra xác định, không có ngoại lệ chặn. B=A cần HR xác nhận cách phân loại.
Không dùng số thực để cộng trừ thời gian; nội bộ integer seconds, một giờ = 3.600 giây. Định dạng h:mm:ss giữ đủ độ chính xác, không làm tròn.
Không nhân hệ số vào W: 100/130/150/210% là các nhóm thời lượng, không phải tổng giờ có trọng số.

## Ca 1
S = D 08:00; nghỉ D 12:00–13:00; mốc đủ công D 17:00.
T100 = min(W, 28.800); T150 = max(W - 28.800, 0); T130=T210=0.
Đi muộn L=max(A-S,0).
Về sớm E=max(28.800 - [(B-S)-overlap(S,B,R0,R1)],0), với B≥S.
B<S, thời lượng bất thường hoặc kéo qua nhiều ngày: NEEDS_REVIEW, chính sách chưa đủ thông tin.
Công thức W tính hiện diện thực tế, không tự cắt phần trước 08:00.

## Ca 3
S = D 22:00; nghỉ D+1 00:00–01:00; mốc đủ công D+1 07:00.
T100=min(W,14.400).
T130=min(max(W-14.400,0),14.400).
T210=max(W-28.800,0); T150=0.
L=max(A-S,0).
E=max(28.800 - [(B-S)-overlap(S,B,R0,R1)],0), với B≥S.
D+1 chỉ mô tả khung ca chính thức. Không vì vậy tự gán ngày ra cho mọi dòng chỉ có giờ.
Ca 3 phân bổ theo thứ tự số giờ thực làm, không theo khung giờ đồng hồ để áp dụng 130%.
Vào sau nửa đêm cần biết ngày ca/ý nghĩa ngày chấm công trước khi tính L.

## Bất biến
- W = T100 + T130 + T150 + T210; các đại lượng không âm cho dữ liệu hợp lệ.
- R chỉ bằng phần giao thực tế, không trừ cố định một giờ.
- L độc lập E; không trừ muộn lần nữa khỏi W.
- Không dùng cột công/tăng ca/muộn/sớm của Excel để tính.
- Không suy ra ngày nghỉ/lễ, ca 2, mức lương, phép hay ngày vắng từ các tỷ lệ trên.

## Ngoại lệ
VALID, NO_ATTENDANCE, MISSING_CHECKIN, MISSING_CHECKOUT, INVALID_SHIFT, DUPLICATE, NEEDS_REVIEW, RESOLVED.
Đề xuất lưu nhiều exception codes trên một dòng, trạng thái xử lý riêng; thứ tự ưu tiên trạng thái hiển thị cần HR xác nhận.
Cả hai giờ trống: NO_ATTENDANCE; không tự quy thành nghỉ không phép.
Thời gian không hợp lệ hoặc ngày ca đêm mơ hồ: NEEDS_REVIEW, không cấp kết quả hợp lệ.
Ngưỡng bất thường, tên ca/alias, chống trùng, nhiều dòng/ngày: chưa chốt chính sách, xem 12_OPEN_QUESTIONS.md.
