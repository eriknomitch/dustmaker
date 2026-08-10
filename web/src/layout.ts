// Hand-authored display positions for the zone graph (canvas ~1200x560).
// Rules data lives in engine/data/map.json; this file is presentation only.
export const ZONE_POS: Record<string, [number, number]> = {
  NA_N: [180, 110], NA_W: [95, 190], NA_E: [255, 190], NA_S: [180, 265],
  SA_N: [285, 345], SA_W: [235, 415], SA_E: [335, 410], SA_S: [285, 490],
  EU_W: [520, 160], EU_N: [585, 95], EU_E: [655, 170], EU_S: [575, 235],
  RU_W: [730, 110], RU_N: [830, 70], RU_E: [960, 105], RU_S: [840, 170],
  AS_W: [705, 285], AS_N: [795, 240], AS_E: [905, 270], AS_S: [815, 345],
  AF_N: [550, 320], AF_W: [495, 395], AF_E: [615, 390], AF_S: [560, 475],
  ARCTIC: [490, 35], BERING: [1045, 50], N_PAC: [1075, 220], S_PAC: [1090, 430],
  CORAL: [990, 480], N_ATL: [390, 195], MID_ATL: [385, 330], S_ATL: [405, 480],
  CARIB: [255, 300], MED: [575, 285], N_SEA: [490, 95], INDIAN: [760, 440],
  ARABIAN: [672, 345], S_CHINA: [895, 385],
};

export const TERRITORY_COLOR: Record<string, number> = {
  NA: 0x39c0ff, RU: 0xff5a5a, EU: 0x67e08a, SA: 0xffc23a, AS: 0xc07aff, AF: 0xff9a4d,
};

export const UNIT_GLYPH: Record<string, string> = {
  silo: '▲', radar: '◎', airbase: '⊞', carrier: '⌂', battleship: '■', sub: '◆', bomber: '✈',
};
