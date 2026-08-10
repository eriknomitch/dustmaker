// M0 CLI harness (plan §2.1): run a scripted or interactive game in the
// terminal, printing each player's fog-filtered situation and the resolution
// log. Usage: npm run harness [-- --doctrines alpha,turtle --seed 7 --mode default]
import { createInitialState, resolveRound, visibleUnits } from './engine.js';
import { defconForRound } from './constants.js';
import { botOrders, type Doctrine } from './bots.js';
import type { ScoreMode } from './types.js';

const args = process.argv.slice(2);
function flag(name: string, dflt: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}

const doctrines = flag('doctrines', 'alpha,turtle').split(',') as Doctrine[];
const seed = parseInt(flag('seed', '1'), 10);
const scoreMode = flag('mode', 'default') as ScoreMode;
const territories = ['NA', 'RU', 'EU', 'SA', 'AS', 'AF'].slice(0, doctrines.length);

let state = createInitialState(territories, scoreMode);
console.log(`DUSTMAKER harness — ${doctrines.join(' vs ')} — seed ${seed} — ${scoreMode}`);

while (!state.finished) {
  const orders = doctrines.map((d, seat) => botOrders(state, seat, d));
  const { state: next, log } = resolveRound(state, orders, seed * 1000 + state.round);
  const defcon = defconForRound(state.round);
  console.log(`\n=== ROUND ${state.round} (DEFCON ${defcon}) ===`);
  for (const e of log) {
    if (['detect'].includes(e.type)) continue; // noisy
    console.log(`  [p${e.phase}] ${e.type} ${JSON.stringify({ ...e, phase: undefined, type: undefined })}`);
  }
  state = next;
  for (const p of state.players) {
    const pop = state.cities.filter((c) => c.territory === p.territory).reduce((a, c) => a + c.pop, 0);
    const seen = visibleUnits(state, p.seat).filter((u) => u.owner !== p.seat).length;
    console.log(`  ${p.territory} (${doctrines[p.seat]}): score ${p.score.toFixed(1)}, pop ${pop.toFixed(1)}M, sees ${seen} enemy units`);
  }
}

console.log(`\nGAME OVER after round ${state.round - 1} (${state.endReason})`);
const ranked = [...state.players].sort((a, b) => b.score - a.score);
for (const p of ranked) console.log(`  ${p.territory} (${doctrines[p.seat]}): ${p.score.toFixed(1)}`);
