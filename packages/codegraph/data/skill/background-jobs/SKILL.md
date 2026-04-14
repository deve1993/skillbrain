---
name: background-jobs
description: Background job processing with BullMQ, Inngest, Trigger.dev, Upstash QStash. Use when implementing async tasks, scheduled jobs, event-driven workflows, retries, or dead letter queues in Next.js.
version: 1.0.0
---

# Background Jobs Skill

Comprehensive guide for background job processing in Node.js / Next.js applications.

## Decision Matrix

| Criteria | BullMQ | Inngest | Trigger.dev v3 | Upstash QStash |
|----------|--------|---------|-----------------|----------------|
| **Infrastructure** | Self-hosted Redis | Serverless (cloud/self-host) | Serverless (cloud/self-host) | Serverless (Upstash) |
| **Best for** | High throughput, fine control | Event-driven workflows | Long-running tasks, cron | HTTP-based messaging |
| **Pricing** | Free (+ Redis cost) | Free tier 5K runs/mo | Free tier 5K runs/mo | Free tier 500 msg/day |
| **Requires server** | Yes (persistent worker) | No (runs in serverless) | No (runs in serverless) | No (HTTP endpoint) |
| **Max execution** | Unlimited | 2h (serverless) | 24h+ | Depends on endpoint |
| **Dashboard** | Bull Board (self-host) | Built-in cloud UI | Built-in cloud UI | Upstash console |
| **Complexity** | Medium-High | Low | Low-Medium | Low |
| **When to pick** | VPS/Docker deploys, need full queue control | Vercel/serverless, event workflows | Complex cron, long tasks | Simple async, Vercel |

---

## 1. BullMQ (Redis-Based Queue)

### Installation

```bash
pnpm add bullmq ioredis
```

### Connection Setup

```ts
// lib/queue/connection.ts
import IORedis from "ioredis";

export const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});
```

### Define a Queue

```ts
// lib/queue/email-queue.ts
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string>;
  idempotencyKey?: string;
}

export const emailQueue = new Queue<EmailJobData>("email", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400 },   // Keep completed 24h
    removeOnFail: { age: 604800 },       // Keep failed 7 days
  },
});
```

### Worker (runs in a persistent process)

```ts
// workers/email-worker.ts
import { Worker, Job } from "bullmq";
import { redisConnection } from "@/lib/queue/connection";
import type { EmailJobData } from "@/lib/queue/email-queue";

const worker = new Worker<EmailJobData>(
  "email",
  async (job: Job<EmailJobData>) => {
    const { to, subject, template, variables } = job.data;

    // Report progress
    await job.updateProgress(10);

    const result = await sendEmail({ to, subject, template, variables });

    await job.updateProgress(100);
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second (rate limiting)
    },
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
```

### Job Types: Delayed, Repeated, Prioritized

```ts
import { emailQueue } from "@/lib/queue/email-queue";

// Delayed job — runs after 30 minutes
await emailQueue.add("welcome", data, {
  delay: 30 * 60 * 1000,
});

// Repeated job — runs every day at 9am
await emailQueue.add("daily-digest", data, {
  repeat: {
    pattern: "0 9 * * *", // Cron syntax
    tz: "Europe/Rome",
  },
});

// Priority job — lower number = higher priority
await emailQueue.add("password-reset", data, {
  priority: 1, // Processes before priority 10
});

// Bulk add
await emailQueue.addBulk([
  { name: "notify", data: userData1, opts: { priority: 5 } },
  { name: "notify", data: userData2, opts: { priority: 5 } },
]);
```

### Dead Letter Queue

```ts
// lib/queue/dlq.ts
import { Queue, Worker } from "bullmq";
import { redisConnection } from "./connection";

export const deadLetterQueue = new Queue("dead-letter", {
  connection: redisConnection,
});

// In the main worker — move to DLQ on final failure
const worker = new Worker(
  "email",
  async (job) => {
    // ... process
  },
  {
    connection: redisConnection,
    settings: {
      backoffStrategy: (attemptsMade) => {
        // Custom backoff: 1s, 4s, 16s, 64s
        return Math.pow(4, attemptsMade) * 1000;
      },
    },
  }
);

worker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await deadLetterQueue.add("failed-email", {
      originalQueue: "email",
      jobId: job.id,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});
```

### Next.js API Route to Enqueue

```ts
// app/api/jobs/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emailQueue } from "@/lib/queue/email-queue";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const idempotencyKey = body.idempotencyKey ?? nanoid();

  const job = await emailQueue.add("send-email", {
    ...body,
    idempotencyKey,
  }, {
    jobId: idempotencyKey, // Prevents duplicate processing
  });

  return NextResponse.json({ jobId: job.id, status: "queued" });
}
```

### Bull Board Dashboard

```bash
pnpm add @bull-board/api @bull-board/express express
```

```ts
// workers/dashboard.ts
import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "@/lib/queue/email-queue";
import { deadLetterQueue } from "@/lib/queue/dlq";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(deadLetterQueue),
  ],
  serverAdapter,
});

const app = express();
app.use("/admin/queues", serverAdapter.getRouter());
app.listen(3001, () => console.log("Bull Board on http://localhost:3001/admin/queues"));
```

---

## 2. Inngest (Serverless Event-Driven)

### Installation

```bash
pnpm add inngest
```

### Client Setup

```ts
// lib/inngest/client.ts
import { EventSchemas, Inngest } from "inngest";

export const inngest = new Inngest({
  id: "my-app",
  schemas: new EventSchemas().fromRecord<{
    "user/created": { data: { userId: string; email: string; name: string } };
    "order/completed": { data: { orderId: string; amount: number } };
    "email/send": { data: { to: string; template: string } };
  }>(),
});
```

### Next.js Route Handler (serves the Inngest API)

```ts
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { onboardingSequence } from "@/lib/inngest/functions/onboarding";
import { dailyDigest } from "@/lib/inngest/functions/daily-digest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [onboardingSequence, dailyDigest],
});
```

### Function: Onboarding Email Sequence

```ts
// lib/inngest/functions/onboarding.ts
import { inngest } from "../client";

export const onboardingSequence = inngest.createFunction(
  {
    id: "onboarding-email-sequence",
    retries: 3,
    cancelOn: [{ event: "user/deleted", match: "data.userId" }],
  },
  { event: "user/created" },
  async ({ event, step }) => {
    // Step 1: Send welcome email immediately
    await step.run("send-welcome-email", async () => {
      await sendEmail({
        to: event.data.email,
        template: "welcome",
        variables: { name: event.data.name },
      });
    });

    // Step 2: Wait 1 day
    await step.sleep("wait-1-day", "1d");

    // Step 3: Send tips email
    await step.run("send-tips-email", async () => {
      await sendEmail({
        to: event.data.email,
        template: "getting-started-tips",
      });
    });

    // Step 4: Wait 3 days
    await step.sleep("wait-3-days", "3d");

    // Step 5: Check if user has completed setup
    const hasSetup = await step.run("check-setup", async () => {
      const user = await db.user.findUnique({
        where: { id: event.data.userId },
      });
      return user?.setupCompletedAt !== null;
    });

    if (!hasSetup) {
      await step.run("send-reminder", async () => {
        await sendEmail({
          to: event.data.email,
          template: "complete-setup-reminder",
        });
      });
    }

    // Step 6: Wait for a conversion event (up to 7 days)
    const conversion = await step.waitForEvent("wait-for-upgrade", {
      event: "order/completed",
      match: "data.userId",
      timeout: "7d",
    });

    if (!conversion) {
      await step.run("send-discount", async () => {
        await sendEmail({
          to: event.data.email,
          template: "special-discount",
        });
      });
    }
  }
);
```

### Fan-Out Pattern

```ts
// lib/inngest/functions/fan-out.ts
export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "order/completed" },
  async ({ event, step }) => {
    // Fan-out: run multiple steps in parallel
    const [invoice, notification, analytics] = await Promise.all([
      step.run("generate-invoice", async () => {
        return await generateInvoice(event.data.orderId);
      }),
      step.run("send-notification", async () => {
        return await sendOrderNotification(event.data.orderId);
      }),
      step.run("track-analytics", async () => {
        return await trackPurchase(event.data.orderId, event.data.amount);
      }),
    ]);

    // Continue with results
    await step.run("finalize", async () => {
      await markOrderProcessed(event.data.orderId, invoice.url);
    });
  }
);
```

### Scheduled Function (Cron)

```ts
// lib/inngest/functions/daily-digest.ts
export const dailyDigest = inngest.createFunction(
  { id: "daily-digest" },
  { cron: "0 9 * * *" }, // Every day at 9am UTC
  async ({ step }) => {
    const users = await step.run("get-active-users", async () => {
      return await db.user.findMany({
        where: { digestEnabled: true },
        select: { id: true, email: true },
      });
    });

    // Process in batches to avoid timeouts
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await step.run(`send-batch-${i}`, async () => {
        await Promise.all(
          batch.map((user) => sendDigestEmail(user.id, user.email))
        );
      });
    }
  }
);
```

### Sending Events (from anywhere in your app)

```ts
// In a Server Action, API route, or server component
import { inngest } from "@/lib/inngest/client";

// Single event
await inngest.send({
  name: "user/created",
  data: { userId: "usr_123", email: "dan@example.com", name: "Dan" },
});

// Batch events
await inngest.send([
  { name: "email/send", data: { to: "a@b.com", template: "welcome" } },
  { name: "email/send", data: { to: "c@d.com", template: "welcome" } },
]);
```

---

## 3. Trigger.dev v3 (Serverless Background Jobs)

### Installation

```bash
pnpm add @trigger.dev/sdk
npx trigger.dev@latest init
```

### Task Definition

```ts
// trigger/tasks/generate-report.ts
import { task, logger } from "@trigger.dev/sdk/v3";

export const generateReport = task({
  id: "generate-report",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: { userId: string; reportType: string }) => {
    logger.info("Generating report", { payload });

    // Long-running work is fine — no serverless timeout
    const data = await fetchReportData(payload.userId, payload.reportType);
    const pdf = await generatePDF(data);
    const url = await uploadToS3(pdf);

    logger.info("Report generated", { url });
    return { url };
  },
});
```

### Scheduled Trigger (Cron)

```ts
// trigger/tasks/cleanup.ts
import { schedules, logger } from "@trigger.dev/sdk/v3";

export const cleanupTask = schedules.task({
  id: "daily-cleanup",
  cron: "0 3 * * *", // 3am UTC daily
  run: async () => {
    logger.info("Running daily cleanup");

    const deleted = await db.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    logger.info(`Cleaned up ${deleted.count} expired sessions`);
    return { deleted: deleted.count };
  },
});
```

### Triggering Tasks from Next.js

```ts
// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { generateReport } from "@/trigger/tasks/generate-report";

export async function POST(req: NextRequest) {
  const { userId, reportType } = await req.json();

  // Trigger and forget
  const handle = await tasks.trigger<typeof generateReport>("generate-report", {
    userId,
    reportType,
  });

  return NextResponse.json({ runId: handle.id });
}
```

### Trigger from Server Actions

```ts
// app/actions/reports.ts
"use server";

import { tasks } from "@trigger.dev/sdk/v3";

export async function requestReport(userId: string, type: string) {
  const handle = await tasks.trigger("generate-report", { userId, reportType: type });
  return { runId: handle.id, status: "processing" };
}
```

### Batch Triggering

```ts
import { tasks } from "@trigger.dev/sdk/v3";

// Trigger many jobs at once
const results = await tasks.batchTrigger("generate-report", [
  { payload: { userId: "usr_1", reportType: "monthly" } },
  { payload: { userId: "usr_2", reportType: "monthly" } },
  { payload: { userId: "usr_3", reportType: "monthly" } },
]);
```

---

## 4. Upstash QStash (HTTP-Based Serverless Queue)

### Installation

```bash
pnpm add @upstash/qstash
```

### Client Setup

```ts
// lib/qstash/client.ts
import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});
```

### Publishing a Message

```ts
// app/actions/enqueue.ts
"use server";

import { qstash } from "@/lib/qstash/client";

export async function enqueueEmailJob(to: string, template: string) {
  const result = await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/send-email`,
    body: { to, template },
    retries: 3,
    contentBasedDeduplication: true, // Idempotency
  });

  return { messageId: result.messageId };
}
```

### Receiver Endpoint

```ts
// app/api/jobs/send-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  // Verify the request comes from QStash
  const signature = req.headers.get("Upstash-Signature");
  const body = await req.text();

  const isValid = await receiver.verify({
    signature: signature!,
    body,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(body);
  await sendEmail(data.to, data.template);

  return NextResponse.json({ success: true });
}
```

### Delayed and Scheduled Messages

```ts
import { qstash } from "@/lib/qstash/client";

// Delayed message — deliver after 60 seconds
await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/send-email`,
  body: { to: "user@example.com", template: "reminder" },
  delay: 60, // seconds
});

// Scheduled (cron) — runs every hour
await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/hourly-sync`,
  body: { type: "sync" },
  cron: "0 * * * *",
});
```

### Callback URL and DLQ

```ts
await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process-order`,
  body: { orderId: "order_123" },
  retries: 5,
  callback: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/callback`,
  failureCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/dlq`,
});

// app/api/jobs/callback/route.ts
export async function POST(req: NextRequest) {
  const result = await req.json();
  // result contains the response from the original endpoint
  console.log("Job completed:", result);
  return NextResponse.json({ ok: true });
}

// app/api/jobs/dlq/route.ts
export async function POST(req: NextRequest) {
  const failure = await req.json();
  // Log to error tracking, notify team
  await logToSentry("QStash job failed permanently", failure);
  return NextResponse.json({ ok: true });
}
```

---

## 5. Patterns

### Idempotency Keys

Every background job should be idempotent. Use a deterministic key to prevent duplicate processing.

```ts
// Pattern: derive idempotency key from the event
function getIdempotencyKey(event: string, entityId: string, action: string): string {
  return `${event}:${entityId}:${action}`;
}

// In BullMQ — use jobId
await emailQueue.add("send", data, {
  jobId: getIdempotencyKey("order", orderId, "confirmation-email"),
});

// In database — check before processing
async function processWithIdempotency(key: string, fn: () => Promise<void>) {
  const existing = await db.processedJob.findUnique({ where: { key } });
  if (existing) return; // Already processed

  await fn();
  await db.processedJob.create({ data: { key, processedAt: new Date() } });
}
```

### Graceful Shutdown (BullMQ)

```ts
// workers/index.ts
import { Worker } from "bullmq";

const workers: Worker[] = [];

function registerWorker(worker: Worker) {
  workers.push(worker);
}

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  console.log("All workers stopped.");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

### Event-Driven Architecture Pattern

```ts
// lib/events.ts — central event bus (works with Inngest or custom)
type EventMap = {
  "user.created": { userId: string; email: string };
  "order.completed": { orderId: string; userId: string; amount: number };
  "payment.failed": { orderId: string; reason: string };
};

// Emit from anywhere
async function emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
  // Option A: Inngest
  await inngest.send({ name: event, data });

  // Option B: BullMQ
  // await eventQueue.add(event, data);

  // Option C: QStash
  // await qstash.publishJSON({ url: routeFor(event), body: data });
}

// Usage in a Server Action
export async function createOrder(formData: FormData) {
  const order = await db.order.create({ data: { /* ... */ } });
  await emit("order.completed", {
    orderId: order.id,
    userId: order.userId,
    amount: order.total,
  });
}
```

### Retry with Circuit Breaker

```ts
// lib/queue/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private threshold: number = 5,
    private resetTimeoutMs: number = 60_000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = "closed";
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = "open";
      }
      throw err;
    }
  }
}

// Usage in a worker
const emailBreaker = new CircuitBreaker(5, 60_000);

const worker = new Worker("email", async (job) => {
  await emailBreaker.execute(async () => {
    await sendEmail(job.data);
  });
});
```

---

## Quick Start Recommendations

| Scenario | Recommended Tool |
|----------|-----------------|
| Vercel + simple async tasks | **QStash** |
| Vercel + multi-step workflows | **Inngest** |
| Vercel + long-running / cron | **Trigger.dev** |
| VPS / Docker + high throughput | **BullMQ** |
| Need full queue visibility | **BullMQ** + Bull Board |
| Event-driven microservices | **Inngest** |
| Webhook relay / fan-out | **QStash** |

## Environment Variables

```env
# BullMQ
REDIS_URL=redis://localhost:6379

# Inngest
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_xxx

# Upstash QStash
QSTASH_TOKEN=your-token
QSTASH_CURRENT_SIGNING_KEY=sig_xxx
QSTASH_NEXT_SIGNING_KEY=sig_xxx
```
