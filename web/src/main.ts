// Single-player client: you command seat 0; AI doctrines hold the other seats.
// The client runs the same engine module the M2 server will run.
import { Application, Graphics, Text, Container } from 'pixi.js';
import { createInitialState, resolveRound, visibleUnits, validateOrder } from '../../engine/src/engine';
import { defconForRound, UNITS } from '../../engine/src/constants';
import { MAP, neighbors, isSea } from '../../engine/src/map';
import { botOrders, type Doctrine } from '../../engine/src/bots';
import type { GameState, Order, Unit, ResolutionLog } from '../../engine/src/types';
import { ZONE_POS, TERRITORY_COLOR, UNIT_GLYPH } from './layout';
import COAST from './coast.json';

const SEATS: ('human' | Doctrine)[] = ['human', 'staggered', 'turtle', 'alpha'];
const TERRITORIES = ['NA', 'RU', 'EU', 'AS'];
const YOU = 0;

let state: GameState = createInitialState(TERRITORIES);
let queued: Order[] = [];
const viaAI = new Set<Order>();
let lastLog: ResolutionLog = [];
let selected: Unit | null = null;
let pendingTargetFor: 'move' | 'launch' | 'sortie' | 'takeoff' | null = null;
let draft: Order[] | null = null;
const gameSeed = (Date.now() % 100000) + 7;

const $ = (id: string) => document.getElementById(id)!;

const PHASE_NAMES: Record<number, string> = {
  0: 'Orders & placement', 1: 'Mode changes', 2: 'Movement', 3: 'Air operations',
  4: 'Launch detection', 5: 'Interception', 6: 'Impacts', 7: 'Conventional combat', 8: 'Cleanup',
};
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

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
    const z = zoneAt((e.clientX - r.left) * sx, (e.clientY - r.top) * sx - 30);
    if (z) onZoneClick(z);
  });
  $('btn-sitrep').onclick = () => { renderLog(); $('sitrep-back').classList.remove('hidden'); };
  $('sitrep-close').onclick = () => $('sitrep-back').classList.add('hidden');
  ($('comms-send') as HTMLButtonElement).onclick = sendChat;
  ($('comms-input') as HTMLInputElement).onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
  $('commit').onclick = commitRound;
  overlay(
    'You command NORTH AMERICA. Three AI commanders hold Russia, Europe and South Asia. '
    + 'Queue orders on the map or ask your Chief of Staff to draft your turn. '
    + 'The round resolves when you commit.',
    'ASSUME COMMAND',
    () => {
      renderAll();
      chat('cos', 'Good morning, Commander. Placement window is open — put our silos, radar and fleets on the board, or say "draft my turn" and I\'ll propose a full set. The other three commands will not wait for us.');
    },
  );
}

function renderAll() {
  renderTopbar(); renderForces(); renderActions(); renderOrders(); draw();
}

function zoneAt(px: number, py: number): string | null {
  for (const [z, [x, y]] of Object.entries(ZONE_POS)) {
    if ((px - x) ** 2 + (py - y) ** 2 < 26 ** 2) return z;
  }
  return null;
}

// ---------- map ----------
function project(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * 1200, ((83 - lat) / 143) * 560];
}

function draw() {
  world.removeChildren();
  const scale = Math.min(app.renderer.width / 1200, (app.renderer.height - 60) / 560);
  world.scale.set(scale);
  world.position.set(0, 30 * scale);
  const g = new Graphics();
  world.addChild(g);
  // real coastlines (extracted from the FIRST STRIKE mock)
  for (const line of COAST as [number, number][][]) {
    if (line.every(([, lat]) => lat < -58)) continue; // skip the Antarctic ring
    let prev: [number, number] | null = null;
    for (const [lon, lat] of line) {
      const [x, y] = project(lon, lat);
      // break the path at the dateline instead of drawing across the map
      if (!prev || Math.abs(lon - prev[0]) > 180) g.moveTo(x, y);
      else g.lineTo(x, y);
      prev = [lon, lat];
    }
    g.stroke({ color: 0x232323, width: 1 });
  }
  // dotted background grid
  for (let gx = 40; gx < 1500; gx += 55) {
    for (let gy = 20; gy < 560; gy += 55) {
      g.rect(gx, gy, 1.2, 1.2).fill({ color: 0x161616 });
    }
  }
  // territory name watermarks
  const terrZones = new Map<string, [number, number][]>();
  for (const [z, t] of Object.entries(MAP.landZones)) {
    if (!terrZones.has(t)) terrZones.set(t, []);
    terrZones.get(t)!.push(ZONE_POS[z]);
  }
  const TERRITORY_NAMES: Record<string, string> = {
    NA: 'N  A M E R I C A', SA: 'S  A M E R I C A', EU: 'E U R O P E',
    RU: 'R U S S I A', AS: 'S  A S I A', AF: 'A F R I C A',
  };
  for (const [t, pts] of terrZones) {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const owner = state.players.find((p) => p.territory === t);
    const label = new Text({
      text: TERRITORY_NAMES[t] ?? t,
      style: { fill: 0x3a3a3a, fontSize: 12, fontFamily: 'monospace' },
    });
    label.position.set(cx - label.width / 2, cy - 42);
    world.addChild(label);
    if (owner) {
      const tag = owner.seat === YOU ? '· YOU ·' : '· AI ·';
      const you = new Text({ text: tag, style: { fill: 0x555555, fontSize: 8, fontFamily: 'monospace' } });
      you.position.set(cx - you.width / 2, cy - 28);
      world.addChild(you);
    }
  }
  // zone graph — edges spanning the dateline wrap off both sides of the map
  for (const [a, b] of MAP.edges) {
    const [ax, ay] = ZONE_POS[a];
    const [bx, by] = ZONE_POS[b];
    if (Math.abs(ax - bx) > 600) {
      const [lx, ly, rx, ry] = ax < bx ? [ax, ay, bx, by] : [bx, by, ax, ay];
      g.moveTo(lx, ly).lineTo(rx - 1200, ry).stroke({ color: 0x151b1e, width: 1 });
      g.moveTo(rx, ry).lineTo(lx + 1200, ly).stroke({ color: 0x151b1e, width: 1 });
    } else {
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ color: 0x151b1e, width: 1 });
    }
  }
  const visible = visibleUnits(state, YOU);
  const legal = new Set(legalTargetZones());
  for (const [z, [x, y]] of Object.entries(ZONE_POS)) {
    const terr = MAP.landZones[z];
    const color = terr ? TERRITORY_COLOR[terr] : 0x1a5f70;
    if (legal.has(z)) g.circle(x, y, 24).stroke({ color: 0xffc23a, width: 2 });
    g.circle(x, y, isSea(z) ? 5 : 7).stroke({ color, width: 1.5 });
    const label = new Text({ text: z, style: { fill: 0x2a3a40, fontSize: 9, fontFamily: 'monospace' } });
    label.position.set(x - label.width / 2, y + 10);
    world.addChild(label);
    const cities = state.cities.filter((c) => c.zone === z && c.pop >= 1);
    cities.forEach((c, i) => {
      const s = 2 + (c.pop / c.initialPop) * 4;
      const cx = x - 14 + i * 8;
      const cy = y - 14;
      g.moveTo(cx, cy - s).lineTo(cx + s, cy).lineTo(cx, cy + s).lineTo(cx - s, cy).closePath()
        .stroke({ color: TERRITORY_COLOR[c.territory] ?? 0x666666, width: 1 });
    });
    const here = visible.filter((u) => u.zone === z);
    here.forEach((u, i) => {
      const mine = u.owner === YOU;
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
    if (state.ghosts.some((gh) => gh.zone === z && gh.owner !== YOU)) {
      const t = new Text({ text: '☢', style: { fill: 0xff4b4b, fontSize: 11 } });
      t.position.set(x + 12, y + 8);
      world.addChild(t);
    }
  }
  drawStrikes(g);
}

// Last round's missile traffic, drawn as dashed arcs with impact markers.
// This is the briefing layer: it persists until the next commit.
function drawStrikes(g: Graphics) {
  for (const e of lastLog) {
    if (e.type === 'launch') {
      const from = ZONE_POS[(e as any).from];
      const to = ZONE_POS[(e as any).target];
      if (!from || !to) continue;
      const [x1, y1] = from;
      const [x2, y2] = to;
      const mx = (x1 + x2) / 2;
      const my = Math.max(14, (y1 + y2) / 2 - Math.min(90, Math.abs(x2 - x1) * 0.25 + 30));
      // quadratic arc sampled into dashes
      let px = x1, py = y1;
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t ** 2 * x2;
        const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t ** 2 * y2;
        if (i % 2 === 0) g.moveTo(px, py).lineTo(x, y).stroke({ color: 0xff2a1f, width: 1, alpha: 0.75 });
        px = x; py = y;
      }
      g.circle(x2, y2, 2).fill({ color: 0xff2a1f });
    } else if (e.type === 'cityHit') {
      const city = state.cities.find((c) => c.id === (e as any).city);
      const pos = city && ZONE_POS[city.zone];
      if (!pos) continue;
      g.circle(pos[0], pos[1], 10).stroke({ color: 0xff2a1f, width: 1, alpha: 0.9 });
      g.circle(pos[0], pos[1], 16).stroke({ color: 0xff2a1f, width: 1, alpha: 0.4 });
    } else if (e.type === 'intercept') {
      const pos = ZONE_POS[(e as any).target];
      if (!pos) continue;
      const [x, y] = pos;
      g.moveTo(x - 4, y - 4).lineTo(x + 4, y + 4).stroke({ color: 0xffc23a, width: 1.5, alpha: 0.9 });
      g.moveTo(x + 4, y - 4).lineTo(x - 4, y + 4).stroke({ color: 0xffc23a, width: 1.5, alpha: 0.9 });
    }
  }
}

// ---------- order UX ----------
function legalTargetZones(): string[] {
  if (!selected || !pendingTargetFor) return [];
  const all = [...Object.keys(MAP.landZones), ...MAP.seaZones];
  return all.filter((z) => {
    const o = makeOrder(z);
    return o && validateOrder(state, YOU, o) === null;
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
  if (u.owner !== YOU) { hint('Enemy unit. Target its zone with a launch or strike.'); return; }
  selected = u;
  pendingTargetFor = null;
  renderActions();
  draw();
}

function onZoneClick(z: string) {
  if (selected && pendingTargetFor) {
    const o = makeOrder(z);
    const err = o ? validateOrder(state, YOU, o) : 'invalid';
    if (o && !err) {
      queued = queued.filter((q) => !('unitId' in q && 'unitId' in o && q.unitId === (o as any).unitId && q.kind === o.kind));
      queued.push(o);
      hint(`Order queued: ${o.kind} → ${z}`);
      pendingTargetFor = null;
      renderOrders();
    } else hint(err ?? 'invalid target');
    draw();
    return;
  }
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
    const placedAll = Object.entries(UNITS).every(([t, spec]: [string, any]) =>
      !spec.count || state.units.filter((u) => u.owner === YOU && u.type === t).length >= spec.count);
    if (!placedAll) {
      add('AUTO-PLACE ALL', () => {
        queued = [...queued.filter((o) => o.kind !== 'place'), ...botOrders(state, YOU, 'staggered').filter((o) => o.kind === 'place')];
        renderOrders();
        hint('Placement orders queued. Review on the right, then commit.');
      });
    }
  }
  if (!selected) { if (!el.children.length) hint('Select one of your units on the map.'); return; }
  const u = selected;
  if (['carrier', 'battleship', 'sub'].includes(u.type)) add('move', () => { pendingTargetFor = 'move'; hint('Click a highlighted sea zone.'); draw(); });
  if (u.type === 'silo') add(u.siloMode === 'defend' ? 'mode: LAUNCH' : 'mode: DEFEND', () => {
    const o: Order = { kind: 'mode', unitId: u.id, mode: u.siloMode === 'defend' ? 'launch' : 'defend' };
    const err = validateOrder(state, YOU, o);
    if (err) return hint(err);
    queued.push(o); renderOrders();
  });
  if (u.type === 'sub') add(u.subMode === 'submerged' ? 'SURFACE' : 'DIVE', () => {
    queued.push({ kind: 'mode', unitId: u.id, mode: u.subMode === 'submerged' ? 'surfaced' : 'submerged' }); renderOrders();
  });
  if (u.type === 'carrier') add(u.carrierMode === 'airops' ? 'mode: ASW' : 'mode: AIR OPS', () => {
    queued.push({ kind: 'mode', unitId: u.id, mode: u.carrierMode === 'airops' ? 'asw' : 'airops' }); renderOrders();
  });
  if (u.type === 'silo' || u.type === 'sub' || u.type === 'bomber') add('launch…', () => { pendingTargetFor = 'launch'; hint('Click a highlighted target zone.'); draw(); });
  if (u.type === 'airbase' || u.type === 'carrier') {
    add('scout…', () => { pendingTargetFor = 'sortie'; hint('Click a zone within 3 hops.'); draw(); });
    add('bomber…', () => { pendingTargetFor = 'takeoff'; hint('Click the bomber target zone.'); draw(); });
  }
}

function orderTitle(o: Order): string {
  return ('unitId' in o ? o.unitId : 'hostId' in o ? o.hostId : (o as any).type ?? '').replace('_', ' ');
}
function orderDesc(o: Order): string {
  return `${o.kind}${'mode' in o ? ' → ' + (o as any).mode : ''}${'to' in o ? ' → ' + o.to : ''}${'targetZone' in o ? ' → ' + (o as any).targetZone : ''}${'zone' in o ? ' → ' + (o as any).zone : ''}`.toUpperCase();
}

function renderOrders() {
  const ul = $('orders');
  ul.innerHTML = '';
  $('orders-round').textContent = `— round ${state.round}`;
  if (!queued.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = 'NO ORDERS QUEUED';
    ul.appendChild(d);
  }
  queued.forEach((o, i) => {
    const li = document.createElement('li');
    if (o.kind === 'launch') li.className = 'nuclear';
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = orderTitle(o);
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = orderDesc(o) + (viaAI.has(o) ? ' · VIA AI' : '');
    info.append(title, desc);
    const b = document.createElement('button');
    b.textContent = '✕';
    b.onclick = () => { queued.splice(i, 1); renderOrders(); };
    li.append(info, b);
    ul.appendChild(li);
  });
  $('commit').textContent = `COMMIT ORDERS (${queued.length})`;
  $('commit-sub').textContent = `${SEATS.length - 1} AI COMMANDS AWAIT YOUR MOVE`;
}

function renderTopbar() {
  $('tb-round').textContent = `${state.round}/${state.maxRounds}`;
  const defcon = defconForRound(state.round);
  const pill = $('tb-defcon-pill');
  pill.textContent = `DEFCON ${defcon}`;
  pill.className = defcon > 2 ? 'calm' : '';
  const seats = $('tb-seats');
  seats.innerHTML = '';
  state.players.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'seat-chip';
    const d = document.createElement('span');
    d.className = 'diamond';
    d.style.color = hex(TERRITORY_COLOR[p.territory] ?? 0x888888);
    d.textContent = '◆';
    const name = document.createElement('span');
    name.textContent = p.territory;
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = p.score.toFixed(0);
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = i === YOU ? 'YOU' : 'AI';
    chip.append(d, name, score, tag);
    seats.appendChild(chip);
  });
}

function renderForces() {
  const el = $('forces-rows');
  el.innerHTML = '';
  for (const p of state.players) {
    const pop = state.cities.filter((c) => c.territory === p.territory).reduce((a, c) => a + c.pop, 0);
    const row = document.createElement('div');
    row.className = 'row';
    const d = document.createElement('span');
    d.style.color = hex(TERRITORY_COLOR[p.territory] ?? 0x888888);
    d.textContent = '◆';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.territory + (p.seat === YOU ? ' · YOU' : '');
    const pops = document.createElement('span');
    pops.className = 'label';
    pops.textContent = `${pop.toFixed(0)}M`;
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = p.score.toFixed(0);
    row.append(d, name, pops, score);
    el.appendChild(row);
  }
}

function renderLog() {
  // Launches are public (spec §2.4 phase 4); placement/rejection/sortie events
  // are private to their seat. Real fog filtering is the M2 server's job.
  const el = $('log');
  el.innerHTML = '';
  $('sitrep-defcon').textContent = `DEFCON ${defconForRound(Math.max(1, state.round - 1))}`;
  const events = lastLog
    .filter((e) => !['detect', 'roundEnd'].includes(e.type))
    .filter((e) => !(['placed', 'rejected', 'sortie'].includes(e.type) && (e as any).seat !== YOU));
  if (!events.length) {
    const d = document.createElement('div');
    d.className = 'ev';
    d.textContent = 'A quiet round. All commands held their breath.';
    el.appendChild(d);
    return;
  }
  let lastPhase = -1;
  for (const e of events) {
    if (e.phase !== lastPhase) {
      lastPhase = e.phase;
      const h = document.createElement('div');
      h.className = 'phase';
      h.textContent = `Phase ${e.phase} · ${PHASE_NAMES[e.phase] ?? ''}`;
      el.appendChild(h);
    }
    const d = document.createElement('div');
    d.className = 'ev' + (['cityHit', 'destroyed', 'launch'].includes(e.type) ? ' bad' : '');
    const { phase: _p, type, ...rest } = e as any;
    d.textContent = `${type.toUpperCase()}  ${Object.entries(rest).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('  ')}`;
    el.appendChild(d);
  }
}

// ---------- chief of staff ----------
function chat(who: 'you' | 'cos', text: string, chips?: { label: string; fn: () => void }[]) {
  const log = $('comms-log');
  const m = document.createElement('div');
  m.className = `msg ${who}`;
  const w = document.createElement('div');
  w.className = 'who';
  w.innerHTML = who === 'you' ? 'You' : 'Chief of Staff<span class="ai">AI</span>';
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = text;
  m.append(w, t);
  log.appendChild(m);
  renderChips(chips ?? defaultChips());
  log.scrollTop = log.scrollHeight;
}

function defaultChips(): { label: string; fn: () => void }[] {
  return [
    { label: 'Status of my cities', fn: () => ask('status of my cities') },
    { label: 'Enemy intel', fn: () => ask('enemy intel') },
    { label: 'Draft my turn', fn: () => ask('draft my turn') },
    { label: 'Warheads remaining', fn: () => ask('warheads remaining') },
  ];
}

function renderChips(chips: { label: string; fn: () => void }[]) {
  const el = $('comms-chips');
  el.innerHTML = '';
  for (const c of chips) {
    const b = document.createElement('button');
    b.className = 'small';
    b.textContent = c.label;
    b.onclick = c.fn;
    el.appendChild(b);
  }
}

function sendChat() {
  const input = $('comms-input') as HTMLInputElement;
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  ask(q);
}

function ask(q: string) {
  chat('you', q);
  const lower = q.toLowerCase();
  const me = state.players[YOU];
  if (lower.includes('status') || lower.includes('cities') || lower.includes('city')) {
    const mine = state.cities.filter((c) => c.territory === me.territory);
    const alive = mine.filter((c) => c.pop >= 1);
    const pop = mine.reduce((a, c) => a + c.pop, 0);
    const worst = [...mine].sort((a, b) => a.pop / a.initialPop - b.pop / b.initialPop)[0];
    chat('cos',
      `${alive.length} of ${mine.length} cities stand. Total population ${pop.toFixed(1)}M of 100M.`
      + (worst.pop < worst.initialPop ? ` Hardest hit: ${worst.id.replace('_', ' ')} at ${worst.pop.toFixed(1)}M of ${worst.initialPop}M.` : ' No city has been touched.'));
  } else if (lower.includes('intel') || lower.includes('enemy') || lower.includes('see')) {
    const seen = visibleUnits(state, YOU).filter((u) => u.owner !== YOU);
    if (!seen.length) {
      chat('cos', 'No enemy contacts on the board. Our radar reaches 3 hops; consider a fighter sweep to light up the approaches.');
    } else {
      const byOwner = new Map<number, Unit[]>();
      for (const u of seen) byOwner.set(u.owner, [...(byOwner.get(u.owner) ?? []), u]);
      const lines = [...byOwner.entries()].map(([o, us]) =>
        `${state.players[o].territory}: ${us.map((u) => `${u.type} in ${u.zone}`).join(', ')}`);
      chat('cos', `Current contacts:\n${lines.join('\n')}\nGhost markers persist where they have launched.`);
    }
  } else if (lower.includes('warhead') || lower.includes('nuke') || lower.includes('missile')) {
    const mine = state.units.filter((u) => u.owner === YOU);
    const lrbm = mine.reduce((a, u) => a + (u.lrbms ?? 0), 0);
    const mrbm = mine.reduce((a, u) => a + (u.mrbms ?? 0), 0);
    const srbm = mine.reduce((a, u) => a + (u.srbms ?? 0), 0);
    chat('cos', `Arsenal: ${lrbm} LRBM in silos, ${mrbm} MRBM aboard the boats, ${srbm} SRBM in the magazines. ${defconForRound(state.round) > 1 ? 'Release is not authorised until DEFCON 1.' : 'DEFCON 1 — release is authorised.'}`);
  } else if (lower.includes('draft') || lower.includes('plan') || lower.includes('turn')) {
    draft = botOrders(state, YOU, 'staggered').filter((o) => validateOrder(state, YOU, o) === null);
    if (!draft.length) {
      chat('cos', 'Nothing worth ordering this round — units are placed and holding. I would keep the silos on DEFEND and wait.');
      draft = null;
    } else {
      const lines = draft.map((o) => `  ${orderTitle(o)} — ${orderDesc(o)}`);
      chat('cos',
        `Proposed orders (${draft.length}):\n${lines.join('\n')}\nI never commit without you. Accept and they go to the queue under my name.`,
        [
          { label: '✓ Accept draft', fn: acceptDraft },
          { label: '✕ Discard', fn: () => { draft = null; chat('cos', 'Discarded. The map is yours.'); } },
        ]);
    }
  } else if (lower.includes('defcon') || lower.includes('rules') || lower.includes('can i')) {
    const d = defconForRound(state.round);
    chat('cos', `We are at DEFCON ${d}. ${d >= 4 ? 'Placement and scouting only.' : d === 3 ? 'Conventional naval and air combat is permitted.' : d === 2 ? 'All conventional combat; silos may begin the change to LAUNCH.' : 'Nuclear release is authorised.'} Mode changes cost a full round of vulnerability.`);
  } else {
    chat('cos', 'I can report on our cities, enemy contacts, or the arsenal — or draft your whole turn. Try "status of my cities", "enemy intel", "warheads remaining", or "draft my turn".');
  }
}

function acceptDraft() {
  if (!draft) return;
  for (const o of draft) { queued.push(o); viaAI.add(o); }
  chat('cos', `${draft.length} orders queued under my name. Review them on the right — the commit is still yours.`);
  draft = null;
  renderOrders();
}

// ---------- round flow ----------
function commitRound() {
  const orders: Order[][] = SEATS.map((k, i) => (i === YOU ? queued : botOrders(state, i, k as Doctrine)));
  const { state: ns, log } = resolveRound(state, orders, gameSeed * 1000 + state.round);
  state = ns;
  lastLog = log;
  queued = [];
  viaAI.clear();
  selected = null;
  pendingTargetFor = null;
  if (state.finished) {
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    const you = ranked.findIndex((p) => p.seat === YOU) + 1;
    overlay(
      `GAME OVER (${state.endReason}). Final scores — ${ranked.map((p) => `${p.territory}: ${p.score.toFixed(1)}`).join(' · ')}. You placed #${you}.`,
      'NEW GAME',
      () => location.reload(),
    );
    return;
  }
  renderAll();
  renderLog();
  $('sitrep-back').classList.remove('hidden');
  const dead = lastLog.filter((e) => e.type === 'cityHit').length;
  if (dead) chat('cos', `Round ${state.round - 1} resolved — ${dead} warhead${dead > 1 ? 's' : ''} found cities. Read the sitrep before you move.`);
}

// ---------- overlay ----------
function overlay(msg: string, btn: string, fn: () => void) {
  $('overlay').classList.remove('hidden');
  $('overlay-msg').textContent = msg;
  const b = $('overlay-btn') as HTMLButtonElement;
  b.textContent = btn;
  b.onclick = () => { $('overlay').classList.add('hidden'); fn(); };
}

boot();
