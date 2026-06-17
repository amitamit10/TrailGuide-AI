# TrailGuide AI — Phase 41: Dark Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark mode that follows system preference by default with a manual toggle saved to `localStorage`. All UI components use CSS custom properties (variables) so the switch is instant with no hydration flash.

**Architecture:** Tailwind's `dark:` variant is already available but not enabled. Enable `darkMode: "class"` in `tailwind.config.ts`. A `ThemeProvider` sets `class="dark"` on `<html>` based on user preference (stored in `localStorage`). A compact toggle button in the header. All custom colors (`#2D6A4F`, `#F5F0E8`, etc.) are replaced with CSS variables that change in dark mode.

**Tech Stack:** Tailwind CSS `dark:` variants, CSS custom properties, Next.js `<Script>` to prevent flash.

**Prerequisite:** Phase 27 (TypeScript strict). Phase 18 (pure Next.js frontend).

## Global Constraints
- NO flash of wrong theme on page load — use a blocking `<script>` in `<head>` to set the class before first paint.
- User preference stored in `localStorage` key `"theme"` with values `"light"` | `"dark"` | `"system"`.
- Default: `"system"` (respects `prefers-color-scheme`).
- Keep the green brand color (`#2D6A4F`) in both modes — just adjust backgrounds and text.
- No external library (no next-themes) — implement directly with ~50 lines.

---

## Task 1: Tailwind + CSS variables setup

- [ ] **Step 1: Update `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",  // ADD THIS
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          light: "var(--color-brand-light)",
        },
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-2": "var(--color-on-surface-2)",
        border: "var(--color-border)",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Add CSS variables to `src/app/globals.css`**

```css
:root {
  --color-brand: #2D6A4F;
  --color-brand-light: #F0F7F4;
  --color-surface: #FAFAF8;
  --color-surface-2: #FFFFFF;
  --color-on-surface: #111827;
  --color-on-surface-2: #6B7280;
  --color-border: #E5E7EB;
}

.dark {
  --color-brand: #52B788;          /* lighter green for dark bg */
  --color-brand-light: #1A2E25;
  --color-surface: #111827;        /* gray-900 */
  --color-surface-2: #1F2937;      /* gray-800 */
  --color-on-surface: #F9FAFB;     /* gray-50 */
  --color-on-surface-2: #9CA3AF;   /* gray-400 */
  --color-border: #374151;         /* gray-700 */
}
```

- [ ] **Step 3: Replace hardcoded hex colors in components**

Search for hardcoded colors:
```bash
grep -rn "#2D6A4F\|#F5F0E8\|bg-white\|bg-gray-50\|text-gray-900\|text-gray-500" src/ --include="*.tsx" | wc -l
```

Replace systematically:
```bash
# bg-white → bg-surface-2
# bg-[#FAFAF8] → bg-surface  
# text-gray-900 → text-on-surface
# text-gray-500 → text-on-surface-2
# border-gray-100, border-gray-200 → border-border
# bg-[#2D6A4F] → bg-brand
# bg-[#F0F7F4] or bg-[#F5F0E8] → bg-brand-light
```

- [ ] **Step 4: Add dark: variants to key components**

Card backgrounds:
```tsx
// Before:
<div className="bg-white rounded-2xl shadow-sm">
// After:
<div className="bg-surface-2 dark:shadow-none dark:border dark:border-border rounded-2xl shadow-sm">
```

Text:
```tsx
// Before:
<p className="text-gray-600">
// After:
<p className="text-on-surface-2">
```

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/
git commit -m "build: enable Tailwind dark mode class variant and add CSS variable color system"
```

---

## Task 2: Theme provider and flash prevention

- [ ] **Step 1: Create `src/lib/theme.ts`**

```typescript
export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  localStorage.setItem("theme", theme);
}

export function initTheme() {
  const stored = localStorage.getItem("theme") as Theme ?? "system";
  const isDark = stored === "dark" ||
    (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}
```

- [ ] **Step 2: Add blocking script to `src/app/layout.tsx` to prevent flash**

```tsx
// In <head>, BEFORE any CSS:
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){
  var t=localStorage.getItem('theme')||'system';
  var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  if(dark)document.documentElement.classList.add('dark');
})()`,
  }}
/>
```

This runs synchronously before the first paint — no flash.

- [ ] **Step 3: Create `src/components/ThemeToggle.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => { setThemeState(getStoredTheme()); }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    setThemeState(next);
  }

  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻";

  return (
    <button onClick={toggle} title={`Theme: ${theme}`}
      className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-2 border border-border text-sm">
      {icon}
    </button>
  );
}
```

- [ ] **Step 4: Add ThemeToggle to header/nav**

```tsx
import { ThemeToggle } from "@/components/ThemeToggle";
// In header:
<ThemeToggle />
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/components/ThemeToggle.tsx src/app/layout.tsx src/
git commit -m "feat: add dark mode with flash-free theme toggle (light/dark/system)"
```

---

## Task 3: Component-level dark mode sweep

- [ ] **Step 1: Test each major screen in dark mode**

Open DevTools → toggle `class="dark"` on `<html>` and check each page:
```
/dashboard  — cards, trip list, empty state
/trips/new  — wizard steps, buttons
/trips/[id]/timeline  — day cards, activity cards, map
/trips/[id]/budget  — bars, expense list
/explore    — destination cards
/admin      — stats table
```

- [ ] **Step 2: Fix any components with hardcoded colors not covered by CSS variables**

Common issues:
```tsx
// Photo captions hardcoded white on dark image overlay — OK
// Map tiles (Leaflet) — no change needed, map has own style
// Code/monospace text — add dark:text-gray-300
// Input placeholder color — add dark:placeholder-gray-500
```

Update each flagged component with appropriate `dark:` overrides.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "fix: apply dark mode overrides to all remaining hardcoded-color components"
```

---

## Verification Checklist

- [ ] No flash of wrong theme on hard refresh (blocking script works)
- [ ] Toggle cycles: light → dark → system → light
- [ ] `"system"` uses OS dark mode preference (test by toggling macOS/Windows dark mode)
- [ ] All backgrounds, text, and borders update on toggle
- [ ] Brand green (`#2D6A4F`) → lighter green (`#52B788`) in dark mode for visibility
- [ ] Input fields, cards, and modals all respect dark mode
- [ ] `npm run build` exits 0 (no type errors from new CSS variable usage)
