// Golden tests for the four spec-conformance fixes (spec audit, v0.2):
// scout-route detection, one-order-per-unit, mobile ghost expiry, SRBM return.
import { describe, it, expect } from 'vitest';
import { createInitialState, resolveRound } from '../src/engine.js';
import type { GameState, Order } from '../src/types.js';

const T2 = ['NA', 'RU'];

function atRound(round: number, state: GameState): GameState {
  let s = state;
  while (s.round < round) s = resolveRound(s, [[], []], s.round).state;
  return s;
}

describe('spec-conformance fixes', () => {
  it('a fighter sortie reveals units in the zones on its route (§2.2, §2.5)', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'airbase', zone: 'NA_N' }],
      // RU battleship in N_PAC: 3 hops from NA_N, beyond the airbase's 2-hop
      // passive detection but within the 3-hop fighter radius
      [{ kind: 'place', type: 'battleship', zone: 'N_PAC' }],
    ], 1).state;
    s = atRound(3, s); // DEFCON 4: scouting permitted
    const airbase = s.units.find((u) => u.type === 'airbase')!;
    const bship = s.units.find((u) => u.type === 'battleship')!;
    expect(bship).toBeDefined();
    const { log } = resolveRound(s, [
      [{ kind: 'sortie', hostId: airbase.id, zone: 'N_PAC', role: 'scout' }],
      [],
    ], 5);
    const detect = log.find((e) => e.type === 'detect' && (e as any).seat === 0) as any;
    expect(detect?.units.some((u: any) => u.id === bship.id)).toBe(true);
  });

  it('rejects a second order for the same unit in one round (§2.4)', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [[{ kind: 'place', type: 'sub', zone: 'ARCTIC' }], []], 1).state;
    const sub = s.units.find((u) => u.type === 'sub')!;
    const orders: Order[] = [
      { kind: 'mode', unitId: sub.id, mode: 'surfaced' },
      { kind: 'move', unitId: sub.id, to: 'BERING' },
    ];
    const { state: s2, log } = resolveRound(s, [orders, []], 2);
    const rejected = log.find((e) => e.type === 'rejected') as any;
    expect(rejected?.reason).toBe('only one order per unit each round');
    const after = s2.units.find((u) => u.id === sub.id)!;
    expect(after.subMode).toBe('surfaced'); // first order executed
    expect(after.zone).toBe('ARCTIC'); // second did not
  });

  it('a submarine ghost clears when the boat dives or moves; silo ghosts persist (§2.5)', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [
      [{ kind: 'place', type: 'sub', zone: 'ARCTIC' }, { kind: 'place', type: 'silo', zone: 'NA_E' }],
      [],
    ], 1).state;
    s = atRound(9, s);
    const sub = s.units.find((u) => u.type === 'sub')!;
    const silo = s.units.find((u) => u.type === 'silo')!;
    s = resolveRound(s, [
      [{ kind: 'mode', unitId: sub.id, mode: 'surfaced' }, { kind: 'mode', unitId: silo.id, mode: 'launch' }],
      [],
    ], 9).state;
    // round 10: both launch — both leave ghosts
    s = resolveRound(s, [
      [{ kind: 'launch', unitId: sub.id, targetZone: 'RU_W' }, { kind: 'launch', unitId: silo.id, targetZone: 'RU_W' }],
      [],
    ], 2).state;
    expect(s.ghosts.some((g) => g.unitId === sub.id)).toBe(true);
    expect(s.ghosts.some((g) => g.zone === 'NA_E' && !g.unitId)).toBe(true);
    // the boat dives: its ghost clears, the silo ghost stays
    s = resolveRound(s, [[{ kind: 'mode', unitId: sub.id, mode: 'submerged' }], []], 11).state;
    expect(s.ghosts.some((g) => g.unitId === sub.id)).toBe(false);
    expect(s.ghosts.some((g) => g.zone === 'NA_E' && !g.unitId)).toBe(true);
  });

  it('a bomber that lands with its SRBM returns it to the magazine (§2.2)', () => {
    let s = createInitialState(T2);
    s = resolveRound(s, [[{ kind: 'place', type: 'airbase', zone: 'NA_N' }], []], 1).state;
    s = atRound(5, s); // DEFCON 3: bomber ops permitted
    const airbase = () => s.units.find((u) => u.type === 'airbase')!;
    const srbmsBefore = airbase().srbms!;
    // takeoff to an adjacent zone, then send it home; it lands still armed
    const r1 = resolveRound(s, [[{ kind: 'takeoff', hostId: airbase().id, targetZone: 'NA_W' }], []], 5);
    s = r1.state;
    expect(airbase().srbms).toBe(srbmsBefore - 1);
    const bomber = s.units.find((u) => u.type === 'bomber')!;
    bomber.targetZone = 'NA_N'; // order it home
    while (s.units.some((u) => u.type === 'bomber')) {
      s = resolveRound(s, [[], []], s.round).state;
    }
    expect(airbase().srbms).toBe(srbmsBefore); // SRBM restored on landing
  });
});
