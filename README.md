# EchoGPT - Backend REST API (Lean MVP)

> Production-ready RESTful API backend for the [EchoGPT Chrome Extension](https://chromewebstore.google.com/detail/echogpt-multi-ai-chat-sid/negimdcamohmoheiifgecbjgjepkcfhj) built with **NestJS**, **PostgreSQL**, **Prisma ORM**, **Vercel AI SDK**, and **Swagger / OpenAPI**.

---

## 🚀 Key Highlights & Architecture

* **Framework & Architecture**: Clean, modular NestJS architecture with domain separation (Auth, Users, AI Providers, Chat, Web Search).
* **Database & ORM**: PostgreSQL with a lean, normalized Prisma schema tracking users, subscription limits, encrypted providers, conversations, and search logs.
* **Unified AI Engine (Vercel AI SDK)**: Powered by Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic`) for multi-provider routing (OpenAI, Gemini, Claude).
* **Security & Auth**: Dual-token JWT (15-minute Access Token + 7-day Rotating Refresh Token hashed with Argon2 in the `User` table), Argon2 password hashing, and AES-256-GCM encrypted API key storage.
* **Quota Enforcement**: Direct `requestsCount` check against `requestLimit` returning `402 Payment Required` upon quota depletion.
* **Swagger / OpenAPI CLI Plugin**: Configured with `@nestjs/swagger` CLI plugin (`classValidatorShim: true`, `introspectComments: true`) for automated reflection from DTOs.
* **Web Search**: DuckDuckGo instant query execution persisting searches to the database.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **NestJS 10+ (TypeScript)** | Enterprise backend framework |
| **PostgreSQL 16 / 18** | Relational database engine |
| **Prisma ORM 5.x** | Type-safe migrations, query builder, schema modeling |
| **Vercel AI SDK (`ai`)** | Unified multi-provider AI model routing |
| **Swagger / OpenAPI 3.0** | Interactive documentation at `/docs/` |
| **Argon2** | Password and refresh token hashing |
| **Crypto (AES-256-GCM)** | Encrypted API key storage at rest |

---

## 📂 Project Structure

```
echogpt-backend/
├── prisma/
│   ├── schema.prisma              # Lean database schema
│   └── seed.ts                    # Seed script (Admin, plans, providers)
├── src/
│   ├── common/                    # Guards, decorators, AES-256-GCM crypto utility
│   │   ├── decorators/            # @CurrentUser(), @Roles(), @Public()
│   │   ├── filters/               # HttpExceptionFilter
│   │   ├── guards/                # JwtAuthGuard, RolesGuard
│   │   └── utils/                 # CryptoUtil (AES-256-GCM)
│   ├── modules/
│   │   ├── auth/                  # Register, Login, Refresh token rotation
│   │   ├── users/                 # Profile, requestsCount tracking
│   │   ├── ai-providers/          # Admin CRUD, AES encrypted key vault
│   │   ├── chat/                  # Vercel AI SDK, 402 quota guard, conversation history
│   │   └── web-search/            # Web query execution, search history
│   ├── app.module.ts              # Root application module
│   └── main.ts                    # App bootstrap & Swagger setup
├── scripts/
│   ├── test-block1.js             # Auth & Users test suite
│   ├── test-block2.js             # AI Providers & AES encryption test suite
│   ├── test-block3.js             # Chat & Vercel AI SDK test suite
│   └── test-block4.js             # Web search & end-to-end test suite
├── docker-compose.yml             # PostgreSQL container orchestration
├── Dockerfile                     # Multi-stage production container build
├── postman_collection.json        # Postman API Collection
├── .env.example                   # Environment configuration template
└── README.md                      # Documentation
```

---

## ⚡ Quick Start & Setup

### 1. Install Dependencies
```bash
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

### 3. Run Migrations & Seed
```bash
npx prisma db push
npx prisma db seed
```

### 4. Start the Application
```bash
# Build
npm run build

# Start production server
npm run start:prod
```

* **API Base URL**: `http://localhost:3000/api/v1`
* **Swagger Documentation**: `http://localhost:3000/docs/`

---

## 🔑 Default Seed Credentials

* **Admin Email**: `admin@echogpt.com`
* **Admin Password**: `AdminPass123!`
* **Role**: `ADMIN` (PREMIUM plan with 1,000 request limit)

Pre-configured Providers:
* `OPENAI` (Default)
* `GEMINI`
* `CLAUDE`

---

## 📖 API Endpoints Reference

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register user and auto-assign FREE plan (50 requests limit) |
| **Auth** | `POST` | `/api/v1/auth/login` | Login and receive JWT Access & Refresh tokens |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| **Users** | `GET` | `/api/v1/users/me` | Current profile, requestsCount, and remaining quota |
| **AI Providers** | `GET` | `/api/v1/ai-providers` | [Admin] List all providers (keys masked) |
| **AI Providers** | `POST` | `/api/v1/ai-providers` | [Admin] Add provider (AES-256-GCM encrypted) |
| **AI Providers** | `PATCH` | `/api/v1/ai-providers/:id/default` | [Admin] Set global default provider |
| **AI Providers** | `PATCH` | `/api/v1/ai-providers/:id/toggle` | [Admin] Toggle provider active status |
| **AI Providers** | `DELETE` | `/api/v1/ai-providers/:id` | [Admin] Delete provider |
| **Chat** | `POST` | `/api/v1/chat/message` | Send prompt via Vercel AI SDK with quota enforcement |
| **Chat** | `GET` | `/api/v1/chat/conversations` | Paginated conversation threads |
| **Chat** | `GET` | `/api/v1/chat/conversations/:id` | Full message history |
| **Chat** | `DELETE` | `/api/v1/chat/conversations/:id` | Delete conversation thread |
| **Search** | `POST` | `/api/v1/search/query` | Execute web search and save query to DB |
| **Search** | `GET` | `/api/v1/search/history` | Paginated search history |
| **Search** | `GET` | `/api/v1/search/recent` | Recent distinct queries |

---

## 🧪 Automated Testing

Run the test suites for each milestone:
```bash
node scripts/test-block1.js   # Auth, Users, Swagger
node scripts/test-block2.js   # Providers, AES-256-GCM, RBAC
node scripts/test-block3.js   # Chat, Vercel AI SDK, 402 Quota Guard
node scripts/test-block4.js   # Web Search & End-to-End Integration
```
