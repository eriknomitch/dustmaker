# @dustmaker/web — M1 hotseat client

Two-player hotseat (or human vs bot: edit `SEATS` in `src/main.ts`) on the real
engine. `npm install && npm run dev`, open the printed URL. Use AUTO-PLACE ALL
on round 1, queue orders by clicking units, commit, hand the device over.

Known M1 limitations (by design, resolved in M2+):
- Manual per-unit placement UI is stubbed; use AUTO-PLACE.
- Resolution is shown as a text log, not an animated replay.
- Log fog-filtering is client-side; the M2 server owns real fog.
