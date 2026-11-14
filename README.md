# Timișoara Newcomer Hub

UniHack 8 project (team of 2, 48 hours). A web app for people who have just moved to Timișoara. It does two things:

- **Lease check (Feature A).** Paste a Romanian lease. Gemini returns a clause checklist (risky clauses, missing clauses, overall risk), and a price verdict compares the rent with neighbourhood listings. The price verdict still works when Gemini fails. CNP, IBAN and ID series are removed from the text before it goes to Gemini or the database.
- **Event groups (Feature B).** Set your interests and availability, join an event, and get matched into a group of 3 to 5 people with a "why you match" line.

Stack: FastAPI + psycopg 3 on Tiger Cloud (Postgres + TimescaleDB), Google Gemini, Auth0, React + Vite.

## Features

### Lease check (Feature A, `/lease`)

You enter the lease text, the neighbourhood, the room count (1 to 3, Romanian *camere*), the monthly rent in EUR and the report language (English or Romanian). `POST /lease/analyze` then works in this order:

1. **Redaction.** `redact()` in `services/gemini.py` replaces CNP, IBAN, ID card series and number, and passport numbers with `[REDACTED]`. Only the redacted text goes to Gemini or into the database.
2. **Two checks at once.** Gemini and the price query run side by side in worker threads. Gemini can take up to a minute, so it does not hold a pooled database connection while it waits.
3. **Clause report (Gemini).** The model returns structured JSON that matches the `LeaseReport` schema: a summary, the overall risk, the risky clauses and the missing clauses. Each risky clause has a short quote, a category, a severity, why it matters and what to ask for instead. Output that fails validation is retried once. If Gemini still fails, the response has `report: null` and a `report_error`, and the price verdict is returned anyway.
4. **Price verdict (SQL).** The rent is compared with the median asking rent for the same room count over the last 12 months. The neighbourhood median is used when there are at least 5 listings, and the city-wide median otherwise. Verdicts: within ±10% is `fair`, more than 10% above is `above_market`, more than 10% below is `below_market`, and more than 30% below is `suspiciously_low`. When pricing fails, the request fails with a 503, because the price verdict must always work.
5. **Save.** The analysis is stored in `lease_analyses` and reads back exactly as it was returned.

The lease page also has:

- **Median chart.** One bar per neighbourhood with the median rent and a marker for your rent (`GET /pricing/neighbourhoods`). Plain CSS, no chart library.
- **Price trend chart.** The monthly median over the last 12 months as an inline SVG line chart, with the city-wide line for comparison (`GET /pricing/trend`). The data comes from the TimescaleDB continuous aggregates `listings_monthly` and `listings_monthly_city`. On plain Postgres it is read from `listings` directly.
- **"How this was checked" panel.** Three tabs show the redacted text exactly as Gemini received it, Gemini's raw JSON, and the SQL behind the verdict and the trend (`GET /lease/analyses/{id}/details`).
- **History.** `/lease/history` lists your saved checks, newest first, with filters. `/lease/history/:id` shows one check at its own URL. You can only see your own analyses; another user's id gives 404.
- **Hourly limit.** After 30 checks in an hour, `POST /lease/analyze` returns 429 before calling Gemini.
- **Demo cache.** With `DEMO_CACHE=1`, the demo lease (`data/sample_leases/demo_ro.txt`, English report) is answered from `demo_ro.json` without calling Gemini. Every other lease still goes to Gemini. See [docs/PITCH_A.md](docs/PITCH_A.md).

### Event groups (Feature B, `/events`)

- **Profile.** A display name, interests from 10 seeded options (theatre, live music, board games, football, hiking, language exchange, cinema, food and drinks, art and museums, cycling) and availability slots (weekday morning or evening; weekend morning, afternoon or evening). `PUT /profile` replaces the whole profile.
- **Events list.** Upcoming events, with filters for interest and date range. Anyone can browse; logged-in users also see their own status (`waiting`, `grouped` or `left`).
- **Join and leave.** Joining puts you on the event's waiting list. Joining twice changes nothing. Leaving a group of 3 dissolves it, and the other two go back to waiting. Events that have already started cannot be joined or matched (409).
- **Matching.** `POST /events/{id}/match` groups everyone who is waiting into groups of 3 to 5. Only people who joined the event can run it. The algorithm in `services/matching.py` has no database, clock or randomness, so the same input always gives the same groups:
  - Two people's fit is 0.6 × Jaccard similarity of their interests plus 0.4 × Jaccard similarity of their availability.
  - Groups are built greedily, starting from the person who has waited longest and adding whoever fits the group best. The target size is 4. One or two leftovers join the group they fit best (up to 5), and awkward counts such as 6 are split evenly (3 + 3).
  - Each group gets a "why you match" sentence built from the interests and free time its members share, for example: "You all like board games and live music, and are free on weekday evenings."
- **Group card.** The group's members, a student badge, a meeting time 30 minutes before the event and the "why you match" line (`GET /events/{id}/my-group`).

### Shared

- **Auth.** Auth0 login in the frontend. The backend checks RS256 access tokens against the tenant's JWKS (PyJWT). The first authenticated request creates the user (an upsert on `auth0_sub`). `/me` shows the profile and whether the user is a verified student (the `https://newcomer-hub/student` claim).
- **Dev login bypass.** When `APP_ENV=dev` only, the header `X-Dev-User: <name>` (sent by the frontend when `VITE_DEV_USER` is set) replaces the token.
- **Errors.** Every error is `{"detail": "..."}`. Any database error becomes a 503 with CORS headers, so the frontend can show the message.
- **Health.** `GET /health` and `GET /health/db`.

## Project structure

```
backend/                      FastAPI app
  main.py                     app, CORS, connection pool lifespan, database-error handler
  config.py                   settings, read from env / backend/.env only
  db.py                       psycopg_pool; get_conn (pooled) and get_connector (short-lived)
  auth.py                     Auth0 JWT check, X-Dev-User bypass, user upsert
  routers/                    health, me, lease (A), pricing (A), events (B), profile (B)
  schemas/                    Pydantic models: common, lease (A), events (B)
  services/
    gemini.py                 redaction, Gemini prompt and call, demo cache (A)
    pricing.py                median SQL, verdict rules, trend from continuous aggregates (A)
    matching.py               pure group matching and "why you match" (B)
  tests/                      pytest: auth, contract, health, gemini, pricing, lease API,
                              matching, events API
  Dockerfile                  build from the repo root (includes data/sample_leases)
db/
  schema/00_shared.sql        users
  schema/10_lease.sql         listings (hypertable), lease_analyses, monthly aggregates (A)
  schema/20_events.sql        interests, availability, events, signups, groups, reports (B)
  apply_schema.py             applies the schema files in order; never drops
  seed.py                     runs seed_listings.py and seed_events.py (random.seed(42))
  seed_listings.py            1000 listings over 12 months, prices from data/rent_ranges.md (A)
  seed_events.py              interests, upcoming events, demo users and signups (B)
  reset_db.py                 drops the project tables (APP_ENV=dev only, asks first)
data/
  rent_ranges.md              rent ranges per neighbourhood and room count, with sources
  sample_leases/              fictional Romanian leases: demo, fair and missing-clauses
                              cases, and the cached demo report
frontend/                     React + Vite (JavaScript)
  src/api.js                  the only file that calls the backend; one function per endpoint
  src/useApi.js               small hook: { data, error, loading, reload }
  src/auth/                   Auth0 provider, login and logout buttons, ProtectedRoute
  src/components/             Layout (nav) and ErrorBox
  src/pages/                  Home, Me, NotFound
  src/pages/lease/            lease form, result, report, price badge, median chart,
                              trend chart, "How this was checked", history (A)
  src/pages/events/           profile form, event and group cards, events page (B)
  src/styles.css              the only stylesheet
docs/
  PLAN.md                     the plan, phases and tasks
  PITCH_A.md, pitch-a/        Feature A pitch script and backup screenshots
API.md                        the API contract
```

Frontend routes: `/` (home), `/lease`, `/lease/history`, `/lease/history/:id`, `/events` and `/me`. The history pages and `/me` need a login. `/lease` and `/events` can be opened without one, but checking a lease and joining an event need a login.

Database tables: `users`; `listings` and `lease_analyses` (A); `interests`, `user_interests`, `user_availability`, `events`, `event_signups`, `event_groups`, `group_members` and `reports` (B). Every primary key is a UUID.

More documentation:

- [docs/PLAN.md](docs/PLAN.md): the full plan, phases and tasks.
- [API.md](API.md): the API contract (endpoints, auth, example responses).
- [CLAUDE.md](CLAUDE.md): project rules and commands.

## Setup on a new laptop

You need Python 3.12, Node 20 or newer, and Git. Ask your teammate for `DATABASE_URL` and the Auth0 values in a direct message. Never commit them.

### 1. Clone

```bash
git clone https://github.com/Blidari-Laurentiu/UniHack2026Project.git
cd UniHack2026Project
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then fill in the real values
```

`backend/.env` variables:

| Variable | What to put |
| --- | --- |
| `DATABASE_URL` | Tiger Cloud connection string (from your teammate) |
| `AUTH0_DOMAIN` | e.g. `your-tenant.eu.auth0.com` |
| `AUTH0_AUDIENCE` | `https://newcomer-hub/api` (must match the frontend) |
| `GEMINI_API_KEY` | your own key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `DEMO_CACHE` | `0` normally. `1` answers the demo lease from `data/sample_leases/demo_ro.json` without calling Gemini (for the pitch). |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `APP_ENV` | `dev` on laptops. Only `dev` allows seeding, reset and the `X-Dev-User` login bypass. Left unset, it is `production` (bypass off). |

### 3. Database schema and seed data

From the repo root, with the venv still active:

```bash
cd ..
python db/apply_schema.py          # creates or updates tables, never drops
python db/seed.py                  # sample listings and events (fixed random seed)
```

Everyone shares one Tiger Cloud database. Do not push or pull data: the schema and seed scripts create the same tables and rows on any machine. `python db/reset_db.py` drops every project table and builds them again. It only runs when `APP_ENV=dev` and asks you to confirm first; `--yes` skips the question.

### 4. Run the backend

```bash
cd backend
uvicorn main:app --reload
```

Check:

- http://localhost:8000/health/db returns ok
- http://localhost:8000/docs lists every endpoint

Run the tests with `pytest`.

Docker image (build from the repo root, so the demo leases in `data/` are included; `.env` files are never copied, so pass the variables above to the host, with `APP_ENV` not `dev`):

```bash
docker build -f backend/Dockerfile -t newcomer-hub-api .
```

### 5. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env               # then fill in the Auth0 values
npm run dev                        # http://localhost:5173
```

`frontend/.env` variables:

| Variable | What to put |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | same tenant as the backend |
| `VITE_AUTH0_CLIENT_ID` | the Auth0 Single Page Application's client id |
| `VITE_AUTH0_AUDIENCE` | `https://newcomer-hub/api` |
| `VITE_API_URL` | `http://localhost:8000` |
| `VITE_DEV_USER` | optional: a name such as `alice` lets you skip Auth0 login (works only when the backend has `APP_ENV=dev`) |

`npm run build` makes a production build in `frontend/dist/`.

## Git workflow

One branch per task, one pull request per branch, squash merge to `main`. `main` must always run.

```bash
git switch main
git pull                                 # get the other person's work
git switch -c a/pricing-service          # a/... for Person A, b/... for Person B
# work, run pytest / npm run build, commit small steps
git push -u origin a/pricing-service
gh pr create --fill                      # or open the PR on github.com
```

The other person reviews the PR for a couple of minutes and merges it with **Squash and merge**. Then both run `git switch main && git pull`.

If `main` changed while you were working:

```bash
git pull origin main                     # merge the latest main into your branch
# fix any conflicts, then git add <file> && git commit && git push
```

Rules:

- Edit only your own feature files. A owns lease and pricing; B owns events, profile and matching.
- Shared files (`backend/main.py`, `config.py`, `auth.py`, `frontend/src/api.js`, `db/schema/00_shared.sql`, `API.md`): message your teammate first and keep the change small.
- After pulling, rerun `pip install -r requirements.txt`, `npm install` and `python db/apply_schema.py` if those files changed.
- Never commit `.env`, keys, passwords or database dumps. If a secret gets committed, deleting the file is not enough: rotate the password or key right away.
