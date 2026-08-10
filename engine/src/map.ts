import type { ZoneId, Territory } from './types.js';
import rawMap from '../data/map.json' with { type: 'json' };

export interface MapData {
  version: number;
  territories: Territory[];
  landZones: Record<ZoneId, Territory>;
  seaZones: ZoneId[];
  edges: [ZoneId, ZoneId][];
  cityPops: number[];
}

export const MAP = rawMap as unknown as MapData;

const adj = new Map<ZoneId, Set<ZoneId>>();
for (const z of [...Object.keys(MAP.landZones), ...MAP.seaZones]) adj.set(z, new Set());
for (const [a, b] of MAP.edges) {
  adj.get(a)!.add(b);
  adj.get(b)!.add(a);
}

export function neighbors(z: ZoneId): ZoneId[] {
  return [...(adj.get(z) ?? [])];
}

export function isSea(z: ZoneId): boolean {
  return MAP.seaZones.includes(z);
}

export function isLand(z: ZoneId): boolean {
  return z in MAP.landZones;
}

export function territoryOf(z: ZoneId): Territory | null {
  return MAP.landZones[z] ?? null;
}

export function allZones(): ZoneId[] {
  return [...Object.keys(MAP.landZones), ...MAP.seaZones];
}

// BFS hop distance over the whole graph (spec §2.1: all range in zone hops).
export function hops(from: ZoneId, to: ZoneId): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  let d = 0;
  while (frontier.length) {
    d++;
    const next: ZoneId[] = [];
    for (const z of frontier) {
      for (const n of neighbors(z)) {
        if (seen.has(n)) continue;
        if (n === to) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

// One step along a shortest path, restricted by a zone filter (e.g. sea-only).
export function stepToward(
  from: ZoneId,
  to: ZoneId,
  allowed: (z: ZoneId) => boolean,
): ZoneId | null {
  if (from === to) return null;
  const prev = new Map<ZoneId, ZoneId>();
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length) {
    const next: ZoneId[] = [];
    for (const z of frontier) {
      for (const n of neighbors(z)) {
        if (seen.has(n)) continue;
        if (n !== to && !allowed(n)) continue;
        seen.add(n);
        prev.set(n, z);
        if (n === to) {
          // walk back to first step
          let cur = n;
          while (prev.get(cur) !== from) cur = prev.get(cur)!;
          return cur;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}
