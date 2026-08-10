# DUSTMAKER Spec Report

**Subject:** `DUSTMAKER.md` v0.1 (draft for review)
**Date:** 2026-08-10
**Reviewer:** Claude (Fable 5)

## Overall assessment

This is an unusually strong v0.1 spec. It makes the three hardest calls correctly up front: a deterministic pure engine with seeded RNG (§6.2), server-side fog-of-war filtering so hidden state never reaches the client (§6.6), and AI that can only act through the same validated order interface as humans (§5.5). Those three decisions eliminate whole classes of bugs — desyncs, map-hack cheating, and LLM-induced state corruption — before any code exists. The WEGO adaptation of DEFCON is also the right translation: DEFCON's tension was never twitch reflexes, it was commitment under uncertainty, and simultaneous secret orders preserve exactly that.

## What works especially well

- **The DEFCON-level-as-round-clock (§2.3).** Tying escalation to the round number gives every game a shared dramatic arc and makes async pacing predictable — you know round 10 is when the world ends. It also neatly bounds game length for the "one evening or three weeks" goal.
- **Mode changes costing a full round (§2.2).** Silo Defend↔Launch with a vulnerable transition round is the single best decision-preserving simplification in the doc. It converts DEFCON's continuous timing into a discrete tell/bluff mechanic that fits WEGO perfectly.
- **The AI role separation (§5).** Chief of Staff (per-player, fog-limited), Adjudicator (explains but cannot override the engine), Narrator (fed pre-filtered logs). Each role's information boundary is enforced structurally, not by prompt. "The code makes the decision. The LLM only gives the explanation" is the right architecture and worth defending against scope creep.
- **Cloudflare stack fit (§6.1–6.3).** One Durable Object per room is a natural match: single-threaded authority kills commit races, hibernation makes week-long async games nearly free, alarms handle deadlines. This is close to the ideal workload for that platform.
- **Fallback discipline (§5.4).** "If the LLM fails, hold and defend — a game never stops" plus per-game LLM budgets shows the design treats AI as unreliable infrastructure, which it is.

## Design risks and gaps

1. **Warhead economy math may be off.** Each player has 30 LRBMs + 8 MRBMs + up to ~8 SRBMs ≈ 46 warheads, but only 8 cities per territory and the 50%-halving damage curve means population becomes nearly worthless after 2–3 hits per city. With DEFCON 1 arriving at round 10 and games ending ~15–25, the endgame may be a monotonous alpha-strike: everyone dumps everything at round 10 because holding back has no upside. DEFCON's real-time version created launch-timing dilemmas via silo reload times and interception windows; the spec's interception (Defend-mode silos, 3 per player) may not be dense enough to reward staggered launches. This deserves a playtest focus and is arguably a bigger open question than any in §10.

2. **The 80% victory-countdown trigger interacts badly with hoarding.** If one player simply never launches, the 80% threshold may be unreachable and every game runs to the round cap. That's fine, but it means the round cap — not the countdown — is the real ending in most games, and Survivor mode actively incentivizes never launching. Worth checking whether Survivor mode degenerates into "everyone hides submarines and waits."

3. **Simultaneous-move edge cases are underspecified.** §10.2 flags fleet zone-swaps, but the same class of problem appears elsewhere: two players launch at each other's silos in the same round (do both silos fire before dying? phase 4 announce → phase 6 impact says yes — but say so explicitly); a fighter intercepting a bomber whose host carrier dies the same round; a silo hit while mid-mode-change. The phase sequence in §2.4 resolves most of these implicitly, but the engine tests will need an explicit table of these cases — worth adding one to the spec.

4. **Chief of Staff delegation is a competitive fairness lever.** Since the deadline default is Delegate, a player who writes excellent standing guidance effectively gets a strong AI playing their turns. That's a feature, but combined with §5.4's "small inexpensive model for AI players," a human's Chief of Staff (large model) may outplay AI seats — and in multiplayer, prompt-engineering skill becomes game skill. Worth deciding whether that's embraced or capped.

5. **Alliance rules have a scoring hole.** Alliances confer real advantages (radar sharing, ceasefire) but "alliances do not win together" (§2.6). In Default scoring, two allies who jointly annihilate a third split the megadeath points by who launched — this makes kill-stealing within alliances the dominant late-game play. That may be intended (very DEFCON), but the spec should say so.

6. **Minor spec inconsistencies.** §2.2 says a warhead on a unit "destroys that unit" then immediately says it removes 1 HP — the second sentence should simply replace the first. Fighter combat stats (interception odds, HP) are never given, though bombers "die easily" to them; the engine needs numbers. Bomber movement is stated as "moves 1 zone each round" but the "3-hop combat radius"/"5-hop fuel range" framing shared with fighters implies multi-zone sorties — the fighter/bomber movement model needs one clarifying paragraph.

## On the milestones

M0-first (engine with no UI, exit: two scripted bots finish a 25-round game) is exactly right and will surface most of the issues above cheaply. One suggestion: pull the edge-case resolution table (risk #3) into M0's test plan explicitly, and consider a throwaway text/CLI harness during M0 to hand-play the warhead economy (risk #1) before any PixiJS work — the balance questions are cheaper to answer at that layer than after M1.

## Bottom line

The architecture is sound and the DEFCON→WEGO translation preserves the right tensions. The open risks are almost all *balance* risks (warhead economy, victory trigger, alliance scoring), not architecture risks — which is the best position a v0.1 spec can be in, because M0's bot-vs-bot games can answer them empirically. Add the simultaneous-resolution edge-case table and the missing combat numbers before starting M0; everything else can wait for playtest data.
