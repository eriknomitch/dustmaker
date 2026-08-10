// Pure deterministic engine: (state, orders, seed) -> (state, log).
// No I/O. All randomness comes from the seeded RNG (spec §6.2).
import { COMBAT, UNITS, RANGES, defconForRound, VICTORY } from './constants.js';
import { MAP, hops, isSea, isLand, territoryOf, stepToward, neighbors } from './map.js';
import { makeRng, type Rng } from './rng.js';
import type {
  GameState, Unit, City, Order, OrderSet, ResolutionLog, LogEvent, ScoreMode, ZoneId,
} from './types.js';

let uidCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${++uidCounter}`;
}

export function createInitialState(
  territories: string[],
  scoreMode: ScoreMode = 'default',
  maxRounds: number = VICTORY.defaultMaxRounds,
): GameState {
  uidCounter = 0;
  const players = territories.map((territory, seat) => ({
    seat,
    territory,
    score: scoreMode === 'survivor' ? 100 : 0,
  }));
  const cities: City[] = [];
  for (const territory of territories) {
    const zones = Object.entries(MAP.landZones)
      .filter(([, t]) => t === territory)
      .map(([z]) => z);
    MAP.cityPops.forEach((pop, i) => {
      const zone = zones[i % zones.length];
      cities.push({ id: `${territory}_C${i + 1}`, zone, territory, pop, initialPop: pop });
    });
  }
  return {
    round: 1,
    players,
    units: [],
    cities,
    scoreMode,
    maxRounds,
    totalWarheadsStart: 0,
    warheadsExpended: 0,
    countdown: null,
    finished: false,
    ghosts: [],
  };
}

function unitWarheads(u: Unit): number {
  return (u.lrbms ?? 0) + (u.mrbms ?? 0) + (u.srbms ?? 0) + (u.type === 'bomber' && u.armed ? 1 : 0);
}

function ownTerritoryZones(state: GameState, seat: number): ZoneId[] {
  const t = state.players[seat].territory;
  return Object.entries(MAP.landZones).filter(([, tt]) => tt === t).map(([z]) => z);
}

function countUnits(state: GameState, seat: number, type: string): number {
  return state.units.filter((u) => u.owner === seat && u.type === type).length;
}

// --- order validation (deterministic; the Adjudicator LLM only explains these) ---
export function validateOrder(state: GameState, seat: number, o: Order): string | null {
  const defcon = defconForRound(state.round);
  const unit = 'unitId' in o ? state.units.find((u) => u.id === o.unitId) : undefined;
  const host = 'hostId' in o ? state.units.find((u) => u.id === o.hostId) : undefined;
  switch (o.kind) {
    case 'place': {
      if (defcon < 4) return 'placement is not permitted after DEFCON 4';
      const spec = UNITS[o.type as keyof typeof UNITS] as { count?: number };
      if (!spec?.count) return `cannot place unit type ${o.type}`;
      if (countUnits(state, seat, o.type) >= spec.count) return `all ${o.type} units already placed`;
      const naval = o.type === 'carrier' || o.type === 'battleship' || o.type === 'sub';
      if (naval) {
        if (!isSea(o.zone)) return 'naval units must be placed in a sea zone';
        const own = ownTerritoryZones(state, seat);
        if (!own.some((z) => neighbors(z).includes(o.zone))) {
          return 'naval units must start in a sea adjacent to your territory';
        }
      } else {
        if (territoryOf(o.zone) !== state.players[seat].territory) {
          return 'ground units must be placed in your own territory';
        }
      }
      return null;
    }
    case 'move': {
      if (!unit || unit.owner !== seat) return 'no such unit';
      if (!['carrier', 'battleship', 'sub'].includes(unit.type)) return 'unit cannot move';
      if (!neighbors(unit.zone).includes(o.to) || !isSea(o.to)) return 'destination must be an adjacent sea zone';
      return null;
    }
    case 'mode': {
      if (!unit || unit.owner !== seat) return 'no such unit';
      if (unit.type === 'silo') {
        if (unit.siloMode === 'changing') return 'silo is already changing mode';
        if (o.mode === 'launch' && defcon > 2) return 'silos cannot change to Launch mode before DEFCON 2';
      }
      return null;
    }
    case 'launch': {
      if (!unit || unit.owner !== seat) return 'no such unit';
      if (defcon > 1) return 'nuclear launches are not permitted before DEFCON 1';
      if (unit.type === 'silo') {
        if (unit.siloMode !== 'launch') return 'silo is not in Launch mode';
        if ((unit.lrbms ?? 0) < 1) return 'silo has no missiles';
      } else if (unit.type === 'sub') {
        if (unit.subMode !== 'surfaced') return 'submarine must be surfaced to launch';
        if ((unit.mrbms ?? 0) < 1) return 'submarine has no missiles';
        if (hops(unit.zone, o.targetZone) > RANGES.mrbm) return 'target is beyond MRBM range';
      } else if (unit.type === 'bomber') {
        if (!unit.armed) return 'bomber has no SRBM';
        if (hops(unit.zone, o.targetZone) > RANGES.srbm) return 'target is beyond SRBM range';
      } else return 'unit cannot launch';
      return null;
    }
    case 'sortie': {
      if (!host || host.owner !== seat) return 'no such host';
      if ((host.fighters ?? 0) < 1) return 'no fighters available';
      if (defcon > 4) return 'scouting flights are not permitted before DEFCON 4';
      if (o.role === 'intercept' && defcon > 3) return 'combat air patrol requires DEFCON 3';
      if (hops(host.zone, o.zone) > UNITS.fighter.radius) return 'zone is beyond fighter radius';
      return null;
    }
    case 'takeoff': {
      if (!host || host.owner !== seat) return 'no such host';
      if ((host.bombers ?? 0) < 1) return 'no bombers available';
      if (defcon > 3) return 'bomber operations require DEFCON 3';
      return null;
    }
    case 'strike': {
      if (!unit || unit.owner !== seat || unit.type !== 'bomber') return 'no such bomber';
      if (defcon > 3) return 'conventional combat requires DEFCON 3';
      const t = state.units.find((u) => u.id === o.targetUnitId);
      if (!t || t.zone !== unit.zone) return 'target is not in the bomber zone';
      return null;
    }
  }
}

interface Missile {
  owner: number;
  from: ZoneId;
  targetZone: ZoneId;
  targetUnitId?: string;
  kind: 'lrbm' | 'mrbm' | 'srbm';
  intercepted?: boolean;
}

interface Sortie {
  owner: number;
  hostId: string;
  zone: ZoneId;
  route: ZoneId[];
  role: 'scout' | 'intercept';
  lost?: boolean;
}

export function resolveRound(
  state: GameState,
  ordersBySeat: OrderSet[],
  seed: number,
): { state: GameState; log: ResolutionLog } {
  const s: GameState = structuredClone(state);
  const rng: Rng = makeRng(seed);
  const log: ResolutionLog = [];
  const ev = (phase: number, type: string, rest: Record<string, unknown> = {}) =>
    log.push({ phase, type, ...rest } as LogEvent);
  const defcon = defconForRound(s.round);
  const unitById = () => new Map(s.units.map((u) => [u.id, u]));

  // --- Phase 1a: pending mode changes complete BEFORE order validation, so an
  // order that depends on the completed mode (e.g. launch) is legal this round.
  for (const u of s.units) {
    if (u.type === 'silo' && u.siloMode === 'changing') {
      u.siloMode = u.siloTargetMode ?? 'defend';
      delete u.siloTargetMode;
      ev(1, 'modeComplete', { unit: u.id, mode: u.siloMode });
    }
  }

  // Collect valid orders (invalid ones are skipped and logged).
  const valid: { seat: number; order: Order }[] = [];
  ordersBySeat.forEach((set, seat) => {
    for (const order of set ?? []) {
      const err = validateOrder(s, seat, order);
      if (err) ev(0, 'rejected', { seat, order, reason: err });
      else valid.push({ seat, order });
    }
  });

  // Placement (part of the orders step; happens before everything).
  for (const { seat, order } of valid) {
    if (order.kind !== 'place') continue;
    const t = order.type;
    const u: Unit = { id: uid(t), owner: seat, type: t, zone: order.zone, hp: (UNITS as any)[t].hp };
    if (t === 'silo') Object.assign(u, { siloMode: 'defend', lrbms: UNITS.silo.lrbms });
    if (t === 'sub') Object.assign(u, { subMode: 'submerged', mrbms: UNITS.sub.mrbms });
    if (t === 'airbase') Object.assign(u, { fighters: UNITS.airbase.fighterCap, bombers: UNITS.airbase.bomberCap, srbms: UNITS.airbase.srbms });
    if (t === 'carrier') Object.assign(u, { carrierMode: 'airops', fighters: UNITS.carrier.fighterCap, bombers: UNITS.carrier.bomberCap, srbms: UNITS.carrier.srbms });
    s.units.push(u);
    ev(0, 'placed', { seat, unit: u.id, unitType: t, zone: order.zone });
  }

  // --- Phase 1b: new mode changes start ---
  for (const { order } of valid) {
    if (order.kind !== 'mode') continue;
    const u = unitById().get(order.unitId)!;
    if (u.type === 'silo') {
      if (u.siloMode === order.mode) continue;
      u.siloTargetMode = order.mode as 'defend' | 'launch';
      u.siloMode = 'changing'; // vulnerable: cannot defend or fire this round
      ev(1, 'modeChanging', { unit: u.id, to: order.mode });
    } else if (u.type === 'sub') {
      u.subMode = order.mode as 'submerged' | 'surfaced';
      ev(1, 'mode', { unit: u.id, mode: order.mode });
    } else if (u.type === 'carrier') {
      u.carrierMode = order.mode as 'airops' | 'asw';
      ev(1, 'mode', { unit: u.id, mode: order.mode });
    }
  }

  // --- Phase 2: movement (naval + bombers) ---
  const moves = valid.filter((v) => v.order.kind === 'move') as { seat: number; order: Extract<Order, { kind: 'move' }> }[];
  // Fleet-swap edge case (§2.9): enemy units exchanging zones engage in the
  // defender's destination zone. Deterministic defender: higher seat index.
  for (const a of moves) {
    for (const b of moves) {
      const ua = unitById().get(a.order.unitId)!;
      const ub = unitById().get(b.order.unitId)!;
      if (ua.id >= ub.id || ua.owner === ub.owner) continue;
      if (a.order.to === ub.zone && b.order.to === ua.zone) {
        const defender = ua.owner > ub.owner ? a : b;
        const attacker = defender === a ? b : a;
        // attacker's move is cancelled; both end in the defender's destination
        (attacker.order as any).to = unitById().get(attacker.order.unitId)!.zone;
        ev(2, 'fleetSwapEngagement', {
          attacker: attacker.order.unitId, defender: defender.order.unitId,
          zone: defender.order.to,
        });
      }
    }
  }
  for (const { order } of moves) {
    const u = unitById().get(order.unitId)!;
    ev(2, 'moved', { unit: u.id, from: u.zone, to: order.to });
    u.zone = order.to;
  }
  // bomber takeoffs create airborne bomber units
  for (const { seat, order } of valid) {
    if (order.kind !== 'takeoff') continue;
    const host = unitById().get(order.hostId)!;
    if ((host.bombers ?? 0) < 1) continue;
    host.bombers!--;
    const armed = (host.srbms ?? 0) > 0;
    if (armed) host.srbms!--;
    const b: Unit = {
      id: uid('bomber'), owner: seat, type: 'bomber', zone: host.zone, hp: UNITS.bomber.hp,
      hostId: host.id, fuelUsed: 0, armed, targetZone: order.targetZone,
    };
    s.units.push(b);
    ev(2, 'takeoff', { unit: b.id, host: host.id, target: order.targetZone, armed });
  }
  // bombers move 1 zone toward their target; airborne bombers burn fuel every
  // round, moving or loitering
  for (const u of s.units) {
    if (u.type !== 'bomber') continue;
    if (u.targetZone && u.zone !== u.targetZone) {
      const step = stepToward(u.zone, u.targetZone, () => true);
      if (step) {
        ev(2, 'bomberMove', { unit: u.id, from: u.zone, to: step });
        u.zone = step;
      }
    }
    u.fuelUsed = (u.fuelUsed ?? 0) + 1;
  }

  // --- Phase 3: air operations (sorties, detection) ---
  const sorties: Sortie[] = [];
  for (const { seat, order } of valid) {
    if (order.kind !== 'sortie') continue;
    const host = unitById().get(order.hostId);
    if (!host || (host.fighters ?? 0) < 1) continue;
    // route: shortest path zones (revealed to the owner; used for combat presence)
    const route: ZoneId[] = [host.zone];
    let cur = host.zone;
    while (cur !== order.zone) {
      const step = stepToward(cur, order.zone, () => true);
      if (!step) break;
      route.push(step);
      cur = step;
    }
    sorties.push({ owner: seat, hostId: host.id, zone: order.zone, route, role: order.role });
    ev(3, 'sortie', { seat, host: host.id, zone: order.zone, role: order.role, route });
  }

  // detection resolves here (phase 3) — before impacts and combat (§2.9)
  if (defcon <= 4) {
    for (const p of s.players) {
      const seen = visibleUnits(s, p.seat).filter((u) => u.owner !== p.seat);
      if (seen.length) ev(3, 'detect', { seat: p.seat, units: seen.map((u) => u.id) });
    }
  }

  // --- Phase 4: launch announcements ---
  const missiles: Missile[] = [];
  for (const { seat, order } of valid) {
    if (order.kind !== 'launch') continue;
    const u = unitById().get(order.unitId)!;
    const count = Math.max(1, order.count ?? 1);
    for (let i = 0; i < count; i++) {
      let kind: Missile['kind'];
      if (u.type === 'silo') {
        if ((u.lrbms ?? 0) < 1 || u.siloMode !== 'launch') break;
        u.lrbms!--; kind = 'lrbm';
      } else if (u.type === 'sub') {
        if ((u.mrbms ?? 0) < 1) break;
        u.mrbms!--; kind = 'mrbm';
      } else {
        if (!u.armed) break;
        u.armed = false; kind = 'srbm';
      }
      s.warheadsExpended++;
      missiles.push({ owner: seat, from: u.zone, targetZone: order.targetZone, targetUnitId: order.targetUnitId, kind });
      ev(4, 'launch', { seat, unit: u.id, kind, from: u.zone, target: order.targetZone });
    }
    if (u.type === 'silo' || u.type === 'sub') {
      if (!s.ghosts.some((g) => g.zone === u.zone && g.owner === seat)) {
        s.ghosts.push({ zone: u.zone, owner: seat });
      }
    }
  }

  // --- Phase 5: interception ---
  for (const m of missiles) {
    // Defend-mode silos within 1 hop of the target zone (own + adjacent zones)
    for (const silo of s.units) {
      if (m.intercepted) break;
      if (silo.type !== 'silo' || silo.siloMode !== 'defend' || silo.owner === m.owner) continue;
      if (silo.zone !== m.targetZone && !neighbors(silo.zone).includes(m.targetZone)) continue;
      if (rng() < COMBAT.siloInterceptsMissile) {
        m.intercepted = true; // already counted as expended at launch (phase 4)
        ev(5, 'intercept', { by: silo.id, missile: m.kind, target: m.targetZone });
      }
    }
    // intercept-role fighters in the target zone
    for (const f of sorties) {
      if (m.intercepted) break;
      if (f.role !== 'intercept' || f.owner === m.owner || f.zone !== m.targetZone) continue;
      if (rng() < COMBAT.fighterInterceptsMissile) {
        m.intercepted = true;
        ev(5, 'intercept', { by: `fighter(${f.hostId})`, missile: m.kind, target: m.targetZone });
      }
    }
  }
  // silos and fighters also roll against bombers in range (spec phase 5)
  for (const b of s.units.filter((u) => u.type === 'bomber')) {
    let dead = false;
    for (const silo of s.units) {
      if (dead) break;
      if (silo.type !== 'silo' || silo.siloMode !== 'defend' || silo.owner === b.owner) continue;
      if (silo.zone !== b.zone && !neighbors(silo.zone).includes(b.zone)) continue;
      if (rng() < COMBAT.siloInterceptsMissile) dead = true;
    }
    for (const f of sorties) {
      if (dead) break;
      if (f.role !== 'intercept' || f.owner === b.owner || f.zone !== b.zone) continue;
      if (rng() < COMBAT.fighterKillsBomber) dead = true;
    }
    if (dead) {
      b.hp = 0;
      ev(5, 'bomberDown', { unit: b.id, zone: b.zone });
    }
  }

  // --- Phase 6: impacts ---
  const megadeathsByVictimTerritory = new Map<string, number>();
  for (const m of missiles) {
    if (m.intercepted) continue;
    const target = m.targetUnitId ? unitById().get(m.targetUnitId) : undefined;
    if (target && target.zone === m.targetZone && target.hp > 0) {
      target.hp--;
      ev(6, 'unitHit', { unit: target.id, hp: target.hp, by: m.owner });
      continue;
    }
    // city strike: largest surviving city in the zone; overkill spills to the
    // next largest in the same territory (spec §2.6)
    const zoneTerr = territoryOf(m.targetZone);
    const candidates = s.cities
      .filter((c) => c.pop >= 1 && (c.zone === m.targetZone || c.territory === zoneTerr))
      .sort((a, b2) => (a.zone === m.targetZone ? 0 : 1) - (b2.zone === m.targetZone ? 0 : 1) || b2.pop - a.pop);
    const city = candidates[0];
    if (!city) {
      ev(6, 'wasted', { zone: m.targetZone, by: m.owner });
      continue;
    }
    const killed = city.pop / 2;
    city.pop -= killed;
    megadeathsByVictimTerritory.set(city.territory, (megadeathsByVictimTerritory.get(city.territory) ?? 0) + killed);
    ev(6, 'cityHit', { city: city.id, killed: +killed.toFixed(2), remaining: +city.pop.toFixed(2), by: m.owner });
    // scoring attribution (spec §2.6: points go to the launching player)
    const victimSeat = s.players.findIndex((p) => p.territory === city.territory);
    if (s.scoreMode === 'default') {
      if (victimSeat !== m.owner) s.players[m.owner].score += 2 * killed;
      if (victimSeat >= 0) s.players[victimSeat].score -= killed;
    } else if (s.scoreMode === 'genocide') {
      if (victimSeat !== m.owner) s.players[m.owner].score += killed;
    }
  }

  // --- Phase 7: conventional combat ---
  if (defcon <= 3) {
    const snapshot = structuredClone(s.units); // simultaneous: attacks read pre-phase state
    const damage = new Map<string, number>();
    const hit = (id: string) => damage.set(id, (damage.get(id) ?? 0) + 1);
    const visibleNaval = (z: ZoneId, notOwner: number) =>
      snapshot.filter((u) => u.owner !== notOwner && u.hp > 0 &&
        (u.type === 'battleship' || u.type === 'carrier' || (u.type === 'sub' && u.subMode === 'surfaced') || u.type === 'bomber') &&
        u.zone === z);
    for (const bs of snapshot.filter((u) => u.type === 'battleship' && u.hp > 0)) {
      const zones = [bs.zone, ...neighbors(bs.zone).filter(isSea)];
      const targets = zones.flatMap((z) => visibleNaval(z, bs.owner)).sort((a, b) => a.id.localeCompare(b.id));
      if (targets.length && rng() < COMBAT.battleshipHits) {
        hit(targets[0].id);
        ev(7, 'battleshipHit', { by: bs.id, target: targets[0].id });
      }
    }
    for (const cv of snapshot.filter((u) => u.type === 'carrier' && u.carrierMode === 'asw' && u.hp > 0)) {
      const subs = snapshot.filter((u) => u.type === 'sub' && u.owner !== cv.owner && u.zone === cv.zone && u.hp > 0);
      for (const sub of subs) {
        if (rng() < COMBAT.carrierAswHits) {
          hit(sub.id);
          ev(7, 'depthCharge', { by: cv.id, target: sub.id });
        }
      }
    }
    for (const { order } of valid) {
      if (order.kind !== 'strike') continue;
      const b = unitById().get(order.unitId);
      const t = unitById().get(order.targetUnitId);
      if (!b || b.hp <= 0 || !t || t.zone !== b.zone) continue;
      if (rng() < COMBAT.bomberHitsNaval) {
        hit(t.id);
        ev(7, 'bomberStrike', { by: b.id, target: t.id });
      }
    }
    // fighter vs fighter where intercept sorties overlap enemy sorties
    for (const f of sorties) {
      if (f.role !== 'intercept' || f.lost) continue;
      const enemy = sorties.find((g) => g.owner !== f.owner && !g.lost && g.zone === f.zone);
      if (enemy && rng() < COMBAT.fighterKillsFighter) {
        enemy.lost = true;
        const host = unitById().get(enemy.hostId);
        if (host && (host.fighters ?? 0) > 0) host.fighters!--;
        ev(7, 'fighterDown', { host: enemy.hostId, zone: f.zone });
      }
    }
    for (const [id, dmg] of damage) {
      const u = unitById().get(id);
      if (u) {
        u.hp -= dmg;
        if (u.hp <= 0) ev(7, 'destroyed', { unit: u.id, unitType: u.type });
      }
    }
  }

  // --- Phase 8: cleanup ---
  // destroyed units surrender their remaining warheads to the expended count
  for (const u of s.units) {
    if (u.hp > 0) continue;
    s.warheadsExpended += unitWarheads(u);
    ev(8, 'removed', { unit: u.id, unitType: u.type, zone: u.zone });
  }
  s.units = s.units.filter((u) => u.hp > 0);
  // §2.9: aircraft with a destroyed host — fighters are counts on the host and
  // die with it; orphaned bombers keep flying until fuel runs out.
  const ids = new Set(s.units.map((u) => u.id));
  for (const b of s.units.filter((u) => u.type === 'bomber')) {
    const atHost = b.hostId && ids.has(b.hostId) && s.units.find((u) => u.id === b.hostId)!.zone === b.zone;
    if (atHost && b.zone === b.targetZone) {
      // land, refuel, rearm
      const host = s.units.find((u) => u.id === b.hostId)!;
      if ((host.bombers ?? 0) < ((host.type === 'airbase' ? UNITS.airbase.bomberCap : UNITS.carrier.bomberCap))) {
        host.bombers = (host.bombers ?? 0) + 1;
        b.hp = 0;
        ev(8, 'landed', { unit: b.id, host: host.id });
      }
    } else if ((b.fuelUsed ?? 0) >= UNITS.bomber.fuel) {
      if (b.armed) s.warheadsExpended++;
      b.hp = 0;
      ev(8, 'crashed', { unit: b.id, zone: b.zone });
    }
  }
  s.units = s.units.filter((u) => u.hp > 0);
  // hosts regenerate one fighter per round up to capacity
  for (const h of s.units) {
    if (h.type === 'airbase' && (h.fighters ?? 0) < UNITS.airbase.fighterCap) h.fighters!++;
    if (h.type === 'carrier' && (h.fighters ?? 0) < UNITS.carrier.fighterCap) h.fighters!++;
  }
  // survivor score = surviving population
  if (s.scoreMode === 'survivor') {
    for (const p of s.players) {
      p.score = s.cities.filter((c) => c.territory === p.territory).reduce((a, c) => a + c.pop, 0);
    }
  }
  // victory countdown (spec §2.3): 80% of all warheads launched or destroyed
  const remaining = s.units.reduce((a, u) => a + unitWarheads(u), 0);
  const total = remaining + s.warheadsExpended;
  // NOTE (M0 tournament): a population-floor countdown trigger was tested and
  // rejected — it converts kill speed into game-ending power and makes the
  // alpha strike dominant (95-100% vs staggered). Warhead threshold only.
  if (s.countdown === null && defcon === 1 &&
      total > 0 && s.warheadsExpended / total >= VICTORY.warheadThreshold) {
    s.countdown = VICTORY.countdownRounds;
    ev(8, 'countdownStarted', { expended: s.warheadsExpended, total });
  } else if (s.countdown !== null) {
    s.countdown--;
  }
  if (s.countdown === 0) {
    s.finished = true;
    s.endReason = 'countdown';
  }
  if (s.round >= s.maxRounds) {
    s.finished = true;
    s.endReason ??= 'maxRounds';
  }
  ev(8, 'roundEnd', {
    round: s.round,
    defcon,
    scores: s.players.map((p) => +p.score.toFixed(1)),
    expendedFraction: total > 0 ? +(s.warheadsExpended / total).toFixed(3) : 0,
  });
  s.round++;
  return { state: s, log };
}

// --- fog of war (spec §2.5): what one seat can see ---
export function visibleUnits(state: GameState, seat: number): Unit[] {
  const own = state.units.filter((u) => u.owner === seat);
  const detectors: { zone: ZoneId; range: number }[] = own.map((u) => ({
    zone: u.zone,
    range: u.type === 'radar' ? RANGES.radarDetect
      : ['battleship', 'carrier', 'airbase'].includes(u.type) ? RANGES.surfaceDetect
      : 0,
  }));
  return state.units.filter((u) => {
    if (u.owner === seat) return true;
    if (u.type === 'sub' && u.subMode === 'submerged') {
      // only ASW carriers and own subs in the same zone
      return own.some((o) => o.zone === u.zone && (o.type === 'sub' || (o.type === 'carrier' && o.carrierMode === 'asw')));
    }
    return detectors.some((d) => hops(d.zone, u.zone) <= d.range);
  });
}
