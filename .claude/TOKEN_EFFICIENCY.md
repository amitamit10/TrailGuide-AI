# Token Efficiency — How to Work Without Wasting Context

This guide exists because Claude Code sessions on this repo tend to burn tokens on things that don't need them. Read it before starting any task.

---

## The Golden Rule

**CLAUDE.md already loaded architecture, env vars, the full changelog, and the deploy checklist into your context.** Do not re-read those files unless the task explicitly modifies them. Everything about the DB schema, service layout, auth patterns, and phase status is already here.

---

## 1. Never Read a File to Find Something — Grep First

Bad:
```
Read(src/lib/ratelimit.ts)   ← reading the whole file to find one function
```

Good:
```
Grep("publicRatelimit", type="ts")   ← find it in one shot
```

Then use `Read` with `offset` + `limit` to read only the relevant lines.

---

## 2. Always Use offset + limit on Large Files

Files like `CHANGELOG.md`, `docs/api-reference.md`, and migration files are long. Never read them from the top unless you need the top.

```
Read(CHANGELOG.md, offset=132, limit=20)   ← jump straight to the changelog section
Read(supabase/migrations/001_initial_schema.sql, offset=1, limit=50)
```

Rule of thumb: if you don't know where in the file the thing you need is, **Grep first, then Read with offset**.

---

## 3. Batch Every Independent Tool Call

Any time you need two or more things that don't depend on each other, make them in the same message.

Bad (sequential, double the roundtrips):
```
Read(src/app/api/expenses/route.ts)
... wait ...
Read(src/app/api/checklist/check/route.ts)
```

Good (parallel):
```
Read(src/app/api/expenses/route.ts)          ← both in the same message
Read(src/app/api/checklist/check/route.ts)
```

This applies to Grep, Glob, Bash, and Read equally.

---

## 4. Use Edit, Not Write, for Changes to Existing Files

`Write` sends the entire file content. `Edit` sends only the diff. On files over ~50 lines, always use `Edit`.

The only time to use `Write` is when creating a new file or doing a complete rewrite.

---

## 5. Don't Spawn an Agent for Things You Can Do Inline

Agents start cold — they re-derive everything from scratch. Spawning one to "search the codebase for X" when you could just `Grep("X")` wastes the entire agent's startup context.

Use the Agent tool only when:
- The task needs to explore 10+ files across multiple directories
- You want to protect your main context from a large Bash output
- The subagent type is `Explore` and you genuinely don't know where to look

For anything you can express as a Grep pattern or a Glob + 2–3 Reads, do it inline.

---

## 6. Don't Read CHANGELOG.md Mid-Task

The full changelog is already in your system prompt via CLAUDE.md. You only need to `Read` CHANGELOG.md when you're about to **write** to it (to know what's there before editing).

---

## 7. Skip These Directories Entirely

Never search or read inside:
- `node_modules/`
- `.next/`
- `ai-service/.venv/`
- `backend/vendor/` (if it exists)

Add `--glob '!node_modules/**'` to any broad Grep.

---

## 8. Run tsc Only When You've Changed TypeScript

`tsc --noEmit` on this repo takes several seconds and prints hundreds of lines. Only run it when you've actually modified `.ts` or `.tsx` files. Don't run it as a "just checking" step before you've changed anything.

---

## 9. Know Where Things Live — Don't Search for the Obvious

The architecture is documented in your context. Before grepping for something, check:

| What you need | Where it is |
|---|---|
| DB table definitions | `supabase/migrations/` |
| API route for X | `src/app/api/<topic>/route.ts` |
| Go trip handler | `backend/handlers/trips.go` |
| Python AI router for X | `ai-service/routers/<name>.py` |
| Auth helpers | `src/lib/supabase/server.ts` |
| Rate limiting | `src/lib/ratelimit.ts` |
| Backend proxy | `src/lib/backend-proxy.ts` |
| Supabase types | `src/types/` |

If you know the file, `Read` it directly. Don't Grep first for known files.

---

## 10. Don't Re-Read What You Just Edited

After a successful `Edit` or `Write`, the file state is current in your context. Reading it back to verify is wasted tokens — the tool would have errored if the write failed.

---

## 11. Keep Bash Output Small

When you need to run Bash, scope it:

Bad:
```bash
cat src/app/api/ai/generate-itinerary/route.ts
```

Good:
```bash
head -40 src/app/api/ai/generate-itinerary/route.ts
```

Or better: use `Read(file, limit=40)` instead of Bash at all.

For `git diff`, limit to specific files rather than a full diff:
```bash
git diff src/app/api/expenses/route.ts
```

---

## 12. One-Shot Commit

When committing, do `git status`, `git add`, and `git commit` in as few Bash calls as possible. Don't run `git status` twice or check `git log` unless you need to match a commit style. The commit message style for this repo is: `<type>: <short description>` with a body if needed.

---

## Summary: The Shortest Path to Done

1. Check what's already in context (CLAUDE.md loaded a lot)
2. Grep → narrow down → Read with offset/limit
3. Batch all parallel tool calls
4. Edit (not Write) for changes
5. Commit in one pass
