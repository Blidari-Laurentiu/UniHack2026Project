# Sample leases

These leases are **fictional**, made up for testing. Every person, address and contract number is invented. They contain no real personal data, and the ID numbers are deliberately fake placeholders:

- `CNP 0000000000000` (13 digits, so the CNP regex should match it)
- `IBAN RO00 XXXX 0000 0000 0000 0000` (written with spaces, as it often is in real contracts)
- `CI seria XX nr. 000000` and `pașaport nr. X0000000`

Every placeholder should come out as `[REDACTED]` after `redact()` in `backend/services/gemini.py`. These leases are not legal templates, and nothing here is legal advice.

| File | Purpose | What the analysis should find |
| --- | --- | --- |
| `demo_ro.txt` | Main demo lease (Mei's story). 2 rooms, Circumvalațiunii, 500 EUR. Matches the `API.md` example. | Risky clauses: deposit kept at the owner's sole discretion without justification (5.2), rent changed at any time by a verbal notice (4.3), owner enters any time without notice and keeps a key (7.3). Also: tenant pays all repairs including structural ones (7.2), lopsided termination (tenant pays 3 months' rent, owner gives 5 days' notice, 8.2 and 8.3), 2% per day late fee (4.4), cash payment option. |
| `fair_ro.txt` | Control case. 1 room, Iosefin, 320 EUR. | Low risk, no missing key clauses. It has a handover report with photos and meter readings, a deposit returned within 30 days with itemised deductions, rent fixed for 12 months, 48-hour notice before entry and a 30-day notice period for both sides. |
| `missing_clauses_ro.txt` | Missing-clause case. 3 rooms, Fabric, 550 EUR. | Missing: handover report (proces-verbal de predare-primire) and inventory, notice period or early termination terms, the deadline and conditions for returning the deposit, who pays for repairs, and the rules for owner access. Few explicitly risky clauses. |

When the Gemini service caches a result (`DEMO_CACHE=1`), it goes in `demo_ro.json` next to `demo_ro.txt`.
