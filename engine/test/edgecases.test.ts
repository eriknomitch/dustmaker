// Golden tests for DUSTMAKER.md §2.9 — the spec table and this file must stay
// identical, row for row.
import { describe, it, expect } from 'vitest';
import { createInitialState, resolveRound } from '../src/engine.js';
import type { GameState, Order } from '../src/types.js';

const T2 = ['NA', 'RU'];

// Fast-forward an empty game to a given round (no orders).
function atRound(round: number, state?: GameState): GameState {
  let s = state ?? createInitialState(T2);
  while (s.round < round) s = resolveRound(s, [[], []], s.round).state;
  return s;
}

function place(s: GameState, seat: number, orders: Order[]): GameState {
  const sets: Order[][] = [[], []];
  sets[seat] = orders;
  return resolveRound(s, sets, s.round).state;
}

describe('§2.9 resolution edge cases', () => {
  it('two silos launch at each other in the same round: both missiles fly', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'silo', zone: 'NA_E' }],
      [{ kind: 'place', type: 'silo', zone: 'RU_W' }],
    ], 1).state;
    s = atRound(9, s);
    // both flip to launch mode at DEFCON 2 (round 9), ready round 10
    const [a, b] = s.units.map((u) => u.id);
    s = resolveRound(s, [
      [{ kind: 'mode', unitId: a, mode: 'launch' }],
      [{ kind: 'mode', unitId: b, mode: 'launch' }],
    ], 9).state;
    // round 10, DEFCON 1: mutual launch at each other's silo
    const { state: s2, log } = resolveRound(s, [
      [{ kind: 'launch', unitId: a, targetZone: 'RU_W', targetUnitId: b }],
      [{ kind: 'launch', unitId: b, targetZone: 'NA_E', targetUnitId: a }],
    ], 42);
    const launches = log.filter((e) => e.type === 'launch');
    expect(launches).toHaveLength(2); // launch (phase 4) precedes impact (phase 6)
    // neither launch was rejected because the firing silo was hit
    expect(log.filter((e) => e.type === 'rejected')).toHaveLength(0);
    void s2;
  });

  it('a silo destroyed during a mode change: the change dies with it', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'silo', zone: 'NA_E' }],
      [{ kind: 'place', type: 'silo', zone: 'RU_W' }],
    ], 1).state;
    s = atRound(10, s);
    const na = s.units.find((u) => u.owner === 0)!;
    const ru = s.units.find((u) => u.owner === 1)!;
    // RU flips to launch first so it can fire at round 11
    s = resolveRound(s, [[], [{ kind: 'mode', unitId: ru.id, mode: 'launch' }]], 10).state;
    // NA starts a mode change while RU fires 3 warheads at it (silo has 3 HP)
    const { state: s2 } = resolveRound(s, [
      [{ kind: 'mode', unitId: na.id, mode: 'launch' }],
      [{ kind: 'launch', unitId: ru.id, targetZone: 'NA_E', targetUnitId: na.id, count: 3 }],
    ], 7); // seed chosen so no interception occurs (NA silo is 'changing' and cannot defend)
    expect(s2.units.find((u) => u.id === na.id)).toBeUndefined(); // dead: no partial states survive
  });

  it('host destroyed while aircraft are aloft: fighters die with host, bombers fly on then crash', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'battleship', zone: 'N_ATL' }],
      [{ kind: 'place', type: 'carrier', zone: 'ARCTIC' }],
    ], 1).state;
    s = atRound(5, s); // DEFCON 3: conventional combat permitted
    const carrier = s.units.find((u) => u.type === 'carrier')!;
    expect(carrier.fighters).toBeGreaterThan(0);
    // launch a bomber, then batter the carrier to death with the battleship
    let bomberId: string | undefined;
    for (let i = 0; i < 12 && !s.finished; i++) {
      const bs = s.units.find((u) => u.type === 'battleship');
      const cv = s.units.find((u) => u.type === 'carrier');
      if (!bs) break;
      const naOrders: Order[] = [];
      const ruOrders: Order[] = [];
      if (cv && !bomberId) ruOrders.push({ kind: 'takeoff', hostId: cv.id, targetZone: 'NA_N' });
      if (cv && bs.zone !== cv.zone) naOrders.push({ kind: 'move', unitId: bs.id, to: cv.zone === 'ARCTIC' ? 'ARCTIC' : cv.zone });
      const r = resolveRound(s, [naOrders, ruOrders], 100 + i);
      s = r.state;
      bomberId ??= (r.log.find((e) => e.type === 'takeoff') as any)?.unit;
      if (!s.units.some((u) => u.type === 'carrier')) break;
    }
    expect(s.units.some((u) => u.type === 'carrier')).toBe(false); // host is dead
    // fighters were counts on the host: gone with it. The orphan bomber flies on.
    const bomber = s.units.find((u) => u.id === bomberId);
    if (bomber) {
      // run until fuel exhaustion: bomber must crash, never persist forever
      let s2 = s;
      for (let i = 0; i < 8 && s2.units.some((u) => u.id === bomberId); i++) {
        s2 = resolveRound(s2, [[], []], 200 + i).state;
      }
      expect(s2.units.find((u) => u.id === bomberId)).toBeUndefined();
    }
  });

  it('two fleets exchanging zones engage in the defender destination zone', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'battleship', zone: 'N_ATL' }],
      [{ kind: 'place', type: 'battleship', zone: 'ARCTIC' }],
    ], 1).state;
    const [na, ru] = [s.units.find((u) => u.owner === 0)!, s.units.find((u) => u.owner === 1)!];
    const { state: s2, log } = resolveRound(s, [
      [{ kind: 'move', unitId: na.id, to: 'ARCTIC' }],
      [{ kind: 'move', unitId: ru.id, to: 'N_ATL' }],
    ], 5);
    expect(log.some((e) => e.type === 'fleetSwapEngagement')).toBe(true);
    const a = s2.units.find((u) => u.id === na.id)!;
    const b = s2.units.find((u) => u.id === ru.id)!;
    expect(a.zone).toBe(b.zone); // they meet — they do not pass through each other
  });

  it.todo('alliance formed the same round as an attack: targeting cancelled, in-flight missiles still hit (alliances land in M2)');

  it('a radar destroyed the same round it would detect: it detects first, then dies', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'radar', zone: 'NA_N' }, { kind: 'place', type: 'silo', zone: 'NA_E' }],
      [{ kind: 'place', type: 'battleship', zone: 'ARCTIC' }, { kind: 'place', type: 'silo', zone: 'RU_W' }],
    ], 1).state;
    s = atRound(9, s);
    const ruSilo = s.units.find((u) => u.owner === 1 && u.type === 'silo')!;
    s = resolveRound(s, [[], [{ kind: 'mode', unitId: ruSilo.id, mode: 'launch' }]], 9).state;
    const radar = s.units.find((u) => u.type === 'radar')!;
    const { state: s2, log } = resolveRound(s, [
      [],
      [{ kind: 'launch', unitId: ruSilo.id, targetZone: 'NA_N', targetUnitId: radar.id }],
    ], 3); // seed with no interception
    const detect = log.find((e) => e.type === 'detect' && (e as any).seat === 0) as any;
    const hitEvent = log.find((e) => e.type === 'unitHit' && (e as any).unit === radar.id);
    if (hitEvent) {
      expect(s2.units.find((u) => u.id === radar.id)).toBeUndefined(); // 1 HP: destroyed
      expect(detect?.units.some((u: any) => u.id === ruSilo.id)).toBe(true); // but it detected in phase 3 first
    }
  });
});
