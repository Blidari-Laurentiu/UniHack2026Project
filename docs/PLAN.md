# Timișoara Newcomer Hub: status (UniHack 8)

Updated Saturday 2026-11-14, 20:40 · @Blidari Laurentiu

## 1. Status

Both features work end to end on `main` and are deployed. The backend is on Render and the frontend is on Vercel. Both redeploy on every merge to `main`. All 413 backend tests pass, and `npm run build` passes. PDF upload, student codes, account settings and English / Romanian on every page were checked on the live site. What is left: rehearse the walkthrough, reseed the database and fix the docs. Feature freeze is at 24:00 tonight. The last merge is at 12:00 on Sunday, and commits freeze at 13:00. Judging is a 1-on-1 walkthrough with a judge. There is no stage pitch and there are no slides.

| What | URL |
| --- | --- |
| App | https://uni-hack2026-project.vercel.app |
| Backend | https://unihack2026project.onrender.com (free plan, sleeps after 15 minutes) |

## 2. Done

**Feature A, lease check (Laurentiu)**

- #5 sample leases and Timișoara rent ranges
- #7 seed listings (now 1000 over 12 months)
- #8 pricing service: median, verdict, city fallback
- #9 Gemini service: redaction, structured report, retry, demo cache
- #10 lease and pricing routers: real endpoints
- #11 lease page: form, report, price badge
- #12 neighbourhood median chart
- #13 and #14 saved checks history
- #15 continuous aggregate and price trend chart
- #16 "How this was checked" panel
- #22 PDF upload
- #25 lease pages in English and Romanian

**Feature B, event groups (Petru)**

- #2 frontend shell
- #6 Auth0 tenant, events, profile, matcher, join and leave, group card
- #26 account settings: edit profile, change password, 2FA on and off, delete account; student status lasts one year

**Shared**

- #1 API contract and mock endpoints
- #3 and #4 README and repo cleanup
- 28b5d17 code review fixes: auth, DB connections, errors, Docker, events rules
- #19 deploy (Render and Vercel)
- #20 and #21 team notes kept local
- #23 roles with admin MFA, verified email required, student status by university code
- #24 student codes sent through Brevo
- #27 whole site in English and Romanian, with the switch in the top bar

**Build checklist from Friday**

Together:

- [x] Read the eight fixes and agree on them.
- [x] Agree on slot names, interest tags and branch prefixes (`a/`, `b/`).
- [x] Decide who is Person A (renting) and who is Person B (events).

Person A:

- [x] Create the GitHub repo, add Person B, save the plan as `docs/PLAN.md`.
- [x] Prompts 0 and 1, first push.
- [x] Send `DATABASE_URL` to Person B privately.
- [x] Prompt 2 (schema), prompt 3 (Auth0 in the backend), prompt 4 (API contract), prompt 6 (review and README).
- [x] Sample Romanian leases and rent ranges.

Person B:

- [x] Clone the repo and pass `/health/db`.
- [x] Auth0 tenant, Single Page Application and API.
- [x] Post-Login Action with custom claims. Student status later moved to a university email code (#23).
- [x] Prompt 5 (frontend shell), PR opened.
- [x] Real login in the browser, `/me` shows the user row.
- [x] Sample Timișoara events and interest tags.

- [x] **Gate 1:** `main` runs on both laptops, `pytest` and `npm run build` pass, login and every endpoint answer from the frontend.

Phase 2, Person A:

- [x] 1\. `db/seed_listings.py`
- [x] 2\. `services/pricing.py` with tests
- [x] 3\. `services/gemini.py`
- [x] 4\. `routers/lease.py` and `routers/pricing.py`
- [x] 5\. `pages/lease/`

Phase 2, Person B:

- [x] 1\. `db/seed_events.py`
- [x] 2\. `services/matching.py` with tests
- [x] 3\. `routers/events.py` and `routers/profile.py`
- [x] 4\. `pages/events/`

- [x] **Gate 2:** both features work end to end on `main`, and the demo story runs without errors.

Phase 3:

- [x] Neighbourhood median chart (#12)
- [x] Saved checks history (#13, #14)
- [x] Continuous aggregate and price trend chart (#15)
- [x] Verified student badge (by university code, #23)
- [x] Leave group; a group under three is dissolved and its members go back on the waiting list
- [x] Host decision: Render and Vercel (#19)
- [x] Judge walkthrough written (`docs/DEMO.md`, local)
- [x] Talk tracks for part A and part B (local)
- [x] PDF lease upload (#22)

Not started: Gemini icebreakers per group.

## 3. What is left until 13:00

| Time | Laurentiu | Petru |
| --- | --- | --- |
| Saturday 20:40 to 24:00 | Refresh the local notes. This PR (`a/plan-refresh`). CLAUDE.md and README fixes, if we agree on them. | Check the Events and Me pages at 375 px: error, loading and empty states. |
| **24:00 (12 AM) between Saturday and Sunday** | **Feature freeze.** Bug fixes only after this. | same |
| 00:00 to 00:30 | Walkthrough run 1 on the deployed URLs, together. Fix only what breaks the walkthrough. | same |
| Sunday 09:00 | Reseed: `python db/reset_db.py --yes`, then `python db/seed.py`. Tell Petru first. Log in again and run the lease demo once. | Log in again after the reseed. |
| 09:30 | Walkthrough run 2, together. | same |
| 10:30 | Last docs fixes. | same |
| **12:00** | **Last merge to `main`.** Check that the Render and Vercel deploys are green. | same |
| **13:00** | **Commit freeze.** | same |
| Judging | Open backend `/health` 5 minutes before the slot and keep the tab open. | same |

## 4. Decisions already made

- **Hosting:** Render for the backend (free Docker service, Frankfurt, sleeps after 15 minutes) and Vercel for the frontend. Both deploy from `main`. Vultr is not used.
- **Slides dropped:** judging is a 1-on-1 walkthrough.
- **Report button cut.** It will not be built. The `reports` table stays in `20_events.sql`, and `GET /admin/reports` (#23) still reads it; it returns an empty list.
- **Team notes stay local:** `docs/DEMO.md`, `docs/PITCH_A.md`, `docs/PITCH_B.md` and `docs/HANDOFF_PROMPT.md` are in `.gitignore`. They are never pushed and never linked from `README.md`. Old copies remain in the commits of #16, #19 and #20.
- **Feature freeze** at 24:00 (12 AM) between Saturday and Sunday.

## 5. After the event

- Delete the Tiger Cloud service.
- Revoke the Gemini keys used in the demo.
- Delete the Render service.
- Revoke the Brevo API key and the Auth0 Machine to Machine secret.
- The repo is public: keep secrets out of it.

## History

On Friday this file was the build kit. It listed eight fixes to the first plan: separate seed scripts, a split schema, UUID keys, keeping pairs with no shared free time, Auth0 email claims, redaction before Gemini, a hypertable for listings and the dev login bypass. All eight are built. Prompts 0 to 6 produced CLAUDE.md and PRs #1 to #3. The first-push Git steps now live in the README's "Git workflow" section. The two starter prompts produced #9 (Gemini) and #6 (matcher). The full text is in the git history of this file, before this commit.
