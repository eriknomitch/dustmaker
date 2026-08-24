// Humanized SITREP: turns the engine's resolution log into the prototype's
// phase-grouped, collapsible briefing with plain-language event lines and a
// stat-tile strip. Rendering only — every fact comes from the log and state.
import type { GameState, LogEvent, ResolutionLog } from '../../engine/src/types';
import { unitName, cityName } from './names';

export const PHASE_META: Record<number, [string, string]> = {
  0: ['ORDERS & PLACEMENT', 'placements land; illegal orders are rejected'],
  1: ['MODE CHANGES', 'silo transits, dive & surface orders complete'],
  2: ['MOVEMENT', 'naval units reposition; passing hulls may be detected'],
  3: ['AIR OPERATIONS', 'fighter sweeps fly and radar takes contacts'],
  4: ['LAUNCH DETECTION', 'launch zones revealed to every commander'],
  5: ['INTERCEPTION', 'defend-mode silos roll against inbound warheads'],
  6: ['IMPACT', 'surviving warheads apply damage'],
  7: ['CONVENTIONAL COMBAT', 'guns, depth charges and bomber strikes'],
  8: ['CLEANUP', 'scoring, recovery, DEFCON tick'],
};

export interface SitrepLine {
  title: string;
  detail?: string;
  tone: 'bad' | 'good' | 'neutral';
}

const MODE_DETAIL: Record<string, string> = {
  launch: 'Doors open. It can fire — and it no longer intercepts.',
  defend: 'It screens its neighbors against inbound warheads.',
  surfaced: 'Missile doors open — the boat is visible to any radar in range.',
  submerged: 'Slipped under. Invisible except to ASW.',
  airops: 'Deck spotted for fighters and bombers.',
  asw: 'Screws listening for submarines in the zone.',
};

export function describeEvent(e: LogEvent, you: number): SitrepLine | null {
  const a = e as any;
  const mine = (owner: unknown) => owner === you;
  switch (e.type) {
    case 'roundEnd':
      return null;
    case 'placed':
      return { title: `${unitName(a.unit)} placed — ${a.zone}`, tone: 'neutral' };
    case 'rejected':
      return {
        title: `ORDER REJECTED — ${a.order?.kind?.toUpperCase() ?? ''}`,
        detail: String(a.reason ?? ''),
        tone: 'bad',
      };
    case 'modeChanging':
      return {
        title: `${unitName(a.unit)} enters transit → ${String(a.to).toUpperCase()}`,
        detail: 'Ready next round; until then it neither fires nor intercepts.',
        tone: 'neutral',
      };
    case 'modeComplete':
    case 'mode':
      return {
        title: `${unitName(a.unit)} → ${String(a.mode).toUpperCase()}`,
        detail: MODE_DETAIL[String(a.mode)],
        tone: 'neutral',
      };
    case 'moved':
      return { title: `${unitName(a.unit)} — ${a.from} → ${a.to}`, tone: 'neutral' };
    case 'takeoff':
      return {
        title: `${unitName(a.unit)} lifts off ${unitName(a.host)} → ${a.target}`,
        detail: a.armed ? 'Carrying an SRBM.' : 'Flying unarmed.',
        tone: 'neutral',
      };
    case 'bomberMove':
      return { title: `${unitName(a.unit)} transits ${a.from} → ${a.to}`, tone: 'neutral' };
    case 'sortie':
      return {
        title: `Fighter ${a.role === 'intercept' ? 'CAP' : 'sweep'} from ${unitName(a.host)} over ${a.zone}`,
        tone: 'neutral',
      };
    case 'detect': {
      const units = (a.units as any[]) ?? [];
      return {
        title: `CONTACTS — ${units.map((u) => `${u.unitType} in ${u.zone}`).join(', ')}`,
        tone: 'neutral',
      };
    }
    case 'launch':
      return {
        title: `LAUNCH — ${String(a.kind).toUpperCase()} from ${a.from} → ${a.target}`,
        detail: mine(a.seat)
          ? 'Our launch zone is now revealed to every commander.'
          : 'Launch zone revealed on detection.',
        tone: 'bad',
      };
    case 'intercept':
      return {
        title: `INTERCEPTED — ${String(a.missile).toUpperCase()} over ${a.target}`,
        detail: `Killed by ${String(a.by).startsWith('fighter') ? 'the fighter screen' : unitName(a.by)}.`,
        tone: 'good',
      };
    case 'bomberDown':
      return { title: `${unitName(a.unit)} shot down over ${a.zone}`, tone: 'bad' };
    case 'unitHit':
      return {
        title: `${unitName(a.unit)} struck — ${a.hp} HP remains`,
        tone: mine(a.by) ? 'good' : 'bad',
      };
    case 'wasted':
      return {
        title: `Warhead wasted — ${a.zone}`,
        detail: 'Nothing remained at the aim point.',
        tone: 'neutral',
      };
    case 'cityHit':
      return {
        title: `${cityName(a.city)} HIT — ${a.killed}M dead, ${a.remaining}M remain`,
        detail: 'Each hit kills half the remaining population.',
        tone: 'bad',
      };
    case 'battleshipHit':
      return { title: `${unitName(a.by)} shells ${unitName(a.target)}`, tone: 'neutral' };
    case 'depthCharge':
      return { title: `${unitName(a.by)} depth-charges ${unitName(a.target)}`, tone: 'neutral' };
    case 'bomberStrike':
      return { title: `${unitName(a.by)} strikes ${unitName(a.target)}`, tone: 'neutral' };
    case 'fighterDown':
      return { title: `Fighter lost over ${a.zone}`, tone: 'bad' };
    case 'destroyed':
      return { title: `${unitName(a.unit)} DESTROYED`, tone: 'bad' };
    case 'removed':
      return { title: `${unitName(a.unit)} wreck cleared — ${a.zone}`, tone: 'neutral' };
    case 'landed':
      return {
        title: `${unitName(a.unit)} recovers aboard ${unitName(a.host)}`,
        detail: a.srbmReturned ? 'SRBM returned to the magazine.' : undefined,
        tone: 'neutral',
      };
    case 'crashed':
      return { title: `${unitName(a.unit)} down — out of fuel over ${a.zone}`, tone: 'bad' };
    case 'countdownStarted':
      return {
        title: 'VICTORY COUNTDOWN STARTED',
        detail: '80% of all warheads are spent or destroyed. The game ends shortly.',
        tone: 'bad',
      };
    default:
      return {
        title: `${e.type.toUpperCase()} ${Object.entries(a)
          .filter(([k]) => k !== 'phase' && k !== 'type')
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(' ')}`,
        tone: 'neutral',
      };
  }
}

export interface SitrepStats {
  deadM: number;
  warheads: number;
  score: number;
  delta: number;
  round: number;
  maxRounds: number;
}

export function sitrepStats(state: GameState, you: number, delta: number): SitrepStats {
  const me = state.players[you];
  const mine = state.cities.filter((c) => c.territory === me.territory);
  const deadM = mine.reduce((a, c) => a + (c.initialPop - c.pop), 0);
  const warheads = state.units
    .filter((u) => u.owner === you)
    .reduce((a, u) => a + (u.lrbms ?? 0) + (u.mrbms ?? 0) + (u.srbms ?? 0), 0);
  return { deadM, warheads, score: me.score, delta, round: state.round, maxRounds: state.maxRounds };
}

// Renders tiles + collapsible phase groups into `el`. Same fog rule as
// before: placement/rejection/sortie/detect events are private to your seat.
export function renderSitrep(el: HTMLElement, log: ResolutionLog, stats: SitrepStats, you: number): void {
  el.innerHTML = '';
  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  const tile = (label: string, value: string, sub?: string, bad?: boolean) => {
    const d = document.createElement('div');
    d.className = 'tile' + (bad ? ' bad' : '');
    d.innerHTML = `<div class="tl">${label}</div><div class="tv">${value}${sub ? ` <small>${sub}</small>` : ''}</div>`;
    tiles.appendChild(d);
  };
  tile('YOUR DEAD', `${stats.deadM.toFixed(1)}M`, undefined, stats.deadM > 0);
  tile('WARHEADS', String(stats.warheads));
  tile('SCORE', stats.score.toFixed(0), `(${stats.delta >= 0 ? '+' : ''}${stats.delta.toFixed(0)})`);
  tile('ROUND', `${stats.round}`, `/ ${stats.maxRounds}`);
  el.appendChild(tiles);

  const events = log
    .filter((e) => !(['placed', 'rejected', 'sortie', 'detect'].includes(e.type) && (e as any).seat !== you))
    .map((e) => ({ phase: e.phase, line: describeEvent(e, you) }))
    .filter((x): x is { phase: number; line: SitrepLine } => x.line !== null);

  if (!events.length) {
    const d = document.createElement('div');
    d.className = 'ev';
    d.textContent = 'A quiet round. All commands held their breath.';
    el.appendChild(d);
    return;
  }

  const byPhase = new Map<number, SitrepLine[]>();
  for (const e of events) byPhase.set(e.phase, [...(byPhase.get(e.phase) ?? []), e.line]);

  let idx = 0;
  for (const [phase, lines] of [...byPhase.entries()].sort((a, b) => a[0] - b[0])) {
    const [title, sub] = PHASE_META[phase] ?? [`PHASE ${phase}`, ''];
    const group = document.createElement('div');
    group.className = 'phg' + (lines.some((l) => l.tone === 'bad') || idx < 2 ? ' open' : '');
    const head = document.createElement('div');
    head.className = 'ph';
    head.innerHTML = `<span class="cv">▸</span><b>PHASE ${phase} · ${title}</b><span class="sub">${sub}</span><span class="n">${lines.length}</span>`;
    head.onclick = () => group.classList.toggle('open');
    const rows = document.createElement('div');
    rows.className = 'rows';
    for (const l of lines) {
      const d = document.createElement('div');
      d.className = `lrow ${l.tone}`;
      d.innerHTML = `<span class="t">${l.title}</span>${l.detail ? `<span class="d">${l.detail}</span>` : ''}`;
      rows.appendChild(d);
    }
    group.append(head, rows);
    el.appendChild(group);
    idx++;
  }
}
