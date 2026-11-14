# Judge walkthrough (about 5 minutes)

For the two of us, during the 1-on-1 judging. There is no stage pitch: a judge sits with us and checks what we built. Laurentiu drives part A, Petru drives part B, on one laptop and one login.

| What | URL |
| --- | --- |
| App | https://uni-hack2026-project.vercel.app |
| Backend | https://unihack2026project.onrender.com |
| Warm-up | https://unihack2026project.onrender.com/health |
| API docs | https://unihack2026project.onrender.com/docs |

[PITCH_A.md](PITCH_A.md) was written as a stage pitch. It is now the talk track for part A of this walkthrough: say the same sentences, sitting down, and stop whenever the judge asks something.

## Before the slot

Sunday morning, once:

1. Reseed the shared database (see [Reseed](#reseed)). Tell the other person first.
2. Log in on the app and run the lease demo once, so **Your past checks** is not empty.

Five minutes before the slot:

1. Open the warm-up URL and keep the tab. The free Render instance sleeps after 15 minutes without traffic and takes about a minute to wake. Wait for `{"status": "ok"}`.
2. Open the app and log in. Check that `/me` loads.
3. Open `data/sample_leases/demo_ro.txt` in an editor, select all, copy.
4. Open `/events` and check that the event for this slot still shows its waiting list (see [Match budget](#match-budget)).
5. Browser zoom at 125%.

## The walkthrough

### 0. Open (20 seconds)

"Mei just moved to Timișoara. Two things go wrong in the first month: she signs a lease she cannot read, and she goes to everything alone. We built one app for both."

Show the home page with the two cards.

### 1. Auth0 login (30 seconds, Petru)

1. Click **Log in**. The Auth0 Universal Login page opens: email and password, Google or GitHub.
2. Log in, then open **Me**. The row comes from our Postgres database: Auth0 id, our own UUID, joined date.
3. Say: "The frontend gets an RS256 access token for our API. The backend checks the signature against the tenant's JWKS, the audience and the issuer on every request, then creates or updates the user row."
4. If the judge wants proof: open `https://unihack2026project.onrender.com/me` in a new tab. It answers 401 `{"detail": "missing bearer token"}`.

### 2. Part A, lease check (2 minutes, Laurentiu)

Follow **Demo click path** and **Talk track** in [PITCH_A.md](PITCH_A.md). In short:

1. **Lease check**: paste the demo lease, **Circumvalațiunii**, **2** rooms, **500**, **English**, then **Check my lease**.
2. Result in about a second: **Fair price** (+2.0% against a median of €490 from 50 listings) and **High risk** (7 risky clauses, 1 missing).
3. **How this was checked**: **Sent to Gemini** (4 `[REDACTED]` markers), **Gemini's raw answer** (`"overall_risk": "high"`), **The SQL** (median query, then the trend query on `listings_monthly`).
4. Scroll to the **Price trend** chart.
5. **Your past checks** → **See all checks** → open one and reload the page. The saved check comes back from the database on a deep link.

### 3. Part B, event groups (2 minutes, Petru)

When `docs/PITCH_B.md` exists, use its talk track. The click path:

1. Open **Events**. On a new account the page asks **Tell us what you like**: the first name is filled in from Auth0. Pick two or three interests (include **Board games**) and **Weekday evenings**, then **Save profile**. The form turns into a summary with chips.
2. Point at the filters (**Interest**, **From**, **To**). Choose **Board games**.
3. On **Board-game night**: "7 people want to go". Click **I want to go**. The badge says **On the list** and the count is 8.
4. Click **Find my group**. The card shows **You have a group** and **Your group**: the "why you match" line, four members with "(you)" next to our name, and where to meet, 30 minutes before the start.
5. Say: "Eight people waiting became two groups of four. Each group starts from the person who waited longest and takes the people who fit best: 60% shared interests, 40% shared free time. Same input, same groups, so we can test it."
6. If there is time: **Leave group**, confirm. The group goes on with three people; a group that falls under three is dissolved and its members go back on the list.

### 4. Close (10 seconds)

"A newcomer can trust what they see, because we show how we checked: the redacted text, the raw JSON, the SQL, and why these four people are a group."

## Match budget

A match uses up an event's waiting list. Each seed gives three clean matches, one per event:

| Event | Fake users waiting | After you join and match |
| --- | --- | --- |
| Board-game night | 7 | two groups of 4 |
| Hamlet (with English surtitles) | 11 | three groups of 4 |
| Poli Timișoara home match | 4 | one group of 5 |

- Use a different event for each run. Order: Board-game night, then Hamlet, then Poli.
- If the event was already matched, the next person to join sees "Not enough people yet: 1 waiting, a group needs 3". That is correct behaviour, but it is not the demo.
- To get all three back between judges: `python db/seed.py` (without `reset_db.py`). It refills the waiting lists and keeps users and saved lease checks. Your own signups and groups on the seeded events are removed.

## What each sponsor sees

**Gemini**

- Structured output: Gemini answers in JSON against our schema, checked with Pydantic, with one retry. The page is rendered from that JSON (**Gemini's raw answer** tab).
- Privacy before the call: CNP, ID card, passport and IBAN are replaced with `[REDACTED]` on our server. Only the redacted text is sent and stored (**Sent to Gemini** tab).
- The price verdict still answers when Gemini fails.
- If asked whether it is live: the demo lease returns a saved Gemini answer for that exact text (`DEMO_CACHE`), so judging does not depend on quota or wifi. Any other lease is a live call. To show one, paste `data/sample_leases/fair_ro.txt` with **Iosefin**, **1** room, **320**. It takes a few seconds and should come back low risk.

**Tiger Data**

- `listings` is a TimescaleDB hypertable on `listed_at`.
- The verdict is one SQL query: neighbourhood median and city median together with `percentile_cont`, city fallback under 5 listings (**The SQL** tab).
- The trend chart reads two continuous aggregates, `listings_monthly` and `listings_monthly_city`, refreshed hourly, real-time for the current month.
- Proof queries with their output are in [PITCH_A.md](PITCH_A.md) under **Proof SQL**. Paste them into the Tiger console if the judge wants them live.

**Auth0**

- Universal Login with email, Google and GitHub; Single Page Application plus an API with audience `https://newcomer-hub/api`.
- The backend verifies RS256 access tokens with the tenant's JWKS. No token, or a bad one, gives 401.
- Every saved lease check and every signup belongs to the Auth0 user. Another user's lease check returns 404.
- A Post-Login Action adds the email and a student flag as custom claims; a student gets the **Verified student** badge. Check before the slot: if **Me** says "not shared by Auth0 yet" next to Email, the Action is not running, so do not claim this point.
- The **Student** badges inside a group card belong to the seeded sample users. They do not come from Auth0.

## Reseed

Sunday at 09:00, from the repo root, with `APP_ENV=dev` in the local `backend/.env`:

```bash
python db/reset_db.py --yes      # drops every user, saved check and signup
python db/seed.py
```

Why: listing and event dates are relative to the seed day. A fresh seed brings back the exact numbers in [PITCH_A.md](PITCH_A.md), puts every event in the future and refills the three waiting lists.

After a reset, both of us log in again on the app. The profile on **Events** is empty again, which is what step 3.1 of the walkthrough expects. Run the lease demo once.

## Plan B

1. **Backend asleep or slow**: wait a minute on the warm-up URL, then reload the app.
2. **Deployed site broken**: run it locally. Needs `DEMO_CACHE=1` in `backend/.env`.

   ```bash
   cd backend && .venv\Scripts\activate && uvicorn main:app
   cd frontend && npm run dev          # http://localhost:5173
   ```

   Auth0 still works on `http://localhost:5173`. If Auth0 itself is down, set `VITE_DEV_USER=mei` in `frontend/.env` and restart `npm run dev` (works only with `APP_ENV=dev`).
3. **No network at all**: the screenshots in [`docs/pitch-a/`](pitch-a/) show the three **How this was checked** tabs on desktop and at 375 px.

## Likely questions

Part A questions (real data, why a continuous aggregate, exact median, Gemini making things up, what is stored) are answered in [PITCH_A.md](PITCH_A.md) under **If a judge asks**.

- **"Why is the first load slow?"** The backend is on a free instance that sleeps after 15 minutes. Nothing is wrong with the app.
- **"Are the events and people real?"** No. 26 sample events at real Timișoara venues and 36 sample users, labelled as sample data on the page.
- **"How does matching work?"** Score between two people = 0.6 × overlap of interests + 0.4 × overlap of free time (Jaccard). Groups of 3 to 5, target 4, built from the longest-waiting person. Nobody is left out when at least 3 are waiting. It is a pure function with unit tests.
- **"Why does availability count if they all chose the same event?"** Nobody is excluded for it. It only favours people who could meet again.
- **"Who can run a match?"** Only someone who joined that event; anyone else gets 403. An event that has started cannot be joined or matched.
- **"What happens to a lease after the check?"** Only the redacted text, Gemini's JSON and the verdict are saved, for that user only.
- **"What is not finished?"** No PDF upload: the lease is pasted as text. Listings are sample data, not a live feed. Matching runs when a user asks, not on a schedule.
- **"Who did what?"** Laurentiu: backend skeleton, lease check, pricing, database schema, deployment. Petru: Auth0 tenant, frontend shell, events, profile, matching.
