# DocView — Tasklist triển khai infa-admin

## Phase 1 – Nền tảng & Auth/RBAC & DB

### Sprint 1 – Skeleton Backend + SQLite + Auth cơ bản
- <span style="color: green">DONE — Backend skeleton & cấu trúc dự án</span>
- [TODO] Tích hợp SQLite với sqlx
- [TODO] Auth cơ bản (chưa 2FA)
- [TODO] Logging & error handling
- [TODO] Unit test: Argon2 hash/verify, login/refresh cơ bản

### Sprint 2 – RBAC, session model, audit, 2FA TOTP
- [TODO] RBAC ma trận role-action
- [TODO] Middleware RBAC cho route bảo vệ
- [TODO] TOTP & backup codes (Argon2 hashed)
- [TODO] Audit logging (SQLite)
- [TODO] Unit test RBAC/TOTP/backup codes

## Phase 2 – Import Job async, Graph versioning, Redis, Cache, WebSocket

### Sprint 3 – Redis, session, refresh blacklist, graphVersion
- [TODO] Triển khai Redis (RDB/AOF cấu hình)
- [TODO] Tích hợp Redis client & wrapper pool
- [TODO] Lưu session (Redis + SQLite metadata)
- [TODO] Refresh token rotation + blacklist (Redis + SQLite)
- [TODO] Graph version (key `graph:version`) + API version
- [TODO] Unit test rotation/blacklist/version tăng

### Sprint 4 – Import Job 2-phase, Redis lock, staging graph
- [TODO] Model Job + migrations SQLite
- [TODO] API tạo job import + trả `jobId`
- [TODO] Worker xử lý STAGING → COMMIT (Redis lock `SETNX`)
- [TODO] Snapshot “last known good” + rollback khi lỗi
- [TODO] Idempotency theo `fileHash`
- [TODO] Integration test song song 2 job, commit tuần tự

### Sprint 5 – Cache subgraph, WebSocket notify, version-based search
- [TODO] Cache subgraph theo `subgraph:{version}:{queryHash}` + TTL theo loại
- [TODO] WebSocket notify tiến độ & hoàn thành job
- [TODO] `/api/search` dùng cache versioned
- [TODO] Test cache hit/miss, WS nhận đúng event

## Phase 3 – Frontend graph + animation worker + UX, CSP, rate limit, performance

### Sprint 6 – Frontend Auth, Role-based UI, Job UI
- [TODO] Trang Login + 2FA (nếu bật)
- [TODO] Route guard theo role, RequireAction
- [TODO] UI Jobs + subscribe WebSocket
- [TODO] FE unit test role-based rendering

### Sprint 7 – React Flow + Web Worker animation + search & subgraph
- [TODO] Canvas React Flow (nodes/edges, layers)
- [TODO] Tách animation D3 vào Web Worker, protocol frames
- [TODO] Search highlight subgraph & sync `graphVersion`
- [TODO] FE unit test worker bridge + perf manual 2k–5k nodes

### Sprint 8 – Security hardening, CSP, rate-limit, performance & test full
- [TODO] CSP & security headers
- [TODO] Rate limit toàn nền tảng (IP + user; endpoint nhạy cảm)
- [TODO] Retention/cleanup audit (TTL 90 ngày, autovacuum SQLite)
- [TODO] Bộ test tổng: unit/integration/E2E/performance

---

## DONE Summary
- Backend skeleton đã khởi tạo: Axum + Tokio, router cơ bản (`/health`, `/_auth/*`), đọc cấu hình env, CORS permissive.
- Kết nối SQLite và chạy migrations tự động với `sqlx::migrate!`.
- Tạo migrations `users`, `role_actions`.

### Dashboard Import/Export
- DONE: Sửa export phía frontend để tải JSON ổn định.
- DONE: Chuẩn hoá dữ liệu import phía frontend.
- DONE: Validation import backend, trả 400 khi payload không hợp lệ.
- DONE: Hiển thị thông báo trạng thái Import/Export trong UI.
- DONE: Unit test `DashboardService` và spec luồng import/export.
- DONE: Test cho handler import backend.

## Tiếp Theo (Sprint 1)
- Thực hiện: Tích hợp SQLite với sqlx (DAO/helper), bổ sung logging JSON chi tiết, stub logic auth cơ bản.
