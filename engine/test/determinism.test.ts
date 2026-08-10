import { describe, it, expect } from 'vitest';
import { createInitialState, resolveRound } from '../src/engine.js';
import type { Order } from '../src/types.js';

describe('determinism (spec §6.2)', () => {
  it('same state + orders + seed gives an identical state and log', () => {
    const orders: Order[][] = [
      [{ kind: 'place', type: 'silo', zone: 'NA_E' }, { kind: 'place', type: 'battleship', zone: 'N_ATL' }],
      [{ kind: 'place', type: 'silo', zone: 'RU_W' }, { kind: 'place', type: 'sub', zone: 'ARCTIC' }],
    ];
    const s0 = createInitialState(['NA', 'RU']);
    const a = resolveRound(structuredClone(s0), orders, 1234);
    const s1 = createInitialState(['NA', 'RU']);
    const b = resolveRound(structuredClone(s1), orders, 1234);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
  });

  it('the engine never calls Math.random', async () => {
    const src = await Promise.all(
      ['engine', 'map', 'rng', 'constants'].map((m) =>
        import('node:fs/promises').then((fs) => fs.readFile(new URL(`../src/${m}.ts`, import.meta.url), 'utf8')),
      ),
    );
    for (const code of src) expect(code).not.toMatch(/Math\.random\(/);
  });
});
