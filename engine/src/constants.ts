// Single source of truth for the combat numbers in DUSTMAKER.md §2.2
// ("Combat numbers" table). If a value changes here, change the spec too.

export const COMBAT = {
  fighterKillsBomber: 2 / 3,
  fighterKillsFighter: 1 / 2,
  fighterInterceptsMissile: 1 / 6,
  siloInterceptsMissile: 1 / 4, // per Defend silo in range, per missile
  battleshipHits: 1 / 2,
  carrierAswHits: 1 / 3,
  bomberHitsNaval: 1 / 2,
};

export const UNITS = {
  silo: { count: 3, hp: 3, lrbms: 10 },
  radar: { count: 2, hp: 1 },
  airbase: { count: 2, hp: 2, fighterCap: 4, bomberCap: 2, srbms: 6 },
  carrier: { count: 2, hp: 2, fighterCap: 3, bomberCap: 1, srbms: 3 },
  battleship: { count: 3, hp: 3 },
  sub: { count: 2, hp: 2, mrbms: 4 },
  bomber: { hp: 1, fuel: 5, srbmRange: 2 },
  fighter: { hp: 1, radius: 3 },
};

export const RANGES = {
  radarDetect: 3,
  surfaceDetect: 2, // ships, airbases, carriers
  mrbm: 6,
  srbm: 2,
};

// DEFCON level as a function of round number (spec §2.3 defaults).
export function defconForRound(round: number): number {
  if (round <= 2) return 5;
  if (round <= 4) return 4;
  if (round <= 7) return 3;
  if (round <= 9) return 2;
  return 1;
}

export const VICTORY = {
  warheadThreshold: 0.8, // fraction of all warheads launched-or-destroyed
  countdownRounds: 3,
  defaultMaxRounds: 25,
};
