# 10 – Hướng dẫn triển khai dự kiến
Trạng thái: kế hoạch; chưa có ứng dụng/Dockerfile/Compose/migration và chưa chạy server.

## Môi trường
Local/dev và staging tách DB/storage/accounts với production. Không dùng nhân viên thật để gửi hàng loạt thử nghiệm.
Docker Compose dự kiến gồm web/reverse proxy, api, worker và PostgreSQL; tệp nguồn/PDF dùng volume private.
Pin dependency/container versions sau lựa chọn thư viện và kiểm thử; không dùng tag latest cho bản nghiệm thu.
Secrets nằm ngoài Git, có mẫu biến môi trường không chứa khóa thật; timezone nghiệp vụ Asia/Ho_Chi_Minh.
DB không mở cổng ra mạng công cộng; API nội bộ qua TLS, health check không lộ dữ liệu.

## Runbook sẽ hoàn thiện ở Phase2–5
1. Kiểm tra server, dung lượng/CPU/RAM và chính sách truy cập.
2. Tạo secrets, DB user quyền tối thiểu, volumes và backup schedule.
3. Chạy migration trên DB thử nghiệm; kiểm tra constraints và phục hồi trước khi áp dụng môi trường khác.
4. Tạo tài khoản admin bằng quy trình bảo mật, không mật khẩu mặc định.
5. Chạy unit/integration/E2E, upload XLSX ẩn danh, đối chiếu tổng và PDF.
6. Benchmark import/calculate/export, đo CPU/RAM/thời gian; SLA chờ HR/IT xác nhận.
7. Kiểm tra job retry, downtime, audit, lock/concurrency.
8. Nếu được yêu cầu production sau này: backup, phê duyệt phiên bản, rollout/rollback riêng; không tự triển khai.

## Backup/restore
Backup DB cùng file source/PDF, manifest hash và revision/rule/engine references.
Mã hóa, quyền riêng, retention/RPO/RTO cần IT xác nhận.
Restore vào môi trường cách ly, kiểm tra FK/số bản ghi/hash/tổng kỳ/quyền trước khi kết luận phục hồi đạt.
Rollback app không đồng nghĩa rollback DB; chuẩn bị migration tương thích và phương án restore có kiểm chứng.
Không ghi lệnh giả “đã chạy”; hướng dẫn thực thi cụ thể cập nhật khi có code/infrastructure.
