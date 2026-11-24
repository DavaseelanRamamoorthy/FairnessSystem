---
name: import-spond-availability
description: At the availability deadline, read who answered a Moonwalkers Spond event and write the app's availability snapshot JSON. Use when the user asks to import, capture or snapshot availability from Spond.
---

# Snapshot Spond availability

The snapshot decides who is **on time**: the first snapshot imported for a
fixture marks every "yes" as on time; answers added later count as late. So
take it at (or just after) the deadline the organiser set on the fixture.

The user signs in to Spond **themselves**. Never type, ask for, or store their
password.

## Steps

1. Open https://spond.com in the built-in browser; ask the user to sign in if needed.
2. Open the event the user named. Read the response lists with `get_page_text`:
   Accepted → `yes`, Declined → `no`, "Maybe"/tentative → `maybe`,
   no response → `unanswered`. Use names exactly as Spond shows them.
3. Write `sportfairsystem/imports/spond-<YYYY-MM-DD>.json` following
   `sportfairsystem/src/import/spondSchema.ts`, with `captured_at` = now in ISO
   format with timezone, and the event id from the URL as `spond_event_ref` if visible.
4. Run `npm run validate:spond -- imports/<file>.json` from `sportfairsystem/`.
5. Tell the user to upload it at **Fixtures → (the fixture) → Import availability**
   and resolve any new names there (each name only needs resolving once).

If Spond offers an export of the responses, the user can upload that file
instead; convert it to the same JSON shape.
