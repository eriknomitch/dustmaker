# Repository Guidelines

DUSTMAKER — a turn-based, asynchronous WEGO reimagining of DEFCON.

Read these before doing anything, in this order:

1. `PRODUCT.md` — the quality bar, the ranked gaps, the constraints, and the
   deliberate decisions that must not be "fixed".
2. `DUSTMAKER.md` — the normative spec (v0.3). Game rules live here, not in
   code comments or this file. Spec §2.9 is also the golden-test list.
3. `prompt.md` — the gauntlet-loop mission this repo is built against.
4. `docs/plans/spec-report-implementation-plan.md` — the M0 plan, and
   `docs/repos/m0-tournament-results.md` — what the doctrine tournament
   actually showed (the alpha strike is not dominant).

Status: M0 (engine) and M1 (local web game) are done; M2 (Workers +
GameRoom Durable Object, lobby, WebSocket sync, server-owned fog) is next.

## Layout

- `DUSTMAKER.md` — the spec. Normative. A rule change is a spec edit first,
  then code.
- `engine/` — the **engine of record**: pure deterministic TypeScript,
  state-in/state-out, no I/O. `pnpm test` (from the repo root) runs the suite
  (vitest; sub-second — the suite is the only automated gate, there is no
  `tsc` typecheck script). `test/edgecases.test.ts` mirrors spec §2.9
  row-for-row — the table and the suite are the same artifact and must stay
  identical. A spec row not yet implementable stays as an `it.todo` holding
  its slot (currently the alliance row, which lands in M2); never delete one.
  `test/specfixes.test.ts` holds golden tests for audit-found
  conformance gaps; add one there whenever a spec rule is fixed in code.
  `pnpm harness` plays a scripted bot game in the terminal;
  `pnpm tournament` runs the doctrine round-robin (`src/bots.ts`).
- `web/` — the Vite + PixiJS client. It imports the engine **directly from
  `../../engine/src`** (no build step between them); the M2 server will run
  the same module. Single-player: you are seat 0, doctrine bots hold the
  rest (`SEATS` in `src/main.ts`). Fog filtering and the Chief of Staff are
  client-side and scripted for now — placeholders for M2 and M4, not the
  product shape. `pnpm dev` to run.
- `prototype.html` — the playable single-file demo (round 11, DEFCON 1). Its
  inlined engine is legacy: it predates `engine/` and the two have not been
  reconciled. Do not extend the inlined rules; converge on `engine/`. Its
  email-styled round screen is also legacy — play-by-email was cut from the
  design; remove it rather than extend it.
- `docs/` — the spec review, implementation plan, and tournament results.

This is a **pnpm workspace** (`pnpm-workspace.yaml`): one `pnpm install` at
the repo root, one root `pnpm-lock.yaml`, one TypeScript version
(`^7.0.2`) pinned across packages. Run
everything from the root — `pnpm test`, `pnpm dev`, `pnpm build`, `pnpm
harness`, `pnpm tournament` — or target a package with `pnpm --filter
@dustmaker/engine <script>`. Do not add nested lockfiles; they shadow the
root one. The per-package boundary is load-bearing: it is what keeps
browser and Workers dependencies out of the engine of record. The M2 server
joins as a third workspace package.

## Hard constraints (from PRODUCT.md, non-negotiable)

- **Web/HTML game.** The only platform constraint: it runs in the browser.
  Any framework, renderer, or build stack is acceptable — spec §6.1's stack
  table is a recommendation, not a mandate.
- **Full app.** The product is a served client + server per spec §6
  (Cloudflare-first, one Durable Object per game room). The single-file
  prototype is a demo, not the product shape.
- Everything is seeded and deterministic — no `Math.random()`, no
  wall-clock-driven simulation. One seed per round, reproducible resolution
  (spec §2.4). Determinism is what makes replays, golden tests and pixel
  gates meaningful.
- 60fps on integrated graphics; responsive 390px→2560px, desktop primary.
- Respect every item under "Deliberate — do not fix" in `PRODUCT.md`.

## Conventions to establish (mirroring workmelt's proven shape)

As the repo grows, follow the pattern of
[workmelt](https://github.com/eriknomitch/workmelt):

- `src/` split by subsystem, boundaries documented in an `ARCHITECTURE.md`
  written when the split happens.
- `tools/` for the harness: deterministic headless capture, per-pixel diff
  gate, scripted playtests, goal scorecard with an exit code.
- `goals/*.md` for machine-scoreable quality criteria — a goal you cannot
  score is a wish.
- Self-tests beside the code they verify; headless and free by default,
  browser only when the change is a function of the image.
- Ad-hoc screenshots go in `.shots/` (gitignored) and must be read back and
  described — a `.png` nobody looked at is not a visual check.
- Throwaway probe scripts go in `scratch/` (gitignored), never `/tmp`.
