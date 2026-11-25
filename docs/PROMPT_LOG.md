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

## Build-time prompts (Claude Code)

| Date | Phase | Prompt (summary) | Outcome |
|---|---|---|---|
| 2026-11-25 | Planning | Generate architecture + feature plan from challenge brief; then produce all project docs | `CLAUDE.md`, `README.md`, `docs/*` |
