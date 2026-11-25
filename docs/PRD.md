# Product Requirements — Breathwise

## 1. Problem

Every winter, cities across India — not only Delhi — face severe smog. Families see an AQI number but don't know what to *do*: Is the park safe for my child at 5 pm? Should my father skip his morning walk? Should I open the windows? Does my purifier setting matter? Generic "stay indoors" advice ignores the household's actual routine, health conditions and resources.

## 2. Goal

Give any household in India a **personalised, live, explained** plan for the day that reduces their exposure and their own emissions — in under a minute.

## 3. Success criteria (for the challenge)

| Criterion | How Breathwise meets it |
|---|---|
| Real-time data only | Live Open-Meteo AQ + weather per request; no static datasets; source + timestamps shown |
| No LLM-generated AQI | NAQI computed in code; AI schema has no numeric AQI fields; numeric-grounding guard |
| Low-emission routines | Routine pillar: time-shifted activities, commute alternatives, carpool, errand bundling |
| Indoor guidance | Indoor pillar: purifier schedule, ventilation windows, sealing, cooking, plants (honestly) |
| Impact justification | Every action has `why` + `impact`; emissions numbers computed in code |
| Personalisation | Household profile with personas, ages, conditions, commute, home, resources |
| Pan-India | GPS + search across India; no hard-coded city |
| UX on mobile & desktop | Mobile-first responsive, WCAG 2.2 AA |
| Evaluator speed | One-click test scenarios; works without evaluator's own key |

## 4. Personas

| Persona | Key questions | Sensitivities |
|---|---|---|
| **Parent with young children** | Can my child play outside? When? School-run exposure? Mask for kids? | Children breathe more air per kg body weight; under-2s should not wear masks |
| **Senior citizen** | Is my morning walk safe? What should I do indoors? | Heart/lung conditions more likely; morning winter smog peaks |
| **Commuter / professional** | Best route/mode/time? Which mask? Office air? | Long exposure on two-wheelers / walking legs |
| **Student** | Sports practice timing? Campus activity? | High-exertion outdoor activity |
| **Mixed household** | One plan that respects everyone | Advice must be per-member where it differs |

## 5. User stories & acceptance criteria

### US-1 Location
As a user I can detect my location or search for any place in India.
- AC1: "Use my location" requests browser geolocation; on success shows city/district + state.
- AC2: Search returns Indian places only (`countryCode=IN`), keyboard-navigable, debounced.
- AC3: If permission is denied or fails, a clear message and the search box are shown.
- AC4: If coordinates resolve outside India, show "Breathwise currently supports locations in India" and keep search available.
- AC5: Last location is remembered locally (opt-out in Settings).

### US-2 Household profile
As a user I can describe my household in ≤ 60 seconds.
- AC1: Choose one or more personas; add members with age band and optional conditions (asthma, COPD, heart disease, pregnancy, allergies, none).
- AC2: Optional: commute mode, departure/return times, one-way distance; outdoor activity type + usual time + duration.
- AC3: Optional: home type, purifier (yes/no, CADR if known, room size), masks available (N95/FFP2, surgical, cloth, none), cooking fuel.
- AC4: Profile stored only in `localStorage`; "Clear my data" removes it.
- AC5: Every field has a visible label and is usable by keyboard and screen reader.

### US-3 Live air-quality view
- AC1: Shows India AQI (estimated), category label + icon + colour, dominant pollutant, pollutant grid (PM2.5, PM10, NO₂, SO₂, O₃, CO) with units.
- AC2: Shows US AQI from the API as a secondary reference.
- AC3: Shows source name, reading time (local), "fetched N min ago", and the modelled-estimate note with attribution.
- AC4: Data auto-refreshes every 15 min while visible; a stale warning appears if data is > 90 min old or the fetch fails.
- AC5: Weather context: temperature, humidity, wind speed/direction.

### US-4 Forecast timeline
- AC1: 48-hour timeline of hourly PM2.5 band, current hour marked.
- AC2: Best outdoor window(s) and best ventilation window(s) highlighted, labelled in text, computed in code.
- AC3: Timeline has an accessible table alternative.

### US-5 Personalised plan (AI)
- AC1: Plan has three tabs: **Today's routine**, **Indoor air**, **Impact & why**.
- AC2: Each action card shows: title, when (if time-bound), who it's for, why, impact, priority.
- AC3: Plan references only computed windows and snapshot values; no invented numbers (guard enforced).
- AC4: Plan generation is cached per (location, hour, profile hash, language); regenerate button available.
- AC5: If AI fails, a rules-based fallback plan is shown with a notice.
- AC6: Loading state is announced to screen readers.

### US-6 Follow-up chat
- AC1: Ask a free-text question (≤ 500 chars) about today's air and plan.
- AC2: Answers use the same snapshot; off-topic or unsafe requests are politely declined.
- AC3: Conversation keeps the last 6 turns only; not persisted.

### US-7 Evaluator scenarios
- AC1: "Try a scenario" menu loads a predefined **profile + location** (never predefined AQI).
- AC2: Scenarios listed in `docs/TEST_SCENARIOS.md` match the in-app list.

### US-8 Settings
- AC1: Toggle "Use my own Gemini key" (stored in `sessionStorage`, masked, clear button).
- AC2: Response language: English (default), Hindi, Bengali, Tamil, Marathi (stretch).
- AC3: Clear all local data.

## 6. Functional requirements

- **FR-1** Fetch current + hourly air quality (`past_days=1`, `forecast_days=3`, `timezone=auto`).
- **FR-2** Fetch current + hourly weather for the same coordinates in parallel.
- **FR-3** Compute NAQI (CPCB method) from rolling averages; expose sub-indices and dominant pollutant.
- **FR-4** Compute hourly PM2.5 band series, trend (rising/falling/steady), best outdoor windows (by activity duration), ventilation windows, worst hours.
- **FR-5** Compute persona-aware risk level per household member.
- **FR-6** Compute emissions deltas for commute alternatives using cited emission factors.
- **FR-7** Build `FactsSnapshot`; call `/api/advise` (or BYOK direct) for plan/chat; validate response.
- **FR-8** Numeric-grounding guard on AI text; retry once then fall back.
- **FR-9** Rules-based fallback plan from the same snapshot.
- **FR-10** Display provenance and attribution on every data view.

## 7. Non-functional requirements

- **Performance:** LCP < 2.5 s on mid-range mobile (4G); initial JS < 200 KB gzip; AI plan < 8 s p50.
- **Reliability:** graceful degradation when any API fails; no blank screens.
- **Security:** see `SECURITY.md`; zero secrets client-side except user's own BYOK in session.
- **Privacy:** no accounts, no analytics with PII, profile stays on device; coordinates rounded to 2 decimals before sending to the AI.
- **Accessibility:** WCAG 2.2 AA; axe has zero serious/critical violations.
- **Browser support:** last 2 versions of Chrome, Edge, Firefox, Safari; Android Chrome; iOS Safari.

## 8. Out of scope (v1)

User accounts, push notifications, indoor sensor integrations, ground-station (CPCB) data ingestion, route maps, native apps.

## 9. Stretch goals (only after all phases are green)

1. Regional-language output (Hindi, Bengali, Tamil, Marathi).
2. "Compare two places" (e.g. home vs office).
3. Shareable plan summary (copy-to-clipboard text).
4. PWA install + offline last-plan view (clearly marked stale).
