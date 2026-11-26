# UI / UX — Breathwise

## 1. Design direction

**"Clear sky through haze."** Calm, airy, trustworthy. Soft neutral surfaces, one confident accent, generous spacing, large readable numbers. The AQI colour is the only loud element on screen, and it always comes with a text label and icon.

- Mobile-first (360 px), scales to a two-column dashboard ≥ 1024 px.
- Light and dark themes (`prefers-color-scheme`, user override in Settings).
- Motion: subtle (150–200 ms fades); disabled under `prefers-reduced-motion`.

## 2. Design tokens (`src/styles/index.css`, Tailwind v4 `@theme`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `#F7F9FB` | `#0E1418` | Page |
| `--color-surface` | `#FFFFFF` | `#151D22` | Cards |
| `--color-text` | `#0F1A20` | `#E8EEF2` | Body |
| `--color-muted` | `#55656F` | `#9AABB5` | Secondary text (check ≥ 4.5:1) |
| `--color-accent` | `#0E7C86` | `#4FC3CC` | Primary actions, focus ring |
| `--color-border` | `#E2E8EC` | `#26323A` | Dividers (decorative only, see note) |
| `--color-on-accent` | `#FFFFFF` | `#0E1418` | Text/icons on accent-filled buttons |

AQI category tokens (CPCB-inspired hues; text colour chosen for ≥ 4.5:1 contrast). CSS names: `--color-aqi-<category>` and `--color-on-aqi-<category>`.

| Category | Background | Text on it | Icon |
|---|---|---|---|
| Good | `#237A3C` | white | `smile` |
| Satisfactory | `#8CC63F` | `#0F1A20` | `smile-plus` |
| Moderate | `#F2D21B` | `#0F1A20` | `meh` |
| Poor | `#F28C28` | `#0F1A20` | `frown` |
| Very Poor | `#C0302A` | white | `alert-triangle` |
| Severe | `#8E1B1B` | white | `octagon-alert` |

### Verified contrast (WCAG 2.x relative luminance, checked 2026-11-25)

Good was `#2E9E4F` (3.43:1 with white) and Very Poor was `#E03C31` (4.32:1 with white). Both failed 4.5:1 and were darkened (ADR-009).

| Pair | Light | Dark | Required |
|---|---|---|---|
| text on bg / surface | 16.74 / 17.66 | 15.85 / 14.58 | 4.5 |
| muted on bg / surface | 5.72 / 6.04 | 7.83 / 7.20 | 4.5 |
| accent (links, focus ring) on bg / surface | 4.69 / 4.95 | 8.84 / 8.13 | 4.5 text · 3 ring |
| on-accent on accent (buttons) | 4.95 | 8.84 | 4.5 |
| border on bg / surface | 1.17 / 1.24 | 1.41 / 1.30 | n/a (decorative) |

| AQI label (text on category bg) | Ratio |
|---|---|
| Good: white on `#237A3C` | 5.36 |
| Satisfactory: `#0F1A20` on `#8CC63F` | 8.63 |
| Moderate: `#0F1A20` on `#F2D21B` | 11.78 |
| Poor: `#0F1A20` on `#F28C28` | 7.20 |
| Very Poor: white on `#C0302A` | 5.68 |
| Severe: white on `#8E1B1B` | 9.04 |

Notes:
- **Category swatches vs page background** are below 3:1 for Satisfactory (1.94), Moderate (1.42) and Poor (2.33) in light mode, and Severe (2.05) in dark mode. This is acceptable because a swatch never carries meaning alone: it always contains the category text label (contrast above) and an icon. Do not use a bare colour dot without its label.
- **`--color-border` is for decorative dividers only.** Form-control boundaries (inputs, checkboxes, selects) need ≥ 3:1 against their background, so use `--color-muted` for those borders.

Typography: `Inter Variable` (UI) self-hosted via `@fontsource-variable/inter`; numeric displays use tabular figures. Base 16 px, scale 1.25.

Icons: `lucide-react` (tree-shaken).

## 3. Screens

### 3.1 Onboarding (3 short steps, progress indicator "Step 1 of 3")

1. **Where are you?** — "Use my location" button + search combobox. "Try a sample household" link opens the scenario picker.
2. **Who's at home?** — persona chips (multi-select) → member rows (label, age band select, condition checkboxes, optional outdoor activity + usual time + duration). "Add person" button.
3. **Your day & home** — commute (mode, times, km, days/week), home (type, purifier y/n + CADR + room size, AC), masks available, cooking fuel, response language. All optional; "Skip for now".

Finish → Dashboard. Everything editable later via "Household" sheet.

### 3.2 Dashboard

```
┌ Header: Breathwise · [📍 Lucknow, Uttar Pradesh ▾] · [Household] [Settings] ┐
├──────────────────────────────────────────────────────────────────────────────┤
│ LiveAqiCard                         │ WeatherStrip                           │
│  India AQI (estimated) 312          │  14°C · 82% RH · wind 4 km/h NW        │
│  [icon] Very Poor  · PM2.5 dominant │  "Calm, cold air is trapping smog"     │
│  US AQI 245 (reference)             │  (copy from rules, not AI)             │
│  PollutantGrid (6 tiles)            │                                        │
│  FreshnessBar: Reading 6:30 pm IST · fetched 3 min ago · Open-Meteo/CAMS ⓘ   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ForecastTimeline (48 h, hour cells, W1/W2 and V1 highlighted)  [Table view]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Plan: headline + summary                                                     │
│ Tabs: [Today's routine] [Indoor air] [Impact & why]                          │
│   ActionCard × n  (priority badge · title · when · for · Why · Impact)       │
│ Member notes · "Seek care if…" callout                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Ask Breathwise] → ChatPanel (sheet on mobile, side panel on desktop)        │
└ Footer: attribution · About data · Not medical advice ───────────────────────┘
```

Desktop ≥ 1024 px: left column = live data + timeline; right column = plan + chat.

### 3.3 Sheets / dialogs

- **Household** (edit profile)
- **Settings**: theme, language, "Use my own Gemini key" (password-type input, show/hide, clear), remember location toggle, "Clear all my data"
- **About data**: sources, model resolution note, NAQI method, attribution, links
- **Try a scenario**: list from `features/profile/scenarios.ts`

## 4. Component specs

| Component | Notes |
|---|---|
| `LocationSearch` | Radix-free ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox options); arrow keys + Enter + Esc |
| `LiveAqiCard` | Value in `<data>`; category text always visible; `aria-live="polite"` region announces "India AQI updated: 312, Very Poor" on refresh |
| `PollutantGrid` | Each tile: name (with `<abbr title>`), value, unit, small band label |
| `FreshnessBar` | Relative time updates every minute; turns into warning style when stale: the **reading time** is > 90 min old (not the fetch time; India readings are hourly) |
| `ForecastTimeline` | Horizontal scroll on mobile; each hour cell has `aria-label="7 pm, PM2.5 182, Very Poor"`; window highlights have text badges W1/W2/V1; "Table view" toggles an accessible `<table>` |
| `PlanTabs` | Radix Tabs; tab panels lazy |
| `ActionCard` | `<article>` with heading; priority as text badge ("High priority"); Why/Impact as labelled paragraphs |
| `ChatPanel` | `<form>` with labelled textarea, char counter, submit; message list `role="log"` `aria-live="polite"` |
| `ByokField` | `type="password"`, `autocomplete="off"`, never echoed in logs |
| Loading | Skeletons + visually hidden "Loading live air quality…" status |
| Errors | Inline cards with clear message + Retry button that receives focus |

## 5. Content & tone

- Calm and specific: "PM2.5 is lowest between 2 and 4 pm (W1). Move Aarav's park time there."
- Avoid fear words ("toxic", "deadly"). Avoid jargon; explain PM2.5 once ("tiny particles that reach deep into lungs").
- Always pair a restriction with an alternative ("Skip the 6:30 am walk → try 15 minutes of indoor stretching, or a short walk in W1").
- Disclaimer in footer and plan: "General guidance, not medical advice."

## 6. Accessibility checklist (WCAG 2.2 AA)

- [ ] Skip link to main content
- [ ] Landmarks: `header`, `nav`, `main`, `footer`; one `h1` per view; logical heading order
- [ ] All inputs have visible `<label>`s; errors linked via `aria-describedby`
- [ ] Colour never the sole carrier of meaning (category text + icon)
- [ ] Text contrast ≥ 4.5:1, UI component/focus contrast ≥ 3:1
- [ ] Visible focus ring (2 px accent, offset) on every interactive element
- [ ] Target size ≥ 24×24 px (aim 44×44 on touch)
- [ ] Keyboard: everything operable; no traps; dialogs return focus
- [ ] Live regions for AQI refresh, plan ready, chat replies
- [ ] `prefers-reduced-motion` respected
- [ ] `lang` attribute set; switches to `hi`/`bn`/`ta`/`mr` for AI text blocks when language changes
- [ ] Zoom to 200% and 320 px reflow without loss
- [ ] axe: zero serious/critical violations (CI)

## 7. Responsive breakpoints

`sm 640` · `md 768` · `lg 1024` · `xl 1280`. Test at 360, 768, 1280.
