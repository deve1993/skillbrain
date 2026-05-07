# SkillBrain — Setup Guide (English)

Welcome! This takes ~15 minutes. Do the steps in order — don't skip the verification prompts at the end.

---

## Step 1 — Log in to the dashboard

1. Open **https://memory.fl1.it/**
2. Use the **email + temporary password** Daniel sent you.
3. Once inside, go to **Profile** (left sidebar) → scroll to the **Password** section → set a new password.

---

## Step 2 — Generate your personal API key

The key in your invite email is your bootstrap key. Replace it now with one only you know.

1. Profile → **API Keys**
2. Click **+ Generate Key**
3. Label: `claude-code-<yourname>` (e.g. `claude-code-victor`)
4. Click **Generate** → **copy the key immediately** (it's shown only once).
5. Save it in a password manager. After that, you can revoke the old "invite" key.

---

## Step 3 — Connect Claude Code to SkillBrain

Open your Claude Code MCP config and add the `codegraph` server. Easiest path: in Claude Code run:

```
/mcp
```

…and add a new server. Or edit your config file manually with this entry:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@skillbrain/mcp-proxy@latest"],
      "env": {
        "CODEGRAPH_AUTH_TOKEN": "<paste-your-key-from-step-2>",
        "CODEGRAPH_SERVER": "https://memory.fl1.it"
      }
    }
  }
}
```

Replace `<paste-your-key-from-step-2>` with the key you just generated. **Restart Claude Code** so it picks up the new server.

---

## Step 4 — Verification flow (paste these prompts one by one)

Open a fresh Claude Code chat and paste each prompt below in order. After each one, check the **expected result**. If something fails, stop and ping Daniel — don't continue.

### Prompt 1 — Confirm the MCP server is reachable

```
List the tools you have available from the codegraph MCP server.
```

- ✅ **Expected:** Claude lists ~30 tools starting with `memory_*`, `skill_*`, `session_*`, `codegraph_*`, `user_env_*`.
- ❌ **If it says "no codegraph tools" or similar:** restart Claude Code, double-check the JSON config, verify the API key has no extra spaces.

### Prompt 2 — Confirm authentication works

```
Call memory_search with the query "authentication" and show me the first 3 results.
```

- ✅ **Expected:** A list of memories (titles + short descriptions) is returned.
- ❌ **401 Unauthorized:** the key is wrong or was revoked. Go back to Step 2, generate a new one, update the config, restart.

### Prompt 3 — Confirm your identity is recognized

```
Call user_env_list and tell me which services I have credentials for in my master.env.
```

- ✅ **Expected:** Claude returns a list of services tied to **your** SkillBrain account (it can be empty — that's fine, it just confirms the user record is wired up).
- ❌ **403 / "user not found":** Daniel needs to check your account on memory.fl1.it.

### Prompt 4 — Confirm session lifecycle works

```
Call session_resume with project "skillbrain-onboarding" and summarize what it returned.
```

- ✅ **Expected:** Claude shows a session object (likely empty for a brand-new project) and your **Capability Profile**. No error.
- ❌ **Error:** copy the error message and send it to Daniel.

### Prompt 5 — Confirm skills load from the server (not local disk)

```
Call skill_route with the task "set up a Next.js page" and tell me the top 3 skills it suggests.
```

- ✅ **Expected:** Claude returns at least 3 skill names with relevance scores (e.g. `nextjs`, `react-expert`, `frontend-design`).
- ❌ **"skill not found" / empty list:** the server is unreachable — try again in 30s, then ping Daniel.

---

## Step 5 — Team conventions (read once)

- **Memory scope is `team` by default** — that's the whole point, knowledge gets shared. Use `personal` only for your own debug notes.
- **Tag domain memories with `skill:<name>`** (e.g. `skill:nextjs`, `skill:payments`) so the skill auto-evolution picks them up.
- **Don't read skills from local disk** — always use `skill_route` + `skill_read`. Local copies get stale.
- **Don't `git push` unless explicitly asked** — same rule everyone on the team follows.

---

## Troubleshooting cheat sheet

| Problem | Fix |
|---|---|
| 401 on every MCP tool | Key wrong/revoked → regenerate in Profile → update config → restart Claude Code |
| `memory_search` returns nothing | Server may be restarting, retry in 30s. If `memory.fl1.it` doesn't load in browser → ping Daniel |
| Dashboard won't load | Hard refresh (Cmd+Shift+R), then clear cookies for `memory.fl1.it` |
| Didn't get the invite email | Check spam; otherwise ask Daniel for the temp password directly |

---

## Contact

- **Admin:** Daniel — devecchidaniel93@gmail.com
- For anything broken after the 5 verification prompts, send Daniel: **(a)** which prompt failed and **(b)** the exact error message.

---

Once you finish the 5 verification prompts and all return ✅, you're fully connected.
