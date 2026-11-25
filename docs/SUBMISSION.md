# Submission Guide — Prompt Wars Virtual, Challenge 6

> Only your **final** submission counts, not your best one, and you get at most 3 attempts. Submit only when everything below is checked. Use earlier attempts deliberately (e.g. attempt 1 = full working version, attempt 2 = polish after leaderboard feedback). Never submit a regression as the last attempt.

## 1. Pre-submission checklist

### Required components
- [ ] Working deployed URL (production, not a preview hash)
- [ ] Public GitHub repo with README, `docs/TEST_SCENARIOS.md`, clear setup steps
- [ ] Demo video (screen recording) showing all features working
- [ ] LinkedIn post published, linked in submission

### Problem-statement alignment
- [ ] Live outdoor data (AQI, PM2.5, PM10, NO₂, SO₂, O₃, CO) from a public API, fetched at runtime
- [ ] Source name + reading time + fetched-at visible
- [ ] No predefined or LLM-generated AQI anywhere (grep the repo for hard-coded values outside `tests/`)
- [ ] Low-emission routine suggestions (commute, carpool, errands, rescheduling)
- [ ] Indoor guidance (purifier, ventilation timing, plants, sealing/filtration)
- [ ] Every recommendation explains *why* + impact
- [ ] Personas: parents, seniors, commuters, students all supported
- [ ] Any location in India (GPS + search)
- [ ] Works on mobile and desktop

### Engineering quality (auto-scored)
- [ ] No secrets in the repo or git history (`gitleaks detect`)
- [ ] `npm run check` green; coverage ≥ 80%; E2E green
- [ ] axe 0 serious/critical; Lighthouse a11y 100
- [ ] Clean structure, no dead code, no `console.log` in production paths
- [ ] Dependencies minimal; `npm audit` clean

## 2. Demo video script (≈ 3–4 min)

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing | "Breathwise turns live air-quality data into a personal plan for your household, anywhere in India." |
| 0:15 | Use my location → place resolves | Pan-India detection; also show search for a second city |
| 0:35 | Onboarding: add child with asthma + senior | Personalisation inputs, ~30 seconds |
| 1:00 | Live card + FreshnessBar → About data | "Live Open-Meteo/CAMS data, reading time and fetch time shown. India AQI is computed in code, not by AI." |
| 1:30 | Timeline with W1/V1 | "Cleanest hours calculated from the hourly forecast." |
| 1:50 | Plan → Routine tab | Per-member advice, why + impact |
| 2:15 | Indoor tab | Purifier/ventilation/sealing advice that adapts to the home |
| 2:35 | Impact tab | Computed CO₂ savings for the commute switch |
| 2:55 | Chat: "Can Aarav play outside at 5 pm?" then an injection attempt | Grounded answer; refusal |
| 3:20 | Block `/api/advise` in DevTools → fallback plan | Graceful degradation |
| 3:35 | Mobile viewport + keyboard navigation | Responsive + accessible |
| 3:50 | Repo: tests, CI, docs | Close |

Record at 1080p, cursor highlighting on, no secrets visible (hide `.dev.vars`, Settings key field).

## 3. LinkedIn post outline

**Hook:** Every winter, an AQI number shows up on your phone. Breathwise tells you what to *do* about it — for your child, your parents, your commute.

**What I built:** 2–3 lines on the three pillars + pan-India + personas. Link to app + repo + video.

**AI tools I chose & why**
- Claude Code — spec-driven development from `docs/` (PRD → architecture → phased plan)
- Gemini (Flash) — runtime reasoning: interprets live data into personalised, explained advice with structured JSON output

**Architecture (one line + diagram image):** React SPA on Cloudflare Pages → live Open-Meteo data → deterministic NAQI and time-window engine → Gemini via a secured Pages Function → validated plan.

**Prompt evolution:** 2–3 bullets from `PROMPT_LOG.md` (e.g. v1 invented numbers → added FACTS-only rule + grounding guard; v2 generic advice → per-member risk facts; v3 …).

**What GenAI handled vs. what I built**

| GenAI | Me (with Claude Code as pair) |
|---|---|
| Personalised plan wording & reasoning | NAQI computation, time windows, risk tables, emissions maths |
| Chat answers | Data pipeline, validation, proxy security, rate limiting |
| Code scaffolding & tests drafts | Architecture decisions, review, test cases, accessibility pass |

**Lesson:** "Let code compute and AI interpret" — the reliability gain was worth it.

**Hashtags:** #PromptWars #GenAI #Gemini #ClaudeCode #AirQuality #BuildInPublic

## 4. Submission form fields (fill in)

- App URL:
- GitHub URL:
- Video URL:
- LinkedIn post URL:
- Attempt number: 1 / 2 / 3
