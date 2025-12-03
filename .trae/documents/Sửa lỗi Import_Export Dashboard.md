## Tình Trạng Hiện Tại
- Export hiện thực bằng client: tạo `Blob` JSON và trigger tải file trong `frontend/src/app/services/dashboard.service.ts:96-105`.
- Import đọc file JSON và POST tới backend `/api/dashboards/import` trong `frontend/src/app/services/dashboard.service.ts:107-133`; Component móc sự kiện ở `architecture.component.ts:776-796` và input file ở `architecture.component.html:1022-1029`.
- Backend xử lý import tại `backend/src/main.rs:230-258`, cấp `id` mới, ghi JSON vào `./data/dashboards` và trả về dashboard.

## Chẩn Đoán Nhanh
- Export có khả năng không kích hoạt tải xuống ổn định trên một số trình duyệt do gọi `link.click()` khi thẻ chưa được gắn vào DOM.
- Import có thể thất bại khi JSON thiếu trường tối thiểu (`id`, `name`, `data`) hoặc cấu trúc `data` không đầy đủ; hiện tại frontend không kiểm tra schema trước khi POST (trả `null` lặng lẽ).
- Nếu backend trả lỗi (400/500), frontend ghi log nhưng UI không thông báo, khiến người dùng cảm nhận "không hoạt động".

## Kế Hoạch Khắc Phục
### 1) Cải thiện Export phía frontend
- Sửa `exportToFile` để:
  - Gắn `link` vào `document.body`, gọi `click()`, rồi tháo ra; chỉ `revokeObjectURL` sau khi click.
  - Giữ `Content-Type` là `application/json`, đảm bảo tên file an toàn.

### 2) Xác thực và chuẩn hoá Import phía frontend
- Thêm kiểm tra schema tối thiểu trước khi POST: tồn tại `name`, `data` với các khóa `nodes`, `edges`, `nodeTypes`, `groups`, `vms`, `domains`.
- Bổ sung default khi thiếu: nếu thiếu `createdAt`/`updatedAt` sẽ set giá trị hợp lệ.
- Trả lỗi có thông điệp rõ ràng thay vì `null` im lặng; hiển thị cảnh báo trong `ArchitectureComponent`.

### 3) Gia cố Backend import (an toàn & rõ ràng)
- Kiểm tra JSON nhập: xác thực kiểu dữ liệu của `data` ở handler `import_dashboard` trước khi ghi.
- Trả mã lỗi `BAD_REQUEST` (400) với thông điệp súc tích khi JSON không hợp lệ, giữ CORS permissive.

### 4) Cải thiện UX cho Import/Export
- Thêm thông báo trạng thái: thành công/ thất bại trong modal Dashboards; đảm bảo `isLoading` được đặt/huỷ đúng cách.
- Cập nhật `accept` của input để hỗ trợ thêm `application/json` nếu cần.

### 5) Kiểm thử & Xác Minh
- Unit test `DashboardService`:
  - Export: tạo Blob, tên file, đảm bảo gọi click (mock).
  - Import: đọc file, validate schema, POST và xử lý lỗi.
- Integration test Backend (Axum):
  - POST `/api/dashboards/import` với JSON hợp lệ/không hợp lệ, kiểm tra mã lỗi và file ghi.
- E2E: mở App, Export dashboard hiện tại, Import lại file vừa xuất, xác nhận xuất hiện trong danh sách và `loadDashboard` hoạt động.

### 6) Tài Liệu & Quản Lý Tác Vụ
- Phát hiện thiếu các tài liệu bắt buộc: `Docs/RULES.md`, `Docs/INFOS.md`, `Docs/CHANGELOG.md`.
- Sau khi bạn xác nhận, tạo các file này và cập nhật quy trình (CHANGELOG, TASKS) mỗi lần thay đổi.

## Phạm Vi Thay Đổi Dự Kiến
- Frontend: sửa `dashboard.service.ts` (export/import), bổ sung hiển thị thông báo trong `ArchitectureComponent`.
- Backend: bổ sung validation và thông báo lỗi rõ ràng trong `import_dashboard`.
- Thêm test đơn vị và tích hợp như mô tả.

## Xác Minh Sau Khi Sửa
- Chạy backend trên `http://localhost:8080` và frontend app; thử:
  - Export: file `.json` tải xuống với tên chuẩn hoá.
  - Import: chọn file `.json` vừa tải; dashboard mới thêm vào danh sách và `loadDashboard` thành công.
- Kiểm tra log và thông báo UI khi lỗi JSON.

Bạn xác nhận để mình tiến hành cập nhật code, thêm kiểm thử và (nếu đồng ý) tạo bổ sung các tài liệu thiếu nêu trên?