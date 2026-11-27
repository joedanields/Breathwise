# Prompt Log — Breathwise

Track every change to runtime prompts and output schemas. This becomes the "prompt evolution" section of the LinkedIn post.

## How to log

For each version add:

```
## vX — YYYY-MM-DD — short title
**Changed:** what changed (prompt text / schema / guard / temperature)
**Why:** the problem observed (quote a bad output briefly)
**Result:** checklist from AI_DESIGN.md §9 — scenarios passed (e.g. 6/6), guard first-try pass rate, notable improvements/regressions
```

Also log the main **build-time** prompts used with Claude Code (one line each) in the section at the bottom.

---

## v1 — 2026-11-25 — Initial design

**Changed:** System prompts for `plan` and `chat` as written in `AI_DESIGN.md §6`. Schema `AdvicePlan` v1. Temperature 0.4. Numeric grounding guard with one retry.
**Why:** Baseline. Key design choices: FACTS-only rule, window labels (W1/V1) so the model refers to computed times instead of inventing them, explicit honesty rules (plants, cloth masks, infants), and a per-member risk table supplied as facts.
**Result:** _Pending — run after Phase 6._

---

## v1.1 — 2026-11-27 — Honest impact facts

**Changed:** Plan system prompt rule 11 (`AI_DESIGN.md §6.1`): "If FACTS show a switch increases or doesn't reduce emissions, don't call it a saving; explain any exposure or health benefit instead." `FactsSnapshot.impactFacts` (Zod, `shared/factsSnapshot.ts`) now carries a signed `kgCo2PerWeekDelta` against the current mode (negative = saving, positive = increase), plus a separate `exposureBenefit` category with in-transit exposure ratios (Goel et al. 2015).
**Why:** With India-specific factors, some "greener-sounding" switches add CO₂. Example from the Phase 3 tests: a 10 km two-wheeler commute (3.68 kg CO₂/week) vs metro (4.37 kg/week, which also counts power-station emissions) is +0.69 kg/week. An unsigned "saving" field would invite the model to call that a saving. The metro case is still worth making on health grounds (0.8× vs 1.3× ambient PM2.5 in transit), so that is now a separate, sourced fact.
**Result:** _Pending — run after Phase 6._

---

## Build-time prompts (Claude Code)

| Date | Phase | Prompt (summary) | Outcome |
|---|---|---|---|
| 2026-11-25 | Planning | Generate architecture + feature plan from challenge brief; then produce all project docs | `CLAUDE.md`, `README.md`, `docs/*` |
