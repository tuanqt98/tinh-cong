# 02 – Quy tắc tính công và kiểm soát ngoại lệ

Cập nhật ngày 24/10/2026 theo DEC-001–DEC-010. DEC-008 thay khung Ca 3 thành 19:00–07:00; DEC-009 thay khung Ca 1 thành 07:00–19:00; DEC-010 bổ sung mức Chủ nhật 200%/230%. Cả hai ca chỉ ghi nhận phần sau mốc kết thúc theo từng khối đủ 30 phút.

## Biểu diễn thời gian

Múi giờ nghiệp vụ là `Asia/Ho_Chi_Minh`. Nội bộ dùng số nguyên giây; một giờ bằng 3.600 giây. Timestamp nguồn không bị làm tròn hoặc sửa. Khoảng được tính công có thể bị giới hạn theo mốc ca và khối ngoài giờ đã được DEC-008 xác nhận.

- `D`: ngày chấm công/ngày bắt đầu ca theo lịch phân công.
- `A`: timestamp vào thực tế, có ngày và múi giờ.
- `B`: timestamp ra thực tế, có ngày và múi giờ.
- `S`: timestamp bắt đầu ca.
- `R0/R1`: timestamp bắt đầu/kết thúc nghỉ.
- `overlap(A,B,R0,R1) = max(0, min(B,R1) - max(A,R0))`.
- `Ac/Bc`: mốc bắt đầu/kết thúc được tính công sau khi áp dụng rule; timestamp nguồn `A/B` vẫn được giữ nguyên.
- `P = Bc - Ac`; `R = overlap(Ac,Bc,R0,R1)`; `W = P - R`.

Ngày lịch chứa timestamp, ngày ca `D` và ngày hiển thị trên ô nguồn là ba khái niệm phải được lưu/đối chiếu riêng. Chỉ tính khi `D`, `A`, `B` đã được xác định bằng bằng chứng đủ tin cậy và không có lỗi chặn.

Rule Ca 1/Ca 3 hiện hành theo DEC-008/DEC-009/DEC-010 có hiệu lực từ ngày công 01/09/2026. Không tự kéo lùi hiệu lực cho dữ liệu cũ hơn; thiếu quyết định áp dụng lịch sử thì fail-closed.

## Chuẩn hóa ngày ca và timestamp

1. Xác định `D` từ phân ca nguồn đã duyệt. Với Ca 3 bắt đầu `D 19:00`, nhân viên vào sau 00:00 có thể vẫn thuộc `D` khi evidence của dòng import chứng minh điều đó (DEC-001/DEC-007/DEC-008).
2. Ưu tiên timestamp có ngày rõ ràng từ nguồn. Không thay ngày thực tế bằng ngày ca.
3. Nếu nguồn chỉ có giờ ra, chỉ gán `B` vào `D+1` khi có bằng chứng phù hợp phân ca Ca 3 19:00–07:00. Không dùng riêng điều kiện “giờ ra nhỏ hơn giờ vào” để cộng ngày (DEC-002/DEC-007/DEC-008).
4. Lưu loại và tham chiếu bằng chứng dùng để chọn `D`, ngày `A`, ngày `B` (ví dụ: ngày nguồn, lịch phân công, mapping đã duyệt, rule version).
5. Nếu lịch, dữ liệu nguồn hoặc mapping thiếu/mâu thuẫn, gắn mã lỗi timestamp/ngày ca phù hợp, hiển thị `NEEDS_REVIEW`, không tính công. Tiêu chí suy ngày ra chi tiết vẫn `OPEN`.

Không được giả định một ca kéo dài nhiều ngày khi nguồn thiếu ngày. Một thời lượng âm chỉ được kết luận sau khi `A` và `B` đã chuẩn hóa có căn cứ.

## Ca 1

`S = D 07:00`; nghỉ `D 12:00–13:00`; mốc kết thúc chuẩn `C = D 19:00`.

- `Ac = max(A,S)`: timestamp vào thực tế vẫn được lưu nguyên, nhưng phần trước 07:00 không được tính công.
- Nếu `B <= C` thì `Bc=B`.
- Nếu `B > C` thì `Bc = C + floor((B-C)/1.800) × 1.800`: chỉ từng khối đủ 30 phút sau 19:00 được tính. Ví dụ 19:20 → `Bc=19:00`, 19:30 → `Bc=19:30`, 19:59 → `Bc=19:30`.
- `W = (Bc-Ac) - overlap(Ac,Bc,R0,R1)`.

- `T100 = min(W, 28.800)`.
- `T150 = max(W - 28.800, 0)`.
- `T130 = T210 = 0`.
- Đi muộn `L = max(A-S, 0)`.
- Về sớm `E = max(39.600 - [(B-S)-overlap(S,B,R0,R1)], 0)`, với `B ≥ S`.

Ca chuẩn 07:00–19:00 sau khi trừ một giờ nghỉ có `W=39.600` giây, tương ứng 8 giờ 100% và 3 giờ 150%. Đi muộn/về sớm độc lập; về sớm so với 19:00 và không dùng giờ vào thực tế. `B<S` hoặc timestamp không xác định là ngoại lệ chặn.

Nếu `D` là Chủ nhật, DEC-010 thay phân bổ thường ở trên bằng `T200=W`; `T100=T130=T150=T210=T230=0`. Cách tính `Ac`, `Bc`, nghỉ, `W`, đi muộn và về sớm không đổi.

## Ca 3

`S = D 19:00`; nghỉ `D+1 00:00–01:00`; mốc kết thúc chuẩn `C = D+1 07:00`.

- `Ac = max(A,S)`: timestamp vào thực tế vẫn được lưu nguyên, nhưng phần trước 19:00 không được tính công.
- Nếu `B <= C` thì `Bc=B`.
- Nếu `B > C` thì `Bc = C + floor((B-C)/1.800) × 1.800`: chỉ từng khối đủ 30 phút sau 07:00 được tính. Ví dụ 07:15 → `Bc=07:00`, 07:30 → `Bc=07:30`, 07:59 → `Bc=07:30`.
- `W = (Bc-Ac) - overlap(Ac,Bc,R0,R1)`.

- `T100 = min(W, 14.400)`.
- `T130 = min(max(W - 14.400, 0), 14.400)`.
- `T210 = max(W - 28.800, 0)`.
- `T150 = 0`.
- Đi muộn `L = max(A-S, 0)`.
- Về sớm `E = max(39.600 - [(B-S)-overlap(S,B,R0,R1)], 0)`, với `B ≥ S`. Chỉ tiêu này dùng `B` thực tế và độc lập với `A`.

Phân bổ mức theo thứ tự thời lượng được tính, không theo khung giờ đồng hồ. Ca chuẩn 19:00–07:00 sau khi trừ một giờ nghỉ có `W=39.600` giây, tương ứng 4 giờ 100%, 4 giờ 130% và 3 giờ 210%. `D+1` là khung ca chính thức, không phải quyền cộng một ngày cho mọi dòng chỉ có giờ. Vào sau nửa đêm chỉ được gắn với `D` khi có mapping/evidence tin cậy.

Nếu `D` là Chủ nhật, DEC-010 thay phân bổ thường ở trên bằng `T230=W`; `T100=T130=T150=T200=T210=0`. Việc checkout vào thứ Hai không đổi mức vì Chủ nhật được xác định theo ngày bắt đầu ca `D`. Cách tính `Ac`, `Bc`, nghỉ, `W`, đi muộn và về sớm không đổi.

## Đi muộn, về sớm và bất biến

- `L` và `E` tính độc lập; không trừ đi muộn lần thứ hai khỏi `W`.
- `W = T100 + T130 + T150 + T200 + T210 + T230`; các đại lượng không âm cho kết quả hợp lệ.
- `R` chỉ bằng phần giao thực tế; không trừ cố định một giờ.
- Không dùng các cột Công, Giờ, TC1/2/3, Ký hiệu, Vào trễ, Ra sớm của Excel làm đầu vào tính.
- Không suy ra ngày nghỉ/lễ, ca 2, mức lương, phép, nghỉ bù hoặc ngày vắng từ các tỷ lệ trên.

## Import trùng (DEC-003)

- Validation trùng phải chạy trước khi ghi dữ liệu nghiệp vụ.
- Phát hiện trùng trong cùng file và trùng với dữ liệu đã lưu là hai loại riêng; preview ghi dòng và lý do.
- Nếu có ít nhất một bản ghi được xác định trùng, từ chối toàn bộ import; không ghi raw/calculation một phần, không merge/overwrite/replace.
- Ghi log lần import bị từ chối và bằng chứng fingerprint/khớp đã dùng, không ghi dữ liệu cá nhân vào log vận hành.
- File khác hash hoặc sửa một dòng không mặc nhiên là phiên bản thay thế hợp lệ.
- Khóa nhận diện trùng đã được duyệt ngày 22/10/2026 là `Mã nhân viên + Ngày chấm công + Tên ca` (`employeeCode,attendanceDate,shiftName`). Không đưa giờ vào/ra, bảy trường đầy đủ hay ID thiết bị vào khóa. Detector phải fail-closed nếu cấu hình bị thiếu hoặc sai.

## Nhiều dòng cùng nhân viên/ngày ca (DEC-004)

- Nhóm theo mã nhân viên và `D` sau khi `D` đã xác định có căn cứ.
- Giữ nguyên từng dòng nguồn và các kết quả validation riêng.
- Không mặc định mọi nhóm nhiều dòng là `DUPLICATE`; phân biệt bản ghi giống nhau với nhiều lượt chấm công.
- Nhóm chưa được HR xác nhận phải có ngoại lệ, không cộng/ghép và không đưa vào tổng công hợp lệ.
- Quy trình HR chọn/ghép/tính riêng được hoãn sang Phase sau; không được lấp khoảng trống bằng quy tắc kỹ thuật.

## Thời gian bất thường (DEC-005)

Sau khi chuẩn hóa timestamp có căn cứ:

- `A = B`: `NEEDS_REVIEW`, không tự coi là 0 công hợp lệ.
- `B - A < 0`: `NEEDS_REVIEW`, không tự đổi ngày hoặc đổi chỗ hai mốc.
- `B - A > abnormal_duration_threshold`: `NEEDS_REVIEW`; ngưỡng mặc định đã xác nhận là 16 giờ và phải cấu hình được.
- Thiếu căn cứ xác định ngày/timestamp: dùng lỗi chưa xác định timestamp, không kết luận duration âm/dài.

Mọi trường hợp trên không có kết quả tính công hợp lệ cho tới khi HR xử lý và hệ thống chạy lại validation/calculation.

## Nhiều lỗi và trạng thái (DEC-006)

Một dòng có thể có nhiều `exception code`; phải thu thập đầy đủ thay vì dừng ở lỗi đầu tiên.

- Có ít nhất một lỗi cần HR kiểm tra → trạng thái tổng hợp hiển thị `NEEDS_REVIEW`.
- Có ít nhất một lỗi chặn đang mở → không được REVIEWED/APPROVED/LOCKED/chốt kỳ.
- Mọi xử lý lưu người thực hiện, thời gian, lý do, dữ liệu trước/sau hoặc quyết định không điều chỉnh.
- `RESOLVED` là trạng thái xử lý của ngoại lệ, không phải kết quả tính công. Chỉ sau khi validation và calculation chạy lại thành công, dòng mới có thể `VALID`.
- Hai giờ cùng trống có thể ghi `NO_ATTENDANCE`; không tự quy thành nghỉ không phép. Việc `NO_ATTENDANCE` có chặn chốt trong từng tình huống vẫn `OPEN`.

Các mã tối thiểu cần mô hình hỗ trợ: `NO_ATTENDANCE`, `MISSING_CHECKIN`, `MISSING_CHECKOUT`, `INVALID_SHIFT`, `DUPLICATE`, `MULTIPLE_ROWS_SAME_EMPLOYEE_SHIFT_DATE`, `UNRESOLVED_SHIFT_DATE`, `UNRESOLVED_CHECKOUT_DATE`, `EQUAL_CHECK_TIMES`, `NEGATIVE_DURATION`, `EXCESSIVE_DURATION`, `NEEDS_REVIEW`. Taxonomy cuối và cờ blocking phải cấu hình/version hóa sau khi được duyệt.
