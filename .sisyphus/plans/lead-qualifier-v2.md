# Lead Qualifier v2 — Multi-Tenant Product Transformation

## TL;DR

> **Quick Summary**: Transform the lead-qualifier prototype (in-memory sessions, file-based skills, Angular client) into a multi-tenant product with Supabase persistence, embeddable Web Component widget, configurable webhooks, SSE streaming, and per-skill branding.
> 
> **Deliverables**:
> - Supabase-backed persistence for sessions, leads, and skills
> - Embeddable `<script>` widget (Web Component + Shadow DOM) with per-skill branding
> - SSE streaming responses (token-by-token like ChatGPT)
> - Configurable webhooks per skill (fire on lead qualification)
> - Per-skill configuration: model, greeting, colors, logo, webhook URL, emailTo
> - Static demo pages per skill for sales
> - Rate limiting, CORS configuration, Docker deployment
> - Test infrastructure (Vitest) with tests for critical paths
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Task 1 → Task 4 → Task 7 → Task 9 → Task 13 → Task 16 → F1-F4

---

## Context

### Original Request
Transform the lead-qualifier chatbot from a working prototype into a deployable multi-tenant product. Key features: Supabase persistence, embeddable widget, configurable webhooks, SSE streaming, per-skill YAML-style configuration.

### Interview Summary
**Key Discussions**:
- **Product model**: Widget + lightweight demo page. Angular client eliminated.
- **Skill storage**: Supabase DB (not .md files). All config stored per-skill.
- **Multi-tenant**: One deployment serves N clients via `data-skill` attribute.
- **Branding**: Colors, logo, greeting, position — all configurable per skill.
- **Streaming**: SSE (Server-Sent Events), mandatory for modern UX.
- **Webhooks**: Per-skill, fire on lead qualification alongside email.
- **Analytics**: Query Supabase directly. No external tools.
- **Tests**: Vitest, tests after implementation for critical paths.
- **Hosting**: Coolify (Docker).
- **Language**: All files in English.

### Metis Review
**Identified Gaps** (all addressed):
- **Message type is wrong**: `schema.ts:Message.content` is `string` but the code stores complex Anthropic content blocks via `as never` casts. Must fix first — everything depends on it.
- **Streaming + tool_use is the hardest problem**: When Claude calls `emit_evaluation` mid-stream, the system must pause streaming, process the tool, fire webhook/email, make a second streaming call, and continue seamlessly. Dedicated task with dedicated tests.
- **Session lifecycle undefined**: Added 24h TTL, 50-message cap per session.
- **Widget serving strategy**: Same Express server for V1 (no separate CDN).
- **Webhook retry policy**: 3 attempts with exponential backoff (1s, 4s, 16s), then log failure.
- **Email + webhook coexistence**: Both fire independently if both configured.
- **Lead deduplication**: Not in V1. Each session = separate lead.
- **Single Anthropic API key**: Shared across all tenants for V1.
- **Widget `document.currentScript`**: Must capture synchronously at IIFE evaluation time (null in async scripts).
- **Shadow DOM CSS inheritance**: Must reset inherited properties (font-family, color, line-height) explicitly.
- **`X-Accel-Buffering: no`**: Required header for SSE through Coolify/nginx proxy.

---

## Work Objectives

### Core Objective
Transform the lead-qualifier from a single-tenant prototype with in-memory storage into a multi-tenant SaaS product backed by Supabase, delivered via an embeddable Web Component widget with SSE streaming, configurable webhooks, and per-skill branding.

### Concrete Deliverables
- Supabase database with tables: `skills`, `sessions`, `leads`, `webhook_logs`
- Refactored backend: Express + Supabase + SSE streaming + webhook dispatch
- Embeddable widget: `<script async src="/widget.js" data-skill="terraemare"></script>`
- Demo page system: `GET /demo/:skillSlug` serves static HTML with embedded widget
- Rate limiting: 20 req/min per IP per skill
- Docker deployment config for Coolify
- Vitest test suite for critical paths

### Definition of Done
- [ ] `npm test` passes all tests (0 failures)
- [ ] `docker build -t lead-qualifier .` succeeds
- [ ] Widget renders on any HTML page via `<script>` tag
- [ ] Streaming responses arrive token-by-token via SSE
- [ ] Lead qualification triggers webhook POST + email notification
- [ ] Server restart preserves all sessions and leads (Supabase persistence)
- [ ] Angular `client/` directory removed

### Must Have
- Supabase persistence for sessions, leads, skills
- Multi-tenant: one deployment serves N skills
- Embeddable Web Component widget with Shadow DOM
- SSE streaming with tool_use handling
- Per-skill configuration (model, greeting, colors, logo, webhook, email)
- Configurable webhooks with retry logic
- Rate limiting
- Docker deployment
- Test infrastructure + critical path tests

### Must NOT Have (Guardrails)
- **No admin UI** — skills managed via Supabase dashboard/SQL only
- **No user authentication for widget visitors** — anonymous public users
- **No per-tenant Anthropic API keys** — single shared key for V1
- **No React/Preact in the widget** — vanilla TypeScript only, <30KB gzipped
- **No custom tool definitions per skill** — all skills use the same `emit_evaluation` tool
- **No individual message rows** — messages stored as JSONB array on sessions table
- **No real-time analytics dashboard** — use Supabase SQL queries
- **No WebSocket** — SSE for streaming, POST for sending
- **No theming engine** — branding is 4 values: `primaryColor`, `greeting`, `logo`, `position`
- **No file uploads in chat** — text-only
- **No returning visitor memory** — every page load = new session
- **No multi-language widget UI** — widget UI strings in English, AI responds in user's language
- **No `as any`, `@ts-ignore`, `@ts-expect-error`** — proper types throughout
- **No `eslint-disable`** — fix the actual issue

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (setting up fresh)
- **Automated tests**: Tests after implementation
- **Framework**: Vitest
- **Setup task**: Task 3 sets up Vitest configuration

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend API**: Use Bash (curl) — send requests, assert status + response fields
- **SSE Streaming**: Use Bash (curl -N) — verify `data:` events arrive individually
- **Widget**: Use Playwright — render widget on test page, interact, assert DOM in Shadow DOM
- **Persistence**: Use Bash (curl) — create session, restart server concept (verify DB query), assert data survives

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately):
├── Task 1: Fix Message types + schema cleanup [quick]
├── Task 2: Supabase project setup + migration SQL [quick]
├── Task 3: Vitest infrastructure setup [quick]
└── Task 4: Widget scaffold (Web Component + IIFE build) [quick]

Wave 2 (Core data layer — after Wave 1):
├── Task 5: Session persistence (replace Map → Supabase) (depends: 1, 2) [unspecified-high]
├── Task 6: Skill loading from Supabase (depends: 2) [unspecified-high]
├── Task 7: SSE streaming + tool_use handling (depends: 1, 5) [deep]
└── Task 8: Webhook service with retry (depends: 2) [unspecified-high]

Wave 3 (Widget + notifications — after Wave 2):
├── Task 9: Widget chat UI with SSE streaming (depends: 4, 7) [visual-engineering]
├── Task 10: Widget branding from skill config (depends: 6, 9) [visual-engineering]
├── Task 11: Demo page system (depends: 9) [quick]
└── Task 12: Per-skill email notification (depends: 6, 8) [quick]

Wave 4 (Hardening — after Wave 3):
├── Task 13: Rate limiting middleware (depends: 5) [quick]
├── Task 14: CORS + security headers (depends: 6) [quick]
├── Task 15: Integration tests for full flow (depends: 3, 7, 8, 9) [unspecified-high]
└── Task 16: Docker + deployment config (depends: all) [quick]

Wave 5 (Cleanup — after Wave 4):
└── Task 17: Remove Angular client + final cleanup (depends: all) [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real QA execution (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: T1 → T5 → T7 → T9 → T15 → T16 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Waves 1-3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 5, 7 | 1 |
| 2 | — | 5, 6, 8 | 1 |
| 3 | — | 15 | 1 |
| 4 | — | 9 | 1 |
| 5 | 1, 2 | 7, 13 | 2 |
| 6 | 2 | 10, 12, 14 | 2 |
| 7 | 1, 5 | 9, 15 | 2 |
| 8 | 2 | 12 | 2 |
| 9 | 4, 7 | 10, 11, 15 | 3 |
| 10 | 6, 9 | — | 3 |
| 11 | 9 | — | 3 |
| 12 | 6, 8 | — | 3 |
| 13 | 5 | — | 4 |
| 14 | 6 | — | 4 |
| 15 | 3, 7, 8, 9 | 16 | 4 |
| 16 | all | — | 4 |
| 17 | all | — | 5 |

### Agent Dispatch Summary

- **Wave 1**: **4 agents** — T1 `quick`, T2 `quick`, T3 `quick`, T4 `quick`
- **Wave 2**: **4 agents** — T5 `unspecified-high`, T6 `unspecified-high`, T7 `deep`, T8 `unspecified-high`
- **Wave 3**: **4 agents** — T9 `visual-engineering`, T10 `visual-engineering`, T11 `quick`, T12 `quick`
- **Wave 4**: **4 agents** — T13 `quick`, T14 `quick`, T15 `unspecified-high`, T16 `quick`
- **Wave 5**: **1 agent** — T17 `quick`
- **FINAL**: **4 agents** — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. Fix Message Types + Schema Cleanup

  **What to do**:
  - Fix `Message.content` in `src/schema.ts` — currently typed as `string` but actually stores Anthropic `ContentBlock[]` and `ToolResultBlockParam[]` (see `qualifier.ts` lines 71, 72-80 where `as never` casts hide the mismatch)
  - Define proper union type: `string | Anthropic.ContentBlock[] | Anthropic.ToolResultBlockParam[]`
  - Add `StoredMessage` interface for DB persistence (role + content as JSONB-compatible)
  - Add `SkillConfig` interface: `id`, `slug`, `name`, `systemPrompt`, `model`, `greeting`, `branding` (primaryColor, logo, position), `webhookUrl`, `emailTo`, `allowedOrigins`, `isActive`, `maxMessages` (default 50), `createdAt`, `updatedAt`
  - Add `StoredSession` interface: `id`, `skillId`, `messages` (JSONB), `lead` (JSONB), `qualified`, `notified`, `qualifiedAt`, `createdAt`, `expiresAt` (24h TTL)
  - Add `WebhookLog` interface: `id`, `sessionId`, `skillId`, `payload`, `statusCode`, `attempts`, `lastAttemptAt`, `success`
  - Remove `as never` casts in `qualifier.ts` — use proper types
  - Update `Lead` interface: add optional `qualifiedAt: string` field

  **Must NOT do**:
  - Do NOT change the qualifier logic flow — only fix types
  - Do NOT add Supabase client yet — this is types only
  - Do NOT rename existing files

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Pure TypeScript type refactoring, no domain skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: None

  **References**:
  - `src/schema.ts` — Current schema with wrong `Message.content: string` type. Full file, 41 lines.
  - `src/qualifier.ts:57-103` — The tool_use handling loop. Lines 71 and 72-80 use `as never` to hide type mismatches. The `response.content` is `Anthropic.ContentBlock[]`, not `string`.
  - `src/qualifier.ts:1-2` — Imports from `@anthropic-ai/sdk` — check SDK types for `ContentBlock`, `ToolUseBlock`, `ToolResultBlockParam`.
  - `src/lead.util.ts` — `isLeadQualified` function. Uses `Partial<Lead>` — must remain compatible.
  - `src/session.ts` — Uses `Session` type. Functions signatures stay the same.

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` passes with zero errors
  - [ ] Zero `as never` or `as any` casts remain in `qualifier.ts`
  - [ ] `SkillConfig`, `StoredSession`, `StoredMessage`, `WebhookLog` interfaces exported from `schema.ts`
  - [ ] Existing `processMessage` function still compiles and runs

  **QA Scenarios**:

  ```
  Scenario: TypeScript compiles without errors
    Tool: Bash
    Preconditions: All source files saved
    Steps:
      1. Run `npx tsc --noEmit` in project root
      2. Check exit code is 0
      3. Check stdout/stderr for zero error lines
    Expected Result: Exit code 0, no error output
    Failure Indicators: Non-zero exit code, "error TS" in output
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt

  Scenario: No unsafe casts remain
    Tool: Bash (grep)
    Preconditions: qualifier.ts has been updated
    Steps:
      1. Run `grep -n "as never\|as any\|as unknown\|@ts-ignore\|@ts-expect-error" src/qualifier.ts`
      2. Verify zero matches
    Expected Result: No output (zero matches)
    Failure Indicators: Any line returned by grep
    Evidence: .sisyphus/evidence/task-1-no-unsafe-casts.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 2. Supabase Project Setup + Migration SQL

  **What to do**:
  - Create Supabase client module: `src/lib/supabase.ts`
    - Use `@supabase/supabase-js` with service role key
    - Options: `auth: { persistSession: false, autoRefreshToken: false }`
    - Single module-level instance (singleton)
  - Write migration SQL file: `supabase/migrations/001_initial_schema.sql`
    - Table `skills`: `id` (uuid PK), `slug` (unique, indexed), `name`, `system_prompt` (text), `model` (default 'claude-sonnet-4-6'), `greeting` (text), `branding` (jsonb: primaryColor, logo, position), `webhook_url` (nullable), `email_to` (nullable), `allowed_origins` (text[] default '{}'), `is_active` (boolean default true), `max_messages` (int default 50), `created_at`, `updated_at`
    - Table `sessions`: `id` (uuid PK), `skill_id` (FK → skills.id), `messages` (jsonb default '[]'), `lead` (jsonb default '{}'), `qualified` (boolean default false), `notified` (boolean default false), `qualified_at` (timestamptz nullable), `created_at`, `expires_at` (timestamptz, default now() + 24h)
    - Table `leads`: `id` (uuid PK), `session_id` (FK → sessions.id), `skill_id` (FK → skills.id), `name`, `email`, `phone`, `company`, `budget`, `use_case`, `timeline`, `is_decision_maker`, `qualified_at`, `created_at`
    - Table `webhook_logs`: `id` (uuid PK), `session_id` (FK), `skill_id` (FK), `webhook_url`, `payload` (jsonb), `status_code` (int), `attempts` (int default 0), `last_attempt_at`, `success` (boolean default false), `created_at`
    - Enable RLS on all tables (defense-in-depth)
    - Create indexes: `sessions.skill_id`, `sessions.expires_at`, `leads.skill_id`, `leads.qualified_at`, `skills.slug`
  - Add seed SQL: `supabase/seed.sql` — insert the 3 existing skills (default, terraemare, cee-machines) with their prompt content from the current `.md` files
  - Add `@supabase/supabase-js` to `package.json` dependencies
  - Add `.env.example` with: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`, `PORT`
  - Create `src/db/types.ts` — Supabase generated types (or manually match the schema)

  **Must NOT do**:
  - Do NOT replace session.ts logic yet — this is schema + client only
  - Do NOT delete the existing `.md` skill files — they're the source for seed data
  - Do NOT use Supabase auth — service role key only

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `["database"]`
    - `database`: Supabase schema design, migration patterns, connection setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 8
  - **Blocked By**: None

  **References**:
  - `src/schema.ts` — Current `Lead`, `Session`, `Message` interfaces (after Task 1 fixes types)
  - `skills/default.md` — Default skill prompt content (47 lines). Seed data source.
  - `skills/terraemare.md` — Terra e Mare skill prompt (108 lines). Seed data source.
  - `skills/cee-machines.md` — CEE Machines skill prompt (135 lines). Seed data source.
  - `package.json` — Current dependencies. Add `@supabase/supabase-js`.
  - Supabase docs: https://supabase.com/docs/reference/javascript/initializing — Service role client setup

  **Acceptance Criteria**:
  - [ ] `src/lib/supabase.ts` exports a typed Supabase client
  - [ ] `supabase/migrations/001_initial_schema.sql` creates all 4 tables with proper types, FKs, indexes
  - [ ] `supabase/seed.sql` inserts 3 skills with correct prompt content
  - [ ] `.env.example` documents all required environment variables
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:

  ```
  Scenario: Migration SQL is valid
    Tool: Bash
    Preconditions: SQL file exists
    Steps:
      1. Read `supabase/migrations/001_initial_schema.sql`
      2. Verify it contains CREATE TABLE for: skills, sessions, leads, webhook_logs
      3. Verify FK constraints reference correct tables
      4. Verify indexes exist for: skills.slug, sessions.skill_id, sessions.expires_at
    Expected Result: All 4 tables defined with proper constraints
    Failure Indicators: Missing table, missing FK, syntax error
    Evidence: .sisyphus/evidence/task-2-migration-review.txt

  Scenario: Seed SQL contains all 3 skills
    Tool: Bash (grep)
    Preconditions: seed.sql exists
    Steps:
      1. Run `grep -c "INSERT INTO skills" supabase/seed.sql`
      2. Verify count is 3
      3. Grep for slugs: 'default', 'terraemare', 'cee-machines'
    Expected Result: 3 INSERT statements, all 3 slugs present
    Failure Indicators: Missing skill, wrong slug
    Evidence: .sisyphus/evidence/task-2-seed-review.txt

  Scenario: TypeScript compiles with Supabase client
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `npm install`
      2. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Failure Indicators: Import errors for @supabase/supabase-js
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 3. Vitest Infrastructure Setup

  **What to do**:
  - Install `vitest` as dev dependency
  - Create `vitest.config.ts` at project root with TypeScript support
  - Create `tests/` directory
  - Create `tests/setup.ts` — global test setup (env vars, mocks)
  - Create `tests/helpers.ts` — shared test utilities (mock Supabase client, mock Anthropic client)
  - Create one example test: `tests/lead.util.test.ts` — test `isLeadQualified` function
  - Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts

  **Must NOT do**:
  - Do NOT write tests for features that don't exist yet
  - Do NOT add E2E/integration tests — those come in Task 15

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `["testing"]`
    - `testing`: Vitest setup patterns, test configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 15
  - **Blocked By**: None

  **References**:
  - `package.json` — Current scripts and dependencies. Add vitest.
  - `tsconfig.json` — TypeScript config. Vitest needs compatible settings.
  - `src/lead.util.ts` — Simple pure function, perfect for first test. 9 lines.

  **Acceptance Criteria**:
  - [ ] `npm test` runs and passes (at least 1 test for `isLeadQualified`)
  - [ ] `vitest.config.ts` exists with TypeScript support
  - [ ] `tests/helpers.ts` exports mock factories for Supabase and Anthropic clients

  **QA Scenarios**:

  ```
  Scenario: Test suite runs successfully
    Tool: Bash
    Preconditions: vitest installed, test files exist
    Steps:
      1. Run `npm test`
      2. Check exit code is 0
      3. Verify output shows at least 1 test passed
    Expected Result: Exit code 0, "1 passed" in output
    Failure Indicators: Non-zero exit code, "FAIL" in output
    Evidence: .sisyphus/evidence/task-3-vitest-run.txt

  Scenario: isLeadQualified tests cover edge cases
    Tool: Bash
    Preconditions: lead.util.test.ts exists
    Steps:
      1. Run `npm test -- tests/lead.util.test.ts`
      2. Verify tests for: name+email=qualified, name+phone=qualified, name-only=not-qualified, empty=not-qualified
    Expected Result: All 4+ test cases pass
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-3-lead-util-tests.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 4. Widget Scaffold (Web Component + IIFE Build)

  **What to do**:
  - Create `widget/` directory at project root
  - Create `widget/src/index.ts` — main entry point:
    - Define `LeadQualifierWidget` class extending `HTMLElement`
    - Register as custom element: `lead-qualifier-widget`
    - Use Shadow DOM `mode: 'open'`
    - Read `data-skill` attribute from `document.currentScript` (capture SYNCHRONOUSLY at IIFE evaluation time, before any async code — `document.currentScript` is `null` in async callbacks)
    - Read `data-api-url` attribute (defaults to same origin)
    - Render a floating chat bubble (bottom-right by default)
    - Click bubble → expand to chat panel
    - Placeholder chat UI (send button, message list, input field) — real SSE integration comes in Task 9
  - Create `widget/src/styles.ts` — CSS-in-JS string for Shadow DOM:
    - Reset inherited properties: `font-family`, `color`, `line-height`, `font-size`
    - Chat bubble: fixed position, z-index `2147483647`, 60x60px circle
    - Chat panel: 380px wide, 520px tall, border-radius, shadow
    - Typing indicator animation (3 bouncing dots)
    - Mobile responsive: full-width below 480px
  - Create `widget/build.ts` — esbuild script:
    - Input: `widget/src/index.ts`
    - Output: `public/widget.js` (IIFE format, minified)
    - Target: ES2020
    - Bundle: true, no external dependencies
    - Goal: <30KB gzipped
  - Add build script: `"build:widget": "tsx widget/build.ts"` to `package.json`
  - Install `esbuild` as dev dependency

  **Must NOT do**:
  - Do NOT add React, Preact, or any framework — vanilla TypeScript only
  - Do NOT implement SSE streaming yet — just the UI shell
  - Do NOT fetch skill config yet — use hardcoded defaults for now
  - Do NOT add actual API calls — placeholder only

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Vanilla TypeScript Web Component — no domain skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `client/src/app/chat/chat.component.html` — Current Angular chat UI template. Port the structure (message list, input, send button, typing indicator) to vanilla DOM.
  - `client/src/app/chat/chat.component.scss` — Current styles. Port to CSS-in-JS string for Shadow DOM. Key: `.chat-wrapper`, `.message--user`, `.message--assistant`, `.message__bubble--typing`.
  - MDN Web Components: https://developer.mozilla.org/en-US/docs/Web/API/Web_components — Shadow DOM, custom elements, lifecycle callbacks.

  **Acceptance Criteria**:
  - [ ] `npm run build:widget` produces `public/widget.js`
  - [ ] `public/widget.js` is <30KB gzipped
  - [ ] Widget renders on a plain HTML page: `<script src="widget.js" data-skill="test"></script>`
  - [ ] Chat bubble appears in bottom-right corner
  - [ ] Click bubble → chat panel opens
  - [ ] Shadow DOM isolates widget styles from host page

  **QA Scenarios**:

  ```
  Scenario: Widget builds successfully under size limit
    Tool: Bash
    Preconditions: esbuild installed, widget source exists
    Steps:
      1. Run `npm run build:widget`
      2. Check `public/widget.js` exists
      3. Run `gzip -c public/widget.js | wc -c` to get gzipped size
      4. Verify size < 30720 bytes (30KB)
    Expected Result: File exists, size under 30KB gzipped
    Failure Indicators: Build error, file missing, size over limit
    Evidence: .sisyphus/evidence/task-4-widget-build.txt

  Scenario: Widget renders in Shadow DOM isolation
    Tool: Playwright
    Preconditions: widget.js built, test HTML page created
    Steps:
      1. Create test HTML: `<html><head><style>* { color: red !important; font-family: Comic Sans MS !important; }</style></head><body><script src="widget.js" data-skill="test"></script></body></html>`
      2. Navigate to test page
      3. Locate shadow root on `lead-qualifier-widget` element
      4. Verify chat bubble exists inside shadow root
      5. Click chat bubble
      6. Verify chat panel appears
      7. Verify text inside shadow root is NOT red (Shadow DOM isolation)
    Expected Result: Widget renders, chat opens on click, styles isolated from host page
    Failure Indicators: No shadow root, styles leak through, bubble doesn't expand
    Evidence: .sisyphus/evidence/task-4-widget-isolation.png
  ```

  **Commit**: NO — user handles commits manually

- [x] 5. Session Persistence (Replace Map → Supabase)

  **What to do**:
  - Rewrite `src/session.ts` internals — keep the same function signatures (`createSession`, `getSession`, `updateSession`, `deleteSession`, `getAllSessions`), replace `Map` with Supabase queries
  - `createSession(skillId: string)` — INSERT into `sessions` table, set `expires_at` to `now() + 24h`, return session object
  - `getSession(id: string)` — SELECT from `sessions` WHERE `id` AND `expires_at > now()` (auto-expire)
  - `updateSession(session)` — UPDATE `sessions` SET messages, lead, qualified, notified, qualified_at
  - When lead qualifies (`qualified` flips to true): INSERT into `leads` table with extracted lead data
  - Update `src/server.ts`:
    - `POST /api/sessions` — accept `{ skillId }` in body, validate skill exists and is active
    - `GET /api/sessions/:id` — return session data
    - Change routes from `/session` to `/api/sessions` (API prefix convention)
    - Change `/chat` to `/api/chat`
    - Remove `SKILL_PATH` env var and file reading from `boot()`
  - Add session message count check: reject messages if session has ≥ `maxMessages` (from skill config)

  **Must NOT do**:
  - Do NOT change the qualifier.ts flow — only how sessions are stored/retrieved
  - Do NOT implement streaming yet — keep request/response for now
  - Do NOT implement webhook dispatch — just persist the lead

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `["database"]`
    - `database`: Supabase query patterns, JSONB operations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Tasks 7, 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/session.ts` — Current in-memory implementation. 33 lines. Keep function signatures, replace internals.
  - `src/server.ts:42-95` — Current route handlers. Update route paths and session creation to accept skillId.
  - `src/schema.ts` — `StoredSession` interface (after Task 1). Use for Supabase row typing.
  - `src/lib/supabase.ts` — Supabase client singleton (from Task 2).
  - `supabase/migrations/001_initial_schema.sql` — Table schema for `sessions` and `leads` (from Task 2).

  **Acceptance Criteria**:
  - [ ] `POST /api/sessions` with `{"skillId":"default"}` returns `{"sessionId":"<uuid>"}`
  - [ ] `GET /api/sessions/<id>` returns session with messages, lead, qualified fields
  - [ ] Session data persists in Supabase (query `SELECT * FROM sessions` returns row)
  - [ ] Expired sessions (>24h) return 404
  - [ ] No `Map` usage remains in `session.ts`
  - [ ] `POST /api/chat` with valid session still works (full round-trip with Claude)

  **QA Scenarios**:

  ```
  Scenario: Session persists in Supabase
    Tool: Bash (curl)
    Preconditions: Server running, Supabase connected
    Steps:
      1. curl -X POST http://localhost:3001/api/sessions -H "Content-Type: application/json" -d '{"skillId":"default"}' → capture sessionId
      2. curl http://localhost:3001/api/sessions/<sessionId> → verify 200 with session data
      3. curl -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d '{"sessionId":"<id>","message":"Hello"}' → verify 200 with reply
      4. curl http://localhost:3001/api/sessions/<sessionId> → verify messages array has 3 entries (user + assistant greeting + user hello + assistant reply)
    Expected Result: Session created, chat works, messages persisted
    Failure Indicators: 500 error, empty messages, session not found
    Evidence: .sisyphus/evidence/task-5-session-persistence.txt

  Scenario: Invalid skill returns 404
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -X POST http://localhost:3001/api/sessions -H "Content-Type: application/json" -d '{"skillId":"nonexistent"}' -w "\n%{http_code}"
      2. Verify HTTP 404 with `{"error":"skill_not_found"}`
    Expected Result: 404 with error message
    Failure Indicators: 200 or 500
    Evidence: .sisyphus/evidence/task-5-invalid-skill.txt

  Scenario: Message limit enforced
    Tool: Bash (curl)
    Preconditions: Skill with max_messages=5 in Supabase
    Steps:
      1. Create session
      2. Send 3 messages (each = 2 entries: user + assistant = 6 message entries)
      3. Verify 3rd message rejected with session_message_limit_reached error
    Expected Result: Message rejected after hitting limit
    Failure Indicators: Message accepted beyond limit
    Evidence: .sisyphus/evidence/task-5-message-limit.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 6. Skill Loading from Supabase

  **What to do**:
  - Create `src/skill.ts` — skill loading module:
    - `getSkill(slug: string): Promise<SkillConfig | null>` — SELECT from `skills` WHERE `slug` AND `is_active`
    - `getSkillById(id: string): Promise<SkillConfig | null>` — SELECT by UUID
    - In-memory cache with 5-minute TTL (avoid DB query on every chat message)
    - `invalidateSkillCache(slug: string)` — for manual cache busting
  - Create `GET /api/skills/:slug` endpoint in `server.ts`:
    - Returns public skill config (slug, name, greeting, branding). Excludes system_prompt (private).
    - Widget uses this to load branding on init.
  - Update `POST /api/sessions` to load skill from DB and validate `is_active`
  - Update qualifier to load `systemPrompt` and `model` from skill config instead of file
  - Remove filesystem skill loading from `boot()` in `server.ts`

  **Must NOT do**:
  - Do NOT create/update/delete skill endpoints — use Supabase dashboard
  - Do NOT expose `system_prompt` in the public API
  - Do NOT delete the `skills/` directory yet — cleanup is in Task 17

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `["database"]`
    - `database`: Supabase queries, caching patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Tasks 10, 12, 14
  - **Blocked By**: Task 2

  **References**:
  - `src/server.ts:25-33` — Current `boot()` function that reads skill from filesystem. Replace with Supabase loading.
  - `src/qualifier.ts:37-51` — `processMessage` takes `skill: string` parameter. Change to use `SkillConfig.systemPrompt` and `SkillConfig.model`.
  - `src/schema.ts` — `SkillConfig` interface (from Task 1).
  - `supabase/seed.sql` — Contains the 3 seeded skills (from Task 2).

  **Acceptance Criteria**:
  - [ ] `GET /api/skills/terraemare` returns `{ slug, name, greeting, branding }` (no system_prompt)
  - [ ] `GET /api/skills/nonexistent` returns 404
  - [ ] Qualifier uses `SkillConfig.model` from DB (not hardcoded `claude-sonnet-4-6`)
  - [ ] Second request to same skill within 5min uses cached config (no DB query)
  - [ ] `SKILL_PATH` env var no longer referenced anywhere

  **QA Scenarios**:

  ```
  Scenario: Skill config loads from Supabase
    Tool: Bash (curl)
    Preconditions: Server running, skills seeded in Supabase
    Steps:
      1. curl http://localhost:3001/api/skills/terraemare → verify 200
      2. Verify response contains: slug, name, greeting, branding
      3. Verify response does NOT contain: system_prompt
    Expected Result: Public config returned, private prompt excluded
    Failure Indicators: 500, system_prompt exposed, missing fields
    Evidence: .sisyphus/evidence/task-6-skill-loading.txt

  Scenario: Chat uses skill model from DB
    Tool: Bash (curl)
    Preconditions: Skill in Supabase with model='claude-sonnet-4-6'
    Steps:
      1. Create session with skillId
      2. Send chat message
      3. Verify response (Claude responded = correct model used)
    Expected Result: Chat response received using DB-configured model
    Failure Indicators: Error about invalid model, no response
    Evidence: .sisyphus/evidence/task-6-skill-model.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 7. SSE Streaming + Tool Use Handling

  **What to do**:
  - This is the HARDEST technical task. The Anthropic streaming API emits `content_block_start`, `content_block_delta`, `content_block_stop` events. When Claude calls `emit_evaluation` mid-stream, the system must: (1) stream text tokens, (2) detect tool_use block, (3) accumulate `input_json_delta` until complete, (4) process lead data + fire notifications, (5) send tool_result back to Claude, (6) start second streaming call, (7) stream follow-up text — all seamlessly to the client.
  - Create `src/streaming.ts` — streaming qualifier module:
    - `streamMessage(session, message, skillConfig, res)` — handles full SSE streaming flow
    - Use `client.messages.stream()` from Anthropic SDK
    - SSE event format: `data: {"type":"token","content":"word"}\n\n` for text tokens
    - `data: {"type":"qualified","lead":{...}}\n\n` when lead qualifies
    - `data: {"type":"done"}\n\n` when stream completes
    - `data: {"type":"error","message":"..."}\n\n` on error
    - Handle the tool_use → tool_result → follow-up stream flow seamlessly
  - Add `POST /api/chat/stream` endpoint in `server.ts`:
    - Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (critical for Coolify/nginx proxy)
    - Handle client disconnect: abort Anthropic stream (no orphaned API calls)
  - Keep the existing non-streaming `POST /api/chat` endpoint working (for backward compatibility and testing)
  - Update session messages storage to handle both text and tool_use content blocks properly

  **Must NOT do**:
  - Do NOT use WebSocket — SSE only
  - Do NOT rewrite the qualification logic — extend `qualifier.ts` patterns for streaming
  - Do NOT remove the non-streaming `/api/chat` endpoint

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`
    - Complex streaming + tool interaction logic. Requires deep focus, no additional domain skills needed.

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Tasks 9, 15
  - **Blocked By**: Tasks 1, 5

  **References**:
  - `src/qualifier.ts:37-113` — Current non-streaming qualifier. Lines 57-103 handle the tool_use → follow-up pattern. Extend this for streaming, don't rewrite.
  - `src/qualifier.ts:10-27` — `EMIT_EVALUATION_TOOL` definition. Reuse as-is.
  - Anthropic SDK streaming docs: https://docs.anthropic.com/en/api/streaming — `content_block_start`, `content_block_delta`, `content_block_stop` events.
  - `src/schema.ts` — `StoredMessage` type (after Task 1) must handle Anthropic content block arrays.

  **Acceptance Criteria**:
  - [ ] `curl -N -H "Accept: text/event-stream" POST /api/chat/stream` receives `data:` events with individual tokens
  - [ ] Tokens arrive progressively (not buffered as one chunk)
  - [ ] When Claude calls `emit_evaluation`, text continues seamlessly after tool processing
  - [ ] Client disconnect aborts the Anthropic stream
  - [ ] `X-Accel-Buffering: no` header present on SSE response
  - [ ] Non-streaming `POST /api/chat` still works

  **QA Scenarios**:

  ```
  Scenario: SSE streams tokens individually
    Tool: Bash (curl)
    Preconditions: Server running, session created
    Steps:
      1. Create session via POST /api/sessions
      2. Run: curl -N -X POST http://localhost:3001/api/chat/stream -H "Content-Type: application/json" -H "Accept: text/event-stream" -d '{"sessionId":"<id>","message":"Hello, what do you do?"}' --max-time 30
      3. Capture output
      4. Verify output contains multiple `data: {"type":"token",...}` lines
      5. Verify output ends with `data: {"type":"done"}`
    Expected Result: Multiple token events followed by done event
    Failure Indicators: Single large data event, no done event, timeout
    Evidence: .sisyphus/evidence/task-7-sse-streaming.txt

  Scenario: Tool use triggers qualification event mid-stream
    Tool: Bash (curl)
    Preconditions: Server running, session created
    Steps:
      1. Create session
      2. Stream message: "Hi, I'm Marco Rossi and my email is marco@test.com"
      3. Capture full SSE output
      4. Verify output contains `data: {"type":"qualified","lead":{"name":"Marco Rossi","email":"marco@test.com",...}}`
      5. Verify text tokens appear both before and after the qualified event
      6. Verify output ends with `data: {"type":"done"}`
    Expected Result: Qualification event appears mid-stream, text continues after
    Failure Indicators: No qualified event, stream ends at tool_use, missing follow-up text
    Evidence: .sisyphus/evidence/task-7-tool-use-stream.txt

  Scenario: X-Accel-Buffering header present
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -I -X POST http://localhost:3001/api/chat/stream -H "Content-Type: application/json" -d '{"sessionId":"<id>","message":"test"}'
      2. Verify response headers contain X-Accel-Buffering: no
    Expected Result: Header present
    Failure Indicators: Header missing
    Evidence: .sisyphus/evidence/task-7-headers.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 8. Webhook Service with Retry

  **What to do**:
  - Create `src/webhook.ts` — webhook dispatch module:
    - `dispatchWebhook(skillConfig, lead, sessionId)` — POST to `skillConfig.webhookUrl` if configured
    - Payload: `{ lead, sessionId, skillSlug, qualifiedAt, timestamp }`
    - Content-Type: `application/json`
    - Retry logic: 3 attempts with exponential backoff (1s, 4s, 16s)
    - Log every attempt to `webhook_logs` table in Supabase
    - On final failure: log error, do NOT crash, do NOT throw
    - If `webhookUrl` is null/empty: skip silently (not all skills need webhooks)
  - Update `src/server.ts` — when lead qualifies (in `/api/chat` and `/api/chat/stream`):
    - Call `dispatchWebhook()` alongside existing `notifyLead()` email
    - Both fire independently (email failure doesn't block webhook, vice versa)
  - Add timeout: 10 seconds per webhook attempt

  **Must NOT do**:
  - Do NOT add a dead letter queue — just log failures to `webhook_logs`
  - Do NOT add webhook management endpoints — configure via Supabase dashboard
  - Do NOT block the chat response waiting for webhook — fire async

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`
    - HTTP dispatch + retry logic. Standard patterns, no domain skills needed.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 12
  - **Blocked By**: Task 2

  **References**:
  - `src/mailer.ts` — Current email notification pattern. Webhook follows same async fire pattern.
  - `src/server.ts:64-69` — Where email notification fires on qualification. Webhook fires alongside.
  - `src/schema.ts` — `WebhookLog` interface (from Task 1).
  - `src/lib/supabase.ts` — Supabase client for logging to `webhook_logs`.

  **Acceptance Criteria**:
  - [ ] Skill with `webhook_url` → POST fires within 5 seconds of qualification
  - [ ] Webhook payload contains: `lead`, `sessionId`, `skillSlug`, `qualifiedAt`
  - [ ] Failed webhook (target returns 500) → retried 3 times with backoff
  - [ ] All attempts logged to `webhook_logs` table
  - [ ] Skill without `webhook_url` → no error, no attempt
  - [ ] Webhook failure does NOT crash the server or block chat response

  **QA Scenarios**:

  ```
  Scenario: Webhook fires on lead qualification
    Tool: Bash (curl + webhook.site or similar)
    Preconditions: Skill with webhook_url pointing to a test endpoint
    Steps:
      1. Create session with skill that has webhook_url configured
      2. Send message: "Hi, I'm Test User, email test@example.com"
      3. Wait 5 seconds
      4. Query webhook_logs table: SELECT * FROM webhook_logs WHERE skill_id = '<id>'
      5. Verify row exists with success=true, status_code=200
    Expected Result: Webhook fired, logged as successful
    Failure Indicators: No webhook_logs row, success=false
    Evidence: .sisyphus/evidence/task-8-webhook-fire.txt

  Scenario: Webhook retries on failure
    Tool: Bash
    Preconditions: Skill with webhook_url pointing to a non-existent endpoint
    Steps:
      1. Set skill webhook_url to http://localhost:9999/nonexistent
      2. Qualify a lead
      3. Wait 30 seconds (allow retries)
      4. Query webhook_logs: SELECT attempts, success FROM webhook_logs
      5. Verify attempts=3, success=false
    Expected Result: 3 attempts logged, all failed, server still running
    Failure Indicators: Server crashed, fewer than 3 attempts
    Evidence: .sisyphus/evidence/task-8-webhook-retry.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 9. Widget Chat UI with SSE Streaming

  **What to do**:
  - Update `widget/src/index.ts` (from Task 4 scaffold) with full chat functionality:
    - On init: fetch skill config from `GET /api/skills/:slug` (greeting, branding)
    - Display greeting message as first assistant message
    - On send: POST to `/api/chat/stream` with `Accept: text/event-stream`
    - Use `EventSource` or `fetch` with `ReadableStream` for SSE consumption
    - Render tokens progressively as they arrive (append to current assistant bubble)
    - Handle `type: "qualified"` event — show subtle indicator (green dot, checkmark)
    - Handle `type: "done"` event — re-enable input
    - Handle `type: "error"` event — show error message
    - Handle `EventSource.onerror` — show "Connection lost. Tap to retry." message
    - Lock input during streaming (prevent concurrent messages)
    - Markdown rendering: basic support (bold, italic, links, lists) — no heavy library, simple regex replacements
    - Auto-scroll to bottom on new messages
    - Enter to send, Shift+Enter for newline
  - Update `widget/src/styles.ts` — refine chat message styles:
    - User messages: right-aligned, colored background
    - Assistant messages: left-aligned, light background
    - Streaming indicator: blinking cursor at end of current message
    - Error state styling
    - Qualified indicator styling
  - Rebuild widget: `npm run build:widget`

  **Must NOT do**:
  - Do NOT use a markdown library — simple regex replacements for basic formatting
  - Do NOT add file upload or image support
  - Do NOT add sound notifications
  - Do NOT add typing indicator for user (only for assistant during streaming)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`
    - Web Component UI with streaming. Visual focus but no framework skills needed.

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 4 scaffold + Task 7 SSE endpoint)
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: Tasks 10, 11, 15
  - **Blocked By**: Tasks 4, 7

  **References**:
  - `widget/src/index.ts` — Scaffold from Task 4. Add real functionality.
  - `widget/src/styles.ts` — Scaffold styles from Task 4. Refine for real chat UI.
  - `client/src/app/chat/chat.component.ts:57-84` — Angular send() logic. Port to vanilla: send message → lock input → consume SSE → append tokens → unlock on done.
  - `client/src/app/chat/chat.component.html` — Angular template structure. Port message list, input, send button pattern.
  - `src/server.ts` — SSE endpoint URL pattern from Task 7: `POST /api/chat/stream`.

  **Acceptance Criteria**:
  - [ ] Widget loads skill greeting on init
  - [ ] Sending message streams response token-by-token
  - [ ] Input locked during streaming, unlocked on done
  - [ ] Qualified event shows green indicator
  - [ ] Error/disconnect shows retry message
  - [ ] Widget bundle still <30KB gzipped after changes
  - [ ] Basic markdown (bold, italic, links) renders correctly

  **QA Scenarios**:

  ```
  Scenario: Full chat flow in widget
    Tool: Playwright
    Preconditions: Server running, widget built, test HTML page
    Steps:
      1. Navigate to test page with embedded widget
      2. Click chat bubble to open panel
      3. Verify greeting message appears (from skill config)
      4. Type "Hello" in input field
      5. Press Enter
      6. Verify user message appears right-aligned
      7. Verify assistant response streams in progressively (not all at once)
      8. Verify input re-enables after response completes
    Expected Result: Full chat flow works with streaming
    Failure Indicators: No greeting, messages don't appear, input stays locked
    Evidence: .sisyphus/evidence/task-9-widget-chat-flow.png

  Scenario: Connection error shows retry message
    Tool: Playwright
    Preconditions: Server NOT running, widget loaded
    Steps:
      1. Open widget on test page
      2. Type message and send
      3. Verify error message appears in chat
      4. Verify message contains retry option
    Expected Result: Graceful error with retry prompt
    Failure Indicators: Widget crashes, no error message, blank screen
    Evidence: .sisyphus/evidence/task-9-widget-error.png
  ```

  **Commit**: NO — user handles commits manually

- [x] 10. Widget Branding from Skill Config

  **What to do**:
  - Update widget to apply skill branding dynamically:
    - On init (after fetching `/api/skills/:slug`), apply:
      - `primaryColor` → chat bubble background, send button background, user message bubble background, header accent
      - `logo` → image in chat header (URL string, rendered as `<img>`)
      - `greeting` → first assistant message content
      - `position` → chat bubble position (`bottom-right` default, support `bottom-left`)
    - If branding fields are missing, use sensible defaults (blue primary, no logo, generic greeting, bottom-right)
  - Update `widget/src/styles.ts` — use CSS custom properties for dynamic theming:
    - `--lq-primary` for primary color
    - `--lq-position-right` / `--lq-position-left` for positioning
    - Applied to shadow root, not leaked to host page
  - Test with multiple skills having different branding (terraemare vs cee-machines vs default)

  **Must NOT do**:
  - Do NOT build a theming engine — 4 values only: primaryColor, logo, greeting, position
  - Do NOT allow CSS injection from skill config
  - Do NOT add font customization

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`
    - CSS custom properties, dynamic styling in Shadow DOM.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 11, 12)
  - **Blocks**: None
  - **Blocked By**: Tasks 6, 9

  **References**:
  - `widget/src/index.ts` — Widget code from Task 9. Add branding application.
  - `widget/src/styles.ts` — Widget styles from Task 9. Convert hardcoded colors to CSS custom properties.
  - `src/skill.ts` — `GET /api/skills/:slug` response shape (from Task 6).

  **Acceptance Criteria**:
  - [ ] Widget with `data-skill="terraemare"` uses Terra e Mare branding (if configured)
  - [ ] Widget with `data-skill="default"` uses default blue branding
  - [ ] Missing branding fields gracefully fallback to defaults
  - [ ] Logo renders in chat header
  - [ ] `position: bottom-left` moves bubble to bottom-left

  **QA Scenarios**:

  ```
  Scenario: Different skills show different branding
    Tool: Playwright
    Preconditions: Two skills with different primaryColor in Supabase
    Steps:
      1. Load widget with data-skill="default" → screenshot
      2. Load widget with data-skill="terraemare" → screenshot
      3. Compare: chat bubble colors should be different
    Expected Result: Each skill shows its own primary color
    Failure Indicators: Both show same color, branding not applied
    Evidence: .sisyphus/evidence/task-10-branding-default.png, .sisyphus/evidence/task-10-branding-terraemare.png
  ```

  **Commit**: NO — user handles commits manually

- [x] 11. Demo Page System

  **What to do**:
  - Add `GET /demo/:skillSlug` route in `server.ts`:
    - Verify skill exists and is active
    - Serve a minimal static HTML page with the widget embedded
    - HTML includes: `<script src="/widget.js" data-skill=":skillSlug" data-api-url=""></script>`
    - Page styled: centered, clean background, skill name in title
    - No framework, no build step — template literal in the route handler
  - Create `src/demo.ts` — demo page HTML generator:
    - Takes `skillSlug` and `skillName` as parameters
    - Returns complete HTML string
    - Includes minimal CSS (centered content, readable typography)
    - `<meta name="robots" content="noindex">` (demo pages should not be indexed)
  - Serve `public/widget.js` as static file: `app.use('/widget.js', express.static('public/widget.js'))`

  **Must NOT do**:
  - Do NOT use a template engine — plain template literals
  - Do NOT add SSR framework
  - Do NOT add authentication to demo pages (public for sales demos)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple HTML generation, Express static serving.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 12)
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - `src/server.ts` — Express app. Add demo route.
  - `src/skill.ts` — `getSkill(slug)` function (from Task 6).
  - `public/widget.js` — Built widget file (from Tasks 4, 9).

  **Acceptance Criteria**:
  - [ ] `GET /demo/terraemare` returns HTML page with widget embedded
  - [ ] `GET /demo/nonexistent` returns 404
  - [ ] Page includes `<meta name="robots" content="noindex">`
  - [ ] Widget on demo page is functional (can chat)
  - [ ] Page loads in <1 second

  **QA Scenarios**:

  ```
  Scenario: Demo page renders with working widget
    Tool: Playwright
    Preconditions: Server running, terraemare skill in Supabase
    Steps:
      1. Navigate to http://localhost:3001/demo/terraemare
      2. Verify page title contains "Terra e Mare" or skill name
      3. Verify widget chat bubble appears
      4. Click bubble, verify chat panel opens
      5. Send a message, verify response streams
    Expected Result: Demo page with fully functional widget
    Failure Indicators: 404, widget missing, chat broken
    Evidence: .sisyphus/evidence/task-11-demo-page.png
  ```

  **Commit**: NO — user handles commits manually

- [x] 12. Per-Skill Email Notification

  **What to do**:
  - Update `src/mailer.ts`:
    - Change `notifyLead(lead)` to `notifyLead(lead, skillConfig)`:
      - Use `skillConfig.emailTo` as recipient (instead of global `NOTIFY_EMAIL` env var)
      - If `skillConfig.emailTo` is null, fallback to `NOTIFY_EMAIL` env var
      - If both null, skip email (warn in logs)
    - Include skill name in email subject: `New Lead via [skillName]: [leadName]`
  - Update call sites in `server.ts` to pass `skillConfig`

  **Must NOT do**:
  - Do NOT add per-skill SMTP config — single SMTP for all, only recipient changes
  - Do NOT remove `NOTIFY_EMAIL` env var — it's the fallback

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple function signature change.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: None
  - **Blocked By**: Tasks 6, 8

  **References**:
  - `src/mailer.ts` — Current email module. 49 lines. Change signature + recipient logic.
  - `src/server.ts:64-69` — Where `notifyLead()` is called. Pass `skillConfig`.
  - `src/schema.ts` — `SkillConfig.emailTo` field (from Task 1).

  **Acceptance Criteria**:
  - [ ] Skill with `email_to` set → email sent to that address
  - [ ] Skill without `email_to` → email sent to `NOTIFY_EMAIL` env var
  - [ ] Both null → email skipped with warning log (no crash)
  - [ ] Email subject includes skill name

  **QA Scenarios**:

  ```
  Scenario: Email uses per-skill recipient
    Tool: Bash
    Preconditions: Skill with email_to configured, SMTP set up
    Steps:
      1. Qualify a lead on a skill with email_to="test@example.com"
      2. Check server logs for email send confirmation
      3. Verify log shows recipient as test@example.com (not NOTIFY_EMAIL)
    Expected Result: Email sent to skill-specific address
    Failure Indicators: Email sent to global address, no email sent
    Evidence: .sisyphus/evidence/task-12-per-skill-email.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 13. Rate Limiting Middleware

  **What to do**:
  - Install `express-rate-limit` as dependency
  - Create `src/middleware/rate-limit.ts`:
    - Default: 20 requests per minute per IP per skill
    - Key generator: `${req.ip}:${req.body?.skillId || req.params?.id || 'global'}`
    - Return `429 Too Many Requests` with `Retry-After` header
    - Exclude `/health` endpoint from rate limiting
  - Apply to: `/api/sessions`, `/api/chat`, `/api/chat/stream`
  - If rate limit hit during active SSE stream: current stream completes normally, NEXT request is blocked

  **Must NOT do**:
  - Do NOT use Redis — in-memory rate limiting is fine for single-instance
  - Do NOT add per-tenant rate limit configuration — fixed defaults for V1
  - Do NOT rate limit static files (`/widget.js`, `/demo/*`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Standard Express middleware pattern.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14, 15, 16)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:
  - `src/server.ts` — Express app. Apply middleware.
  - express-rate-limit docs: https://www.npmjs.com/package/express-rate-limit

  **Acceptance Criteria**:
  - [ ] 21st request within 60 seconds from same IP → HTTP 429
  - [ ] Response includes `Retry-After` header
  - [ ] `/health` endpoint is not rate limited
  - [ ] Static files not rate limited

  **QA Scenarios**:

  ```
  Scenario: Rate limit triggers after 20 requests
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. Run: for i in $(seq 1 21); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/sessions -H "Content-Type: application/json" -d '{"skillId":"default"}'; done
      2. Capture all status codes
      3. Verify first 20 are 200, 21st is 429
    Expected Result: 20x 200, then 429
    Failure Indicators: All 200, or 429 too early
    Evidence: .sisyphus/evidence/task-13-rate-limit.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 14. CORS + Security Headers

  **What to do**:
  - Update CORS configuration in `src/server.ts`:
    - Replace hardcoded `origin: 'http://localhost:4200'` with dynamic origin check
    - For each request: load skill config, check `allowed_origins` array
    - If `allowed_origins` is empty: allow all origins (for development / unconfigured skills)
    - If `allowed_origins` has entries: only allow those origins
    - Always allow same-origin requests
  - Add security headers middleware: `src/middleware/security.ts`:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY` (except for demo pages)
    - `Referrer-Policy: strict-origin-when-cross-origin`
  - Document required CSP directives for sites embedding the widget:
    - `script-src` must allow the widget origin
    - `connect-src` must allow the API origin
    - Add this to `.env.example` as comments

  **Must NOT do**:
  - Do NOT build a domain management UI — configure `allowed_origins` via Supabase
  - Do NOT block all CORS for development — empty `allowed_origins` = allow all

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Standard Express CORS/security patterns.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 15, 16)
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `src/server.ts:13-17` — Current hardcoded CORS config. Replace.
  - `src/skill.ts` — Skill loading with `allowedOrigins` field (from Task 6).

  **Acceptance Criteria**:
  - [ ] Request from allowed origin → 200 with CORS headers
  - [ ] Request from disallowed origin (when `allowed_origins` configured) → blocked
  - [ ] Empty `allowed_origins` → all origins allowed
  - [ ] Security headers present on all responses

  **QA Scenarios**:

  ```
  Scenario: CORS allows configured origins
    Tool: Bash (curl)
    Preconditions: Skill with allowed_origins=['https://example.com']
    Steps:
      1. curl -H "Origin: https://example.com" http://localhost:3001/api/skills/default -v
      2. Verify Access-Control-Allow-Origin header is present
      3. curl -H "Origin: https://evil.com" http://localhost:3001/api/skills/default -v
      4. Verify CORS headers are NOT present (or origin rejected)
    Expected Result: Allowed origin gets CORS, disallowed doesn't
    Failure Indicators: All origins allowed when restrictions set
    Evidence: .sisyphus/evidence/task-14-cors.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 15. Integration Tests for Full Flow

  **What to do**:
  - Create `tests/integration/` directory
  - `tests/integration/session.test.ts` — test session CRUD against Supabase (mock or real)
  - `tests/integration/skill.test.ts` — test skill loading + caching
  - `tests/integration/qualifier.test.ts` — test full chat flow: create session → send message → receive reply → verify session updated
  - `tests/integration/webhook.test.ts` — test webhook dispatch with mock HTTP server:
    - Happy path: webhook fires, logged as success
    - Failure path: target returns 500, 3 retries, logged as failure
  - `tests/integration/streaming.test.ts` — test SSE event format:
    - Mock Anthropic streaming response
    - Verify token events, done event
  - `tests/integration/rate-limit.test.ts` — test rate limiting:
    - 20 requests pass, 21st returns 429
  - All tests use Vitest setup from Task 3

  **Must NOT do**:
  - Do NOT add E2E browser tests — those are in Final Verification (F3)
  - Do NOT test Angular client — it's being removed

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `["testing"]`
    - `testing`: Vitest patterns, mocking, integration test strategies

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 14, 16)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 3, 7, 8, 9

  **References**:
  - `tests/helpers.ts` — Mock factories from Task 3.
  - `vitest.config.ts` — Test config from Task 3.
  - All `src/*.ts` files — modules under test.

  **Acceptance Criteria**:
  - [ ] `npm test` runs all integration tests
  - [ ] All tests pass (0 failures)
  - [ ] Test coverage for: session CRUD, skill loading, chat flow, webhook dispatch+retry, SSE events, rate limiting
  - [ ] Tests mock external services (Anthropic, Supabase) — no real API calls

  **QA Scenarios**:

  ```
  Scenario: All integration tests pass
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Run `npm test`
      2. Capture output
      3. Verify all test suites pass
      4. Verify 0 failures
    Expected Result: All tests green
    Failure Indicators: Any FAIL in output
    Evidence: .sisyphus/evidence/task-15-integration-tests.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 16. Docker + Deployment Config

  **What to do**:
  - Create `Dockerfile` — multi-stage build:
    - Stage 1 (build): `node:22-alpine`, install deps, build widget (`npm run build:widget`), compile TypeScript
    - Stage 2 (run): `node:22-alpine`, copy compiled code + `public/`, minimal image
    - `EXPOSE 3001`
    - `HEALTHCHECK CMD curl -f http://localhost:3001/health || exit 1`
    - `CMD ["node", "dist/server.js"]`
  - Create `.dockerignore` — exclude: `node_modules`, `client/`, `.git`, `.idea`, `tests/`, `*.md` (except README)
  - Update `package.json` scripts:
    - `"build": "tsc && npm run build:widget"`
    - `"start": "node dist/server.js"` (compiled output, not tsx)
  - Update `tsconfig.json`:
    - Add `outDir: "./dist"` for compilation
    - Add `rootDir: "./src"`
  - Update `.env.example` with all required vars + Coolify-specific notes
  - Test: `docker build -t lead-qualifier . && docker run -p 3001:3001 --env-file .env lead-qualifier`

  **Must NOT do**:
  - Do NOT add docker-compose — single container deployment
  - Do NOT add CI/CD config — Coolify handles deployment from Docker
  - Do NOT include `client/` in Docker build

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `["coolify"]`
    - `coolify`: Docker multi-stage build patterns for Coolify deployment

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 14, 15)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **References**:
  - `package.json` — Current scripts. Update for build + production start.
  - `tsconfig.json` — Current config. Add outDir.
  - Coolify docs for Docker deployment.

  **Acceptance Criteria**:
  - [ ] `docker build -t lead-qualifier .` succeeds
  - [ ] `docker run -p 3001:3001 --env-file .env lead-qualifier` → health check passes
  - [ ] Container serves `/health`, `/api/sessions`, `/widget.js`, `/demo/:slug`
  - [ ] Image size < 200MB

  **QA Scenarios**:

  ```
  Scenario: Docker build and run
    Tool: Bash
    Preconditions: Docker installed, .env file configured
    Steps:
      1. Run `docker build -t lead-qualifier .`
      2. Verify build succeeds (exit code 0)
      3. Run `docker run -d -p 3001:3001 --env-file .env --name lq-test lead-qualifier`
      4. Wait 5 seconds
      5. curl http://localhost:3001/health → verify {"status":"ok"}
      6. docker image ls lead-qualifier → verify size < 200MB
      7. docker stop lq-test && docker rm lq-test
    Expected Result: Build succeeds, container runs, health check passes
    Failure Indicators: Build failure, health check timeout, image too large
    Evidence: .sisyphus/evidence/task-16-docker.txt
  ```

  **Commit**: NO — user handles commits manually

- [x] 17. Remove Angular Client + Final Cleanup

  **What to do**:
  - Delete `client/` directory entirely
  - Delete `skills/` directory (skill content now in Supabase seed)
  - Update `.gitignore`:
    - Add: `dist/`, `public/widget.js` (build artifact), `.env`
    - Remove Angular-specific entries if any
  - Remove any references to Angular or `localhost:4200` in codebase
  - Verify no broken imports or references remain
  - Add `README.md` at project root:
    - Project description
    - Setup instructions (Supabase project, env vars, seed data)
    - Development (`npm run dev`)
    - Widget embedding instructions
    - Docker deployment
    - Environment variables reference

  **Must NOT do**:
  - Do NOT change any functionality — cleanup only
  - Do NOT add new features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - File deletion, README writing.

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all other tasks)
  - **Parallel Group**: Wave 5 (solo)
  - **Blocks**: None
  - **Blocked By**: All tasks

  **References**:
  - `client/` — Angular app to delete. 13 entries.
  - `skills/` — Markdown skill files to delete. 3 files.
  - `.gitignore` — Update.

  **Acceptance Criteria**:
  - [ ] `client/` directory does not exist
  - [ ] `skills/` directory does not exist
  - [ ] No references to `localhost:4200` in codebase
  - [ ] `README.md` exists with setup + embedding + deployment instructions
  - [ ] `tsc --noEmit` passes
  - [ ] `npm test` passes

  **QA Scenarios**:

  ```
  Scenario: No Angular references remain
    Tool: Bash (grep)
    Preconditions: Cleanup complete
    Steps:
      1. Run `grep -r "localhost:4200" src/`
      2. Run `grep -r "angular" . --include="*.ts" --include="*.json" -l`
      3. Verify zero matches for both
    Expected Result: No Angular references found
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-17-cleanup-check.txt

  Scenario: Project still builds and tests pass
    Tool: Bash
    Preconditions: Cleanup complete
    Steps:
      1. Run `npx tsc --noEmit` → verify exit 0
      2. Run `npm test` → verify all pass
      3. Run `npm run build:widget` → verify widget builds
    Expected Result: Everything still works after cleanup
    Failure Indicators: Build error, test failure
    Evidence: .sisyphus/evidence/task-17-post-cleanup-build.txt
  ```

  **Commit**: NO — user handles commits manually

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle` (FIXED: removed as never cast in streaming.ts:133)
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high` (APPROVED)
  Run `tsc --noEmit` + linter + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real QA Execution** — `unspecified-high` (14/14 APPROVED)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (session → chat → qualify → webhook + email). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep` (APPROVED, zero scope creep)
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

> **NO AUTO-COMMITS.** The user will handle all git commits manually.
> Agents MUST NOT run `git add`, `git commit`, or `git push` during execution.
> Focus on implementation and verification only.

---

## Success Criteria

### Verification Commands
```bash
# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Create session with skill
curl -X POST http://localhost:3001/api/sessions -H "Content-Type: application/json" -d '{"skillId":"default"}'
# Expected: {"sessionId":"<uuid>"}

# Stream chat response
curl -N -H "Accept: text/event-stream" "http://localhost:3001/api/chat/stream?sessionId=<id>&message=Hello"
# Expected: data: {"type":"token","content":"Hi"}... data: {"type":"done"}

# Widget loads on external page
# <script async src="http://localhost:3001/widget.js" data-skill="terraemare"></script>
# Expected: chat bubble appears in bottom-right corner

# Rate limit
for i in $(seq 1 21); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/sessions -d '{"skillId":"default"}'; done
# Expected: first 20 return 200, 21st returns 429

# Tests pass
npm test
# Expected: all tests pass, 0 failures

# Docker build
docker build -t lead-qualifier .
# Expected: build succeeds
```

### Final Checklist
- [ ] All "Must Have" items present and working
- [ ] All "Must NOT Have" items absent from codebase
- [ ] All tests pass (`npm test`)
- [ ] Widget renders in Shadow DOM isolation
- [ ] SSE streaming works with tool_use mid-stream
- [ ] Webhook fires on lead qualification
- [ ] Sessions persist across server restarts
- [ ] Docker builds successfully
- [ ] Angular `client/` directory removed
- [ ] All files written in English
