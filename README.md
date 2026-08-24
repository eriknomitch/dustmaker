# DUSTMAKER

A turn-based, asynchronous reimagining of DEFCON: 2–6 commanders secretly
submit orders, then watch one simultaneous WEGO resolution. Cold War war room
feel — austere, procedural, quietly horrifying.

**Play the demo:** open `prototype.html` in a browser (round 11, DEFCON 1,
you command Russia mid-first-exchange). The demo is a single self-contained
file — the full game is a web app (see the spec's §6 architecture).

**Run the engine tests:**

```bash
cd engine
npm install
npm test
```

## What's here

| | |
|---|---|
| `DUSTMAKER.md` | The spec (v0.3) — normative game rules, UX, AI roles, architecture. |
| `engine/` | Pure deterministic TypeScript WEGO engine; golden tests mirror spec §2.9. |
| `prototype.html` | Playable single-file visual prototype of the war room. |
| `PRODUCT.md` | The brief: quality bar, ranked gaps, constraints, deliberate decisions. |
| `prompt.md` | The gauntlet-loop prompt this repo is built against. |
| `AGENTS.md` | Guidelines for the agents doing the building. |
| `docs/` | Spec review report and implementation plan. |

Structure and process modelled on
[workmelt](https://github.com/eriknomitch/workmelt); gauntlet-loop technique
by [Matt Shumer](https://github.com/mshumer). Design from Introversion's
[DEFCON](https://www.introversion.co.uk/defcon/).
