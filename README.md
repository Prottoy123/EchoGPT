# EchoGPT - Backend REST API

> Production-ready Backend REST API for the [EchoGPT Multi-AI Chrome Extension](https://chromewebstore.google.com/detail/echogpt-multi-ai-chat-sid/negimdcamohmoheiifgecbjgjepkcfhj), built with **NestJS**, **PostgreSQL**, **Prisma ORM**, and **Swagger / OpenAPI**.

---

## 🚀 Key Highlights & Architectural Features

* **Clean Architecture & Modular Design**: Built strictly on NestJS modular architecture with domain separation (Auth, Users, Subscriptions, AI Providers, Chat, Web Search, Admin, Health).
* **Multi-AI Provider Engine**: Factory & Adapter design pattern supporting **OpenAI**, **Anthropic Claude**, and **Google Gemini** with automatic fallback, streaming, and model routing.
* **AES-256-GCM Encrypted Key Vault**: AI Provider API keys are never stored in plaintext—all secrets are encrypted with authenticated AES-256-GCM cryptography.
* **Dual-Token JWT Authentication**: Short-lived Access Tokens (15m) + Rotating Refresh Tokens (7d) stored with SHA-256 hashes in PostgreSQL for instant session revocation and device management.
* **Real-time SSE Streaming (Bonus)**: High-performance Server-Sent Events (`/chat/stream`) for token-by-token generation in the Chrome Extension.
* **Web Search with Caching (Bonus)**: AI-assisted web search with TTL caching, recent searches, and real-time query suggestions.
* **Subscription & Dynamic Quota Guards**: Tier-based rate enforcement (`Free` starter with 50 monthly requests, `Premium` with 1,000 requests, and `Enterprise` with unlimited requests).
* **Automated Swagger / OpenAPI CLI Plugin**: Integrated `@nestjs/swagger` compiler plugin with `classValidatorShim: true` and `introspectComments: true` generating interactive documentation automatically from DTOs.
* **Telemetry & Terminus Health**: Database, memory heap, and request latency logging persisted asynchronously to `ApiUsageLog`.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **NestJS 10+ (TypeScript)** | Enterprise backend framework with Dependency Injection |
| **PostgreSQL 16 / 18** | Relational database engine |
| **Prisma ORM 5.x** | Type-safe migrations, query builder, schema modeling |
| **Swagger / OpenAPI 3.0** | Interactive documentation and API testing playground |
| **Passport & JWT** | Dual-token authentication & role-based access control |
| **Argon2** | Next-generation password hashing |
| **Node Crypto (AES-256-GCM)** | Zero-leak API key encryption at rest |
| **NestJS Terminus** | System, memory heap, and database health monitoring |
| **Docker & Docker Compose** | Multi-container environment orchestration |

---

## 📂 Project Structure

```
EchoGPT/
├── prisma/
│   ├── schema.prisma              # Database entities, relations & indexes
│   ├── migrations/                # SQL migration files
│   └── seed.ts                    # Admin, subscriptions, and AI providers seed script
├── src/
│   ├── common/                    # Shared cross-cutting concerns
│   │   ├── decorators/            # @CurrentUser(), @Roles(), @Public()
│   │   ├── filters/               # HttpExceptionFilter (uniform error envelope)
│   │   ├── guards/                # JwtAuthGuard, RolesGuard, SubscriptionQuotaGuard
│   │   ├── interceptors/          # LoggingInterceptor, TransformInterceptor
│   │   └── utils/                 # CryptoUtil (AES-256-GCM encryption/decryption)
│   ├── modules/
│   │   ├── auth/                  # Register, Login, Refresh token rotation, Logout, Email Verify
│   │   ├── users/                 # Profile, Update, Change Password, Delete Account
│   │   ├── subscriptions/         # Tier plans, remaining quotas, upgrade/downgrade
│   │   ├── ai-providers/          # Multi-AI adapters (OpenAI, Claude, Gemini), vault, health pings
│   │   ├── chat/                  # Prompt execution, thread history, SSE streaming
│   │   ├── web-search/            # Web queries, 1-hour TTL caching, suggestions
│   │   ├── admin/                 # Dashboard metrics, user moderation, request audit logs
│   │   └── health/                # Terminus system health checks
│   ├── app.module.ts              # Root application module
│   └── main.ts                    # App bootstrap, Helmet, Compression, Swagger setup
├── scripts/
│   └── verify-api.js              # Comprehensive automated end-to-end test suite
├── docker-compose.yml             # PostgreSQL 16 container setup
├── Dockerfile                     # Multi-stage production container build
├── postman_collection.json        # Postman collection with ready-to-test requests
├── .env.example                   # Environment configuration template
└── README.md                      # Documentation
```

---

## ⚡ Quick Start & Installation

### Prerequisites
* **Node.js**: v18.x or v20.x or v22.x
* **PostgreSQL**: Local PostgreSQL running on port 5432 or Docker
* **npm** or **pnpm**

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd EchoGPT
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` matches your PostgreSQL credentials:
```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/echogpt_db?schema=public
```

### 3. Run Database Migrations & Seed
```bash
# Apply Prisma schema migrations
npx prisma migrate dev

# Seed Admin account and initial AI Providers
npx prisma db seed
```

### 4. Start the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

The application will start on:
* **API Base URL**: `http://localhost:3000/api/v1`
* **Interactive Swagger UI**: `http://localhost:3000/docs/`
* **Health Check**: `http://localhost:3000/api/v1/health`

---

## 🔑 Default Seed Credentials

After running `npx prisma db seed`, the database is populated with:

### System Administrator
* **Email**: `admin@echogpt.com`
* **Password**: `AdminPass123!`
* **Role**: `ADMIN`
* **Subscription**: `ENTERPRISE` (Unlimited Quota)

### Pre-Configured AI Providers
* **OpenAI**: Models `["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]` (Default)
* **Anthropic Claude**: Models `["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"]`
* **Google Gemini**: Models `["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"]`

*(Keys are stored encrypted using AES-256-GCM. Out-of-the-box demo keys allow full end-to-end execution without requiring third-party API billing).*

---

## 📖 API Documentation & Swagger UI

Explore and interactively test every endpoint at:
👉 **[http://localhost:3000/docs/](http://localhost:3000/docs/)**

### Key Endpoints

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/v1/health` | Terminus database and memory health check |
| **Auth** | `POST` | `/api/v1/auth/register` | Register new user + auto-assign Free plan |
| **Auth** | `POST` | `/api/v1/auth/login` | Login and receive dual JWT tokens |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| **Auth** | `POST` | `/api/v1/auth/logout` | Revoke session |
| **Auth** | `GET` | `/api/v1/auth/verify-email` | Validate email verification token |
| **Users** | `GET` | `/api/v1/users/me` | Current profile, stats, and active subscription |
| **Users** | `PATCH` | `/api/v1/users/me` | Update profile information |
| **Users** | `POST` | `/api/v1/users/me/change-password` | Update password and revoke other sessions |
| **Users** | `DELETE`| `/api/v1/users/me` | Delete account and associated data |
| **Subscriptions**| `GET` | `/api/v1/subscriptions/status` | Current plan tier and limits |
| **Subscriptions**| `GET` | `/api/v1/subscriptions/usage` | Requests/tokens used and remaining quota |
| **Subscriptions**| `POST`| `/api/v1/subscriptions/upgrade` | Upgrade plan (e.g. Free $\to$ Premium) |
| **Subscriptions**| `POST`| `/api/v1/subscriptions/downgrade` | Downgrade subscription |
| **AI Providers** | `GET` | `/api/v1/ai-providers` | Active providers and models (Chrome Extension) |
| **AI Providers** | `GET` | `/api/v1/admin/ai-providers` | [Admin] All providers with masked keys |
| **AI Providers** | `POST`| `/api/v1/admin/ai-providers` | [Admin] Add provider (AES-256-GCM encrypted) |
| **AI Providers** | `GET` | `/api/v1/admin/ai-providers/:id/health` | [Admin] Live health-check ping |
| **Chat** | `POST` | `/api/v1/chat/message` | Send prompt and receive AI response |
| **Chat** | `GET` | `/api/v1/chat/stream` | **Server-Sent Events (SSE) streaming** |
| **Chat** | `GET` | `/api/v1/chat/conversations` | Paginated conversation threads |
| **Web Search** | `POST` | `/api/v1/search/query` | AI web search with 1-hr TTL caching |
| **Web Search** | `GET` | `/api/v1/search/history` | Paginated search history |
| **Web Search** | `GET` | `/api/v1/search/suggestions` | Auto-complete search suggestions |
| **Admin** | `GET` | `/api/v1/admin/analytics/dashboard` | Aggregated platform telemetry |
| **Admin** | `GET` | `/api/v1/admin/analytics/usage-logs` | Filterable API audit logs |
| **Admin** | `PATCH`| `/api/v1/admin/users/:id/role` | Elevate or demote user roles |

---

## 🧪 Automated Testing

Execute the automated end-to-end test suite:
```bash
node scripts/verify-api.js
```
Expected output:
```
=== EchoGPT REST API End-to-End Test Suite ===

[PASS] 1. Health Check (Terminus, DB, Heap Memory)
[PASS] 2. Swagger UI Documentation at /docs/
[PASS] 3. Admin Authentication & JWT Generation
[PASS] 4. User Registration with Free Subscription Tier
[PASS] 5. Token Rotation (Dual Token Refresh Flow)
[PASS] 6. User Profile (/users/me)
[PASS] 7. Subscription Status (/subscriptions/status)
[PASS] 8. Remaining Quota Telemetry (/subscriptions/usage)
[PASS] 9. Subscription Upgrade to PREMIUM tier
[PASS] 10. Active AI Providers (OpenAI, Claude, Gemini)
[PASS] 11. Provider Health Check Endpoint (/admin/ai-providers/:id/health)
[PASS] 12. Chat Prompt Execution & History Context (/chat/message)
[PASS] 13. Conversation Threads Listing (/chat/conversations)
[PASS] 14. Web Search Execution (/search/query)
[PASS] 15. Web Search Result Caching (Bonus Feature)
[PASS] 16. Search Suggestions (/search/suggestions)
[PASS] 17. Recent Searches (/search/recent)
[PASS] 18. Admin Analytics Dashboard (/admin/analytics/dashboard)
[PASS] 19. Admin API Usage Audit Logs (/admin/analytics/usage-logs)

======================================================
 TEST RESULTS: 19/19 PASSED (100% SUCCESS)
======================================================
```

---

## 🐳 Docker Deployment

To build and run the production container:
```bash
# Build production image
docker build -t echogpt-backend .

# Run container with environment
docker run -p 3000:3000 --env-file .env echogpt-backend
```

Or using Docker Compose:
```bash
docker-compose up -d
```

---

## 📬 Postman Collection

Import `postman_collection.json` into Postman or Insomnia. It includes pre-configured requests with variables for `baseUrl`, `accessToken`, and `refreshToken`.
