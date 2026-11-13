# Timișoara Newcomer Hub: build kit for UniHack 8

Nov 13, 2026 · @Blidari Laurentiu

## 1. Analysis: is the plan ready to build?

Yes. It is a solid hackathon template: two features with one owner each, a shared API contract first, and a fallback for every risky dependency. Fix the eight points below before writing code. Most take minutes; all of them are already built into the prompts in section 2.

**Keep as is**

- Scope is cut to two features that map 1:1 to UniHack problems 1.17 and 2.14.
- Each sponsor (Gemini, Tiger Data, Auth0) has a concrete demo moment, not just a logo.
- API contract first, with mock responses, lets frontend and backend move in parallel.
- The matcher is a pure function, so it can be unit-tested without the database.
- Env-only config plus a Dockerfile keeps the hosting choice open while Vultr is parked.

**Fix before coding**

| # | Problem in the plan | Fix | Where |
| --- | --- | --- | --- |
| 1 | Both build lists write `db/seed.py`, which guarantees a merge conflict | `db/seed_listings.py` (A) and `db/seed_events.py` (B); `db/seed.py` only calls both | Prompt 2 |
| 2 | One `schema.sql` edited by two people still conflicts, even with marked blocks | Split into `db/schema/00_shared.sql`, `10_lease.sql`, `20_events.sql`; `reset_db.py` runs them in order | Prompt 2 |
| 3 | Integer vs UUID ids is left open | UUID everywhere, `default gen_random_uuid()` | Prompt 2 |
| 4 | The matcher drops pairs with zero availability overlap, but everyone in the pool already chose the same event at a fixed time | Do not drop those pairs: joining means the user is free then. Keep the 0.4 term only to favour people who could meet again | Person B |
| 5 | Auth0 access tokens carry no email by default, but `users.email` and the student badge need it | Post-Login Action adds `https://newcomer-hub/email` and `https://newcomer-hub/student` claims; `email` nullable until then | Person B |
| 6 | Romanian leases contain CNP, ID series and IBAN; the plan stores `lease_text` raw and sends it to Gemini | Regex-redact CNP (13 digits), IBAN and ID series before Gemini and before saving; mention it in the pitch | Person A |
| 7 | The Tiger Data prize rewards Timescale features, but the hypertable is only a stretch | Make `listings` a hypertable on `listed_at` in Phase 2 (primary key `(id, listed_at)`), guarded so plain Postgres still works; trend chart stays stretch | Person A |
| 8 | The dev token bypass appears only in Risks | Build it into `auth.py` now: header `X-Dev-User` works only when `APP_ENV=dev` | Prompt 3 |

Pitch angle for the Civicore track: open with Mei's story and close on the shared principle, "a newcomer can trust what they see".

## 2. Claude Code prompts for the skeleton

Seven prompts build the skeleton in about 2 to 3 hours. Person A runs 0 to 4 and 6 (backend and database); Person B runs 5 (frontend) as soon as prompt 1 is pushed. Copy each block as it is.

**How to run them**

1. Create the repo folder, save the plan file as `docs/PLAN.md`, then start `claude` in the repo root.
2. Run one prompt per session (or `/clear` between them) so the context stays small.
3. For prompts 2 and 4, switch to plan mode first (Shift+Tab) and approve the plan before it writes code.
4. Read the diff, run what the prompt says to run, then commit before the next prompt.

**Prompt 0: CLAUDE.md (Person A)**

```text
Read docs/PLAN.md. It is the plan for our UniHack 8 project "Timisoara Newcomer Hub" (team of 2, 48 hours).
Create CLAUDE.md at the repo root (under 80 lines) for future sessions. Include:
- A short project summary and the two features: Feature A lease check (Person A), Feature B event groups (Person B).
- Stack: FastAPI + psycopg 3 with psycopg_pool on Tiger Cloud (Postgres + TimescaleDB), google-genai, Auth0 (PyJWT + PyJWKClient), React + Vite + @auth0/auth0-react.
- The repo layout from the plan, with these changes: db/schema/00_shared.sql, 10_lease.sql, 20_events.sql instead of one schema.sql; db/seed_listings.py and db/seed_events.py, with db/seed.py calling both; backend/schemas/ for Pydantic models.
- Rules: UUID primary keys (gen_random_uuid()); config only from env through config.py; never commit .env; schema files idempotent; seed and reset scripts refuse to run unless APP_ENV=dev; errors as {"detail": "..."}; every frontend call goes through src/api.js; each person edits only their own feature files.
- The commands to run the backend, the frontend, the schema scripts and the tests.
Do not write any other code yet. Show me the file when done.
```

**Prompt 1: backend skeleton (Person A)**

```text
Using CLAUDE.md and docs/PLAN.md, scaffold the backend only. Do not touch frontend/ or db/.
In backend/ create:
- requirements.txt: fastapi, uvicorn[standard], psycopg[binary], psycopg_pool, pydantic-settings, PyJWT[crypto], google-genai, python-multipart, pytest, httpx.
- config.py: a pydantic-settings Settings class reading DATABASE_URL, AUTH0_DOMAIN, AUTH0_AUDIENCE, GEMINI_API_KEY, GEMINI_MODEL, CORS_ORIGINS (comma-separated, default http://localhost:5173) and APP_ENV (default dev) from backend/.env.
- db.py: the ConnectionPool from the plan's db.py sketch (min 1, max 5, dict_row, open=False) and the get_conn dependency.
- main.py: FastAPI app with a lifespan that opens and closes the pool, CORS from settings, and routers health, me, lease, pricing, events, profile.
- routers/health.py: GET /health and GET /health/db (runs select 1).
- Empty router files for me, lease, pricing, events and profile with a TODO, so main.py imports work.
- .env.example with every variable name and placeholder values only.
- Dockerfile: python:3.12-slim, install requirements, run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}.
- tests/test_health.py for GET /health.
At the repo root create .gitignore covering .env and .env.* (but not .env.example), __pycache__, .venv, node_modules, dist, .pytest_cache, .DS_Store.
Then create a venv, install requirements, run pytest, start uvicorn and call /health and /health/db.
```

**Prompt 2: database schema and scripts (Person A, plan mode)**

```text
Create the database layer in db/ following CLAUDE.md.
- db/schema/00_shared.sql: create extension if not exists pgcrypto; users (id uuid primary key default gen_random_uuid(), auth0_sub text unique not null, display_name text, email text null, is_student boolean default false, created_at timestamptz default now()).
- db/schema/10_lease.sql (Person A block): listings (id uuid default gen_random_uuid(), neighbourhood text, rooms int, price_eur numeric, area_m2 numeric, listed_at timestamptz not null, primary key (id, listed_at)) and lease_analyses (id, user_id references users, neighbourhood, rent_eur, rooms, lease_text_redacted text, result_json jsonb, price_verdict jsonb, created_at). Index listings(neighbourhood, rooms). Add a DO block that calls create_hypertable('listings', 'listed_at', if_not_exists => true) only when the timescaledb extension is installed, so the file still runs on plain Postgres.
- db/schema/20_events.sql (Person B block): interests (id, slug unique, label), user_interests, user_availability (slot text, check in weekday_morning, weekday_evening, weekend_morning, weekend_afternoon, weekend_evening), events (id, title, venue, starts_at, slot, interest_id, description), event_signups (event_id, user_id, status waiting|grouped|left, created_at, unique(event_id, user_id)), event_groups (id, event_id, meet_at, note), group_members, reports. Indexes on events(starts_at) and event_signups(event_id, status).
- Every statement idempotent (create ... if not exists).
- db/apply_schema.py: runs the schema files in name order, never drops anything.
- db/reset_db.py: refuses unless APP_ENV=dev, asks for confirmation unless --yes, drops all project tables, then runs apply_schema.
- db/seed.py calls seed() from db/seed_listings.py and db/seed_events.py; create those two as stubs with a TODO and random.seed(42).
Read DATABASE_URL through backend/config.py. Run apply_schema.py and show me the tables it created and whether listings became a hypertable.
```

**Prompt 3: Auth0 in the backend (Person A)**

```text
Implement Auth0 in the backend following CLAUDE.md.
- backend/auth.py: verify RS256 access tokens with PyJWT and a cached PyJWKClient on https://{AUTH0_DOMAIN}/.well-known/jwks.json; check audience = AUTH0_AUDIENCE and issuer = https://{AUTH0_DOMAIN}/. Read the optional custom claims https://newcomer-hub/email and https://newcomer-hub/student.
- A current_user dependency: verifies the Bearer token, upserts the user by auth0_sub (insert ... on conflict do update email and is_student), returns the users row as a dict; 401 with {"detail": ...} on a missing or bad token.
- Dev bypass: only when APP_ENV == "dev", the header X-Dev-User: <name> skips JWT and upserts auth0_sub "dev|<name>". Log a warning at startup when it is active. It must never work in any other APP_ENV.
- routers/me.py: GET /me returns the current user.
- tests/test_auth.py: no token gives 401; the dev header works in dev; the dev header is refused when APP_ENV=production (monkeypatch settings).
Run the tests.
```

**Prompt 4: API contract with mock endpoints (Person A, plan mode)**

```text
Create the API contract so both of us can build in parallel.
- backend/schemas/common.py, lease.py, events.py: Pydantic models for every request and response in the "API contract" and both "Endpoints" tables of docs/PLAN.md. Include the Gemini report (summary, overall_risk, risky_clauses[quote, category, severity, why, suggestion], missing_clauses[name, why]) and PriceVerdict (median_eur, diff_pct, verdict below_market|fair|above_market|suspiciously_low, scope neighbourhood|city, sample_size).
- Fill routers lease.py, pricing.py, events.py and profile.py with every endpoint from the plan: correct method, path and auth (current_user where the plan says Auth0 JWT), returning realistic hard-coded mock data that validates against the response models. Mark each mock with "# MOCK - replace".
- API.md at the repo root: per area, a table of method, path, auth, request, response example and owner, matching these models.
Start the server, check that /docs lists every endpoint, and call each one with the X-Dev-User header.
```

**Prompt 5: frontend shell (Person B)**

```text
Scaffold the frontend in frontend/ following CLAUDE.md and API.md. Do not touch backend/ or db/.
- Vite + React (JavaScript), react-router-dom, @auth0/auth0-react.
- .env.example: VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE, VITE_API_URL=http://localhost:8000, VITE_DEV_USER (optional).
- src/auth/: Auth0Provider wrapper (audience from env, redirect_uri = window.location.origin), ProtectedRoute, LoginButton and LogoutButton.
- src/api.js: one apiFetch(path, options) that adds Authorization: Bearer <getAccessTokenSilently()>, or the X-Dev-User header instead when VITE_DEV_USER is set; it throws an Error with the backend's detail. Export one function per endpoint in API.md: getMe, analyzeLease, listAnalyses, getAnalysis, getNeighbourhoods, listEvents, getProfile, saveProfile, joinEvent, leaveEvent, runMatch, getMyGroup.
- Pages: Home (two cards linking to the features), /lease and /events (placeholders that call one mock endpoint each), /me (protected, shows GET /me). A layout with a top nav and login/logout.
- One plain CSS file, mobile-friendly, no UI library.
Run npm install and npm run build, then tell me how to start it.
```

**Prompt 6: review and README (Person A, after merging 5)**

```text
Review the whole repo against CLAUDE.md and docs/PLAN.md.
- Search for committed or hard-coded secrets (API keys, connection strings with passwords) and report any.
- Write README.md: what the project is; setup on a new laptop (backend venv, .env from .env.example, apply_schema, seed, uvicorn; frontend npm install, .env, npm run dev); our Git workflow (one branch per task, pull request to main).
- Run all backend tests and the frontend build, and list what is still TODO or MOCK.
```

## 3. Git: push, pull and sharing the data

Git carries code, schema files and seed scripts; the data itself lives in the shared Tiger Cloud service, so nobody pushes or pulls data. Each of you recreates the same tables with `apply_schema.py` and the same rows with `seed.py` (fixed random seed). Never commit `.env`, database dumps or API keys.

**Step 1: first push (Person A, right after prompt 1)**

Create an empty private repo on GitHub (no README, no .gitignore), then add Person B under Settings → Collaborators.

```bash
cd newcomer-hub
git init
git add .gitignore
git commit -m "Add gitignore"
git add .
git status                      # .env must NOT be in the list
git check-ignore backend/.env   # must print the path
git commit -m "Backend skeleton and plan"
git branch -M main
git remote add origin https://github.com/<owner>/newcomer-hub.git
git push -u origin main
```

**Step 2: first pull (Person B)**

```bash
git clone https://github.com/<owner>/newcomer-hub.git
cd newcomer-hub
cp backend/.env.example backend/.env   # paste DATABASE_URL received privately
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload               # then open http://localhost:8000/health/db
```

On Windows, activate with `.venv\Scripts\activate`.

**Step 3: the loop for every task (both)**

```bash
git switch main
git pull                                # get the other person's work
git switch -c a/pricing-service         # a/... for Person A, b/... for Person B
# work, run tests, commit small steps
git add -p                              # review each change before staging
git commit -m "Pricing: median query and verdict"
git push -u origin a/pricing-service
gh pr create --fill                     # or open the PR on github.com
```

The other person skims the PR for 2 minutes and merges it with "Squash and merge". Then both run `git switch main && git pull`.

**Step 4: when main moved while you worked**

```bash
git switch a/pricing-service
git pull origin main            # merges the latest main into your branch
# on conflict: open the files, keep the right lines, remove <<<<<<< ======= >>>>>>>
git add <file> && git commit
git push
```

**Rules that keep it painless**

- One branch per task, merged within a few hours; long branches are where conflicts come from.
- Only touch your own folders: A owns `routers/lease.py`, `routers/pricing.py`, `services/gemini.py`, `services/pricing.py`, `db/schema/10_lease.sql`, `db/seed_listings.py`, `frontend/src/pages/lease/`; B owns the matching files for events.
- Shared files (`main.py`, `config.py`, `auth.py`, `api.js`, `00_shared.sql`, `API.md`): send a message first, keep the change small, merge it fast.
- Main must always run: `uvicorn` starts and `/health/db` returns ok.
- After pulling, run `pip install -r requirements.txt`, `npm install` and `python db/apply_schema.py` if those files changed.
- If `.env` is ever committed, deleting it is not enough: rotate the Tiger password (and any API key) right away.

**Sharing the connection string**: send `DATABASE_URL` in a direct message and delete it after it is pasted, as the plan says. Each of you keeps your own `GEMINI_API_KEY`.

## 4. General plan

The 48 hours split into three phases, and you only move on when the gate at the end of a phase passes on both laptops. If a gate slips, cut stretch items from Phase 3 and never the must-haves (login, lease analysis with price verdict, events, join, matching).

&#91;embedded content: 48-hour plan · 3 phases, 3 gates\]

Read each column top to bottom: shared work, then each person's track, then the gate you check together. Sections 5 and 6 turn every box into a checklist.

## 5. Tasks right now (Friday afternoon and evening)

Tonight's goal is gate 1: on both laptops, login works and `/health/db` and `/me` return 200 from Tiger Cloud. Work top to bottom; tick items as you go.

**Together, first 15 minutes**

- [ ] Read section 1 and agree on the eight fixes.
- [ ] Agree on the availability slot names, interest tags and branch prefixes (`a/`, `b/`).
- [ ] Decide who is Person A (renting) and who is Person B (events).

**Person A: repo, backend, database**

- [ ] Create the private GitHub repo, add Person B, save the plan as `docs/PLAN.md`.
- [ ] Run prompt 0, commit. Run prompt 1, commit, first push (section 3, step 1).
- [ ] Send `DATABASE_URL` to Person B privately.
- [ ] Run prompt 2 in plan mode; check in the Tiger console that the connection limit allows 10 connections.
- [ ] Run prompt 3 with the Auth0 values from Person B (the dev bypass lets you test before they arrive).
- [ ] Run prompt 4, then walk Person B through `API.md` in 10 minutes.
- [ ] Run prompt 6 after Person B's frontend is merged.
- [ ] If time is left: write 2 or 3 sample Romanian leases with invented names and no real ID numbers in `data/sample_leases/`, and note rough rent ranges for 8 to 10 neighbourhoods.

**Person B: Auth0 and frontend**

- [ ] Clone the repo after the first push and pass `/health/db` (section 3, step 2).
- [ ] Auth0: create the tenant, a Single Page Application (callback, logout and web origin `http://localhost:5173`) and an API (identifier `https://newcomer-hub/api`, RS256). Send domain, client id and audience to Person A.
- [ ] Add a Post-Login Action that sets `https://newcomer-hub/email` and `https://newcomer-hub/student` on the access token (student = email domain in a short list of Timișoara university domains; check the exact domains).
- [ ] Run prompt 5 on branch `b/frontend-shell`, open a PR.
- [ ] Test a real login in the browser: `/me` shows your user row from Tiger.
- [ ] If time is left: list 20 to 30 plausible Timișoara events (theatre, concerts, board-game nights, football) and the interest tags for the seed.

**Gate 1, checked together before you stop for the night**

- [ ] `main` runs on both laptops, `pytest` passes, `npm run build` passes.
- [ ] Login, `/me` and every mock endpoint answer from the frontend.

## 6. Tasks for later phases

Phase 2 turns every mock into a real endpoint, one branch and one PR per numbered item. Phase 3 adds the should-haves only after gate 2 passes. Must-haves always win over stretch items.

**Phase 2, Person A: renting (Friday night to Saturday evening)**

- [ ] 1\. `db/seed_listings.py`: about 200 listings across 8 to 10 neighbourhoods, prices by room count, `listed_at` spread over the last 12 months (this later feeds the trend chart). Label it sample data in the UI.
- [ ] 2\. `services/pricing.py` with tests: median via `percentile_cont(0.5)`, verdict thresholds (±10%, under -30% = possible scam), city-wide fallback under 5 listings.
- [ ] 3\. `services/gemini.py`: redaction, checklist prompt, structured output, Pydantic validation, one retry, cached demo result (prompt below).
- [ ] 4\. `routers/lease.py` and `routers/pricing.py`: replace the mocks, run Gemini and pricing in parallel, save to `lease_analyses`; pricing must still answer when Gemini fails.
- [ ] 5\. `pages/lease/`: form, loading state, summary, severity chips, missing clauses, price badge, "Not legal advice".

**Phase 2, Person B: events and matching**

- [ ] 1\. `db/seed_events.py`: interest tags, 20 to 30 events with `slot`, 30 to 40 fake users with interests and availability, signups on 2 or 3 demo events so a match always works.
- [ ] 2\. `services/matching.py` with tests (prompt below).
- [ ] 3\. `routers/events.py` and `routers/profile.py`: replace the mocks; `POST /events/{id}/match` saves `event_groups` and `group_members`.
- [ ] 4\. `pages/events/`: profile form, event list with interest and date filters, "I want to go", group card with "why you match".

**Gate 2 (Saturday evening):** both features work end to end on `main`, and the full demo story in the plan runs without errors.

**Phase 3: polish and demo (Saturday night to Sunday)**

| Person A | Person B | Together |
| --- | --- | --- |
| Neighbourhood median bar chart | Verified student badge from the Auth0 claim | Error, loading and empty states; mobile check |
| Saved analyses history page | Leave group and refill from the waiting list | Host decision (Render, Railway or Fly.io) with the Dockerfile |
| Continuous aggregate and price-trend chart | Report button and `reports` table | Demo script, rehearsed twice; seed reset |
| Pitch part: Gemini and Tiger Data (show the raw JSON and the SQL) | Pitch part: Auth0 and matching | Pitch slides; feature freeze before the rehearsal |

Stretch, only if everything above is done: PDF lease upload, Gemini icebreakers per group (must never block group creation), Vultr deploy.

**After the event**: delete the Tiger service and revoke the Gemini keys used in the demo.

**Starter prompt, Person A: Gemini service**

```text
Implement backend/services/gemini.py for Feature A, following CLAUDE.md and docs/PLAN.md ("Gemini lease analysis").
- redact(text): replace Romanian CNP (13 digits), IBAN (RO followed by 22 characters) and ID card series and number with [REDACTED]; unit tests for each.
- analyze_lease(text, ui_language="en"): google-genai client, model from GEMINI_MODEL, response_mime_type="application/json" and response_schema = the LeaseReport Pydantic model from schemas/lease.py. The prompt includes the plan's checklist and says: answer in ui_language, keep quote in the original language, quote under 25 words.
- Validate with Pydantic; on invalid output retry once, then raise a clear error. 30 second timeout.
- When DEMO_CACHE=1 and the text equals data/sample_leases/demo_ro.txt, return data/sample_leases/demo_ro.json without calling Gemini.
Run it on every file in data/sample_leases/ and show me the JSON.
```

**Starter prompt, Person B: matcher**

```text
Implement backend/services/matching.py for Feature B as pure functions (no database), following docs/PLAN.md ("Matching function") with one change: do NOT drop pairs with zero availability overlap, because everyone in the pool already joined the same event; the availability term only favours people who could meet again.
- jaccard(a, b); score(a, b) = 0.6 * jaccard(interests) + 0.4 * jaccard(availability slots).
- form_groups(users, target=4, max_size=5, min_size=3) returns groups with members and a why_you_match string built from shared interests. Greedy from the longest-waiting user; leftovers of 1 or 2 go into existing groups up to 5; fewer than 3 users gives no groups.
- Deterministic: the same input always gives the same output.
- tests/test_matching.py with 0, 2, 3, 7, 12 and 40 users: nobody in two groups, no group under 3 or over 5, every user placed when there are 3 or more.
Run the tests.
```
