// Display names for units and cities — presentation only, the engine knows
// nothing about them. Names are assigned deterministically: units of one
// owner+type take names from their territory's pool in placement order, so
// the same game always produces the same names (mirrors the prototype's
// SILO SVERDLOVSK / SSBN K-141 flavor).
import type { GameState, Unit } from '../../engine/src/types';

const POOLS: Record<string, Partial<Record<string, string[]>>> = {
  NA: {
    silo: ['SILO CHEYENNE', 'SILO PLATTSBURGH', 'SILO MALMSTROM'],
    sub: ['SSBN OHIO', 'SSBN NAUTILUS'],
    carrier: ['CV NIMITZ', 'CV ENTERPRISE'],
    battleship: ['BB IOWA', 'BB MISSOURI', 'BB WISCONSIN'],
    airbase: ['AIRBASE THULE', 'AIRBASE EDWARDS'],
  },
  RU: {
    silo: ['SILO KALININ', 'SILO SVERDLOVSK', 'SILO BAIKAL'],
    sub: ['SSBN K-141', 'SSBN K-329'],
    carrier: ['CV KUZNETSOV', 'CV VARYAG'],
    battleship: ['BB GANGUT', 'BB MARAT', 'BB SEVASTOPOL'],
    airbase: ['AIRBASE PERM', 'AIRBASE ENGELS'],
  },
  EU: {
    silo: ['SILO SILESIA', 'SILO ARDENNES', 'SILO PYRENEES'],
    sub: ['SSBN VANGUARD', 'SSBN TRIOMPHANT'],
    carrier: ['CV ARK ROYAL', 'CV FOCH'],
    battleship: ['BB HOOD', 'BB RICHELIEU', 'BB ROMA'],
    airbase: ['AIRBASE RAMSTEIN', 'AIRBASE KEFLAVIK'],
  },
  AS: {
    silo: ['SILO KARGIL', 'SILO SICHUAN', 'SILO IRRAWADDY'],
    sub: ['SSBN ARIHANT', 'SSBN JIN'],
    carrier: ['CV VIKRANT', 'CV LIAONING'],
    battleship: ['BB DELHI', 'BB MYSORE', 'BB RAJPUT'],
    airbase: ['AIRBASE AMBALA', 'AIRBASE CHENGDU'],
  },
  SA: {
    silo: ['SILO ANDES', 'SILO PAMPAS', 'SILO AMAZONAS'],
    sub: ['SSBN RIACHUELO', 'SSBN TUPI'],
    carrier: ['CV MINAS GERAIS', 'CV VEINTICINCO'],
    battleship: ['BB SAO PAULO', 'BB RIVADAVIA', 'BB ALMIRANTE'],
    airbase: ['AIRBASE NATAL', 'AIRBASE PALOMAR'],
  },
  AF: {
    silo: ['SILO SAHARA', 'SILO KILIMANJARO', 'SILO KAROO'],
    sub: ['SSBN ORANJE', 'SSBN NILE'],
    carrier: ['CV TANEZROUFT', 'CV ZAMBEZI'],
    battleship: ['BB ASWAN', 'BB TANGIER', 'BB MOMBASA'],
    airbase: ['AIRBASE KUFRA', 'AIRBASE WATERKLOOF'],
  },
};

const CITY_NAMES: Record<string, string[]> = {
  NA: ['NEW YORK', 'LOS ANGELES', 'CHICAGO', 'HOUSTON', 'TORONTO', 'PHILADELPHIA', 'PHOENIX', 'MONTREAL'],
  RU: ['MOSCOW', 'ST PETERSBURG', 'NOVOSIBIRSK', 'YEKATERINBURG', 'KAZAN', 'OMSK', 'SAMARA', 'VOLGOGRAD'],
  EU: ['LONDON', 'PARIS', 'BERLIN', 'MADRID', 'ROME', 'AMSTERDAM', 'VIENNA', 'WARSAW'],
  AS: ['MUMBAI', 'DELHI', 'DHAKA', 'KARACHI', 'BANGKOK', 'KOLKATA', 'LAHORE', 'CHENNAI'],
  SA: ['SAO PAULO', 'BUENOS AIRES', 'RIO DE JANEIRO', 'LIMA', 'BOGOTA', 'SANTIAGO', 'CARACAS', 'QUITO'],
  AF: ['LAGOS', 'CAIRO', 'KINSHASA', 'JOHANNESBURG', 'NAIROBI', 'CASABLANCA', 'ACCRA', 'ADDIS ABABA'],
};

const COMPASS: Record<string, string> = { W: 'WEST', N: 'NORTH', E: 'EAST', S: 'SOUTH' };

// id → display name, filled as units appear and kept for the whole session so
// events about units that died still resolve to their name.
const known = new Map<string, string>();

export function registerNames(state: GameState): void {
  const counters = new Map<string, number>();
  const byNumericId = [...state.units].sort(
    (a, b) => parseInt(a.id.replace(/\D+/g, ''), 10) - parseInt(b.id.replace(/\D+/g, ''), 10),
  );
  for (const u of byNumericId) {
    if (known.has(u.id)) {
      // still consume a slot so later placements keep stable names
      const k = `${u.owner}:${u.type}`;
      counters.set(k, (counters.get(k) ?? 0) + 1);
      continue;
    }
    const terr = state.players[u.owner]?.territory ?? '';
    const k = `${u.owner}:${u.type}`;
    const i = counters.get(k) ?? 0;
    counters.set(k, i + 1);
    known.set(u.id, buildName(u, terr, i));
  }
}

function buildName(u: Unit, terr: string, i: number): string {
  if (u.type === 'radar') {
    const suffix = COMPASS[u.zone.split('_')[1] ?? ''] ?? `${i + 1}`;
    return `RADAR ${suffix}`;
  }
  if (u.type === 'bomber') return `BOMBER ${String(i + 1).padStart(2, '0')}`;
  const pool = POOLS[terr]?.[u.type];
  if (!pool) return u.id.replace('_', ' ').toUpperCase();
  const name = pool[i % pool.length];
  return i < pool.length ? name : `${name} ${Math.floor(i / pool.length) + 1}`;
}

export function unitName(id: string): string {
  return known.get(id) ?? id.replace('_', ' ').toUpperCase();
}

export function cityName(id: string): string {
  const m = id.match(/^([A-Z]+)_C(\d+)$/);
  if (!m) return id.replace('_', ' ').toUpperCase();
  return CITY_NAMES[m[1]]?.[parseInt(m[2], 10) - 1] ?? id.replace('_', ' ').toUpperCase();
}
