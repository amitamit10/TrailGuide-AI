# TrailGuide AI — Phase 29: Python AI Service Test Suite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a pytest suite for all Python AI service routes. Mock the Groq API to avoid real LLM calls and costs during tests. Cover: auth rejection, happy-path response shapes, and error handling.

**Architecture:** `pytest` + `httpx` async test client (`AsyncClient` from `httpx`). Groq responses are mocked via `unittest.mock.AsyncMock` — tests patch `services.groq_client.get_groq()` to return a mock client whose `chat.completions.create()` returns a pre-built fixture object. The internal auth token is set via an env var in `conftest.py`. No real Groq calls, no real Tavily calls.

**Tech Stack:** pytest, pytest-asyncio, httpx, respx (for mocking httpx calls to Tavily/Unsplash).

**Prerequisite:** Phase 17 complete (Python AI service exists).

## Global Constraints
- No real API calls in tests — Groq, Tavily, Unsplash, Open-Meteo are all mocked.
- `INTERNAL_API_SECRET=test-secret` set in `conftest.py` fixture.
- Tests run with `cd ai-service && pytest -v`.
- Add `pytest`, `pytest-asyncio`, `httpx`, `respx` to a new `requirements-dev.txt`.

---

## Task 1: Test setup and conftest

- [ ] **Step 1: Create `ai-service/requirements-dev.txt`**

```
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
respx==0.21.1
```

Install:
```bash
cd ai-service && source .venv/bin/activate
pip install -r requirements-dev.txt
```

- [ ] **Step 2: Create `ai-service/conftest.py`**

```python
import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

os.environ["INTERNAL_API_SECRET"] = "test-secret"
os.environ["GROQ_API_KEY"] = "test-key"

from main import app  # import AFTER setting env vars

@pytest.fixture
def internal_headers():
    return {"X-Internal-Token": "test-secret", "Content-Type": "application/json"}

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

def make_groq_response(content: str):
    """Build a fake Groq completion response object."""
    message = MagicMock()
    message.content = content
    choice = MagicMock()
    choice.choices = [MagicMock(message=message, delta=MagicMock(content=content))]
    choice.choices[0].message.content = content
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock()]
    mock_completion.choices[0].message.content = content
    return mock_completion

@pytest.fixture
def mock_groq(monkeypatch):
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock()
    monkeypatch.setattr("services.groq_client._client", mock_client)
    return mock_client
```

- [ ] **Step 3: Verify conftest loads**

```bash
cd ai-service && source .venv/bin/activate && pytest --collect-only 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/requirements-dev.txt ai-service/conftest.py
git commit -m "test: add pytest setup with httpx AsyncClient and Groq mock fixtures"
```

---

## Task 2: Auth middleware tests

- [ ] **Step 1: Create `ai-service/tests/test_auth.py`**

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_missing_internal_token_returns_403(client):
    resp = await client.post("/ai/generate-itinerary", json={
        "destination": "Tokyo", "startDate": "2026-08-01", "endDate": "2026-08-05",
        "travelers": 2, "tripStyle": "explorer", "interests": [], "transportMode": "public", "budget": "medium"
    })
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_wrong_internal_token_returns_403(client):
    resp = await client.post(
        "/ai/generate-itinerary",
        json={"destination": "Tokyo"},
        headers={"X-Internal-Token": "wrong-secret"},
    )
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_health_endpoint_is_public(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_photo_proxy_is_public(client):
    # /places/photo has no internal token requirement
    import respx, httpx
    with respx.mock:
        respx.get("https://en.wikipedia.org/w/api.php").mock(
            return_value=httpx.Response(200, json={"query": {"pages": {}}})
        )
        resp = await client.get("/places/photo?query=Eiffel+Tower")
        # 404 is fine — Wikipedia returned empty; point is no 403
        assert resp.status_code in (200, 404)
```

- [ ] **Step 2: Run auth tests**

```bash
cd ai-service && source .venv/bin/activate && pytest tests/test_auth.py -v
```

Expected: all 3 pass.

- [ ] **Step 3: Commit**

```bash
git add ai-service/tests/test_auth.py
git commit -m "test: add Python auth middleware tests (403 on missing/wrong token)"
```

---

## Task 3: AI route tests (mocked Groq)

- [ ] **Step 1: Create `ai-service/tests/test_generate.py`**

```python
import json
import pytest

SAMPLE_ITINERARY = {
    "days": [{
        "date": "2026-08-01", "day_number": 1,
        "activities": [{
            "title": "Senso-ji Temple", "description": "Visit Tokyo's oldest temple.",
            "time": "09:00", "duration": "2 hours", "cost": 0.0,
            "category": "attraction", "address": "2-3-1 Asakusa, Taito City",
            "photo_query": "Senso-ji Temple Tokyo"
        }]
    }]
}

@pytest.mark.asyncio
async def test_generate_itinerary_returns_days(client, internal_headers, mock_groq):
    mock_groq.chat.completions.create.return_value = __import__("conftest", fromlist=["make_groq_response"]).make_groq_response(
        json.dumps(SAMPLE_ITINERARY)
    )
    # Simpler: patch directly in the test
    from unittest.mock import AsyncMock, MagicMock
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock()]
    mock_completion.choices[0].message.content = json.dumps(SAMPLE_ITINERARY)
    mock_groq.chat.completions.create.return_value = mock_completion

    resp = await client.post("/ai/generate-itinerary", headers=internal_headers, json={
        "destination": "Tokyo, Japan",
        "startDate": "2026-08-01",
        "endDate": "2026-08-05",
        "travelers": 2,
        "tripStyle": "explorer",
        "interests": ["food", "history"],
        "transportMode": "public",
        "budget": "medium",
        "currency": "USD",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "days" in data
    assert len(data["days"]) == 1
    assert data["days"][0]["activities"][0]["title"] == "Senso-ji Temple"

@pytest.mark.asyncio
async def test_trip_story_returns_story_key(client, internal_headers, mock_groq):
    from unittest.mock import MagicMock
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = "A wonderful trip through ancient temples."
    mock_groq.chat.completions.create.return_value = mock_completion

    resp = await client.post("/ai/trip-story", headers=internal_headers, json={
        "destination": "Tokyo",
        "startDate": "2026-08-01",
        "endDate": "2026-08-05",
        "activities": ["Senso-ji Temple", "Shibuya Crossing"],
    })
    assert resp.status_code == 200
    assert "story" in resp.json()
    assert len(resp.json()["story"]) > 10

@pytest.mark.asyncio
async def test_recommendations_returns_list(client, internal_headers, mock_groq):
    from unittest.mock import MagicMock
    sample = {"recommendations": [
        {"title": "Tsukiji Outer Market", "description": "Fresh sushi breakfast.",
         "reason": "Matches food interest.", "category": "food",
         "address": "4 Tsukiji, Chuo City", "estimated_cost": 15.0,
         "duration": "1 hour", "photo_query": "Tsukiji Market Tokyo"}
    ]}
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = json.dumps(sample)
    mock_groq.chat.completions.create.return_value = mock_completion

    resp = await client.post("/ai/recommendations", headers=internal_headers, json={
        "destination": "Tokyo", "interests": ["food"],
    })
    assert resp.status_code == 200
    assert "recommendations" in resp.json()
    assert len(resp.json()["recommendations"]) >= 1
```

- [ ] **Step 2: Run AI route tests**

```bash
cd ai-service && source .venv/bin/activate && pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 3: Add to CI**

In `.github/workflows/ci.yml`, update the `python-ai` job:
```yaml
- name: Run tests
  run: pytest tests/ -v
  env:
    GROQ_API_KEY: placeholder
    INTERNAL_API_SECRET: test-secret
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/tests/ .github/workflows/ci.yml
git commit -m "test: add Python AI service tests for auth, generate-itinerary, recommendations, trip-story"
```

---

## Verification Checklist

- [ ] `cd ai-service && pytest -v` runs all tests without making real API calls
- [ ] Missing `X-Internal-Token` → 403 on all `/ai/*` routes
- [ ] `POST /ai/generate-itinerary` with mocked Groq → returns `{ days: [...] }`
- [ ] `POST /ai/trip-story` → returns `{ story: "..." }`
- [ ] `POST /ai/recommendations` → returns `{ recommendations: [...] }`
- [ ] `GET /health` is public (no token needed)
- [ ] CI runs pytest on every push
