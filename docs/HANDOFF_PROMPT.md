# Handoff prompt: Timișoara Newcomer Hub, state on Saturday 2026-11-14, about 16:30

Paste everything below the line into a new Claude Code session started in the repo root (or tell Claude: "Read docs/HANDOFF_PROMPT.md and follow it").

---

You are joining a hackathon project in progress. You are working for **Laurentiu (Person A)**. Read this whole brief first, then do "First steps" at the end.

## 1. The project and the deadline

**Timișoara Newcomer Hub**, UniHack 8, team of two, 48 hours.

- **Feature A, lease check** (Laurentiu, Person A): paste a Romanian lease; Gemini returns a clause checklist; a price verdict compares the rent with the neighbourhood median from a TimescaleDB listings table.
- **Feature B, event groups** (Petru, Person B): set interests and availability, join an event, `POST /events/{id}/match` forms groups of 3 to 5.

**Deadline: Sunday 2026-11-15, 13:00. No commits after that.** There is **no stage pitch**. Judging is a **1-on-1 walkthrough** where a judge sits with the team and checks what was built. So there are no slides and no stage rehearsals; we need a short judge walkthrough and a deployed site that works.

Source of truth, read before changing anything: `CLAUDE.md` (rules, follow exactly), `docs/PLAN.md`, `API.md`, `README.md` (now has a Deployment section), `docs/PITCH_A.md` (Person A's talk track, click path and proof SQL).

## 2. What is deployed (done today)

| Part | Host | URL |
| --- | --- | --- |
| Backend | Render, free Docker web service, Frankfurt | `https://unihack2026project.onrender.com` |
| Frontend | Vercel (Hobby), root directory `frontend` | `https://uni-hack2026-project.vercel.app` |

Both redeploy on every merge to `main`. Secrets are only in the hosts' dashboards; Laurentiu enters them himself. Never print or commit a secret.

Verified from the command line at about 16:15:

- Backend `/health` and `/health/db` return 200 (it reaches Tiger Cloud).
- `/me` returns 401 without a token **and** with `X-Dev-User`, so `APP_ENV=production` is in effect and the dev bypass is off.
- CORS preflight from the Vercel origin returns 200 with the right `access-control-allow-origin`; an unknown origin is refused.
- Frontend `/`, `/lease`, `/events`, `/me` and the deep link `/lease/history/abc` all return 200 with the app shell, so the `frontend/vercel.json` rewrite works. The built bundle contains the Render URL.

Render settings that matter (the first build failed until these were set): Root Directory empty, Dockerfile Path `./backend/Dockerfile`, Docker Build Context Directory `.`, health check `/health`. Env on Render: the `backend/.env` names plus `APP_ENV=production`, `DEMO_CACHE=1`, `CORS_ORIGINS=https://uni-hack2026-project.vercel.app`. Vercel env: `VITE_API_URL` (the Render URL) and the three `VITE_AUTH0_*` values; `VITE_DEV_USER` is not set and must never be.

The Render free instance **sleeps after 15 minutes without traffic** and takes about a minute to wake. The first request after a sleep is slow; that is not a bug.

## 3. The one thing blocking right now

**Login on the deployed site fails with Auth0's "Callback URL mismatch".** Only Petru can open the Auth0 dashboard. He has been asked to add `https://uni-hack2026-project.vercel.app` (https, no trailing slash, no path) to **Allowed Callback URLs**, **Allowed Logout URLs** and **Allowed Web Origins** of the Single Page Application, keep `http://localhost:5173` in each, and click **Save Changes**. If it still fails after he says it is done, the usual causes are: not saved, a trailing slash, or the wrong application (its Client ID must match `VITE_AUTH0_CLIENT_ID`).

The Auth0 domain starts with `dev-`. That is just the auto-generated tenant name. It has nothing to do with `APP_ENV=dev` or the dev bypass, and it does not need changing.

**Nothing behind login has been checked on the deployed site yet.** As soon as login works, Laurentiu runs this in the browser and reports back:

1. Log in, open `/me`.
2. Lease demo from `docs/PITCH_A.md`: paste `data/sample_leases/demo_ro.txt`, Circumvalațiunii, 2 rooms, €500, English. Expect **Fair price** and **High risk** in about a second. A fast answer confirms `DEMO_CACHE` works in the container; a slow one means the demo files are missing from the image and Gemini was called live.
3. Open **How this was checked** and click the three tabs; scroll to the price trend chart.
4. Open a saved check from History and reload the page (deep link).
5. Join an event and run a match.
6. Repeat a quick pass at 375 px.

## 4. What is left, with times

Decisions already made, do not reopen them: Render for the backend (Koyeb's pricing page no longer lists a free instance); Vercel for the frontend; slides dropped; **Petru builds the report button**, and if it is not merged by the 21:00 freeze it is cut.

**Saturday**

| Time | Laurentiu, with your help | Petru |
| --- | --- | --- |
| On Petru's Auth0 fix | Browser checklist from section 3. Fix what fails. | Auth0 URLs |
| about 17:15 to 18:15 | Together: events pages on the deployed site (error, loading and empty states, 375 px). Then tick Gate 1, Gate 2 and "Send `DATABASE_URL` to Person B" in `docs/PLAN.md`, only after Laurentiu confirms each. | same |
| 18:15 to 20:30 | Write `docs/DEMO.md` (see below). Add a "Live demo" line with both URLs to `README.md`. | Report button (`API.md` first, then endpoint, `api.js`, button) and `docs/PITCH_B.md` |
| **21:00** | **Feature freeze.** Bug fixes only after this. | same |
| 21:00 to 22:00 | Walkthrough run 1 on the deployed URLs, as if a judge were watching. Fix only what breaks the walkthrough. | same |

**`docs/DEMO.md`** is written for the two team members to follow during judging. One walkthrough for both halves, about 5 minutes: the two URLs; the warm-up step (open backend `/health` 5 minutes before the slot and keep the tab); part A click path (reuse `docs/PITCH_A.md`, do not duplicate it); part B click path (from `docs/PITCH_B.md` once Petru has written it, otherwise from reading `frontend/src/pages/events/`); what each sponsor (Gemini, Tiger Data, Auth0) sees; the Sunday reseed step; plan B (local `uvicorn` + `npm run dev`, then the screenshots in `docs/pitch-a/`); likely judge questions. `docs/PITCH_A.md` is framed as a stage pitch; leave it, and say in `DEMO.md` that it is now used as a talk track for the 1-on-1.

**Sunday**

| Time | What |
| --- | --- |
| 09:00 | Reseed the shared database: `python db/reset_db.py --yes` then `python db/seed.py` (from the repo root, local `APP_ENV=dev`). **This drops every user and saved check, so ask Laurentiu first and have him tell Petru.** Then log in on the deployed site and run the lease demo once so History is not empty. Seeded listing dates are relative to the seed day, so this also restores the exact numbers in `docs/PITCH_A.md`. |
| 09:30 | Walkthrough run 2 on the deployed URLs. |
| 10:30 | Last docs fixes. |
| **12:00** | **Last merge to `main`.** Every merge redeploys Render (a few minutes of downtime), so nothing lands in the final hour. Check both deploys are green. |
| 13:00 | Commit freeze. |
| Judging | Warm up the backend 5 minutes before the slot. |
| After | Delete the Tiger service, revoke the demo Gemini key, delete the Render service. |

## 5. Repo state

- `main` is at `06bcf87` (PR #19, squash-merged: `frontend/vercel.json`, README Deployment section, the first version of this file). 226 backend tests pass; `npm run build` passes with no warnings.
- **This file was rewritten after #19 and is not committed.** Commit it with the next docs PR (branch `a/demo-script`), not on `main` directly.
- `frontend/package-lock.json` shows a local change (an older npm dropping `libc` fields). Never commit it.
- The GitHub repo is **public** (the plan says private). The history was checked: no `.env`, key or connection string was ever committed. Keep it that way.
- Docker is **not installed** on this laptop, so the image can only be built on Render. If a backend change breaks the build, the Render build log is the only place to see it.

## 6. How to work here

- One branch per task (`a/...`), one PR per task, squash merge to `main`. Laurentiu or Petru merges. Opening the PR is fine without asking; merging is not yours.
- Edit only Person A's files and docs. For shared files (`main.py`, `config.py`, `auth.py`, `api.js`, `00_shared.sql`, `API.md`), show Laurentiu the exact small diff first. Do not touch Petru's events files.
- Before every PR: `pytest` (in `backend/`, use `.venv\Scripts\python -m pytest`) and `npm run build` (in `frontend/`), both clean.
- On Windows, write commit messages and PR bodies to a file and use `git commit -F` and `gh pr create --body-file`.
- The shell keeps its working directory between commands. Use absolute paths or `cd` to the repo root at the start of each command.
- Laurentiu's local backend may be on port 8000. Use spare ports (8011, 5181) for your own runs and stop every server you start.
- Ask before anything that touches the shared database or an external dashboard. You cannot click in Render, Vercel or Auth0; give Laurentiu the exact field names and values, and for Auth0 write the message he sends to Petru.
- Read-only `curl` checks against the two deployed URLs are fine at any time.
- Report results faithfully. If something fails or you skipped a step, say so.

## 7. First steps

1. `git switch main && git pull`. Check `git status` (expect this file modified and `package-lock.json` modified, nothing else).
2. Recheck the deploy from the command line: backend `/health` and `/health/db`, frontend `/` and one deep link. Allow up to a minute if the backend was asleep.
3. Ask Laurentiu:
   - Has Petru saved the Auth0 URLs, and does login work on the Vercel site now?
   - Which items of the browser checklist in section 3 passed, and what failed?
   - Has Petru started the report button and `docs/PITCH_B.md`?
   - What time is it, so you can adjust the table in section 4.
4. While waiting for answers, start `docs/DEMO.md` on branch `a/demo-script`. Part A and the logistics do not depend on anyone.
