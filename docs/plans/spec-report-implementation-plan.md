# Implementation Plan — DUSTMAKER Spec Report Suggestions

**Source:** `docs/repos/dustmaker-spec-report.md`
**Target:** `DUSTMAKER.md` v0.1 → v0.2, plus M0 scope additions
**Date:** 2026-08-10
**Status:** Proposed

The report's findings split into two groups: **spec edits** (do now, before any code) and **playtest-gated questions** (build the cheapest possible harness in M0 and answer them with data). Ordered by when to do them.

## Phase 1 — Spec edits (before M0 starts)

### 1.1 Fix the minor inconsistencies (report §6)

Three targeted edits to `DUSTMAKER.md`:

- **Warhead-vs-unit damage (§2.2):** replace "A warhead on a unit destroys that unit. If the unit has more than 1 HP…" with one rule: *"A warhead on a unit removes 1 HP. A unit at 0 HP is destroyed."* One sentence, no special case.
- **Air unit movement model (§2.2):** add a paragraph pinning down sorties. Proposal: fighters resolve their whole sortie in one round (fly out up to 3 hops, scout/intercept, return — they're fast); bombers are persistent map units that move 1 zone per round with a 5-hop cumulative fuel budget and must land to refuel. This matches the existing text's implications and gives the two aircraft genuinely different rhythms.
- **Fighter/bomber combat numbers (§2.2):** add a small stat block — interception hit chances, fighter HP (1), what a battleship's "strong conventional attack" actually rolls. Exact numbers don't matter yet (the harness will tune them); *having* numbers matters, because M0 can't be coded without them. Start with simple fractions (e.g. fighter kills bomber 2/3, silo intercepts each inbound missile 1/4 per Defend silo in range) so hand-verification of resolution logs is easy.

### 1.2 Add the simultaneous-resolution edge-case table (report §3)

New spec section §2.9, "Resolution edge cases," a table of scenario → outcome → deciding phase rule. Seed it with:

| Case | Ruling |
|---|---|
| Two silos launch at each other same round | Both missiles fly; both can be hit. Launch (phase 4) precedes impact (phase 6). |
| Silo destroyed mid-mode-change | Change dies with it; no partial states. |
| Host carrier/airbase destroyed while aircraft aloft | Fighters are lost at end of round (nowhere to land); bombers keep flying until fuel runs out, then crash. |
| Two fleets swap zones (spec §10.2) | Engage in the defender's destination zone (adopt the spec's proposal, mark as playtest-provisional). |
| Alliance formed same round as an attack on the new ally | Targeting cancelled at resolution; in-flight missiles still hit (already in §2.8 — cross-reference it). |
| Radar/detector destroyed same round it would detect | Detection resolves in phase 3, destruction in phases 6–7 → it detects, then dies. |

This table then becomes, verbatim, the golden-test list for M0 — every row is a test case with a scripted order set and an asserted resolution log. The spec table and the test suite are the same artifact.

### 1.3 Close the alliance scoring hole (report §5)

Add one explicit sentence to §2.6 declaring the intent: *"Within an alliance, points go to the player whose warhead caused the megadeaths. Competition for kills inside an alliance is intentional."* Embrace it rather than patch it — kill-stealing among allies is extremely DEFCON, and any point-sharing scheme (split by alliance, assists) adds rules for a problem playtests haven't confirmed. Cheap to revisit later; expensive to design speculatively now.

### 1.4 Decide the Chief-of-Staff fairness question (report §4)

This is a lobby-settings decision, not a mechanics change:

- Add a host option in §2.7/§5.1: **delegation quality tier** — all seats' delegated/AI turns use the *same* model tier within a game. Human Chief-of-Staff *chat* (advice, drafting) can stay on the large model, but when the Chief of Staff actually *plays a turn* (Delegate policy, vacation mode), it runs on the same model as AI opponents.
- Rationale: advice-asymmetry is fine (it's the human's skill to use advice well), but autopilot-asymmetry means the game is partly model-vs-model, which undermines the "AI player cannot cheat / same information, same rules" principle in spirit.
- Standing-guidance prompt engineering stays uncapped — that's legitimately part of the game's skill expression; say so in the spec.

## Phase 2 — M0 additions (playtest-gated questions)

### 2.1 Build the CLI harness first, inside M0

Before touching balance, add a thin text harness on the pure engine: load a scenario JSON, print an ASCII/fog-filtered situation per player, accept orders as text or from a script file, resolve, dump the log. Roughly 1–2 days on top of the engine since the engine is already pure state-in/state-out. Everything below depends on it.

### 2.2 Answer the warhead-economy question (report §1)

The concern: ~46 warheads/player vs 8 cities and a halving damage curve → round-10 alpha strike dominates. Test it empirically:

- Write 3 scripted bot doctrines: **Alpha** (launch everything at DEFCON 1), **Staggered** (launch in waves, keep silos toggling Defend/Launch), **Turtle** (max Defend, second-strike only).
- Run a round-robin (hundreds of seeded games via the harness) and compare mean scores per doctrine per score mode.
- **Decision rule:** if Alpha wins ≥60% against both others, the economy is broken. Tuning levers, in order: raise interception density (Defend silos intercept more missiles per round), cap launches per silo per round (e.g. 3 of 10 LRBMs — creates a mandatory multi-round launch window and a reason to time it), then soften the halving curve. Change one lever at a time, re-run the tournament.

### 2.3 Answer the victory-countdown/hoarding question (report §2)

Same tournament data answers this for free: log which end condition fired (80% countdown vs round cap) per game and Turtle's win rate in Survivor mode. If ≥~80% of games end at the round cap, the countdown is decorative — either fine (document that the cap is the real clock) or fix by adding a second trigger (e.g. countdown also starts when any player drops below 20% population). If Turtle dominates Survivor, add a small per-round survival decay or accept Survivor as the pacifist variant and label it.

### 2.4 Confirm the fleet-swap ruling (report §3 leftover)

The §10.2 proposal (engage in defender's zone) ships in the edge-case table as provisional; the bot tournament will exercise it incidentally. Flag it for the first *human* playtest in M1 — this one is about feel, not math, so bots can't fully answer it.

## Sequencing summary

- **Week 0 (spec):** 1.1 → 1.2 → 1.3 → 1.4 — all pure document edits, ~a day of work; 1.2 doubles as the M0 test plan.
- **M0 (engine):** engine + edge-case golden tests → CLI harness (2.1) → doctrine tournament (2.2, 2.3) → tune → freeze numbers before M1 starts.

The through-line: every judgment call in the report either becomes an explicit sentence in the spec now, or becomes a scripted experiment with a decision rule attached — nothing stays as an open vibe.
