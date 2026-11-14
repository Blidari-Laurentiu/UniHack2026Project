# Timișoara Newcomer Hub

UniHack 8 project (team of 2, 48 hours). A web app for people who have just moved to Timișoara:

- **Lease check (Feature A).** Paste a Romanian lease, or upload it as a PDF (our server reads the PDF's text into the form; scans are not supported). Gemini returns a clause checklist (risky clauses, missing clauses, overall risk), and a price verdict compares the rent with neighbourhood listings. The price verdict still works when Gemini fails. CNP, IBAN and ID series are removed from the text before it goes to Gemini or the database.
- **Event groups (Feature B).** Set your interests and availability, join an event, and get matched into a group of 3 to 5 people with a "why you match" line.

The whole site is in English or Romanian (switch in the top bar). Students can verify with a code sent to their university email, and the Me page has account settings.

Stack: FastAPI + psycopg 3 on Tiger Cloud (Postgres + TimescaleDB), Google Gemini, Auth0, React + Vite.

**Live demo:** https://uni-hack2026-project.vercel.app (frontend) and https://unihack2026project.onrender.com/docs (API). The backend sleeps after 15 minutes without traffic, so the first request can take about a minute.

More documentation:

- [docs/PLAN.md](docs/PLAN.md): project status: what is done, what is left, and the decisions.
- [API.md](API.md): the API contract (endpoints, auth, example responses).
- [CLAUDE.md](CLAUDE.md): project rules and commands.

## Setup on a new laptop

You need Python 3.14 (`requirements.txt` is pinned against it), Node 20 or newer, and Git. Ask your teammate for `DATABASE_URL` and the Auth0 values in a direct message. Never commit them.

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
| `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET` | the Machine to Machine app (see [Auth0](#auth0)), used to turn 2FA off and to delete an account. Can stay empty on a laptop. |
| `GEMINI_API_KEY` | your own key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `DEMO_CACHE` | `0`. With `1`, the demo lease (English interface) answers from a saved report instead of calling Gemini. |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `MAIL_FROM`, `BREVO_API_KEY` | sender and Brevo key for the student code emails. Leave the key empty on a laptop: the code is printed in the server log. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP instead of Brevo, for local use only (Render's free plan blocks SMTP). |
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

## Deployment

The backend runs on Render (free Docker web service) and the frontend on Vercel. Both deploy from `main` on every merge. Secrets live only in each host's dashboard.

### Backend on Render

| Setting | Value |
| --- | --- |
| Language | Docker |
| Branch | `main` |
| Region | Frankfurt |
| Root Directory | empty (the build context must be the repo root) |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path | `/health` |

Environment variables: the same names as `backend/.env`, with these differences:

| Variable | Value on the host |
| --- | --- |
| `APP_ENV` | `production` (turns the `X-Dev-User` bypass off) |
| `DEMO_CACHE` | `1` (the demo lease answers without calling Gemini) |
| `CORS_ORIGINS` | the exact frontend origin, e.g. `https://your-project.vercel.app`, with no trailing slash |
| `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET` | a Machine to Machine application authorised for the Auth0 Management API with `read:authentication_methods`, `delete:authentication_methods` and `delete:users`; needed to turn 2FA off and to delete an account |
| `BREVO_API_KEY` | the Brevo API key; student verification codes are sent through Brevo's HTTPS API, because Render's free plan blocks SMTP ports |
| `MAIL_FROM` | `Newcomer Hub <address>`, where the address is a sender verified in Brevo |

Do not set `PORT`. Render provides it and the Dockerfile reads it.

The free instance sleeps after 15 minutes without traffic and takes about a minute to wake. Open `/health` a few minutes before a demo and keep the tab open.

### Frontend on Vercel

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework preset | Vite (build `npm run build`, output `dist`) |

Environment variables (Production): `VITE_API_URL` (the Render URL, no trailing slash), `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` and `VITE_AUTH0_AUDIENCE`. Never set `VITE_DEV_USER` on the host.

`frontend/vercel.json` sends every path to `index.html`, so a reload on a deep link such as `/lease/history/<id>` works. Use the production domain only: preview URLs are not in `CORS_ORIGINS` or in Auth0.

### Auth0

- **Single Page Application:** add the frontend origin to **Allowed Callback URLs**, **Allowed Logout URLs** and **Allowed Web Origins**. Keep `http://localhost:5173` in each list.
- **Post-Login Action:** adds four custom claims to the access token, under `https://newcomer-hub/`: `email`, `email_verified`, `roles` and `mfa` (true when the login used a second factor). Without `email_verified`, every endpoint that needs a login answers 403 "verify your email address first". Admins also need `mfa`. When the login has `enroll_mfa=true`, the Action shows the 2FA enrolment page.
- **Machine to Machine application:** authorised for the Auth0 Management API with `read:authentication_methods`, `delete:authentication_methods` and `delete:users`. Its id and secret go in `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET`.

### Check after a deploy

- `/health` and `/health/db` on the backend return 200.
- Log in on the frontend with an account whose email is verified, then open `/me`.
- Run a lease check: paste `data/sample_leases/demo_ro.txt`, choose Circumvalațiunii, 2 rooms, 500 EUR, English. Expect **Fair price** and **High risk**.
- Upload `data/sample_leases/demo_ro.pdf` on the lease page. Its text fills the form.
- On `/me`, verify a UVT, UPT or UMFT student email. The 6-digit code arrives by email.
- Join an event and run a match.
- Reload the page on `/lease/history/<id>`.

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

- Edit only your own feature files. A owns lease, pricing and student verification; B owns events, profile, matching and account settings.
- Shared files (`backend/main.py`, `config.py`, `auth.py`, `frontend/src/api.js`, `db/schema/00_shared.sql`, `API.md`): message your teammate first and keep the change small.
- After pulling, rerun `pip install -r requirements.txt`, `npm install` and `python db/apply_schema.py` if those files changed.
- Never commit `.env`, keys, passwords or database dumps. If a secret gets committed, deleting the file is not enough: rotate the password or key right away.
