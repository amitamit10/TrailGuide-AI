# TrailGuide AI — Phase 30: End-to-End Tests (Playwright)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright test suite covering the 5 critical user journeys: sign-up, create trip (AI generation), view timeline, mark activity complete, and view summary. Tests run against a real stack (all three services running) with a dedicated test user account.

**Architecture:** Playwright tests run headlessly in CI. A test user (`e2e@trailguide.test`) is pre-seeded in Supabase staging. `playwright.config.ts` starts all three services as `webServer` before the test run. Tests use Playwright's built-in auth state storage (`storageState`) so the sign-in flow only runs once per test session.

**Tech Stack:** `@playwright/test` 1.48+. Node.js 20.

**Prerequisite:** Phase 19 complete (all three services runnable). Phase 27 (TypeScript strict — ensures build works).

## Global Constraints
- New env vars: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — credentials for the test Supabase user.
- Tests live in `e2e/` at repo root, not inside `src/`.
- Never run E2E against production — use `NEXT_PUBLIC_API_URL=http://localhost:8080`.
- AI generation is tested with a real call (can take 5-10s) — set `timeout: 60000` on the generation step.
- CI runs E2E only on `push` to `main` (not PRs) to save minutes.

---

## Task 1: Playwright setup

- [ ] **Step 1: Install Playwright**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: "**/auth.setup.ts" },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "cd backend && go run main.go",
      port: 8080,
      reuseExistingServer: true,
    },
    {
      command: "cd ai-service && source .venv/bin/activate && uvicorn main:app --port 8081",
      port: 8081,
      reuseExistingServer: true,
    },
    {
      command: "npm run build && npm start",
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
```

- [ ] **Step 3: Create `e2e/.auth/` directory**

```bash
mkdir -p e2e/.auth
echo '{}' > e2e/.auth/user.json
echo "e2e/.auth/" >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/ .gitignore package.json
git commit -m "test: add Playwright E2E test setup with webServer config"
```

---

## Task 2: Auth setup and sign-in test

- [ ] **Step 1: Create `e2e/auth.setup.ts`**

```typescript
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.getByPlaceholder(/email/i).fill(process.env.E2E_USER_EMAIL!);
  await page.getByPlaceholder(/password/i).fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);

  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 2: Verify auth setup works**

```bash
E2E_USER_EMAIL=e2e@trailguide.test E2E_USER_PASSWORD=testpass123 \
  npx playwright test auth.setup.ts --headed
```

Expected: browser opens, fills login form, redirects to dashboard, creates `e2e/.auth/user.json`.

---

## Task 3: Core journey tests

- [ ] **Step 1: Create `e2e/dashboard.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test("dashboard loads and shows trip list", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveTitle(/TrailGuide/i);
  // Either shows a trip or the empty state CTA
  const hasTripOrCTA = await page.locator("text=Start Planning").count() > 0
    || await page.locator("[data-testid='trip-card']").count() > 0;
  expect(hasTripOrCTA).toBeTruthy();
});

test("navigation tabs are visible", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /trips/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /explore/i })).toBeVisible();
});
```

- [ ] **Step 2: Create `e2e/trip-creation.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test("create a trip end-to-end", async ({ page }) => {
  await page.goto("/trips/new");

  // Step 1: Destination
  await page.getByPlaceholder(/destination/i).fill("Kyoto, Japan");
  await page.getByRole("button", { name: /next/i }).click();

  // Step 2: Dates
  await page.getByLabel(/start date/i).fill("2026-09-01");
  await page.getByLabel(/end date/i).fill("2026-09-05");
  await page.getByRole("button", { name: /next/i }).click();

  // Step 3-8: Remaining wizard steps (click through with defaults)
  for (let i = 0; i < 6; i++) {
    const nextBtn = page.getByRole("button", { name: /next|continue/i });
    if (await nextBtn.isVisible()) await nextBtn.click();
  }

  // Final: Generate
  await page.getByRole("button", { name: /generate|create/i }).click();

  // Wait for AI generation (up to 60s)
  await page.waitForURL("**/trips/**/timeline", { timeout: 60_000 });
  await expect(page).toHaveURL(/timeline/);

  // Timeline shows at least one activity
  const activityCards = page.locator("[data-testid='activity-card']");
  await expect(activityCards.first()).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 3: Create `e2e/timeline.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Navigate to the first trip's timeline
  await page.goto("/dashboard");
  const firstTripLink = page.locator("a[href*='/trips/']").first();
  await firstTripLink.click();
  await page.waitForURL("**/trips/**/timeline");
});

test("timeline shows days and activities", async ({ page }) => {
  await expect(page.getByText(/day 1/i)).toBeVisible();
});

test("can mark activity as complete", async ({ page }) => {
  const checkbox = page.locator("[data-testid='activity-complete']").first();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
});

test("can navigate to map tab", async ({ page }) => {
  await page.getByRole("link", { name: /map/i }).click();
  await page.waitForURL("**/map");
  await expect(page.locator("canvas, [class*='leaflet']")).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 4: Add E2E to CI**

In `.github/workflows/ci.yml`, add a new job (runs only on `main`):
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: npm }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npx playwright test
      env:
        E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
        E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
        SUPABASE_JWT_SECRET: ${{ secrets.SUPABASE_JWT_SECRET }}
        AI_SERVICE_URL: http://localhost:8081
        INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}
        GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

- [ ] **Step 5: Commit**

```bash
git add e2e/ playwright.config.ts .github/workflows/ci.yml
git commit -m "test: add Playwright E2E tests for auth, dashboard, trip creation, and timeline"
```

---

## Verification Checklist

- [ ] `npx playwright test auth.setup.ts` creates `e2e/.auth/user.json`
- [ ] `npx playwright test` runs all tests (requires all 3 services running)
- [ ] Dashboard test passes — page loads and shows content
- [ ] Trip creation test creates a trip and lands on timeline
- [ ] Activity complete checkbox toggles and persists after page reload
- [ ] Map tab shows Leaflet canvas
- [ ] CI E2E job runs on push to main and uploads failure artifacts
