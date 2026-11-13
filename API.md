# API contract

Base URL: `http://localhost:8000` (interactive docs at `/docs`). Models live in `backend/schemas/` (`common.py`, `lease.py`, `events.py`); this file must match them.

- **Auth.** "JWT" means the header `Authorization: Bearer <Auth0 access token>`. When `APP_ENV=dev` only, `X-Dev-User: <name>` can replace it. "Public" routes need no auth.
- **Errors.** Errors are always `{"detail": "..."}`: 401 for a missing or bad token, 404 for an unknown id, 422 for an invalid body (FastAPI validation; there `detail` is a list), and 503 when price data is unavailable (empty listings table or database error).
- **IDs.** All ids are UUID strings. Times are ISO 8601 with a timezone.
- **Data.** All endpoints are real and read the database; none are mocked.
- **Slots.** The availability slots are `weekday_morning`, `weekday_evening`, `weekend_morning`, `weekend_afternoon` and `weekend_evening`.

The endpoint list was inferred from the `api.js` functions in docs/PLAN.md prompt 5, because PLAN.md has no endpoint tables. Change it here first, then in code.

## Me and health (shared)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | Public | – | `{"status": "ok"}` | A |
| GET | `/health/db` | Public | – | `{"status": "ok", "db": true}` | A |
| GET | `/me` | JWT | – | `{"id": "…", "auth0_sub": "dev\|alice", "display_name": "alice", "email": null, "is_student": false, "created_at": "2026-11-13T13:38:42Z"}` | A |

## Lease (Feature A)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
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
| POST | `/events/{id}/join` | JWT | – | `{"event_id": "e100…01", "status": "waiting"}` | B |
| POST | `/events/{id}/leave` | JWT | – | `{"event_id": "e100…01", "status": "left"}`; 404 `{"detail": "you have not joined this event"}` | B |
| POST | `/events/{id}/match` | JWT | – | `{"event_id": "e100…01", "groups": [Group], "unmatched_count": 0}` | B |
| GET | `/events/{id}/my-group` | JWT | – | `Group` (below); 404 `{"detail": "not in a group yet"}` | B |

An unknown event id gives 404 `{"detail": "event not found"}`.

- **Join.** Joining twice changes nothing. Joining again after leaving puts you at the back of the waiting list.
- **Match.** Groups everyone who is `waiting` for the event (3 to 5 per group, longest-waiting first) and saves the groups. It returns only the groups made by this call; `unmatched_count` is how many people are still waiting. Fewer than 3 waiting gives `"groups": []`.
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
  "my_status": null
}
```

`my_status` is `waiting`, `grouped`, `left` or `null` (never joined, or not logged in).

`Group` (3 to 5 members):

```json
{
  "id": "f1000000-0000-4000-8000-000000000001",
  "event_id": "e1000000-0000-4000-8000-000000000001",
  "meet_at": "2026-11-18T18:30:00+02:00",
  "note": "Meet at the entrance 30 minutes before.",
  "members": [
    {"user_id": "c100…02", "display_name": "Andrei", "is_student": true}
  ],
  "why_you_match": "You all like board games and live music, and are free on weekday evenings."
}
```

## Profile (Feature B)

| Method | Path | Auth | Request | Response example | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/profile/interests` | Public | – | `[{"id": "b100…01", "slug": "theatre", "label": "Theatre"}, ...]` | B |
| GET | `/profile` | JWT | – | `ProfileOut` (below) | B |
| PUT | `/profile` | JWT | `{"display_name": "Mei", "interest_slugs": ["board_games", "theatre"], "availability": ["weekday_evening"]}` | `ProfileOut`; 422 `{"detail": "unknown interest: x"}` | B |

`ProfileOut`:

```json
{
  "display_name": "Mei",
  "is_student": true,
  "interests": [{"id": "b100…03", "slug": "board_games", "label": "Board games"}],
  "availability": ["weekday_evening", "weekend_afternoon"]
}
```

`PUT /profile` replaces the whole profile. The seeded interest slugs are `theatre`, `live_music`, `board_games`, `football`, `hiking`, `language_exchange`, `cinema`, `food_drinks`, `art_museums` and `cycling`.
