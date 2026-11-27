# Progress — Breathwise

Resume point for the build. Updated after every task. Times are IST.

- **Deadline:** submission 12:00 IST 28 Nov 2026; stable deploy by 10:30.
- **Production:** https://breathwise.pages.dev (Git-connected; every push to `main` deploys).

## Current state

| | |
|---|---|
| Current phase | Phase 4 — Profile & onboarding |
| Last commit | see `git log -1` |
| Next task | Profile schema additions (carAc), then stores + onboarding |
| Timebox | P4 02:30 · P5 05:00 · P6 07:30 · P7 09:00 · P8 10:15 · P9 10:45 |

## Done

- Phases 1–3 (CI green at `9f57cc3`).
- Step 0 (00:15): `.claude/settings.local.json` (git-ignored), KV namespaces `RATE_LIMIT_KV` (prod `250e22da…`) and `RATE_LIMIT_KV_PREVIEW` (`ffaf36aa…`) in `wrangler.toml`, ALLOWED_ORIGINS with `*.breathwise.pages.dev` suffix rule.

## Decisions (this run)

- Phase 4 decisions accepted by the owner: W1/W2 and X1/X2 at least 1 h apart; WFH alternative renamed "One fewer commuting day a week (e.g. working from home)" (id `co2_wfh_extra_day`); S4 unchanged; remember location on by default (2 dp); WFH exposure benefit only when the commute ratio > 1; `carAc` S1 `windows_open`, S6 `ac_closed`.

## Open issues

- None.

## Run notes

- Run npm/npx from PowerShell (Git Bash loads React/vitest twice on this machine).
- E2E and CI never call live Gemini or Open-Meteo.
