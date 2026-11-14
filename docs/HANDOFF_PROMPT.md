# Handoff prompt: Timișoara Newcomer Hub, state on 2026-11-14

Paste everything below the line into a new Claude Code session started in the repo root (or tell Claude: "Read docs/HANDOFF_PROMPT.md and follow it").

---

You are joining a hackathon project in progress. Read this whole brief before you do anything. Then do the "First steps" at the end and wait for my go before changing code or touching any external service.

## 1. The project

**Timișoara Newcomer Hub**, built for UniHack 8 by a team of two in 48 hours (started Friday 2026-11-13; the demo is on Sunday, so ask me for the exact submission and pitch times). It helps newcomers to Timișoara, often international students, with two problems:

- **Feature A, lease check** (owner: Laurentiu, "Person A"). The user pastes a Romanian rental contract. Gemini returns a clause checklist: risky clauses quoted in the original language, missing clauses and an overall risk. A price verdict compares the rent with the neighbourhood median from a listings table (fair within ±10%, more than 30% below = possible scam, city-wide fallback under 5 local listings). Pricing must still answer when Gemini fails.
- **Feature B, event groups** (owner: Petru, "Person B"). The user sets interests and availability and joins an event. `POST /events/{id}/match` forms groups of 3 to 5 with a "why you match" line.

The pitch closes on one principle: *a newcomer can trust what they see*. Each sponsor has a concrete demo moment: **Gemini** (clause check), **Tiger Data / TimescaleDB** (hypertable, `percentile_cont` medians, continuous aggregates) and **Auth0** (login, verified-student badge from a custom claim).

## 2. Read these first (they are the source of truth)

- `CLAUDE.md`: rules, layout and commands. Follow it exactly.
- `docs/PLAN.md`: the full plan, phases, gates and checklists.
- `API.md`: the API contract. Change it first, then the code.
- `README.md`: setup on a new laptop, the Docker build, `APP_ENV`.
- `docs/PITCH_A.md`: Person A's 2-minute talk track, demo click path and proof SQL with real output.

## 3. Stack and layout (short version)

- **Backend:** FastAPI, psycopg 3 + psycopg_pool, Tiger Cloud (Postgres + TimescaleDB 2.32), google-genai, Auth0 (PyJWT + PyJWKClient, RS256). Python 3.14 (the Dockerfile matches the tested venv).
- **Frontend:** React 18 + Vite (JavaScript), react-router-dom 7, @auth0/auth0-react, one plain CSS file, no UI library. Every request goes through `frontend/src/api.js`.
- **DB:** `db/schema/00_shared.sql`, `10_lease.sql` (A), `20_events.sql` (B); `db/apply_schema.py`, `reset_db.py`, `seed.py` (calls `seed_listings.py` and `seed_events.py`, `random.seed(42)`).
- **Config:** env only, through `backend/config.py`. `APP_ENV` now **defaults to `production`**, so the `X-Dev-User` bypass needs an explicit `APP_ENV=dev`. Frontend `VITE_DEV_USER` makes the UI send that header (dev only).

## 4. What has been done

All work reached `main` through squash-merged PRs #1 to #16, plus one direct commit (`28b5d17`, code review fixes). Current `main`: **226 backend tests pass**, and `npm run build` passes.

**Phase 1, skeleton (both):** backend skeleton, schema and auth (#1 API contract with Pydantic schemas and API.md), frontend shell with Auth0 and api.js (#2, Petru), README and repo review (#3), cleanup (#4).

**Phase 2, Feature A (Laurentiu):**
- #5: three sample Romanian leases (`data/sample_leases/`, invented names, no real IDs) and `data/rent_ranges.md` for 10 neighbourhoods.
- #7: `db/seed_listings.py`, now **about 1000 listings** over 12 months, labelled as sample data in the UI.
- #8: `services/pricing.py`, the median and the city fallback in one query.
- #9: `services/gemini.py`. Redaction of CNP, IBAN, ID card and passport numbers happens before Gemini and before saving. It also has structured output against the `LeaseReport` schema, Pydantic validation, one retry, and `DEMO_CACHE=1` serving `demo_ro.json` for `demo_ro.txt`.
- #10: real `/lease` and `/pricing` endpoints. Gemini and pricing run in parallel, and results are saved to `lease_analyses`.
- #11: the lease page: form, loading state, report, price badge, past checks.

**Phase 2, Feature B (Petru):**
- #6: Auth0 configured, with a Post-Login Action adding the `https://newcomer-hub/email` and `https://newcomer-hub/student` claims. Also events, join/leave, the matcher, profile and the events pages.

**Phase 3, polish:**
- #12 (A): neighbourhood median bar chart.
- #13 and #14 (A): `/lease/history` (filters in the URL, reset) and `/lease/history/:id` (404 card).
- #15 (A): `listings` is a hypertable. Two continuous aggregates, `listings_monthly` and `listings_monthly_city`, use exact `percentile_cont`, hourly refresh policies and real-time aggregation for the current month. They feed the price-trend chart (header `X-Trend-Source`).
- #16 (A): `GET /lease/analyses/{id}/details` and the **"How this was checked"** panel under every lease result. It has three tabs: the redacted text sent to Gemini, Gemini's raw JSON and the SQL. A test fails if the SQL shown on the page drifts from the SQL the backend runs. This PR also added `docs/PITCH_A.md`, backup screenshots in `docs/pitch-a/`, a favicon and the browser-checked history pages.
- B: the verified-student badge (on `/me`, the events page and group cards). Leave group: leaving a group of 3 dissolves it, and the others go back to waiting for the next match.
- `28b5d17` (review fixes, both features):
  - The production default for `APP_ENV`, a root `.dockerignore` allowlist, and a Dockerfile built from the repo root so the demo leases are in the image.
  - Pinned requirements.
  - `/lease/analyze` no longer holds a pooled connection while Gemini runs. A rate limit allows 30 checks per user per hour (429).
  - Database errors come back as JSON 503 with CORS headers.
  - Match needs the caller on the event (403). Join or match on a started event gives 409.
  - Seeded event times use Europe/Bucharest.

**Things worth knowing:**
- In TimescaleDB 2.32, `timescaledb_information.continuous_aggregates` has no `finalized` column, and `jobs.hypertable_name` holds the aggregate's own name.
- On Windows, write commit messages to a file and use `git commit -F`.
- `frontend/package-lock.json` often shows a local change (an older npm dropping `libc` fields). Never commit it as part of an unrelated task.
- Person A's backend may already be on port 8000. Use spare ports (e.g. 8011 and 5181) for your own test runs, and stop every server you start.
- A browser run left two saved lease checks for the dev user `pitch-demo` in the shared database. Reseed on pitch morning (it is in PITCH_A.md).

## 5. What is left (by priority)

Must-haves are done. Gate 2 ("both features end to end on main") looks met but has never been ticked together in `docs/PLAN.md`.

1. **Deployment.** Vultr is not working, so we need another free host (section 6). This is the biggest open risk for the demo.
2. **Person B, report button + `reports` table.** The table exists in `20_events.sql` (`reporter_id`, `reported_user_id`, `event_id`, `group_id`, `reason`, `created_at`), but there is no endpoint, schema, api.js function or button. Petru should build it, or the team should agree to cut it; it is a should-have.
3. **Person B, pitch part (Auth0 + matching).** Not started. Mirror `docs/PITCH_A.md` (talk track, click path, proof) as `docs/PITCH_B.md`.
4. **Together, events pages check:** error, loading and empty states, plus a 375 px mobile check, as was done for the lease pages.
5. **Together, demo:** one demo script for both halves, a seed reset step, slides, feature freeze before the rehearsal, then two rehearsals.
6. **Housekeeping:** tick the Gate 1 and Gate 2 boxes in `docs/PLAN.md` after checking them together, and tick "Send `DATABASE_URL` to Person B" if it was done.
7. **Stretch, only if everything above is done:** PDF lease upload, Gemini icebreakers per group (must never block group creation). Vultr is dropped.
8. **After the event:** delete the Tiger service and revoke the Gemini keys used in the demo.

## 6. Deployment: replacing Vultr

Recommended setup (free, no server to manage, and it fits our Dockerfile and a Vite build). Pricing and limits change often, so **check each provider's current pricing page before committing to it**, and tell me if anything below is out of date.

**Backend: Koyeb, free instance, Frankfurt region.**
- Why:
  - It deploys our existing `backend/Dockerfile` straight from GitHub.
  - Frankfurt is the closest free region to Timișoara (also check which region our Tiger service is in).
  - It scales to zero only after 1 hour without traffic, and wakes in seconds.
- Limits: 1 free instance per organization, 512 MB RAM, 0.1 vCPU. That is enough for FastAPI plus the pool (max 5 connections).
- Build settings: Dockerfile `backend/Dockerfile`, **build context = repo root** (the image needs `data/sample_leases/` for `DEMO_CACHE`). The container listens on `$PORT`.
- Health check: `GET /health`, with `/health/db` checked by hand after deploy.

**Fallback: Render, free web service (Docker).** It works the same way, but it sleeps after 15 minutes idle and takes about a minute to wake. Open the backend URL about 5 minutes before the pitch and keep a tab hitting `/health`.

**Option if someone already has a Google Cloud billing account: Cloud Run.** It has a generous monthly free allowance and fast cold starts, and looks the most "professional", but it needs billing set up. Don't pick it under time pressure unless that is already done.

Fly.io and Railway: as far as I know neither has a lasting free tier for new accounts (trial credit only), so verify before considering them.

**Frontend: Vercel (Hobby) or Cloudflare Pages.**
- Build settings: root directory `frontend`, build command `npm run build`, output `dist`.
- Add an **SPA fallback** so deep links like `/lease/history/:id` load `index.html`. On Vercel use a `vercel.json` rewrite; Cloudflare Pages serves `index.html` for unknown paths when there is no `404.html`.
- Build-time env: `VITE_API_URL` = backend URL, plus `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` and `VITE_AUTH0_AUDIENCE`. **Never set `VITE_DEV_USER` in production.**

**Backend env on the host** (set them in the host's dashboard; never commit them):
- `DATABASE_URL`, with SSL as Tiger requires.
- `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- `CORS_ORIGINS` = the exact frontend origin.
- `APP_ENV=production`, which disables `X-Dev-User`.
- `DEMO_CACHE=1`, so the demo lease answers instantly.

**Auth0:** add the frontend URL to the SPA's Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins (keep `http://localhost:5173`).

**Verify after deploy:**
- `/health` and `/health/db` return 200.
- Real Auth0 login, then `/me`.
- The lease demo path from `docs/PITCH_A.md`: fair price, high risk, and the "How this was checked" panel.
- One event join plus match.
- A deep-link reload on `/lease/history/<id>`.
- The phone width.
- Write the URLs and the "warm it up before the pitch" step into the demo script.

Creating accounts, connecting the GitHub repo, setting secrets and deploying are outward-facing actions. **Ask me before each one**, tell me exactly which values I need to paste myself, and never print or commit secrets.

## 7. Plan ahead

Propose concrete times once I tell you the deadline. The order:

1. **Now:**
   - Deploy the backend and frontend (section 6) and verify.
   - Meanwhile Petru builds the report button, or the team cuts it.
   - One person clicks through the events flow, including 375 px.
2. **Then:**
   - Write `docs/PITCH_B.md`.
   - Merge both pitch halves into one demo script with timings, including the warm-up and the seed reset.
   - Make the slides. **Feature freeze** after this point; only bug fixes go in.
3. **Before the pitch:**
   - Reseed (`python db/reset_db.py --yes` then `python db/seed.py`, with `APP_ENV=dev`, against the shared database).
   - Rehearse twice on the deployed URLs.
   - Keep a local run (`uvicorn` + `npm run dev`) and the `docs/pitch-a/` screenshots as plan B.
4. **After:** delete the Tiger service and revoke the demo Gemini keys.

## 8. How to work in this repo

- One branch per task (`a/...` for Person A, `b/...` for Person B) from an up-to-date `main`, one PR per task, squash merge. `main` must always run.
- Edit only the files of the person you are working for. For shared files (`main.py`, `config.py`, `auth.py`, `api.js`, `00_shared.sql`, `API.md`), show me the exact small diff first so I can message the other person.
- Before every PR, run `pytest` and `npm run build` with no errors or warnings. Browser-check UI changes on spare ports, at desktop width and at 375 px.
- Never commit `.env` files, keys, passwords or dumps. Mark mocks `# MOCK - replace`. Errors are `{"detail": "..."}`.
- Report results faithfully. If something fails or you skipped a step, say so.

## 9. First steps

1. `git switch main && git pull`, then read the files in section 2.
2. Run `pytest` (expect 226 passing or more) and `npm run build`.
3. Ask me:
   - the submission and pitch times;
   - who you are working for (Person A or B) in this session;
   - whether the report button stays or is cut;
   - which host accounts we already have.
4. Then give me a short plan for the deployment, with the exact settings for each host and the values I must enter myself. Wait for my go before acting.
