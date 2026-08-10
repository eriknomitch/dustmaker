// M1 hotseat client: two humans (or human vs bot) share one browser.
// The client runs the same engine module the server will run in M2.
import { Application, Graphics, Text, Container } from 'pixi.js';
import { createInitialState, resolveRound, visibleUnits, validateOrder } from '../../engine/src/engine';
import { defconForRound } from '../../engine/src/constants';
import { MAP, neighbors, isSea } from '../../engine/src/map';
import { botOrders } from '../../engine/src/bots';
import type { GameState, Order, Unit, ResolutionLog } from '../../engine/src/types';
import { ZONE_POS, TERRITORY_COLOR, UNIT_GLYPH } from './layout';

type SeatKind = 'human' | 'alpha' | 'staggered' | 'turtle';
const SEATS: SeatKind[] = ['human', 'human']; // change seat 1 to a doctrine for single-player
const TERRITORIES = ['NA', 'RU'];

let state: GameState = createInitialState(TERRITORIES);
let seat = 0; // whose orders screen is showing
let queued: Order[][] = SEATS.map(() => []);
let committed: boolean[] = SEATS.map(() => false);
let lastLog: ResolutionLog = [];
let selected: Unit | null = null;
let pendingTargetFor: 'move' | 'launch' | 'sortie' | 'takeoff' | null = null;

const $ = (id: string) => document.getElementById(id)!;

// ---------- Pixi setup ----------
// NOTE: no top-level await here. Pixi dynamically imports its renderer chunk,
// which shares the entry chunk; a pending TLA in the entry deadlocks that import.
const app = new Application();
const world = new Container();

async function boot() {
  await app.init({ preference: 'webgl', background: 0x000000, resizeTo: $('map') as HTMLDivElement, antialias: true });
  $('map').appendChild(app.canvas);
  app.stage.addChild(world);
  app.canvas.addEventListener('click', (e) => {
    const r = app.canvas.getBoundingClientRect();
    const sx = 1200 / r.width;
    const z = zoneAt((e.clientX - r.left) * sx, (e.clientY - r.top) * sx);
    if (z) onZoneClick(z);
  });
  overlay('Two-player hotseat. Each player queues secret orders and commits; the round resolves when both are in. Use AUTO-PLACE on round 1.', 'START', () => startTurn(0));
}

function zoneAt(px: number, py: number): string | null {
  for (const [z, [x, y]] of Object.entries(ZONE_POS)) {
    if ((px - x) ** 2 + (py - y) ** 2 < 28 ** 2) return z;
  }
  return null;
}

function draw() {
  world.removeChildren();
  world.scale.set(Math.min(app.renderer.width / 1200, app.renderer.height / 560));
  const g = new Graphics();
  world.addChild(g);
  // edges
  for (const [a, b] of MAP.edges) {
    const [ax, ay] = ZONE_POS[a];
    const [bx, by] = ZONE_POS[b];
    g.moveTo(ax, ay).lineTo(bx, by).stroke({ color: 0x0e3d49, width: 1 });
  }
  const visible = visibleUnits(state, seat);
  const legal = new Set(legalTargetZones());
  for (const [z, [x, y]] of Object.entries(ZONE_POS)) {
    const terr = MAP.landZones[z];
    const color = terr ? TERRITORY_COLOR[terr] : 0x1a5f70;
    if (legal.has(z)) g.circle(x, y, 24).stroke({ color: 0xffc23a, width: 2 });
    g.circle(x, y, isSea(z) ? 5 : 7).stroke({ color, width: 1.5 });
    const label = new Text({ text: z, style: { fill: 0x2a6f80, fontSize: 9, fontFamily: 'monospace' } });
    label.position.set(x - label.width / 2, y + 10);
    world.addChild(label);
    // cities: diamonds shrink with population
    const cities = state.cities.filter((c) => c.zone === z && c.pop >= 1);
    cities.forEach((c, i) => {
      const s = 2 + (c.pop / c.initialPop) * 4;
      const cx = x - 14 + i * 8;
      const cy = y - 14;
      g.moveTo(cx, cy - s).lineTo(cx + s, cy).lineTo(cx, cy + s).lineTo(cx - s, cy).closePath()
        .stroke({ color: TERRITORY_COLOR[c.territory] ?? 0x666666, width: 1 });
    });
    // units in this zone (fog-filtered)
    const here = visible.filter((u) => u.zone === z);
    here.forEach((u, i) => {
      const mine = u.owner === seat;
      const t = new Text({
        text: UNIT_GLYPH[u.type] + (u.type === 'silo' ? (u.siloMode === 'launch' ? '!' : u.siloMode === 'changing' ? '~' : '') : ''),
        style: { fill: mine ? 0x35e0ff : 0xff5a5a, fontSize: 13, fontFamily: 'monospace' },
      });
      t.position.set(x + 10 + (i % 3) * 13, y - 22 + Math.floor(i / 3) * 13);
      if (selected?.id === u.id) {
        g.circle(t.x + 5, t.y + 7, 9).stroke({ color: 0xffc23a, width: 1.5 });
      }
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.on('pointerdown', (ev) => { ev.stopPropagation(); onUnitClick(u); });
      world.addChild(t);
    });
    // ghost markers
    if (state.ghosts.some((gh) => gh.zone === z && gh.owner !== seat)) {
      const t = new Text({ text: '☢', style: { fill: 0xff4b4b, fontSize: 11 } });
      t.position.set(x + 12, y + 8);
      world.addChild(t);
    }
  }
}

// ---------- order UX ----------
function legalTargetZones(): string[] {
  if (!selected || !pendingTargetFor) return [];
  const all = [...Object.keys(MAP.landZones), ...MAP.seaZones];
  return all.filter((z) => {
    const o = makeOrder(z);
    return o && validateOrder(state, seat, o) === null;
  });
}

function makeOrder(targetZone: string): Order | null {
  if (!selected) return null;
  switch (pendingTargetFor) {
    case 'move': return { kind: 'move', unitId: selected.id, to: targetZone };
    case 'launch': return { kind: 'launch', unitId: selected.id, targetZone };
    case 'sortie': return { kind: 'sortie', hostId: selected.id, zone: targetZone, role: 'scout' };
    case 'takeoff': return { kind: 'takeoff', hostId: selected.id, targetZone };
    default: return null;
  }
}

function onUnitClick(u: Unit) {
  if (u.owner !== seat) { hint('Enemy unit. You can target it via a launch on its zone.'); return; }
  selected = u;
  pendingTargetFor = null;
  renderActions();
  draw();
}

function onZoneClick(z: string) {
  if (selected && pendingTargetFor) {
    const o = makeOrder(z);
    const err = o ? validateOrder(state, seat, o) : 'invalid';
    if (o && !err) {
      queued[seat] = queued[seat].filter((q) => !('unitId' in q && 'unitId' in o && q.unitId === (o as any).unitId && q.kind === o.kind));
      queued[seat].push(o);
      hint(`Order queued: ${o.kind} → ${z}`);
      pendingTargetFor = null;
      renderOrders();
    } else hint(err ?? 'invalid target');
    draw();
    return;
  }
  // placement shortcut: at DEFCON 5/4 clicking a zone offers placement via buttons
  hint(`Zone ${z}${MAP.landZones[z] ? ` (${MAP.landZones[z]})` : ' (sea)'}`);
}

function hint(msg: string) { $('hint').textContent = msg; }

function renderActions() {
  const el = $('actions');
  el.innerHTML = '';
  const defcon = defconForRound(state.round);
  const add = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = 'small';
    b.textContent = label;
    b.onclick = fn;
    el.appendChild(b);
  };
  if (defcon >= 4) {
    for (const t of ['silo', 'radar', 'airbase', 'carrier', 'battleship', 'sub'] as const) {
      add(`place ${t}`, () => {
        hint(`Click handled via auto-place for M1 — use AUTO-PLACE.`);
      });
    }
    add('AUTO-PLACE ALL', () => {
      queued[seat] = botOrders(state, seat, 'staggered').filter((o) => o.kind === 'place');
      renderOrders();
      hint(`${queued[seat].length} placement orders queued.`);
    });
  }
  if (!selected) return;
  const u = selected;
  if (['carrier', 'battleship', 'sub'].includes(u.type)) add('move', () => { pendingTargetFor = 'move'; hint('Click a highlighted sea zone.'); draw(); });
  if (u.type === 'silo') add(u.siloMode === 'defend' ? 'mode: LAUNCH' : 'mode: DEFEND', () => {
    const o: Order = { kind: 'mode', unitId: u.id, mode: u.siloMode === 'defend' ? 'launch' : 'defend' };
    const err = validateOrder(state, seat, o);
    if (err) return hint(err);
    queued[seat].push(o); renderOrders();
  });
  if (u.type === 'sub') add(u.subMode === 'submerged' ? 'SURFACE' : 'DIVE', () => {
    queued[seat].push({ kind: 'mode', unitId: u.id, mode: u.subMode === 'submerged' ? 'surfaced' : 'submerged' }); renderOrders();
  });
  if (u.type === 'carrier') add(u.carrierMode === 'airops' ? 'mode: ASW' : 'mode: AIR OPS', () => {
    queued[seat].push({ kind: 'mode', unitId: u.id, mode: u.carrierMode === 'airops' ? 'asw' : 'airops' }); renderOrders();
  });
  if (u.type === 'silo' || u.type === 'sub' || u.type === 'bomber') add('launch…', () => { pendingTargetFor = 'launch'; hint('Click a highlighted target zone.'); draw(); });
  if (u.type === 'airbase' || u.type === 'carrier') {
    add('scout…', () => { pendingTargetFor = 'sortie'; hint('Click a zone within 3 hops.'); draw(); });
    add('bomber…', () => { pendingTargetFor = 'takeoff'; hint('Click the bomber target zone.'); draw(); });
  }
}

function renderOrders() {
  const ul = $('orders');
  ul.innerHTML = '';
  queued[seat].forEach((o, i) => {
    const li = document.createElement('li');
    li.textContent = `${o.kind} ${'unitId' in o ? o.unitId : 'hostId' in o ? o.hostId : (o as any).type ?? ''} ${'to' in o ? '→ ' + o.to : 'targetZone' in o ? '→ ' + (o as any).targetZone : 'zone' in o ? '→ ' + (o as any).zone : 'mode' in o ? '→ ' + (o as any).mode : ''}`;
    const b = document.createElement('button');
    b.className = 'small';
    b.textContent = '✕';
    b.onclick = () => { queued[seat].splice(i, 1); renderOrders(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
  $('commit').textContent = `COMMIT ORDERS (${queued[seat].length} queued)`;
}

function renderTopbar() {
  $('tb-round').textContent = `ROUND ${state.round}`;
  $('tb-defcon').textContent = `DEFCON ${defconForRound(state.round)}`;
  $('tb-player').textContent = `${TERRITORIES[seat]} (P${seat + 1})`;
  $('tb-scores').textContent = state.players.map((p) => `${p.territory} ${p.score.toFixed(0)}`).join('  ');
}

function renderLog() {
  // M1 fog note: launches are public (spec §2.4 phase 4); placement and
  // rejection events are private to their seat. Full per-seat log filtering
  // is the M2 server's job.
  $('log').textContent = lastLog
    .filter((e) => !['detect', 'roundEnd'].includes(e.type))
    .filter((e) => !(['placed', 'rejected', 'sortie'].includes(e.type) && (e as any).seat !== seat))
    .map((e) => `[p${e.phase}] ${e.type} ${JSON.stringify({ ...e, phase: undefined, type: undefined })}`)
    .join('\n') || '(quiet round)';
}

// ---------- hotseat flow ----------
function overlay(msg: string, btn: string, fn: () => void) {
  $('overlay').classList.remove('hidden');
  $('overlay-msg').textContent = msg;
  const b = $('overlay-btn') as HTMLButtonElement;
  b.textContent = btn;
  b.onclick = () => { $('overlay').classList.add('hidden'); fn(); };
}

function startTurn(s: number) {
  seat = s;
  selected = null;
  pendingTargetFor = null;
  overlay(`Hand the device to Player ${s + 1} (${TERRITORIES[s]}). Orders are secret — the other player should look away.`, `BEGIN P${s + 1} TURN`, () => {
    renderTopbar(); renderActions(); renderOrders(); renderLog(); draw();
  });
}

$('commit').onclick = () => {
  committed[seat] = true;
  const next = SEATS.findIndex((k, i) => k === 'human' && !committed[i]);
  if (next >= 0) return startTurn(next);
  // all humans in: bots fill their seats, then resolve
  SEATS.forEach((k, i) => { if (k !== 'human') queued[i] = botOrders(state, i, k); });
  const { state: ns, log } = resolveRound(state, queued, Date.now() % 2 ** 31);
  state = ns;
  lastLog = log;
  queued = SEATS.map(() => []);
  committed = SEATS.map(() => false);
  if (state.finished) {
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    overlay(`GAME OVER (${state.endReason}). ${ranked.map((p) => `${p.territory}: ${p.score.toFixed(1)}`).join(' — ')}`, 'NEW GAME', () => location.reload());
  } else {
    startTurn(SEATS.findIndex((k) => k === 'human'));
  }
};

boot();
