# M0 Doctrine Tournament — Results

**Source plan:** `docs/plans/spec-report-implementation-plan.md` (Phase 2.2 / 2.3)
**Date:** 2026-08-10
**Setup:** 2-player games (NA vs RU), 100 seeded games per pairing per score mode, 1,800 games total per run. Doctrines: **Alpha** (dump the full arsenal at DEFCON 1), **Staggered** (3-missile waves from one Launch silo, others stay in Defend; subs alternate surface/dive), **Turtle** (max Defend, second strike only after losing ~15M population). Reproduce with `cd engine && npm run tournament -- --games 100`.

## Baseline results (current spec rules, v0.2 combat numbers)

| Pairing | Result |
|---|---|
| Alpha vs Staggered | Staggered **61%**, tie 39%, Alpha **0%** |
| Alpha vs Turtle | Turtle **82%**, Alpha 18% |
| Staggered vs Turtle | Staggered **100%** |

Identical across all three score modes (bot behavior does not depend on score mode, and all three scoring formulas rank the same damage patterns the same way in a 2-player game). End condition: **maxRounds in 100% of 1,800 games** — the 80% victory countdown never fired once.

## Finding 1 — the alpha strike is NOT dominant (report finding #1: refuted)

The spec report worried the round-10 all-out launch would be the only rational play. The opposite holds at current numbers: Alpha finishes last against both other doctrines. Two mechanisms punish it:

- Flipping all three silos to Launch mode surrenders all interception, so the opponent's return fire lands unopposed.
- Staggered's Defend silos (1/4 intercept per silo per missile, own + adjacent zones) thin the alpha wave substantially, then its own waves grind on against a disarmed opponent.

**Decision per the plan's rule (Alpha ≥60% → broken): no interception tuning needed.** The Defend/Launch tradeoff is doing exactly the job the spec designed it for. Staggered's 100% record over Turtle also shows pure defence is not degenerate — you must eventually shoot.

## Finding 2 — the victory countdown is decorative (report finding #2: confirmed)

No game reached 80% of warheads launched-or-destroyed; the round cap is the real clock in every game. Turtle-style hoarding (subs sitting submerged with full magazines) keeps the fraction well under threshold.

**Lever tested and rejected: population-floor countdown trigger.** We tried starting the countdown when any player drops below 20M population, then 10M:

| Floor | Alpha vs Staggered | Games ending at cap |
|---|---|---|
| none (baseline) | Alpha 0% | 100% |
| 20M | **Alpha 100%** (avg 13 rounds) | 33% |
| 10M | **Alpha 95%** | 64% |

Any population-based end trigger converts kill *speed* into game-ending power: the alpha strike drops the victim below the floor at round ~10 and the game ends before slower doctrines can answer. It resurrects exactly the degenerate strategy the baseline rules successfully suppress. **Reverted; the engine ships with the warhead threshold only.**

**Recommendation:** accept that the round cap is the real end-of-game clock and say so in the spec (§2.3), keeping the 80% countdown as an early-exit for mutual annihilation games. Alternative levers for a future pass (untested): lower the threshold to ~60%, or count only *launched* warheads and exclude hoarded submarine magazines from the denominator.

## Finding 3 — multiplayer free-for-alls (100 games per mode, rotated seats)

3-player games run one of each doctrine; 6-player games run two of each. Shared wins split fractionally.

| Lobby | Mode | Alpha | Staggered | Turtle |
|---|---|---|---|---|
| 3p | default | 39% | **61%** | 0% |
| 3p | genocide | 42% | **58%** | 0% |
| 3p | survivor | 6% | **56%** | 38% |
| 6p | default | **69%** | 31% | 0% |
| 6p | genocide | **72%** | 28% | 0% |
| 6p | survivor | 10% | 31% | **59%** |

Three conclusions the 2-player runs could not see:

- **The alpha strike returns at scale.** In 6-player kill-scoring lobbies Alpha wins ~70%: with many victims, dumping first harvests megadeath points across several territories while slower doctrines split their attention. The report's finding #1 concern is refuted at 2 players but **confirmed in large default/genocide lobbies** — the balance lever to revisit for v1 (launch caps per round, or denser interception) applies specifically there.
- **Survivor mode partially degenerates as feared.** Turtle (hide, hoard, retaliate only) wins 59% of 6-player Survivor games. The report's "everyone hides submarines and waits" concern is real at scale; either accept Survivor as the pacifist variant (spec already allows the host to choose modes) or add pressure such as per-round survival decay.
- **The countdown still never fires** — 100% maxRounds across all 600 multiplayer games. Finding 2 stands in every configuration tested.

## Caveats and next steps

- Scripted doctrines are crude lower bounds on play skill; a smarter Staggered or a provocation-aware Turtle could shift margins. Re-run after any bot improvement.
- 2-player games only; 6-player free-for-all dynamics (gang-ups, opportunistic third parties) are untested and likely change Turtle's standing. In particular, the report's Survivor-mode question ("does Turtle degenerate Survivor into hiding and waiting?") is structurally untestable at 2 players — all three score formulas reduce to the same comparison there — and needs a 3+ player run.
- Ties in Alpha vs Staggered (39%) are mutual-annihilation stalemates worth inspecting in replays.
- The §2.9 alliance edge case remains `test.todo` until alliances land in M2.
