## [2025-12-02]
- Sửa export frontend để gắn thẻ tải vào DOM
- Chuẩn hoá dữ liệu import phía frontend
- Thêm validation import phía backend và trả 400 khi payload không hợp lệ
- Cải thiện UX: thông báo trạng thái Import/Export
- Thêm unit tests cho DashboardService và spec luồng import/export
- Thêm tests cho handler import backend
- Tạo tài liệu RULES.md, INFOS.md

Modified files:
- frontend/src/app/services/dashboard.service.ts
- frontend/src/app/pages/architecture/architecture.component.ts
- frontend/src/app/pages/architecture/architecture.component.html
- frontend/src/app/services/dashboard.service.spec.ts
- frontend/src/app/pages/architecture/architecture.component.spec.ts
- backend/src/main.rs
- Docs/RULES.md
- Docs/INFOS.md
