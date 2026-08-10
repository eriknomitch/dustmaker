// Deterministic scripted doctrines for the M0 balance tournament (plan §2.2).
// No LLM calls: determinism is what makes the tournament reproducible.
import { defconForRound } from './constants.js';
import { MAP, neighbors, isSea } from './map.js';
import type { GameState, Order, ZoneId } from './types.js';

export type Doctrine = 'alpha' | 'staggered' | 'turtle';

function landZones(territory: string): ZoneId[] {
  return Object.entries(MAP.landZones).filter(([, t]) => t === territory).map(([z]) => z);
}

function homeSeas(territory: string): ZoneId[] {
  const seas = new Set<ZoneId>();
  for (const z of landZones(territory)) for (const n of neighbors(z)) if (isSea(n)) seas.add(n);
  return [...seas].sort();
}

function placementOrders(state: GameState, seat: number): Order[] {
  if (state.round !== 1) return [];
  const t = state.players[seat].territory;
  const land = landZones(t);
  const seas = homeSeas(t);
  const at = (arr: ZoneId[], i: number) => arr[i % arr.length];
  return [
    { kind: 'place', type: 'silo', zone: at(land, 0) },
    { kind: 'place', type: 'silo', zone: at(land, 1) },
    { kind: 'place', type: 'silo', zone: at(land, 2) },
    { kind: 'place', type: 'radar', zone: at(land, 0) },
    { kind: 'place', type: 'radar', zone: at(land, 3) },
    { kind: 'place', type: 'airbase', zone: at(land, 1) },
    { kind: 'place', type: 'airbase', zone: at(land, 2) },
    { kind: 'place', type: 'carrier', zone: at(seas, 0) },
    { kind: 'place', type: 'carrier', zone: at(seas, 1) },
    { kind: 'place', type: 'battleship', zone: at(seas, 0) },
    { kind: 'place', type: 'battleship', zone: at(seas, 1) },
    { kind: 'place', type: 'sub', zone: at(seas, 0) },
    { kind: 'place', type: 'sub', zone: at(seas, 1) },
  ];
}

// Enemy city zones sorted by surviving population (largest first).
function enemyCityZones(state: GameState, seat: number): ZoneId[] {
  const mine = state.players[seat].territory;
  const byZone = new Map<ZoneId, number>();
  for (const c of state.cities) {
    if (c.territory === mine || c.pop < 1) continue;
    byZone.set(c.zone, (byZone.get(c.zone) ?? 0) + c.pop);
  }
  return [...byZone.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z);
}

export function botOrders(state: GameState, seat: number, doctrine: Doctrine): Order[] {
  const orders: Order[] = placementOrders(state, seat);
  const defcon = defconForRound(state.round);
  const mine = state.units.filter((u) => u.owner === seat);
  const silos = mine.filter((u) => u.type === 'silo');
  const subs = mine.filter((u) => u.type === 'sub');
  const targets = enemyCityZones(state, seat);
  if (!targets.length) return orders;

  if (doctrine === 'alpha') {
    // flip everything to launch at DEFCON 2, dump the entire arsenal at DEFCON 1
    if (defcon === 2) {
      for (const silo of silos) {
        if (silo.siloMode === 'defend') orders.push({ kind: 'mode', unitId: silo.id, mode: 'launch' });
      }
      for (const sub of subs) {
        if (sub.subMode === 'submerged') orders.push({ kind: 'mode', unitId: sub.id, mode: 'surfaced' });
      }
    }
    if (defcon === 1) {
      silos.forEach((silo, i) => {
        if (silo.siloMode === 'launch' && (silo.lrbms ?? 0) > 0) {
          orders.push({ kind: 'launch', unitId: silo.id, targetZone: targets[i % targets.length], count: silo.lrbms });
        } else if (silo.siloMode === 'defend') {
          orders.push({ kind: 'mode', unitId: silo.id, mode: 'launch' });
        }
      });
      subs.forEach((sub, i) => {
        if (sub.subMode === 'surfaced' && (sub.mrbms ?? 0) > 0) {
          orders.push({ kind: 'launch', unitId: sub.id, targetZone: targets[i % targets.length], count: sub.mrbms });
        } else if (sub.subMode === 'submerged') {
          orders.push({ kind: 'mode', unitId: sub.id, mode: 'surfaced' });
        }
      });
    }
  } else if (doctrine === 'staggered') {
    // one silo in launch mode at a time, 3 missiles per wave, others defend
    if (defcon <= 2) {
      const launcher = silos.find((u) => u.siloMode === 'launch');
      if (!launcher) {
        const next = silos.find((u) => u.siloMode === 'defend' && (u.lrbms ?? 0) > 0);
        if (next) orders.push({ kind: 'mode', unitId: next.id, mode: 'launch' });
      } else if (defcon === 1) {
        if ((launcher.lrbms ?? 0) > 0) {
          orders.push({ kind: 'launch', unitId: launcher.id, targetZone: targets[state.round % targets.length], count: 3 });
        } else {
          orders.push({ kind: 'mode', unitId: launcher.id, mode: 'defend' });
        }
      }
      // subs fire in alternating surface/dive cycles
      subs.forEach((sub, i) => {
        if (defcon === 1 && (sub.mrbms ?? 0) > 0) {
          if (sub.subMode === 'submerged' && (state.round + i) % 2 === 0) {
            orders.push({ kind: 'mode', unitId: sub.id, mode: 'surfaced' });
          } else if (sub.subMode === 'surfaced') {
            orders.push({ kind: 'launch', unitId: sub.id, targetZone: targets[i % targets.length], count: 2 });
          }
        } else if (sub.subMode === 'surfaced') {
          orders.push({ kind: 'mode', unitId: sub.id, mode: 'submerged' });
        }
      });
    }
  } else {
    // turtle: maximum defence, second strike only after taking real damage
    const myPop = state.cities
      .filter((c) => c.territory === state.players[seat].territory)
      .reduce((a, c) => a + c.pop, 0);
    const provoked = myPop < 85; // retaliate once ~15M have died
    if (defcon === 1 && provoked) {
      const launcher = silos.find((u) => u.siloMode === 'launch');
      if (launcher && (launcher.lrbms ?? 0) > 0) {
        orders.push({ kind: 'launch', unitId: launcher.id, targetZone: targets[0], count: 5 });
      } else {
        const next = silos.find((u) => u.siloMode === 'defend' && (u.lrbms ?? 0) > 0);
        if (next) orders.push({ kind: 'mode', unitId: next.id, mode: 'launch' });
      }
      subs.forEach((sub, i) => {
        if (sub.subMode === 'submerged' && (sub.mrbms ?? 0) > 0) {
          orders.push({ kind: 'mode', unitId: sub.id, mode: 'surfaced' });
        } else if (sub.subMode === 'surfaced' && (sub.mrbms ?? 0) > 0) {
          orders.push({ kind: 'launch', unitId: sub.id, targetZone: targets[i % targets.length], count: sub.mrbms });
        }
      });
    }
  }
  return orders;
}
