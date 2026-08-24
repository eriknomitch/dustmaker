# DUSTMAKER — product brief

The experience-side brief: the quality bar, the ranked gaps, and the
deliberate decisions. The **rules of record** live in `DUSTMAKER.md` (the
spec) and `engine/` (the deterministic engine and its golden tests) — where
this brief and the spec disagree on a game rule, the spec wins.

## Pitch

A turn-based, asynchronous reimagining of DEFCON: global thermonuclear war as
a WEGO strategy game where 2–6 commanders secretly submit orders, then watch
one simultaneous resolution. The feel is a Cold War war room — austere,
procedural, quietly horrifying; the AI Chief of Staff and teletype SITREPs
should feel like commanding a staff, not using an app.

## The bar

- **DEFCON (Introversion, 2006)** — visuals and tone: neon vector map on
  black, missile arcs, shrinking city diamonds, beautiful apocalypse.
  **Primary reference.**
- **Norco / Alien: Isolation terminals** — diegetic UI feel: every panel reads
  as military hardware, not a website.
- **Neptune's Pride** — pacing: slow-burn async betrayal; one meaningful
  decision per session that gnaws at you until the round resolves.

## Core loop

Read SITREP + resolution log → inspect map, chat/delegate with the AI Chief of
Staff → queue one order per unit (move, mode-switch, scout, launch) → commit
blind → watch simultaneous replay (launch, intercept, impact) → scores shift
(+2/megadeath inflicted, −1 suffered). The game ends via the spec's Victory
Countdown (80% of all warheads launched or destroyed, plus 3 rounds) or at the
round cap; highest score wins. The demo simulates round 11, DEFCON 1, player
as Russia mid-first-exchange.

## Current state (at prototype commit)

**Working in `prototype.html`:** canvas vector map (real Natural Earth
coastlines, 38-zone graph), pan/zoom, unit selection with rule-validated
contextual orders, seeded deterministic resolution engine (inlined —
superseded by `engine/` as the engine of record), animated replay, generated
SITREP + phase-grouped log with tooltips, scripted Chief-of-Staff chat
(`draft my turn` queues real orders), faction-isolate legend, responsive
390px→2560px, focus/keyboard support.

**Working in `engine/`:** pure deterministic TypeScript WEGO engine, 13
passing tests including golden tests that mirror spec §2.9 row-for-row.

**Placeholder:** all multiplayer (other seats are scripted), CoS replies are
pattern-matched canned text, round 12+ enemy orders repeat. The prototype's
email-styled round screen is legacy — play-by-email was cut from the design;
remove the screen rather than extend it. The prototype's inlined engine and
`engine/` have not been reconciled.

**Known broken:** nothing currently; interaction + 9-viewport audits pass
clean, engine test suite green.

## The gap (in priority order)

1. **No audio.** Silent nukes. Klaxons, teletype ticks, geiger-crackle
   launches would transform it.
2. **No juice.** Impacts need screen shake, city diamonds visibly shrinking,
   score ticks animating; commit needs weight.
3. **Replay drama is flat** — arcs fly concurrently at uniform speed; no
   camera focus, slow-mo on intercepts, or casualty tickers.
4. **One round of content** — after round 12 enemy behavior is static; loop
   collapses.
5. **Map beauty ceiling** — coastline glow, city labels, ranges all
   serviceable but short of DEFCON's atmosphere.
6. **Two engines** — the prototype plays against its own inlined rules, not
   the spec-tested `engine/`. Convergence is part of the mission.

## Constraints

- **Web/HTML game.** The only platform constraint: it runs in the browser.
  Any framework, renderer, or build stack is fair game (spec §6.1 suggests a
  stack but does not mandate one).
- **Full app.** The product is a served client + server following the spec's
  architecture (§6: Cloudflare-first, one Durable Object per game room). The
  single-file `prototype.html` is a demo artifact, not the product shape.
- Everything stays **seeded and deterministic** — one seed per round,
  reproducible resolution (spec §2.4). No `Math.random()`, no wall-clock
  simulation.
- Desktop browser primary; mobile stays usable (responsive web, no native
  apps in v1).
- 60fps on integrated graphics.

## Deliberate — do not "fix"

- Near-black monochrome palette; red reserved exclusively for nuclear/alert;
  faction colors only on map assets. No blue UI.
- Chrome stays flat: no vignette, no scanlines (removed by request).
- Hand-drawn canvas unit glyphs (not icon-font) — icons are for panels only.
- WEGO simultaneity: no turn order, orders secret until all commit.
- AI commits only under player-granted delegation; "code is the law, LLM is
  the clerk." (Note: the spec's default deadline policy is Delegate — that is
  delegation the player configured, not an exception.)
- Fog of war: hostile positions shown only via radar/ghost/ASW contacts.
