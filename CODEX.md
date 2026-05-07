# Codex Instructions — Synapse Integration

> You are connected to Synapse collective memory via the `codegraph` MCP server.
> All 30+ tools are available as `codegraph/<tool_name>` calls.

---

## MCP Tools Available

You have these tool categories via the `codegraph` MCP server.
Tool names use the format `codegraph/<name>` (e.g. `codegraph/session_resume`).

| Category | Tools | Purpose |
|----------|-------|---------|
| **Memory** | `memory_search`, `memory_add`, `memory_query`, `memory_load`, `memory_stats`, `memory_suggest`, `memory_suggest_outcome` | Persistent knowledge across sessions |
| **Skills** | `skill_list`, `skill_read`, `skill_route`, `skill_stats` | Domain expertise (253 skills) |
| **Sessions** | `session_start`, `session_end`, `session_resume`, `session_heartbeat` | Track work context |
| **Projects** | `project_list`, `project_get`, `project_scan` | Project registry |
| **Code Analysis** | `codegraph_query`, `codegraph_context`, `codegraph_impact`, `codegraph_detect_changes`, `codegraph_rename` | Code intelligence |
| **Credentials** | `user_env_get`, `user_env_list`, `user_env_available`, `user_env_set` | Secure credential access |
| **Cortex** | `cortex_briefing` | Project briefings |

---

## Session Protocol

### Start of conversation

```
session_resume({ "project": "<project-name>" })
```

This returns: last session summary, next steps, blockers, related memories, and your capability profile (available credentials/integrations).

### During work

When you learn something non-obvious, save it:

```
memory_add({
  "type": "BugFix" | "Pattern" | "Decision" | "Preference" | "AntiPattern",
  "content": "what you learned",
  "tags": ["relevant", "tags", "skill:nextjs"],
  "project": "<project-name>"
})
```

Save immediately when:
- Bug fixed after 2+ attempts
- User corrects your approach
- Non-obvious pattern discovered
- Architectural decision made

### Before implementing

Always search for existing knowledge first:

```
memory_search({ "query": "what you're about to do" })
skill_route({ "task": "current task description" })
```

If `skill_route` recommends a skill, read it:

```
skill_read({ "name": "skill-name" })
```

### End of task

```
memory_suggest({
  "taskDescription": "what the user asked",
  "outcome": "what you did and learned",
  "project": "<project-name>"
})
```

Then propose 1-3 memory candidates to the user. Only save with approval.

### End of session

```
session_end({
  "sessionId": "<from session_start>",
  "summary": "what was accomplished",
  "deliverables": "what was built",
  "workType": "feature | fix | setup | deploy | refactor | design | docs",
  "nextSteps": "what should be done next",
  "status": "completed | paused | blocked",
  "filesChanged": [],
  "commits": []
})
```

---

## Credential Access

Never hardcode secrets. Use Synapse credential store:

```
user_env_get({ "varName": "OPENAI_API_KEY", "project": "<project>" })
```

If `session_resume` shows the credential in your capability profile, you have it.
If missing, ask the user, then offer to save with `user_env_set`.

---

## Code Intelligence

Before modifying existing code:

```
codegraph_impact({ "target": "FunctionName", "direction": "upstream" })
codegraph_context({ "name": "FunctionName" })
```

If risk is HIGH or CRITICAL, warn the user before proceeding.

For renames, never use find-and-replace. Use:

```
codegraph_rename({ "oldName": "X", "newName": "Y" })
```

---

## Stack (Default for this workspace)

| Layer | Tech |
|-------|------|
| Framework | Next.js 15+ (App Router, RSC) |
| Styling | Tailwind CSS + shadcn/ui |
| CMS | Payload CMS (multi-tenant) |
| i18n | next-intl |
| Forms | react-hook-form + Zod + Server Actions |
| Deploy | Coolify (Docker multi-stage) |
| SEO | next/metadata + JSON-LD + sitemap.xml |

---

## Iron Rules

1. **No secrets in code** — use `process.env.VAR` or `user_env_get`
2. **No `// eslint-disable`** — fix the issue properly
3. **Impact analysis before edits** — `codegraph_impact` on any existing symbol
4. **Conventional commits** — `type(scope): description`
5. **No `console.log` in prod** — use structured logging
6. **Zod validation** on every API boundary
7. **Never commit `.env`** — only `.env.template`
8. **Client projects** go in `Progetti/<slug>/`

---

## Skill Targets (for memory tagging)

When saving memories, include `skill:<name>` tag if relevant:

`nextjs` `payments` `payload` `tailwind` `auth` `remotion` `database` `forms` `seo` `animations` `coolify` `n8n` `ai-video-generation` `claude-design` `pixarts`

---

## Quality Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| TypeScript | Strict mode |
| First-load JS | < 300KB/route |
| Test Coverage | > 80% |
