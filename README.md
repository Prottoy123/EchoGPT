# EchoGPT - Production REST API Backend

> Production-ready, enterprise-grade RESTful API backend for the [EchoGPT Chrome Extension](https://chromewebstore.google.com/detail/echogpt-multi-ai-chat-sid/negimdcamohmoheiifgecbjgjepkcfhj) built with **NestJS**, **PostgreSQL**, **Prisma ORM**, **Vercel AI SDK**, **Zod**, and **Swagger / OpenAPI**.

---

## 🚀 Key Highlights & Architecture

* **Framework & Architecture**: Modular NestJS clean architecture adhering to domain-driven design with strict separation of concerns (Auth, Users, Subscriptions, AI Providers, Chat, Web Search, Admin Panel).
* **Database & ORM**: PostgreSQL with normalized Prisma schema modeling users, sessions, roles, subscription limits, encrypted providers, conversations, messages, web searches, and telemetry audit logs.
* **Unified AI Engine (Vercel AI SDK)**: Multi-provider orchestration supporting **Google Gemini** (`gemini-3-flash-preview`), **OpenAI** (`gpt-4o-mini`), and **Claude** (`claude-3-5-sonnet`) with automatic fallback routing.
* **Zod Schema Validation**: Runtime prompt sanitization, boundary checks (1–4,000 chars), UUID validation, model enum validation, raw AI output validation, and response contract verification.
* **Streaming Response (Bonus)**: Real-time token streaming via Server-Sent Events (SSE) at `POST /api/v1/chat/stream`.
* **Search Result Caching (Bonus)**: Automatic query result deduplication and caching for sub-2ms response times on recurring queries.
* **Email Verification (Bonus)**: Signed cryptographic verification token lifecycle at `POST /auth/send-verification` and `POST /auth/verify-email`.
* **Security & Auth**:
  * Dual-token JWT (15-min Access Token + 7-day Rotating Refresh Token with RTR replay protection).
  * Argon2id password hashing (memory cost: 64MB, 3 iterations).
  * AES-256-GCM authenticated encryption (`iv:authTag:ciphertext`) for vaulting upstream AI provider API keys.
* **Subscription Quotas**: Tier-based monthly quotas (`FREE`: 50 requests/mo, `PREMIUM`: 1,000 requests/mo) strictly guarded by HTTP 402 Payment Required checks.
* **Interactive Swagger Documentation**: Comprehensive OpenAPI 3.0 documentation available locally at `/docs/` and hosted permanently via GitHub Pages (`docs/index.html`).

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **NestJS 10+ (TypeScript)** | Enterprise backend framework |
| **PostgreSQL 16** | Relational database engine |
| **Prisma ORM 5.x** | Type-safe migrations, query builder, and schema modeling |
| **Vercel AI SDK (`ai`)** | Unified multi-provider AI model orchestration & streaming |
| **Zod v4** | Runtime request sanitization, response contract verification |
| **Swagger / OpenAPI 3.0** | Interactive API documentation |
| **Argon2id** | Cryptographic password and refresh token hashing |
| **Crypto (AES-256-GCM)** | Authenticated symmetric encryption for provider keys |
| **Docker & Docker Compose** | Containerized deployment with PostgreSQL orchestration |

---

## 📋 Feature Breakdown

### 1. Authentication
* `POST /api/v1/auth/register` — Register new user account (auto-provisions FREE plan).
* `POST /api/v1/auth/login` — Authenticate and receive Access & Refresh JWT tokens.
* `POST /api/v1/auth/refresh` — Refresh Token Rotation (RTR) issuing a new cryptographic token pair.
* `POST /api/v1/auth/logout` — Revokes session and invalidates refresh token.
* `POST /api/v1/auth/send-verification` — **(Bonus)** Generates and dispatches email verification token.
* `POST /api/v1/auth/verify-email` — **(Bonus)** Confirms email address and updates verification status.

### 2. User Management
* `GET /api/v1/users/me` — Fetch authenticated profile, subscription tier, and remaining requests.
* `PATCH /api/v1/users/me` — Update display name and extension preferences.
* `POST /api/v1/users/me/change-password` — Change password and invalidate all active device sessions.
* `GET /api/v1/users/me/remaining-requests` — Live remaining requests count and quota status.
* `DELETE /api/v1/users/me` — GDPR-compliant account cascade deletion.

### 3. Subscription Management
* `GET /api/v1/subscriptions/plans` — Public plan catalog & feature matrices (Free & Premium).
* `GET /api/v1/subscriptions/status` — Current user subscription tier, status, and request limits.
* `GET /api/v1/subscriptions/remaining-requests` — Remaining requests API with `isLimitReached` trigger.
* `POST /api/v1/subscriptions/upgrade` — Upgrade account to PREMIUM (1,000 requests/mo).
* `POST /api/v1/subscriptions/downgrade` — Downgrade account to FREE (50 requests/mo).

### 4. AI Provider Management (Admin)
* `POST /api/v1/ai-providers` — Register/update provider with AES-256-GCM encrypted API key.
* `GET /api/v1/ai-providers` — List configured providers (keys strictly sanitized/masked).
* `PATCH /api/v1/ai-providers/:id/default` — Set provider as global default in atomic transaction.
* `PATCH /api/v1/ai-providers/:id/toggle` — Enable or disable provider.
* `GET /api/v1/ai-providers/:id/health` — Zero-leak in-memory cryptographic and network ping health probe.
* `DELETE /api/v1/ai-providers/:id` — Delete provider.

### 5. Chat API
* `POST /api/v1/chat/message` — Send prompt, route to default or selected model, persist history (Zod Validated).
* `POST /api/v1/chat/stream` — **(Bonus)** Stream response tokens via Server-Sent Events (SSE).
* `GET /api/v1/chat/conversations` — Paginated list of user conversation threads.
* `GET /api/v1/chat/conversations/:id` — Full multi-turn conversation message history.
* `DELETE /api/v1/chat/conversations/:id` — Cascade delete conversation thread.

### 6. Web Search API
* `POST /api/v1/search/query` — Live DuckDuckGo web search with **Search Result Caching (Bonus)**.
* `GET /api/v1/search/history` — Paginated search history for current user.
* `GET /api/v1/search/recent` — Recent distinct query strings for popup chips.
* `GET /api/v1/search/suggestions` — Auto-complete query suggestions.

### 7. Admin Panel
* `GET /api/v1/admin/dashboard/stats` — Platform-wide KPI aggregations (users, plans, chats, latency).
* `GET /api/v1/admin/users` — Paginated user directory with role and usage metrics.
* `PATCH /api/v1/admin/users/:id/role` — Update user role (`ADMIN` / `USER`).
* `PATCH /api/v1/admin/users/:id/subscription` — Override user subscription tier.
* `DELETE /api/v1/admin/users/:id` — Administrative user cascade deletion.
* `GET /api/v1/admin/subscriptions` — Subscriber distribution across tiers.
* `GET /api/v1/admin/analytics/usage` — API throughput, status code breakdown, latency percentiles.
* `GET /api/v1/admin/logs` — Security and request audit trail.
* `GET /api/v1/admin/system/health` — Database connection pool, memory RSS, and event loop metrics.

---

## ⚡ Quick Start & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database URL, JWT secrets, and AES-256-GCM master key (sample template provided in `.env.example`).

### 3. Database Migration & Seeding
```bash
# Push schema to PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed initial admin user and default providers
npm run prisma:seed
```

### 4. Run Application
```bash
# Development mode
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

### 5. Running with Docker Compose (Optional)
```bash
docker-compose up --build -d
```

---

## 🧪 Comprehensive Test Suite

Run the full end-to-end test suite verifying all 7 modules and bonus features:
```bash
# Run all core blocks (Auth, Providers, Chat, Search, Quotas)
node scripts/test-all.js

# Run Zod validation suite
node scripts/test-zod.js

# Run Subscription Management suite
node scripts/test-subscriptions.js

# Run Bonus features suite (Email Verification, SSE Streaming, Search Caching)
node scripts/test-bonus.js
```

---

## 📖 API Documentation & Postman

* **Local Swagger UI**: `http://localhost:3000/docs/`
* **Raw OpenAPI Specification**: `http://localhost:3000/docs-json` or [`swagger.json`](./swagger.json)
* **GitHub Pages Standalone Documentation**: Embedded in [`docs/index.html`](./docs/index.html)
* **Postman Collection**: Fully mapped collection with all endpoints in [`postman_collection.json`](./postman_collection.json)
