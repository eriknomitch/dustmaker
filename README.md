# DUSTMAKER

A turn-based, asynchronous reimagining of DEFCON: 2–6 commanders secretly
submit orders, then watch one simultaneous WEGO resolution. Cold War war room
feel — austere, procedural, quietly horrifying.

Everything is seeded and deterministic: one seed per round, no `Math.random()`,
no wall-clock simulation. The resolution log *is* the replay script.

## Play it

**Web client (current work — single-player vs. three AI doctrines):**

```bash
pnpm install     # once, at the repo root (pnpm workspace)
pnpm dev         # open the printed URL
```

You command North America (seat 0). Staggered, Turtle and Alpha doctrine bots
hold Russia, Europe and South Asia and move when you commit. Round 1: use
**AUTO-PLACE ALL**, then click units on the map to queue orders (move, launch,
sortie, take-off), or ask the **Chief of Staff** panel to *draft my turn* —
it proposes a full validated order set that you approve, and accepted orders
queue with a `VIA AI` tag. Commit stays manual. After commit the resolution
plays back as an animated replay (moves slide, missiles fly arcs, interceptions
flash amber, impacts ring red), then the SITREP opens.

Map: drag to pan, wheel to zoom, WASD/arrows pan, Q/E zoom, space deselects.

The Chief of Staff is scripted for now (status, fog-filtered enemy intel,
arsenal count, rules/DEFCON answers, turn drafting) — the LLM-backed version
is spec §5.1 / milestone M4.

**Single-file demo:** open `prototype.html` in a browser (round 11, DEFCON 1,
you command Russia mid-first-exchange). Its inlined engine predates `engine/`
and is legacy — don't extend it.

## Engine

`engine/` is the engine of record: pure deterministic TypeScript,
state-in/state-out, no I/O. The web client imports it directly from
`../../engine/src`; the M2 server will run the same module.

```bash
pnpm install     # once, at the repo root (pnpm workspace)
pnpm test                                       # vitest — sub-second
pnpm harness -- --doctrines alpha,turtle --seed 7 --mode default
pnpm tournament -- --games 100                  # doctrine round-robin, all score modes
```

- `test/edgecases.test.ts` mirrors spec §2.9 row-for-row — the table and the
  suite are the same artifact and must stay identical.
- `test/specfixes.test.ts` covers the conformance gaps found in the spec audit
  (sortie route overflights, one-order-per-unit, mobile ghost markers, bomber
  SRBM rearm).
- `src/bots.ts` — the three doctrines (Alpha: dump the arsenal at DEFCON 1;
  Staggered: 3-missile waves; Turtle: max Defend, second strike only).
  Tournament findings are in `docs/repos/m0-tournament-results.md` — notably,
  the all-out alpha strike is *not* dominant.

## What's here

| | |
|---|---|
| `DUSTMAKER.md` | The spec (v0.3) — normative game rules, UX, AI roles, architecture. A rule change is a spec edit first, then code. |
| `engine/` | Deterministic WEGO engine, bots, CLI harness, doctrine tournament, golden tests. |
| `web/` | Vite + PixiJS client on the real engine: geographic map with real coastlines, order UX, Chief of Staff comms, animated resolution replay. |
| `prototype.html` | Legacy playable single-file demo of the war room. |
| `PRODUCT.md` | The brief: quality bar, ranked gaps, constraints, deliberate decisions. |
| `prompt.md` | The gauntlet-loop prompt this repo is built against. |
| `AGENTS.md` | Guidelines for the agents doing the building — read first. |
| `docs/` | Spec review report, M0 implementation plan, tournament results. |

## Status

Milestones per spec §9:

- **M0 — Engine:** done. Bots complete 25-round games headlessly; harness and
  tournament tooling in place.
- **M1 — Local web game:** done and extended past the hotseat exit condition
  into a single-player vantage with AI opponents, interactive map and replay.
- **M2 — Rooms and live multiplayer** (Workers + GameRoom Durable Object,
  lobby, WebSocket sync, server-owned fog): next. Fog filtering in the client
  is currently client-side and will move to the server.
- **M3 — Async play, M4 — AI layer, M5 — AI opponents & polish:** not started.
  The client's scripted Chief of Staff and doctrine bots are placeholders for
  M4/M5.

## Constraints (from `PRODUCT.md`, non-negotiable)

- Runs in the browser. Any framework or renderer is acceptable.
- The product is a served client + server (Cloudflare-first, one Durable
  Object per game room). The single-file prototype is a demo, not the shape.
- Deterministic everywhere — that's what makes replays, golden tests and
  pixel gates meaningful.
- 60 fps on integrated graphics; responsive 390 px → 2560 px, desktop primary.

Structure and process modelled on
[workmelt](https://github.com/eriknomitch/workmelt); gauntlet-loop technique
by [Matt Shumer](https://github.com/mshumer). Design from Introversion's
[DEFCON](https://www.introversion.co.uk/defcon/).
