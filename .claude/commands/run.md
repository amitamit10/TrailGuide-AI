# Run — Start and Verify the App

Use this skill to launch the app and confirm a change works.

## Which services to start

This app has three services. You almost never need all three — pick the minimum set for what you're testing:

| What you changed | Services needed |
|---|---|
| Next.js UI, a Next.js API route | Next.js only |
| Go handler (`backend/`) | Next.js + Go |
| Python AI router (`ai-service/`) | Next.js + Go + Python |

## Start Next.js (always required)

```bash
npm run dev
```

Wait for: `✓ Ready in` before testing. Runs on http://localhost:3000.

## Start Go backend (when testing trip CRUD or AI proxy)

```bash
cd backend && go run main.go
```

Wait for: `Listening and serving HTTP on :8080`

Requires `backend/.env` with `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `INTERNAL_API_SECRET`, `AI_SERVICE_URL`.

## Start Python AI service (when testing AI routes)

```bash
cd ai-service && source .venv/bin/activate && uvicorn main:app --port 8081 --reload
```

Wait for: `Uvicorn running on http://0.0.0.0:8081`

Requires `ai-service/.env` with `GROQ_API_KEY`, `INTERNAL_API_SECRET`.

## Verify the change

After the relevant service is up:

1. Open http://localhost:3000 in the browser tool
2. Navigate to the feature you changed
3. Exercise the happy path — confirm it works
4. Check the terminal for errors or stack traces
5. If you changed an API route, you can also hit it directly with curl

## Teardown

Kill any background processes you started when you're done. Don't leave dev servers running if the task is complete.
