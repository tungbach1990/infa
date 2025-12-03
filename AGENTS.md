# AGENTS.md

## Commands
- **Backend (Rust/Axum)**: `cd backend && cargo build`, `cargo run`, `cargo test`, single test: `cargo test test_name`
- **Frontend (Angular 21)**: `cd frontend && npm install`, `npm start`, `npm run build`, `npm test`

## Architecture
- **backend/**: Rust API with Axum, SQLite (sqlx), JWT auth. Entry: `src/main.rs`. Migrations in `migrations/`
- **frontend/**: Angular 21 SPA with standalone components. Entry: `src/main.ts`. Routes in `app/app.routes.ts`
- API runs on port 8080, auth endpoints at `/_auth/*`

## Code Style
- **Rust**: Edition 2021, use `thiserror` for errors, `serde` for serialization, async with tokio
- **TypeScript**: Prettier (100 width, single quotes), Angular standalone components, RxJS for reactivity
- **Naming**: snake_case (Rust), camelCase (TS), PascalCase for types/components

## Environment
- Backend: `DATABASE_URL`, `JWT_SECRET` (via .env or env vars)
