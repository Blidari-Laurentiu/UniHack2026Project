# Timișoara Newcomer Hub

UniHack 8 project (team of 2, 48 hours). A web app for people who have just moved to Timișoara:

- **Lease check (Feature A).** Paste a Romanian lease. Gemini returns a clause checklist (risky clauses, missing clauses, overall risk), and a price verdict compares the rent with neighbourhood listings. The price verdict still works when Gemini fails. CNP, IBAN and ID series are removed from the text before it goes to Gemini or the database.
- **Event groups (Feature B).** Set your interests and availability, join an event, and get matched into a group of 3 to 5 people with a "why you match" line.

Stack: FastAPI + psycopg 3 on Tiger Cloud (Postgres + TimescaleDB), Google Gemini, Auth0, React + Vite.

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
| `CORS_ORIGINS` | `http://localhost:5173` |
| `APP_ENV` | `dev` on laptops. Only `dev` allows seeding, reset and the `X-Dev-User` login bypass. |

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
