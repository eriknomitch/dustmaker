# @dustmaker/web — single-player client on the real engine

You command seat 0 (North America); AI doctrines hold the other seats (edit
`SEATS` in `src/main.ts` to change the mix). The client imports the engine
directly from `../../engine/src` — the same module the M2 server will run.

```bash
npm install
npm run dev      # open the printed URL
```

Round 1: AUTO-PLACE ALL, then click units to queue orders or ask the Chief of
Staff to draft your turn. Commit is manual; resolution plays back as an
animated replay, then the SITREP opens.

Files: `src/main.ts` (Pixi setup, map, order UX, Chief of Staff, replay,
round flow), `src/layout.ts` (equirectangular `project()`, zone positions,
territory colors, unit glyphs), `src/coast.json` (coastline polylines).

Known limitations (resolved in M2+):
- Manual per-unit placement UI is stubbed; use AUTO-PLACE.
- Log fog-filtering is client-side; the M2 server owns real fog.
- The Chief of Staff is scripted, not LLM-backed (spec §5.1, M4).
