# Progress — Breathwise

Resume point for the build. Updated after every task. Times are IST.

- **Deadline:** submission 12:00 IST 28 Nov 2026; stable deploy by 10:30.
- **Production:** https://breathwise.pages.dev (Git-connected; every push to `main` deploys).

## Current state

| | |
|---|---|
| Current phase | Phase 8 — Hardening |
| Last commit | see `git log -1` |
| Next task | Full e2e all browsers, coverage, bundle (lazy sheets?), Lighthouse, contrast tokens, README screenshots |
| Timebox | P4 02:30 · P5 05:00 · P6 07:30 · P7 09:00 · P8 10:15 · P9 10:45 |

## Done

- Phases 1–3 (CI green at `9f57cc3`).
- Step 0 (00:15): `.claude/settings.local.json` (git-ignored), KV namespaces `RATE_LIMIT_KV` (prod `250e22da…`) and `RATE_LIMIT_KV_PREVIEW` (`ffaf36aa…`) in `wrangler.toml`, ALLOWED_ORIGINS with `*.breathwise.pages.dev` suffix rule.

- Phase 4 (00:17–00:55): carAc + 1 h window gap + WFH exposure rule; stable hash; Zod-validated local stores; S1–S6; onboarding; Household/Settings/About/sample sheets; clear data; e2e with CSP check (found and fixed: Zod eval probe → jitless; Radix style injection → `style-src 'unsafe-inline'`; header overflow at 360 px).

- Phase 5 (00:57–01:10): dashboard replaces the preview page; fixed grid overflow at 360 px (min-w-0) and table scroll-region focus.

- Phase 6 (01:10–01:50): shared advice engine, /api/advise with SECURITY §3 checks, fallback plan, plan tabs, BYOK, prompt v1.3 (S1–S6 checklist, grounded 7/7). Production verified at end of Phase 5: Lucknow live India AQI 329 Very Poor, CSP headers live, 0 CSP errors.

- Phase 7 (01:50–02:05): chat with E6/E7 verified live; chat prompt v1.1.

## Decisions (this run)

- Model switched to `gemini-3.5-flash-lite` everywhere (ADR-013): `gemini-3.8-flash` did not answer within 60 s. Local `.dev.vars` still says 3.8; local runs use `--binding GEMINI_MODEL=gemini-3.5-flash-lite`.
- Phase 4 decisions accepted by the owner: W1/W2 and X1/X2 at least 1 h apart; WFH alternative renamed "One fewer commuting day a week (e.g. working from home)" (id `co2_wfh_extra_day`); S4 unchanged; remember location on by default (2 dp); WFH exposure benefit only when the commute ratio > 1; `carAc` S1 `windows_open`, S6 `ac_closed`.

## Open issues

- Local Firefox (Windows, software GL) crashes inside axe on the dashboard page; CI Firefox (Linux) passes.
- Owner: optionally update the local `.dev.vars` GEMINI_MODEL to `gemini-3.5-flash-lite` (I don't edit that file).

## Run notes

- Run npm/npx from PowerShell (Git Bash loads React/vitest twice on this machine).
- E2E and CI never call live Gemini or Open-Meteo.
