# API contract

Base URL: `http://localhost:8000` (interactive docs at `/docs`). Models live in `backend/schemas/` (`common.py`, `lease.py`, `events.py`); this file must match them.

- **Auth.** "JWT" means the header `Authorization: Bearer <Auth0 access token>`. When `APP_ENV=dev` only, `X-Dev-User: <name>` can replace it. "Public" routes need no auth.
- **Verified email.** A token is only accepted when its claim `https://newcomer-hub/email_verified` is `true` (set by the Post-Login Action from Auth0's `email_verified`; a token without it counts as not verified). Otherwise every JWT route answers 403 `{"detail": "verify your email address first"}` and no `users` row is created. `GET /events` (optional auth) treats such a caller as anonymous. Dev users count as verified.
- **Roles.** Auth0 roles `admin`, `moderator` and `creator` reach the API in the access-token claim `https://newcomer-hub/roles`; `https://newcomer-hub/mfa` is `true` when the login used a second factor. Both are set by a Post-Login Action. A caller without a required role gets 403 `{"detail": "you do not have permission to do this"}`. An admin account whose login had no second factor gets 403 `{"detail": "admin accounts must sign in with multi-factor authentication"}` on role-protected routes. When `APP_ENV=dev` only, `X-Dev-Roles: admin,moderator` sets the roles next to `X-Dev-User`.
- **Errors.** Errors are always `{"detail": "..."}`: 401 for a missing or bad token, 404 for an unknown id, 422 for an invalid body (FastAPI validation; there `detail` is a list), 429 when a daily limit is reached (lease checks, creating events), and 503 when price data is unavailable (empty listings table) or the database is down, on any endpoint.
- **IDs.** All ids are UUID strings. Times are ISO 8601 with a timezone.
- **Data.** All endpoints are real and read the database; none are mocked.
- **Slots.** The availability slots are `weekday_morning`, `weekday_evening`, `weekend_morning`, `weekend_afternoon` and `weekend_evening`.

The endpoint list was inferred from the `api.js` functions in docs/PLAN.md prompt 5, because PLAN.md has no endpoint tables. Change it here first, then in code.

## Me and health (shared)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | Public | – | `{"status": "ok"}` | A |
| GET | `/health/db` | Public | – | `{"status": "ok", "db": true}` | A |
| GET | `/me` | JWT | – | `{"id": "…", "auth0_sub": "dev\|alice", "display_name": "alice", "email": null, "is_student": false, "created_at": "2026-11-13T13:38:42Z", "roles": ["admin"], "mfa": true}` | A |
| GET | `/admin/users` | JWT, role `admin` | – | `[{"id": "…", "auth0_sub": "google-oauth2\|1082…", "display_name": "Ana", "email": "ana@gmail.com", "is_student": false, "created_at": "2026-11-13T13:38:42Z"}]` (newest first, at most 200) | A |
| GET | `/admin/reports` | JWT, role `moderator` or `admin` | – | `[{"id": "…", "reporter_id": "…", "reported_user_id": "…", "event_id": null, "group_id": null, "reason": "…", "created_at": "2026-11-13T13:38:42Z"}]` (newest first, at most 200) | A |

## Student verification (shared)

`is_student` is set only here, never from a token claim. The user picks a university and types their student email there; we email a 6-digit code; typing it makes them a student **for one year**. After that `is_student` is `false` everywhere (`/me`, `/profile`, group members) and `StudentStatus` has `"expired": true` until the user verifies again. One university email belongs to one account, also after it expired.

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/student/universities` | Public | – | `[{"slug": "uvt", "name": "Universitatea de Vest din Timișoara (UVT)", "domains": ["e-uvt.ro"]}, ...]` | A |
| GET | `/student/status` | JWT | – | `StudentStatus` (below) | A |
| POST | `/student/start` | JWT | `{"university": "uvt", "email": "ana.pop03@e-uvt.ro"}` | 202 `StudentStatus` with `pending` | A |
| POST | `/student/confirm` | JWT | `{"code": "482913"}` | `StudentStatus` with `"is_student": true` | A |

`StudentStatus`:

```json
{"is_student": false, "university": null, "student_email": null, "verified_at": null,
 "expires_at": null, "expired": false,
 "pending": {"university": "uvt", "student_email": "ana.pop03@e-uvt.ro",
             "expires_at": "2026-11-14T16:10:00Z", "resend_after": "2026-11-14T16:01:00Z"}}
```

- **Start.** 422 `unknown university`, `use your student email for UVT (@e-uvt.ro)` (the domain must be a student domain of that university, exact match) or `use your university email without a +tag`. 409 `you are already a verified student` or `this university email is already used by another account`. 429 `wait N seconds before asking for a new code` (60 s between codes) or `too many codes in the last hour, try again later` (5 per hour). 503 when the email cannot be sent, or `sending email is not set up on the server` (no `MAIL_FROM` with `BREVO_API_KEY` or `SMTP_HOST` outside dev; in dev the code is written to the server log instead). A new code replaces the previous one.
- **Confirm.** Codes expire after 10 minutes and allow 5 wrong tries. 400 `no code to confirm, ask for a new one`, `this code has expired, ask for a new one` or `wrong code, N tries left`. 429 `too many wrong codes, ask for a new one`. 409 as above.

## Account settings (shared)

The profile (name, interests, free time) is edited with `PUT /profile`. Turning 2FA **on** is not an API call: the frontend logs in again with the extra parameter `enroll_mfa=true` and the Post-Login Action shows Auth0's enrolment page.

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/account` | JWT | – | `{"login_method": "password", "email": "ana@example.com", "can_change_password": true, "mfa": {"available": true, "enabled": false, "required": false}, "can_delete": true}` | B |
| POST | `/account/password-reset` | JWT | – | 202 `{"sent_to": "ana@example.com"}` | B |
| DELETE | `/account/mfa` | JWT | – | `{"available": true, "enabled": false, "required": false}` | B |
| DELETE | `/account` | JWT | – | 204 | B |

- **Account.** `login_method` is `password`, `google`, `github`, `email_code`, `dev` or `other`. `mfa.available` is false when the server has no Management API credentials (or for a dev user); `mfa.enabled` is `null` when Auth0 could not be asked; `mfa.required` is true for admins.
- **Password reset.** Auth0 emails a link to choose a new password. 409 `this account has no password: you sign in with Google` for accounts without a password.
- **Turn 2FA off.** 409 `two-factor authentication is not on` or `admin accounts must keep two-factor authentication on`. 403 `sign in again with your authenticator code to turn two-factor authentication off` when this login did not use the code.
- **Delete.** Removes the user row and everything that hangs on it (saved lease checks, profile, signups, student verification), takes the user out of their groups (a group left under 3 is dissolved, as when leaving) and deletes the Auth0 user. If Auth0 fails, nothing is deleted.
- **503** `account management is not set up on the server` (no `AUTH0_MGMT_CLIENT_ID`/`AUTH0_MGMT_CLIENT_SECRET`; a dev user can still be deleted) or `the login service could not be reached, try again in a few minutes`.

## Lease (Feature A)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| POST | `/lease/extract-text` | JWT | `multipart/form-data` with one field, `file`: a PDF, at most 5 MB and 40 pages | `{"text": "CONTRACT DE ÎNCHIRIERE ...", "pages": 2, "characters": 4178}` | A |
| POST | `/lease/analyze` | JWT | `LeaseAnalyzeRequest` (below) | `LeaseAnalysis` (below) | A |
| GET | `/lease/analyses` | JWT | – | `[{"id": "a111…", "created_at": "2026-11-13T18:30:00Z", "neighbourhood": "Circumvalațiunii", "rooms": 2, "rent_eur": 500.0, "overall_risk": "medium", "verdict": "above_market"}]` | A |
| GET | `/lease/analyses/{id}` | JWT | – | `LeaseAnalysis`; 404 `{"detail": "analysis not found"}` | A |
| GET | `/lease/analyses/{id}/details` | JWT | – | `{"id": "a111…", "created_at": "…", "lease_text_redacted": "… CNP [REDACTED] …", "redaction_count": 4, "gemini_json": {LeaseReport}, "report_error": null, "price_inputs": {"neighbourhood": "Circumvalațiunii", "rooms": 2, "rent_eur": 500.0, "window": "12 months", "min_sample": 5, "scope": "neighbourhood", "sample_size": 50, "median_eur": 490.0, "diff_pct": 2.0, "verdict": "fair"}}`; 404 `{"detail": "analysis not found"}` | A |

`LeaseAnalyzeRequest`:

```json
{
  "lease_text": "CONTRACT DE ÎNCHIRIERE ... (50 to 50000 chars)",
  "neighbourhood": "Circumvalațiunii",
  "rooms": 2,
  "rent_eur": 500,
  "ui_language": "en"
}
```

`rooms` is 1 to 3 (Romanian *camere*, living room included), because the listings only cover 1 to 3 rooms; 4 or more gives 422; `ui_language` is `en` or `ro`. CNP, IBAN and ID series are redacted on the server before Gemini and before saving.

`LeaseAnalysis`:

```json
{
  "id": "a1111111-1111-4111-8111-111111111111",
  "created_at": "2026-11-13T18:30:00Z",
  "neighbourhood": "Circumvalațiunii",
  "rooms": 2,
  "rent_eur": 500.0,
  "report": {
    "summary": "Standard 12-month lease for a 2-room flat. ...",
    "overall_risk": "medium",
    "risky_clauses": [
      {
        "quote": "Garanția nu se restituie în cazul oricărei uzuri a apartamentului.",
        "category": "deposit",
        "severity": "high",
        "why": "Normal wear and tear is expected; ...",
        "suggestion": "Ask for: the deposit is returned within 30 days, ..."
      }
    ],
    "missing_clauses": [
      {"name": "Major repairs", "why": "Romanian Civil Code puts major repairs on the landlord; ..."}
    ]
  },
  "report_error": null,
  "price_verdict": {
    "median_eur": 450.0,
    "diff_pct": 11.1,
    "verdict": "above_market",
    "scope": "neighbourhood",
    "sample_size": 20
  }
}
```

- `overall_risk` and `severity` are `low`, `medium` or `high`.
- `verdict` is `below_market`, `fair`, `above_market` or `suspiciously_low`; `scope` is `neighbourhood` or `city` (city-wide fallback under 5 listings).
- **When Gemini fails**, `report` is `null` and `report_error` holds a message, but `price_verdict` is always present. The analysis is still saved and reads back the same from `GET /lease/analyses/{id}`; in the list, its `overall_risk` is `null`.
- **When pricing fails**, `POST /lease/analyze` returns 503 `{"detail": "Price check is unavailable: ..."}` (no listings for that room count) or 503 `{"detail": "Price data is unavailable right now (database error). Please try again."}`, and nothing is saved.
- **Daily limit:** 5 analyses per user in any 24 hours, 20 for a verified student (`LEASE_CHECKS_PER_DAY`, `LEASE_CHECKS_PER_DAY_STUDENT`). Past it, `POST /lease/analyze` returns 429 before calling Gemini: `{"detail": "You have checked 5 leases in the last 24 hours. Verify your student status for a higher limit, or try again later."}`, or for a student `{"detail": "You have checked 20 leases in the last 24 hours. Please try again later."}`.
- **PDF upload:** `POST /lease/extract-text` returns the text layer of a PDF, to fill the lease text box. Nothing is saved or sent to Gemini, and the text is not redacted yet: that still happens in `POST /lease/analyze`. Errors: 413 (over 5 MB), 415 (not a PDF) and 422 (password-protected, damaged, over 40 pages, over 50,000 characters, or no text, which usually means a scan; there is no OCR).
- `GET /lease/analyses` is newest first and lists only the caller's analyses; another user's id gives 404.
- `GET /lease/analyses/{id}/details` shows how an analysis was made: the redacted text exactly as Gemini received it (never the original), Gemini's JSON (`null` when Gemini failed, with `report_error` saying why) and what the price verdict was computed from. Same ownership rule: another user's id gives 404.

## Pricing (Feature A)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/pricing/neighbourhoods` | Public | – | `[{"name": "Complex Studențesc", "median_eur_by_rooms": {"1": 330.0, "2": 430.0, "3": 560.0}, "sample_size": 28}, ...]` | A |
| GET | `/pricing/trend?neighbourhood=&rooms=` | Public | Query: `rooms` (required, 1 to 3), `neighbourhood` (optional; leave out or blank for city-wide) | `[{"month": "2025-12-01", "median_eur": 422.5, "count": 46}, ...]`, oldest first, last 12 months (the current month so far); 422 `{"detail": "rooms must be a whole number from 1 to 3."}`; 503 on database error | A |

`/pricing/trend` reads the TimescaleDB continuous aggregates `listings_monthly` / `listings_monthly_city` (header `X-Trend-Source: continuous_aggregate`), or `listings` directly on plain Postgres (`X-Trend-Source: listings`). An unknown neighbourhood returns `[]`.

Use it to fill the neighbourhood dropdown and the median chart. In JSON, the keys of `median_eur_by_rooms` are strings.

## Events (Feature B)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/events?interest=&from=&to=` | Public | Query parameters, all optional: `interest` (slug), `from` (ISO datetime, default now, so past events are hidden) and `to` (ISO datetime) | `[Event]` (below), ordered by `starts_at` | B |
| POST | `/events` | JWT | `EventIn` (below) | 201 `Event`, with `status` `active` or `pending` | B |
| POST | `/events/{id}/report` | JWT | `{"reason": "This is an advert, not an event."}` (5 to 500 characters) | 201 `{"event_id": "e100…01", "status": "received"}` | B |
| POST | `/events/{id}/join` | JWT | – | `{"event_id": "e100…01", "status": "waiting"}` | B |
| POST | `/events/{id}/leave` | JWT | – | `{"event_id": "e100…01", "status": "left"}`; 404 `{"detail": "you have not joined this event"}` | B |
| POST | `/events/{id}/match` | JWT | – | `{"event_id": "e100…01", "groups": [Group], "unmatched_count": 0}` | B |
| GET | `/events/{id}/my-group` | JWT | – | `Group` (below); 404 `{"detail": "not in a group yet"}` | B |

An unknown event id gives 404 `{"detail": "event not found"}`.

- **Create.** Anyone logged in can create an event. `EventIn` is `{"title": "Picnic in Parcul Rozelor", "venue": "Parcul Rozelor", "starts_at": "2026-11-21T19:00:00+02:00", "interest_slug": "food_drinks", "description": "Bring a blanket."}`: `title` 3 to 100 characters, `venue` 2 to 100, `starts_at` with a timezone, in the future and within a year; `interest_slug` and `description` (at most 1000) are optional. The server works out `slot` from `starts_at` on Timișoara's clock. 422 `the event must start in the future`, `the event must start within a year` or `unknown interest: x`.
- **Who is published at once.** A verified student, someone who was in a group for an event that has already taken place, and the roles `creator`, `moderator` and `admin` get `"status": "active"`. Everyone else gets `"status": "pending"`: the event is on nobody's list but the creator's until a moderator approves it.
- **Daily creation limit.** 3 events per user in any 24 hours (`EVENT_CREATE_DAILY_LIMIT`), then 429 `{"detail": "you can create 3 events a day, try again tomorrow"}`. The roles `creator`, `moderator` and `admin` have no limit.
- **Report.** One report per user per event: 409 `you have already reported this event`, 409 `you cannot report your own event`. When an event has more than 10 open reports (the 11th), it becomes `pending` and leaves the list until a moderator reviews it.
- **Events that are not `active`.** `GET /events` shows them only to their creator (`created_by_me` is `true`). Join, match and report on them give 409 `{"detail": "this event is not open right now"}`; leave and my-group still work.
- **Join.** Joining twice changes nothing. Joining again after leaving puts you at the back of the waiting list.
- **Match.** Groups everyone who is `waiting` for the event (3 to 5 per group, longest-waiting first) and saves the groups. It returns only the groups made by this call; `unmatched_count` is how many people are still waiting. Fewer than 3 waiting gives `"groups": []`. Only someone on the event (`waiting` or `grouped`) can run it: anyone else gets 403 `{"detail": "join this event before matching"}`.
- **Started events.** Join and match on an event that has already started give 409 `{"detail": "this event has already started"}`.
- **Leave.** Leaving a group of 3 dissolves it: the other two go back to `waiting` and are grouped again by the next match.
- **`signup_count`** counts `waiting` and `grouped` signups. `my_status` is filled in only when the caller is logged in.

`Event`:

```json
{
  "id": "e1000000-0000-4000-8000-000000000001",
  "title": "Board-game night",
  "venue": "Scârț Loc Lejer",
  "starts_at": "2026-11-18T19:00:00+02:00",
  "slot": "weekday_evening",
  "interest": {"id": "b100…03", "slug": "board_games", "label": "Board games"},
  "description": "Catan, Dixit and Codenames. Beginners welcome.",
  "signup_count": 9,
  "my_status": null,
  "status": "active",
  "created_by_me": false
}
```

`my_status` is `waiting`, `grouped`, `left` or `null` (never joined, or not logged in). `status` is `active`, `pending` (waiting for a moderator) or `rejected` (removed by a moderator).

`Group` (3 to 5 members):

```json
{
  "id": "f1000000-0000-4000-8000-000000000001",
  "event_id": "e1000000-0000-4000-8000-000000000001",
  "meet_at": "2026-11-18T18:30:00+02:00",
  "note": "Meet at the entrance 30 minutes before.",
  "members": [
    {"user_id": "c100…02", "display_name": "Andrei", "is_student": true, "avatar_url": null}
  ],
  "why_you_match": "You all like board games and live music, and are free on weekday evenings."
}
```

## Moderation (Feature B)

For the roles `moderator` and `admin` (an admin needs an MFA login); anyone else gets 403.

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/moderation/events` | JWT, role `moderator` or `admin` | – | `[ModerationEvent]` (below): upcoming events that are `pending`, or `active` with at least one open report. Pending first, then most reports; at most 200 | B |
| POST | `/moderation/events/{id}/approve` | JWT, role `moderator` or `admin` | – | `{"event_id": "e100…01", "status": "active"}` | B |
| POST | `/moderation/events/{id}/reject` | JWT, role `moderator` or `admin` | – | `{"event_id": "e100…01", "status": "rejected"}` | B |

- **Approve** puts the event on the public list and closes its open reports as `dismissed`, so they no longer count towards the limit of 10.
- **Reject** takes the event off the list for good and closes its open reports as `actioned`. Signups and groups are kept.
- `GET /admin/reports` still lists every report, open or closed.

`ModerationEvent`:

```json
{
  "id": "e1000000-0000-4000-8000-000000000001",
  "title": "Picnic in Parcul Rozelor",
  "venue": "Parcul Rozelor",
  "starts_at": "2026-11-21T19:00:00+02:00",
  "interest": {"id": "b100…08", "slug": "food_drinks", "label": "Food and drinks"},
  "description": "Bring a blanket.",
  "status": "pending",
  "created_at": "2026-11-15T12:06:01+02:00",
  "created_by": {"user_id": "c100…07", "display_name": "Ana"},
  "signup_count": 0,
  "reports": [
    {"id": "…", "reason": "This is an advert, not an event.", "created_at": "2026-11-15T12:30:00+02:00", "reporter_name": "Mei"}
  ]
}
```

`created_by` is `null` for a seeded event or a deleted account; `reports` holds the open reports, newest first.

## Profile (Feature B)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/profile/interests` | Public | – | `[{"id": "b100…01", "slug": "theatre", "label": "Theatre"}, ...]` | B |
| GET | `/profile` | JWT | – | `ProfileOut` (below) | B |
| PUT | `/profile` | JWT | `{"display_name": "Mei", "interest_slugs": ["board_games", "theatre"], "availability": ["weekday_evening"]}` | `ProfileOut`; 422 `{"detail": "unknown interest: x"}` | B |
| PUT | `/profile/avatar` | JWT | `multipart/form-data` with one field, `file`: a JPEG, PNG or WebP picture, at most 512 KB | `ProfileOut` with the new `avatar_url` | B |
| DELETE | `/profile/avatar` | JWT | – | `ProfileOut` with `"avatar_url": null` (also when there was no picture) | B |
| GET | `/profile/avatar/{user_id}` | Public | – | The picture itself (`image/jpeg`, `image/png` or `image/webp`); 404 `{"detail": "no profile picture"}` | B |

`ProfileOut`:

```json
{
  "user_id": "c1000000-0000-4000-8000-000000000001",
  "display_name": "Mei",
  "is_student": true,
  "interests": [{"id": "b100…03", "slug": "board_games", "label": "Board games"}],
  "availability": ["weekday_evening", "weekend_afternoon"],
  "avatar_url": "/profile/avatar/c1000000-0000-4000-8000-000000000001?v=1794736800001"
}
```

- **Profile picture.** `avatar_url` (in `ProfileOut` and in every group member) is a path on this API, or `null` when the user has no picture; the frontend then draws the mascot from `user_id`. The frontend crops and resizes a picture to 256 px before `PUT /profile/avatar`. The server reads the type from the file's first bytes, never from the upload's header: 413 `the picture is too large (512 KB at most)`, 415 `use a JPEG, PNG or WebP picture`, 422 `the file is empty`. A new upload replaces the old picture.
- **Reading a picture** needs no token, because an `<img>` tag cannot send one: anyone who knows a user's id can see that user's picture. `v` in the path changes with every upload, so the response is cached for a year (`Cache-Control: public, max-age=31536000, immutable`). Deleting the account deletes the picture.

`PUT /profile` replaces the whole profile. The seeded interest slugs are `theatre`, `live_music`, `board_games`, `football`, `hiking`, `language_exchange`, `cinema`, `food_drinks`, `art_museums` and `cycling`.
