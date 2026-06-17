# TrailGuide AI — Phase 47: Accessibility (WCAG 2.1 AA)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TrailGuide meet WCAG 2.1 AA accessibility standards: keyboard navigation, screen reader support (ARIA labels), sufficient color contrast, focus indicators, and skip-to-content link.

**Architecture:** Pure frontend — no backend changes. Systematic audit of every component with the axe DevTools browser extension, then fix all reported issues. Key areas: form labels, button descriptions, image alt text, modal trap focus, keyboard-accessible custom components (dropdowns, toggles, drag handles).

**Tech Stack:** Next.js, `@axe-core/react` (dev-mode a11y warnings), `focus-trap-react` for modals. No new runtime dependencies.

**Prerequisite:** Phase 18 (Next.js frontend). Phase 41 (dark mode — color system now uses CSS variables).

## Global Constraints
- WCAG 2.1 AA minimum — not AAA.
- Use `axe-core` in development only (`process.env.NODE_ENV === "development"`).
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text.
- All interactive elements must be reachable and operable by keyboard alone.
- Images used for decoration (photo backgrounds) get `alt=""`. Images conveying content get descriptive alt text.
- Test with VoiceOver (macOS) or NVDA (Windows) at the end of this phase.

---

## Task 1: Audit tooling setup

- [ ] **Step 1: Install axe-core for dev-mode warnings**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install -D @axe-core/react
```

- [ ] **Step 2: Enable axe in `src/app/layout.tsx` (dev only)**

```typescript
// At top of layout (client-side only):
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  import("@axe-core/react").then(({ default: axe }) => {
    import("react-dom").then(({ default: ReactDOM }) => {
      axe(React, ReactDOM, 1000);
    });
  });
}
```

This logs accessibility violations to the browser console during development.

- [ ] **Step 3: Run initial audit**

Open Chrome DevTools → install axe DevTools extension → run "Analyze Page" on each major screen. Document all violations in `docs/a11y-audit.md`.

- [ ] **Step 4: Create `docs/a11y-audit.md`**

```markdown
# Accessibility Audit — WCAG 2.1 AA

## Tool: axe DevTools (Chrome extension)
## Date: 2026-06-18

## Pages Audited
- [ ] /dashboard
- [ ] /trips/new (all 8 wizard steps)
- [ ] /trips/[id]/timeline
- [ ] /trips/[id]/budget
- [ ] /explore
- [ ] /login
- [ ] /signup

## Violations Found

| ID | Severity | Page | Issue | Fix |
|---|---|---|---|---|
| (fill in from axe output) |

## Status: IN PROGRESS
```

- [ ] **Step 5: Commit**

```bash
git add docs/a11y-audit.md
git commit -m "docs: add a11y audit log for WCAG 2.1 AA compliance"
```

---

## Task 2: Core fixes — labels, focus, ARIA

- [ ] **Step 1: Skip-to-content link**

Add at the very top of `src/app/[locale]/layout.tsx`:
```tsx
<a href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-brand focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
  Skip to main content
</a>
<main id="main-content">{children}</main>
```

- [ ] **Step 2: Add `aria-label` to icon-only buttons**

Search for buttons with no visible text:
```bash
grep -rn "<button" src/ --include="*.tsx" | grep -v "aria-label" | head -20
```

Add `aria-label` to each:
```tsx
// Before:
<button onClick={toggle}>🌙</button>

// After:
<button onClick={toggle} aria-label={`Switch to ${theme} mode`}>🌙</button>
```

- [ ] **Step 3: Add alt text to all `<img>` elements**

```bash
grep -rn "<img" src/ --include="*.tsx" | grep -v "alt=" | head -20
```

For decorative photos: `alt=""`
For content photos: `alt={activity.title}` or `alt={destination.name}`

- [ ] **Step 4: Fix form labels**

All inputs must have an associated `<label>`:
```tsx
// Before:
<input type="email" placeholder="Email" />

// After:
<label htmlFor="email" className="sr-only">Email address</label>
<input id="email" type="email" placeholder="Email address" />
```

- [ ] **Step 5: Focus indicators**

Add global focus styles in `globals.css`:
```css
:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove outline on click (mouse), keep on keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ docs/a11y-audit.md
git commit -m "fix: add skip-to-content, aria-labels on icon buttons, form labels, focus indicators"
```

---

## Task 3: Modal and dialog accessibility

- [ ] **Step 1: Install focus-trap-react**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install focus-trap-react
```

- [ ] **Step 2: Wrap all modals and drawers with `<FocusTrap>`**

```tsx
import FocusTrap from "focus-trap-react";

// In any modal component:
{isOpen && (
  <FocusTrap>
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">{title}</h2>
      {/* modal content */}
      <button onClick={onClose} aria-label="Close dialog">×</button>
    </div>
  </FocusTrap>
)}
```

- [ ] **Step 3: Add `role="dialog"` and `aria-modal="true"` to drawers**

Search for bottom sheets and modals:
```bash
grep -rn "fixed inset\|z-50\|overlay\|Drawer\|Modal" src/ --include="*.tsx" | head -20
```

Ensure each has:
- `role="dialog"` 
- `aria-modal="true"`
- `aria-labelledby` pointing to its heading
- Escape key closes it

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix: add focus-trap and ARIA dialog roles to all modals and drawers"
```

---

## Task 4: Color contrast fixes

- [ ] **Step 1: Check contrast ratios**

Use WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/) for all text/background combinations:

Check these specific combos:
- `on-surface-2` text on `surface` background (currently `#6B7280` on `#FAFAF8`)
- Brand green `#2D6A4F` on white background
- White text on brand green button
- Light mode: `text-gray-400` on `bg-white`

Minimum: 4.5:1 for body text, 3:1 for large text (>18px or >14px bold).

- [ ] **Step 2: Fix insufficient contrast**

If `#6B7280` on `#FAFAF8` is below 4.5:1, darken to `#4B5563` (gray-600):
```css
/* In globals.css */
:root {
  --color-on-surface-2: #4B5563;  /* was #6B7280 */
}
.dark {
  --color-on-surface-2: #9CA3AF;  /* already sufficient in dark mode */
}
```

- [ ] **Step 3: Fix contrast in badges and chips**

Category chips use light background + text:
```tsx
// Before: text-[#2D6A4F] on bg-[#F0F7F4] — may be low contrast
// After: ensure bg is light enough to pass 4.5:1 with text color
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/
git commit -m "fix: improve color contrast to meet WCAG 2.1 AA 4.5:1 minimum"
```

---

## Task 5: Keyboard navigation for custom components

- [ ] **Step 1: Make custom checkboxes keyboard-accessible**

Packing list checkboxes and activity completion buttons:
```tsx
// Add keyboard handler:
<button
  role="checkbox"
  aria-checked={item.is_packed}
  onClick={() => toggle(item.id, item.is_packed)}
  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") toggle(item.id, item.is_packed); }}
  className="..."
/>
```

- [ ] **Step 2: Make toggle buttons ARIA-correct**

Theme toggle:
```tsx
<button
  role="switch"
  aria-checked={theme === "dark"}
  aria-label="Toggle dark mode"
  onClick={toggle}
/>
```

Notification toggle:
```tsx
<button
  role="switch"
  aria-checked={notificationsEnabled}
  aria-label="Enable Telegram notifications"
  onClick={toggleNotifications}
/>
```

- [ ] **Step 3: Add keyboard navigation to bottom tabs**

```tsx
// Bottom nav: arrow keys navigate between tabs
<nav role="navigation" aria-label="Main navigation">
  {tabs.map((tab, i) => (
    <a key={tab.href} href={tab.href}
      role="tab"
      aria-selected={isActive(tab.href)}
      tabIndex={isActive(tab.href) ? 0 : -1}
      onKeyDown={e => {
        if (e.key === "ArrowRight") tabs[(i+1)%tabs.length].focus();
        if (e.key === "ArrowLeft") tabs[(i-1+tabs.length)%tabs.length].focus();
      }}>
      {tab.label}
    </a>
  ))}
</nav>
```

- [ ] **Step 4: Final audit and sign-off**

Run axe DevTools on all 7 pages again. Update `docs/a11y-audit.md` with results. Zero critical/serious violations.

- [ ] **Step 5: Commit**

```bash
git add src/ docs/a11y-audit.md
git commit -m "fix: make custom checkboxes, toggles, and nav keyboard-accessible with ARIA roles"
```

---

## Verification Checklist

- [ ] Tab key navigates through all interactive elements in logical order
- [ ] Escape key closes any open modal/drawer
- [ ] Skip-to-content link appears on focus (Tab from page top)
- [ ] VoiceOver (macOS): announce activity card content correctly
- [ ] axe DevTools: zero "critical" violations on dashboard and timeline
- [ ] Contrast ratio ≥ 4.5:1 for all body text
- [ ] All icon buttons have `aria-label`
- [ ] All form inputs have associated `<label>` elements
- [ ] Modals trap focus while open, restore focus to trigger on close
