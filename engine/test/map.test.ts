import { describe, it, expect } from 'vitest';
import { MAP, allZones, neighbors, isSea, hops } from '../src/map.js';

describe('map sanity (spec §2.1)', () => {
  it('has 24 land zones, 14 sea zones, 6 territories', () => {
    expect(Object.keys(MAP.landZones)).toHaveLength(24);
    expect(MAP.seaZones).toHaveLength(14);
    expect(MAP.territories).toHaveLength(6);
  });

  it('every territory has exactly 4 land zones', () => {
    for (const t of MAP.territories) {
      expect(Object.values(MAP.landZones).filter((x) => x === t)).toHaveLength(4);
    }
  });

  it('city populations sum to 100 million per territory', () => {
    expect(MAP.cityPops.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('the zone graph is fully connected', () => {
    const zones = allZones();
    for (const z of zones) expect(hops(zones[0], z)).toBeLessThan(Infinity);
  });

  it('every territory touches at least one sea zone', () => {
    for (const t of MAP.territories) {
      const land = Object.entries(MAP.landZones).filter(([, tt]) => tt === t).map(([z]) => z);
      expect(land.some((z) => neighbors(z).some(isSea))).toBe(true);
    }
  });

  it('all edges reference declared zones', () => {
    const zones = new Set(allZones());
    for (const [a, b] of MAP.edges) {
      expect(zones.has(a), a).toBe(true);
      expect(zones.has(b), b).toBe(true);
    }
  });
});
