// Display positions for the zone graph, derived from real-world anchor
// coordinates and projected with the same equirectangular transform used for
// the coastline layer — so zones sit on their continents.
// Rules data lives in engine/data/map.json; this file is presentation only.

export function project(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * 1200, ((83 - lat) / 143) * 560];
}

const ZONE_LL: Record<string, [number, number]> = {
  // land zones (lon, lat)
  NA_W: [-122, 48], NA_N: [-100, 60], NA_E: [-75, 42], NA_S: [-98, 30],
  SA_N: [-66, 2], SA_W: [-76, -12], SA_E: [-45, -10], SA_S: [-65, -33],
  EU_W: [-3, 47], EU_N: [15, 61], EU_E: [25, 50], EU_S: [12, 40],
  RU_W: [38, 57], RU_N: [90, 67], RU_E: [130, 55], RU_S: [60, 50],
  AS_W: [62, 27], AS_N: [77, 33], AS_E: [110, 30], AS_S: [92, 14],
  AF_N: [8, 27], AF_W: [-3, 8], AF_E: [38, 4], AF_S: [24, -22],
  // sea zones
  ARCTIC: [-10, 75], BERING: [-178, 57], N_PAC: [-160, 28], S_PAC: [-130, -18],
  CORAL: [155, -18], N_ATL: [-35, 45], MID_ATL: [-30, 10], S_ATL: [-15, -25],
  CARIB: [-80, 18], MED: [15, 35], N_SEA: [3, 57], INDIAN: [78, -10],
  ARABIAN: [62, 12], S_CHINA: [113, 12],
};

export const ZONE_POS: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(ZONE_LL).map(([z, [lon, lat]]) => [z, project(lon, lat)]),
);

export const TERRITORY_COLOR: Record<string, number> = {
  NA: 0x39c0ff, RU: 0xff5a5a, EU: 0x67e08a, SA: 0xffc23a, AS: 0xc07aff, AF: 0xff9a4d,
};

export const UNIT_GLYPH: Record<string, string> = {
  silo: '▲', radar: '◎', airbase: '⊞', carrier: '⌂', battleship: '■', sub: '◆', bomber: '✈',
};
