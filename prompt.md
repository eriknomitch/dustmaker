# The prompt

The gauntlet-loop prompt this repository is built against. Convention borrowed
from [workmelt](https://github.com/eriknomitch/workmelt) /
[Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty); the gauntlet-loop
technique is Matt Shumer's.

```
Turn DUSTMAKER's two halves into one repository-grade game and close the gap
between it and its bar.

This repo holds a normative spec (DUSTMAKER.md), a pure deterministic
TypeScript engine with golden tests (engine/), and a playable single-file
prototype (prototype.html) running its own inlined rules. The engine of
record is engine/ — the artifact must come to bundle its compiled output, and
the spec's §2.9 edge-case table with its golden tests stays the rules oracle.
Where the prototype and the engine disagree, the engine and spec win.

The bar is DEFCON (Introversion, 2006). Get real gameplay footage and
screenshots of a full nuclear exchange, with audio, and compare against them
directly, not against a description of them. For panel feel, the diegetic
terminals of Norco and Alien: Isolation are the secondary reference.

First build the ground the critics stand on: modular source with subsystem
boundaries and an ARCHITECTURE.md contract, plus a harness — deterministic
headless capture, a per-pixel diff gate, scripted playtests, and a goal
scorecard with measurable criteria and an exit code. Finish what the M0 plan
(docs/plans/) already calls for: the CLI harness and the bot doctrine
tournament, so balance criteria are scoreable, not vibes. Every capture must
stay bit-reproducible. The shipped game builds to one self-contained HTML
file under 2 MB, Canvas 2D and plain JS at runtime (TypeScript compiles into
it), no runtime network calls, 60fps on integrated graphics — the repo can
hold any tooling, the artifact stays pure.

Then break the gap into the smallest pieces that can be improved and judged
on their own. For each piece, fan out a builder and a separate critic with
fresh context. The critic runs the harness, puts our capture next to DEFCON's
blind with the labels stripped, says which is better, and names the single
biggest remaining gap. Then it goes back to the builder. Atmosphere is one
coupled system — where pieces share a rendering surface, use one sequential
owner rather than parallel agents.

Hard rules, never traded away: near-black monochrome with red reserved for
nuclear/alert, flat chrome with no scanlines or vignette, hand-drawn canvas
unit glyphs, WEGO secrecy, fog of war, and the AI Chief of Staff never
commits without delegation.

The critic should be a harsh critic. Praise is not useful. If ours does not
win, it keeps going.

/loop on each piece until the critic picks ours blind. Do not stop before
that.

Keep a live progress page updating as the work evolves so I can watch it.

Fan out subagents and ultracode.
```
