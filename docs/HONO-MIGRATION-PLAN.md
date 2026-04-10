# Hono Backend Migration Plan

> Migrate backend từ Next.js Route Handlers + Neon HTTP → Hono API + Postgres local
> VPS: 2 core Xeon Gold 6133, 4GB RAM

---

## 1. Kiến trúc mới

```
dashboard-v2/
├── apps/
│   ├── web/                    # Next.js frontend (giữ nguyên trên Vercel)
│   │   ├── app/                # Pages, layouts, components
│   │   ├── lib/queries/        # ĐỔI → fetch() tới Hono API thay query DB trực tiếp
│   │   └── next.config.ts
│   │
│   └── api/                    # Hono backend MỚI (chạy trên VPS/localhost)
│       ├── src/
│       │   ├── index.ts        # Hono app entry
│       │   ├── routes/
│       │   │   ├── auth.ts     # /api/auth/* (verify JWT)
│       │   │   ├── projects.ts # /api/projects
│       │   │   ├── leads.ts    # /api/leads + /api/report
│       │   │   ├── upload.ts   # /api/upload/csv
│       │   │   ├── chat.ts     # /api/chat (AI)
│       │   │   ├── campaigns.ts# /api/campaigns + insights
│       │   │   └── webhooks.ts # /api/webhooks/facebook
│       │   ├── middleware/
│       │   │   ├── auth.ts     # JWT verify middleware
│       │   │   ├── rbac.ts     # getAccessibleProjectIds
│       │   │   └── rate-limit.ts
│       │   ├── services/       # Business logic (copy từ lib/csv/*, lib/aggregates/*)
│       │   │   ├── csv-pipeline.ts
│       │   │   ├── matcher.ts
│       │   │   ├── stage-mapper.ts
│       │   │   ├── upsert-service.ts
│       │   │   ├── aggregates.ts
│       │   │   └── fb-sync.ts  # Facebook API sync (Phase 2)
│       │   └── jobs/           # BullMQ background jobs (thay Inngest)
│       │       ├── queue.ts
│       │       ├── process-csv.ts
│       │       ├── sync-fb-insights.ts
│       │       └── nightly-snapshot.ts
│       ├── drizzle.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── db/                     # SHARED Drizzle schema (cả web + api dùng chung)
│       ├── schema/             # Copy từ db/schema/ hiện tại
│       ├── index.ts            # DB client (pg pool thay neon-http)
│       └── package.json
│
└── package.json                # Workspace root (npm workspaces hoặc turborepo)
```

---

## 2. Stack Hono API

| Component | Package | Lý do |
|---|---|---|
| **Framework** | `hono` | Lightweight, TypeScript, fast |
| **DB Driver** | `pg` + `drizzle-orm/node-postgres` | Persistent connection pool (thay neon-http) |
| **Background Jobs** | `bullmq` + `ioredis` | Self-hosted, unlimited, reliable |
| **Validation** | `zod` (giữ nguyên) | Share schemas |
| **Auth** | JWT verify (không cần next-auth) | Hono middleware verify token |
| **AI** | `ai` + `@ai-sdk/google` | Giữ nguyên |
| **Process Manager** | `pm2` | Auto-restart, cluster mode |
| **Reverse Proxy** | `nginx` hoặc `caddy` | HTTPS termination |

---

## 3. Migration steps

### Step 1: Setup workspace structure
```bash
mkdir -p apps/api/src/{routes,middleware,services,jobs}
mkdir -p packages/db/schema
# Move shared DB schema
mv db/schema/* packages/db/schema/
# Create workspace package.json
```

### Step 2: Hono API scaffold
```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import projectRoutes from "./routes/projects";
import leadRoutes from "./routes/leads";
import uploadRoutes from "./routes/upload";
import chatRoutes from "./routes/chat";
import webhookRoutes from "./routes/webhooks";
import { authMiddleware } from "./middleware/auth";

const app = new Hono()
  .use("*", logger())
  .use("*", cors({ origin: ["http://localhost:3000", "https://dashboard-v2-one-vert.vercel.app"] }))
  .use("/api/*", authMiddleware)
  .route("/api/projects", projectRoutes)
  .route("/api/leads", leadRoutes)
  .route("/api/upload", uploadRoutes)
  .route("/api/chat", chatRoutes)
  .route("/api/webhooks", webhookRoutes);

export default { port: 3001, fetch: app.fetch };
```

### Step 3: DB client với pg pool (thay neon-http)
```typescript
// packages/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // 20 persistent connections
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });
```

### Step 4: Auth middleware (verify JWT từ Next.js)
```typescript
// apps/api/src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verify(token, process.env.AUTH_SECRET!);
  c.set("user", { id: payload.sub, role: payload.role, email: payload.email });
  await next();
});
```

### Step 5: Migrate routes (1 by 1)
Mỗi file trong `app/api/*/route.ts` → chuyển thành Hono route.

**Trước** (Next.js):
```typescript
// app/api/upload/csv/route.ts
export async function POST(req: Request) {
  const user = await getSessionUser();
  // ... query DB trực tiếp
}
```

**Sau** (Hono):
```typescript
// apps/api/src/routes/upload.ts
import { Hono } from "hono";
const app = new Hono();

app.post("/csv", async (c) => {
  const user = c.get("user"); // từ middleware
  // ... query DB qua pool (2-5ms thay 50-100ms)
});

export default app;
```

### Step 6: Next.js chuyển sang fetch Hono API
```typescript
// lib/queries/projects.ts — TRƯỚC
import { db } from "@/db";
const projects = await db.select().from(projects);

// lib/queries/projects.ts — SAU
const API_URL = process.env.HONO_API_URL ?? "http://localhost:3001";
const res = await fetch(`${API_URL}/api/projects`, {
  headers: { Authorization: `Bearer ${token}` },
});
const projects = await res.json();
```

### Step 7: BullMQ thay Inngest
```typescript
// apps/api/src/jobs/queue.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379");
export const csvQueue = new Queue("csv-processing", { connection: redis });

// Worker
new Worker("csv-processing", async (job) => {
  const { uploadId, projectId, type, fileContent } = job.data;
  // ... reuse existing upsert-service logic
}, { connection: redis });
```

### Step 8: PM2 deploy
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "hono-api",
    script: "apps/api/dist/index.js",
    instances: 2,       // 2 core → 2 instances
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
    }
  }]
};
```

---

## 4. Performance comparison

| Metric | Hiện tại (Neon HTTP) | Sau (Postgres pool) |
|---|---|---|
| Query latency | 50-100ms/query | **2-5ms/query** |
| 8 queries page load | 2-3.5s | **50-100ms** |
| CSV upload 750 rows | 28s | **3-5s** |
| Connection overhead | New HTTPS per query | **Reuse pool** |
| Cold start | 800ms (serverless) | **0ms (always-on)** |

---

## 5. Env vars cho Hono API

```env
# Database (Postgres local trên VPS)
DATABASE_URL=postgresql://user:pass@localhost:5432/dashboard_v2

# Redis (BullMQ jobs)
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET=same-as-nextjs

# AI
GOOGLE_GENERATIVE_AI_API_KEY=...

# Facebook (Phase 2)
FB_APP_ID=
FB_APP_SECRET=
FB_SYSTEM_USER_TOKEN=
FB_AD_ACCOUNT_ID=

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://dashboard-v2-one-vert.vercel.app
```

---

## 6. Prompt cho session mới

```
Đây là dự án dashboard lead BĐS cho Smartland. Đang migrate backend
từ Next.js Route Handlers sang Hono API trên localhost/VPS.

Đọc trước:
1. docs/HONO-MIGRATION-PLAN.md — kiến trúc + migration steps
2. docs/PHASE-2-PLAN.md — Facebook API integration (làm sau migrate)
3. docs/HANDOFF.md — context tổng

Hiện tại:
- Next.js frontend ở apps/web/ (hoặc root/)
- Cần tạo Hono API ở apps/api/
- Share Drizzle schema ở packages/db/
- DB driver đổi từ neon-http → node-postgres pool

Tôi muốn: scaffold Hono project + migrate API routes + setup BullMQ.
VPS: 2 core Xeon Gold 6133, 4GB RAM. Chạy localhost trước.
```
