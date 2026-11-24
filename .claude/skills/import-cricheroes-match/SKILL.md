---
name: import-cricheroes-match
description: After a matchday, read a Moonwalkers match scorecard from CricHeroes in the built-in browser and turn it into the app's scorecard JSON for upload. Use when the user asks to import, capture or record a match from CricHeroes.
---

# Import a CricHeroes match

The user signs in to CricHeroes **themselves**. Never type, ask for, or store
their password, and never accept cookie/consent banners beyond the most
privacy-preserving option.

## Steps

1. Open https://cricheroes.com in the built-in browser. If a sign-in page shows,
   ask the user to sign in in the pane and say when they are done.
2. Find the match the user named (team profile → Matches), open its
   **Scorecard** tab. Note the match id from the URL (`/scorecard/<id>/...`) —
   it becomes `cricheroes_match_ref`.
3. Read the page with `get_page_text` (not screenshots). For each innings record:
   - team name, total runs/wickets, overs (`"19.4"` style is fine), extras
   - every batter in order: name, position, runs, balls, 4s, 6s, how out,
     `not_out`, and `did_bat: false` for players listed under "Did not bat"
     (give them the remaining positions)
   - every bowler of the fielding side: name, overs, maidens, runs, wickets, wides, no-balls
   - if a player name links to `/player-profile/<id>/...`, put `<id>` in
     `cricheroes_player_id` — this is how names are matched exactly.
4. Write `sportfairsystem/imports/<YYYY-MM-DD>-<opponent>.json` following
   `sportfairsystem/src/import/scorecardSchema.ts` (`source: "cricheroes"`,
   `ours: true` on the Moonwalkers innings, `result` from Moonwalkers' view).
5. Run `npm run validate:scorecard -- imports/<file>.json` from `sportfairsystem/`.
   Fix any reported mismatch by re-reading the page; do not invent numbers.
   If the page itself is inconsistent, tell the user which line.
6. Tell the user the file is ready and that they upload it at
   **Fixtures → (the fixture) → Import scorecard**, where they confirm names.
   Only do the upload yourself if the user asks, and stop at the preview so
   they press **Confirm**.

`imports/` is gitignored; the files contain player names only.
