# CLAUDE.md

## Project

Timișoara Newcomer Hub, UniHack 8 (team of 2, 48 hours). Status: `docs/PLAN.md`. API contract: `API.md`.

- **Feature A, lease check (Person A):** paste a Romanian lease; Gemini returns a clause checklist; pricing gives a price verdict against neighbourhood listings. Pricing must answer even if Gemini fails.
- **Feature B, event groups (Person B):** set interests and availability, join an event, `POST /events/{id}/match` forms groups of 3 to 5 with a "why you match" line. Users create events (`POST /events`) and report them; moderators and admins review them on the Moderation page.

## Stack

- Backend: FastAPI, psycopg 3 + psycopg_pool, Tiger Cloud (Postgres + TimescaleDB).
- AI: google-genai (Gemini).
- Auth: Auth0 with PyJWT + PyJWKClient (RS256); frontend uses @auth0/auth0-react.
- Mail: Brevo HTTPS API (student codes). Auth0 Management API for 2FA off and delete account.
- Frontend: React + Vite (JavaScript), react-router-dom, one plain CSS file.

## Layout

```
backend/   main.py, config.py, db.py, auth.py, schemas/, tests/,
           routers/ (lease, pricing, health, me, admin, student = A;
                     events, moderation, profile, account = B),
           services/ (gemini, pricing, pdf_text, student, mailer = A;
                      matching, auth0_api = B)
db/        schema/00_shared.sql, 05_student.sql (A), 10_lease.sql (A), 20_events.sql (B)
           apply_schema.py, reset_db.py, seed.py,
           seed_listings.py (A), seed_events.py (B)
frontend/  src/api.js, src/auth/, src/i18n.jsx, src/strings.js,
           src/pages/lease/ and student/ (A), events/, moderation/ and account/ (B)
docs/PLAN.md
```

## Rules

- UUID primary keys: `default gen_random_uuid()`. No integer ids.
- Config only from env, read through `backend/config.py`.
- Never commit `.env` or `.env.*` (`.env.example` is fine), keys, passwords or dumps.
- Schema files are idempotent (`if not exists`); scripts never drop outside `reset_db.py`.
- `reset_db.py` and `seed.py` refuse to run unless `APP_ENV=dev`; `reset_db.py` asks unless `--yes`.
- Dev bypass: header `X-Dev-User` works only when `APP_ENV=dev`.
- Auth0 claims under `https://newcomer-hub/`: `email` (may be missing; `users.email` is nullable), `email_verified` (required), `roles` (`admin`, `moderator`, `creator`) and `mfa` (admins need MFA). Student status comes from a university email code, not a claim.
- Redact CNP, IBAN and ID series from lease text before Gemini and before saving.
- Errors are `{"detail": "..."}`.
- Every frontend request goes through `src/api.js`; pages never call `fetch`.
- Mocks are marked `# MOCK - replace` until the real endpoint exists.
- Edit only your own feature files. Shared files (`main.py`, `config.py`, `auth.py`, `api.js`, `00_shared.sql`, `API.md`) need a message first and a small change.
- Branches `a/...` (A) and `b/...` (B); one PR per task, squash merge to `main`. Main must always run.

## Commands

Backend (from `backend/`):

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload        # http://localhost:8000/docs
pytest                           # or: pytest tests/test_auth.py
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev                      # http://localhost:5173
npm run build
```

Schema and seed (from repo root, `APP_ENV=dev` in `backend/.env`):

```bash
python db/apply_schema.py        # create or update, never drops
python db/seed.py                # listings and events, random.seed(42)
python db/reset_db.py            # drops project tables, asks first
python db/reset_db.py --yes      # same, no prompt
```
