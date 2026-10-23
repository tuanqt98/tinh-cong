# Hướng dẫn tiếp tục dự án chấm công In Nhật Hàn

Cập nhật 22/10/2026. Trước khi sửa code, đọc `docs/13_PROGRESS_REPORT.md`, `docs/12_OPEN_QUESTIONS.md`, `docs/17_PHASE0_BUSINESS_DECISIONS.md`, `docs/TEST_REPORT.md` và `docs/DEPLOYMENT_READINESS.md`.

## Trạng thái checkpoint

- Phase 1–6 đã có implementation development tại `D:\chamCong`.
- Engine: 31 unit tests synthetic đạt.
- API: 25 unit/service/export/import-policy tests và 6 PostgreSQL integration tests đạt.
- Web: 12 màn hình; 9 Playwright E2E đạt, gồm refresh phiên, confirm một lần, xem raw import và visual QA Import Excel tại ba viewport.
- Docker image API/web hiện tại đã build; PostgreSQL/API/Nginx healthy qua API trực tiếp và proxy.
- Backup/restore synthetic đã phục hồi 25 bảng.
- Trạng thái tổng thể là `DEVELOPMENT_COMPLETE_WITH_BLOCKERS`, không phải production-ready.

## Quy tắc nghiệp vụ không được thay đổi

- Chỉ bảy trường nguồn được dùng để tính công; không dùng TC1/TC2/TC3 hoặc kết quả có sẵn.
- Engine dùng số nguyên giây, không làm tròn. Tổng các tier phải bằng thời gian được tính công.
- Ngày chấm công là ngày bắt đầu ca. Theo DEC-007, `Tên ca` trong file là phân ca của dòng import, không yêu cầu lịch phân ca riêng. Timestamp phải đầy đủ offset và có evidence; thiếu căn cứ thì fail-closed.
- Ca 1: 08:00–17:00, nghỉ giao 12:00–13:00, 8 giờ đầu 100%, phần vượt 150%.
- Ca 3: 22:00–07:00 hôm sau, nghỉ giao 00:00–01:00, 4 giờ 100%, 4 giờ 130%, vượt 8 giờ 210%.
- Đi muộn và về sớm là hai chỉ tiêu độc lập. Về sớm không dùng giờ vào thực tế.
- Duplicate làm từ chối toàn import; không merge/overwrite. Khóa trùng chính thức vẫn OPEN.
- Nhiều dòng cùng nhân viên/ngày ca không tự cộng/ghép; chuyển ngoại lệ.
- `A=B`, duration âm và hiện diện `>16h` cần HR kiểm tra; lưu tất cả mã lỗi.
- Raw là bất biến. Điều chỉnh phải có revision, actor, reason và revalidation.
- Kỳ có lỗi blocking không được chốt; kỳ LOCKED/PUBLISHED không sửa trực tiếp.

## Guard bắt buộc

- Giữ `DUPLICATE_KEY_FIELDS=employeeCode,attendanceDate,shiftName` theo quyết định ngày 22/10/2026; không tự thêm giờ vào/ra hoặc đổi khóa.
- Giữ `WORKFLOW_ENABLED=false` cho tới khi Q10/Q11 được xác nhận; không nới guard để demo.
- Giữ `SOURCE_MASTER_PROVISIONING_ENABLED=false` cho tới khi việc tạo hồ sơ nhân viên/phòng ban từ file được phê duyệt. DEC-007 chỉ duyệt dùng đúng `Ca1`/`Ca3` trong file làm phân ca và evidence timestamp, không duyệt tự tạo master nhân viên.
- RBAC và data scope phải kiểm tra tại backend. EMPLOYEE chỉ xem chính mình; MANAGER/HR fail-closed khi không có scope.
- Không hard-code secret, mật khẩu hay dữ liệu nhận dạng. Seed chỉ dùng synthetic và yêu cầu credential qua môi trường.
- Không triển khai production, gửi email/Zalo hoặc phát hành cho nhân viên thật.

## Quy trình kỹ thuật

1. Kiểm tra `git status` và giữ thay đổi người dùng.
2. Chạy `pnpm.cmd typecheck`, `pnpm.cmd build`, `pnpm.cmd test:run` sau thay đổi lõi.
3. Thay đổi UI phải chạy `pnpm.cmd test:e2e`.
4. Thay đổi schema/API/auth phải chạy migration trên DB mới và `pnpm.cmd test:integration`.
5. Thay đổi Docker phải build image và kiểm tra health qua cả API trực tiếp lẫn Nginx proxy.
6. Không ghi PASS cho test không chạy; ghi rõ synthetic/real data và mọi skip/blocker.
7. Cập nhật `docs/TEST_REPORT.md`, `docs/13_PROGRESS_REPORT.md` và readiness sau mỗi mốc.

## Blocker hiện tại

- `SX.xlsx` hiện `ACCEPTED` với 2.765 raw rows và 1.740 source issues. DEC-007 đã bỏ dependency lịch phân ca; 92 mã nhân viên vẫn chưa có master nên chưa được liên kết/tính công. Không tự provision master.
- DEC-002 đã đủ cho trường hợp nguồn `Ca3` hiện tại theo DEC-007; các trường hợp checkout khác ngoài tiêu chí đã chốt vẫn OPEN.
- DEC-003 đã chốt khóa `Mã nhân viên + Ngày chấm công + Tên ca`; quy trình file sửa/file nhiều kỳ vẫn OPEN.
- Q10/Q11 và các quyết định phát hành/chỉnh sửa sau khóa chưa duyệt.
- Thiếu mẫu PDF/logo chính thức, UAT người dùng và kiểm thử dữ liệu thật.

Các phần phụ thuộc blocker phải giữ OPEN; tiếp tục được phép cải thiện phần độc lập và guard an toàn.
