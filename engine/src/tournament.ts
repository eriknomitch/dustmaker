// Doctrine round-robin (plan §2.2/§2.3): pairwise 2-player games across many
// seeds and all three score modes. Reports win rates and end-condition stats.
// Usage: npm run tournament [-- --games 100]
import { createInitialState, resolveRound } from './engine.js';
import { botOrders, type Doctrine } from './bots.js';
import type { ScoreMode } from './types.js';

const GAMES = parseInt(process.argv[process.argv.indexOf('--games') + 1] || '100', 10) || 100;
const DOCTRINES: Doctrine[] = ['alpha', 'staggered', 'turtle'];
const MODES: ScoreMode[] = ['default', 'genocide', 'survivor'];

interface Result { winner: Doctrine | 'tie'; endReason: string; rounds: number }

function playGame(a: Doctrine, b: Doctrine, mode: ScoreMode, seed: number): Result {
  let state = createInitialState(['NA', 'RU'], mode);
  while (!state.finished) {
    const orders = [botOrders(state, 0, a), botOrders(state, 1, b)];
    state = resolveRound(state, orders, seed * 100000 + state.round).state;
  }
  const [pa, pb] = state.players;
  const winner = pa.score > pb.score ? a : pb.score > pa.score ? b : 'tie';
  return { winner, endReason: state.endReason!, rounds: state.round - 1 };
}

console.log(`DUSTMAKER doctrine tournament — ${GAMES} games per pairing per mode\n`);
const endReasons: Record<string, number> = {};
let total = 0;

for (const mode of MODES) {
  console.log(`## Score mode: ${mode}`);
  for (let i = 0; i < DOCTRINES.length; i++) {
    for (let j = 0; j < DOCTRINES.length; j++) {
      if (i === j) continue;
      const [a, b] = [DOCTRINES[i], DOCTRINES[j]];
      const wins: Record<string, number> = { [a]: 0, [b]: 0, tie: 0 };
      let roundsSum = 0;
      for (let g = 0; g < GAMES; g++) {
        const r = playGame(a, b, mode, g + 1);
        wins[r.winner]++;
        roundsSum += r.rounds;
        endReasons[r.endReason] = (endReasons[r.endReason] ?? 0) + 1;
        total++;
      }
      console.log(
        `  ${a} vs ${b}: ${a} ${((wins[a] / GAMES) * 100).toFixed(0)}% | ` +
        `${b} ${((wins[b] / GAMES) * 100).toFixed(0)}% | tie ${((wins.tie / GAMES) * 100).toFixed(0)}% | ` +
        `avg ${(roundsSum / GAMES).toFixed(1)} rounds`,
      );
    }
  }
  console.log();
}

console.log('## End conditions across all games');
for (const [reason, n] of Object.entries(endReasons)) {
  console.log(`  ${reason}: ${n}/${total} (${((n / total) * 100).toFixed(1)}%)`);
}
