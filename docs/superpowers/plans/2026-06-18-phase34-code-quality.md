# TrailGuide AI — Phase 34: Code Quality Automation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce consistent code quality across all three services with linters, formatters, and pre-commit hooks that run automatically on every commit. CI must reject PRs with linting failures.

**Architecture:** Go uses `golangci-lint`. Python uses `ruff` (linting + formatting) and `mypy` (type checking). TypeScript/Next.js uses ESLint with strict rules. Pre-commit hooks (via `.githooks/`) run the relevant linter for changed files only (fast). CI runs all linters on every PR. `make lint` runs all three.

**Tech Stack:** `golangci-lint` 1.61+, `ruff` 0.7+, `mypy` 1.13+, `eslint` 8+, git hooks.

**Prerequisite:** Phase 26-33 complete (clean codebase with types + tests).

## Global Constraints
- Pre-commit hooks run ONLY on files staged for commit (fast — no full codebase scan).
- Linters run in CI on every PR (not just main pushes).
- `make lint` must exit 0 on a clean codebase.
- Never use `--fix` in CI — only check. Developers run `make lint-fix` locally to auto-fix.
- All new linting errors are fixed in this phase before committing the lint config.

---

## Task 1: Go — golangci-lint

- [ ] **Step 1: Install golangci-lint**

```bash
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.61.0
```

- [ ] **Step 2: Create `backend/.golangci.yml`**

```yaml
run:
  timeout: 5m
  modules-download-mode: readonly

linters:
  enable:
    - errcheck       # Check all errors are handled
    - govet          # Suspicious constructs
    - ineffassign    # Assignments with no effect
    - staticcheck    # Advanced static analysis
    - gosimple       # Simplification suggestions
    - unused         # Unused code
    - gofmt          # Formatting
    - goimports      # Import ordering
    - revive         # General linting
    - gosec          # Security issues
    - bodyclose      # Check HTTP response body is closed

linters-settings:
  revive:
    rules:
      - name: exported
        disabled: true  # Don't require comments on all exported symbols

issues:
  exclude-rules:
    - path: "_test.go"
      linters: [gosec, errcheck]  # Relax in tests
    - path: "internal/testutil/"
      linters: [gosec]
```

- [ ] **Step 3: Run and fix all lint errors**

```bash
cd backend && golangci-lint run ./...
```

Fix all reported issues before committing. Common fixes:
- Unhandled errors: `if err := ...; err != nil { return err }`
- Unused imports: remove with `goimports`
- gosec: replace `math/rand` with `crypto/rand` for secrets

- [ ] **Step 4: Add to Makefile**

```makefile
## lint-go: Lint Go backend
lint-go:
	@cd backend && golangci-lint run ./...

## lint-go-fix: Auto-fix Go lint issues
lint-go-fix:
	@cd backend && golangci-lint run --fix ./...
```

- [ ] **Step 5: Commit**

```bash
git add backend/.golangci.yml backend/ Makefile
git commit -m "build: add golangci-lint config and fix all Go lint errors"
```

---

## Task 2: Python — ruff + mypy

- [ ] **Step 1: Add to `ai-service/requirements-dev.txt`**

```
ruff==0.7.4
mypy==1.13.0
```

```bash
cd ai-service && source .venv/bin/activate && pip install ruff mypy
```

- [ ] **Step 2: Create `ai-service/pyproject.toml`**

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "B",    # flake8-bugbear
    "N",    # pep8-naming
    "UP",   # pyupgrade
]
ignore = [
    "B008",  # function calls in default args (common in FastAPI)
    "N818",  # Exception names don't need to end in Error
]

[tool.ruff.per-file-ignores]
"tests/*.py" = ["E501"]  # Long lines OK in tests

[tool.mypy]
python_version = "3.12"
strict = false
ignore_missing_imports = true
disallow_untyped_defs = true
check_untyped_defs = true
warn_return_any = true
warn_unused_ignores = true

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs = false
```

- [ ] **Step 3: Run ruff and fix all issues**

```bash
cd ai-service && source .venv/bin/activate
ruff check . --fix
ruff format .
mypy . --ignore-missing-imports 2>&1 | head -50
```

Fix any remaining type errors (`mypy` output).

- [ ] **Step 4: Add to Makefile**

```makefile
## lint-python: Lint Python AI service
lint-python:
	@cd ai-service && source .venv/bin/activate && ruff check . && mypy . --ignore-missing-imports

## lint-python-fix: Auto-fix Python lint issues
lint-python-fix:
	@cd ai-service && source .venv/bin/activate && ruff check . --fix && ruff format .
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/pyproject.toml ai-service/ Makefile
git commit -m "build: add ruff + mypy to Python AI service, fix all lint errors"
```

---

## Task 3: TypeScript — ESLint strict

- [ ] **Step 1: Install/update ESLint config**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks eslint-plugin-import
```

- [ ] **Step 2: Create `.eslintrc.json`**

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "tsconfigRootDir": "."
  },
  "plugins": ["@typescript-eslint", "import"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "import/no-duplicates": "error"
  },
  "ignorePatterns": ["src/types/generated.ts", "*.config.js", "*.config.ts"]
}
```

- [ ] **Step 3: Run ESLint and fix all errors**

```bash
npx eslint src/ --ext .ts,.tsx --fix
npx eslint src/ --ext .ts,.tsx  # Verify zero errors
```

- [ ] **Step 4: Add to Makefile**

```makefile
## lint-ts: Lint TypeScript/Next.js
lint-ts:
	@source $(NVM_DIR)/nvm.sh 2>/dev/null; \
	npx eslint src/ --ext .ts,.tsx

## lint-ts-fix: Auto-fix TypeScript lint issues
lint-ts-fix:
	@source $(NVM_DIR)/nvm.sh 2>/dev/null; \
	npx eslint src/ --ext .ts,.tsx --fix
```

Also add combined targets:
```makefile
## lint: Run all linters
lint: lint-go lint-python lint-ts

## lint-fix: Auto-fix all lint issues
lint-fix: lint-go-fix lint-python-fix lint-ts-fix
```

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.json package.json Makefile
git commit -m "build: add ESLint strict config for TypeScript, fix all lint errors"
```

---

## Task 4: Pre-commit hooks

- [ ] **Step 1: Create `.githooks/pre-commit`**

```bash
mkdir -p .githooks
cat > .githooks/pre-commit << 'EOF'
#!/bin/bash
# Lint only changed files — fast pre-commit check

set -e

STAGED_GO=$(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' | head -5)
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM | grep '\.py$' | head -5)
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | head -5)

if [ -n "$STAGED_GO" ]; then
    echo "→ Running golangci-lint on changed Go files..."
    cd backend && golangci-lint run $STAGED_GO 2>&1
fi

if [ -n "$STAGED_PY" ]; then
    echo "→ Running ruff on changed Python files..."
    cd ai-service && source .venv/bin/activate 2>/dev/null
    ruff check $STAGED_PY
fi

if [ -n "$STAGED_TS" ]; then
    echo "→ Running ESLint on changed TypeScript files..."
    source "$HOME/.nvm/nvm.sh" 2>/dev/null
    npx eslint $STAGED_TS --ext .ts,.tsx --max-warnings 0
fi

echo "✓ Pre-commit checks passed"
EOF
chmod +x .githooks/pre-commit
```

- [ ] **Step 2: Configure git to use the hooks**

```bash
git config core.hooksPath .githooks
```

- [ ] **Step 3: Add to Makefile (for new developers)**

```makefile
## setup: Configure git hooks and install dependencies
setup:
	@git config core.hooksPath .githooks
	@echo "✓ Git hooks configured"
```

- [ ] **Step 4: Commit**

```bash
git add .githooks/ Makefile
git commit -m "build: add pre-commit hooks for Go, Python, TypeScript linting"
```

---

## Task 5: CI lint job

- [ ] **Step 1: Update `.github/workflows/ci.yml` with lint jobs**

```yaml
lint:
  name: Lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    # Go
    - uses: actions/setup-go@v5
      with: { go-version: "1.22" }
    - uses: golangci/golangci-lint-action@v6
      with:
        working-directory: backend

    # Python
    - uses: actions/setup-python@v5
      with: { python-version: "3.12" }
    - run: |
        pip install ruff mypy
        cd ai-service && ruff check . && mypy . --ignore-missing-imports

    # TypeScript
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: npm }
    - run: npm ci
    - run: npx eslint src/ --ext .ts,.tsx --max-warnings 0
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint job for Go, Python, TypeScript on every PR"
```

---

## Verification Checklist

- [ ] `make lint` exits 0 (zero lint errors in all three services)
- [ ] `git commit` triggers pre-commit hook and blocks commit on lint errors
- [ ] CI lint job runs on every PR and fails on introduced lint errors
- [ ] `make lint-fix` auto-fixes common issues (gofmt, ruff, eslint --fix)
- [ ] `@typescript-eslint/no-explicit-any: "error"` prevents new `any` types
- [ ] `golangci-lint` catches unhandled errors in Go handlers
- [ ] `mypy` catches missing type annotations in Python routes
