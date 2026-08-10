export type ZoneId = string;
export type Territory = string;
export type UnitType =
  | 'silo' | 'radar' | 'airbase' | 'carrier' | 'battleship' | 'sub' | 'bomber';

export type SiloMode = 'defend' | 'launch' | 'changing';
export type SubMode = 'submerged' | 'surfaced';
export type CarrierMode = 'airops' | 'asw';

export interface Unit {
  id: string;
  owner: number; // seat index
  type: UnitType;
  zone: ZoneId;
  hp: number;
  // silo
  siloMode?: SiloMode;
  siloTargetMode?: SiloMode; // mode being changed to while 'changing'
  lrbms?: number;
  // sub
  subMode?: SubMode;
  mrbms?: number;
  // carrier / airbase (hosts)
  carrierMode?: CarrierMode;
  fighters?: number;
  bombers?: number;
  srbms?: number;
  // bomber (airborne unit)
  hostId?: string;
  fuelUsed?: number;
  armed?: boolean; // carrying an SRBM
  targetZone?: ZoneId;
}

export interface City {
  id: string;
  zone: ZoneId;
  territory: Territory;
  pop: number; // millions
  initialPop: number;
}

export interface Player {
  seat: number;
  territory: Territory;
  score: number;
}

export type ScoreMode = 'default' | 'genocide' | 'survivor';

export interface GameState {
  round: number; // round about to be resolved
  players: Player[];
  units: Unit[];
  cities: City[];
  scoreMode: ScoreMode;
  maxRounds: number;
  totalWarheadsStart: number;
  warheadsExpended: number; // launched or destroyed
  countdown: number | null; // rounds remaining once triggered
  finished: boolean;
  endReason?: 'countdown' | 'maxRounds';
  ghosts: { zone: ZoneId; owner: number }[]; // permanent launch markers (buildings)
}

export type Order =
  | { kind: 'place'; type: UnitType; zone: ZoneId }
  | { kind: 'move'; unitId: string; to: ZoneId }
  | { kind: 'mode'; unitId: string; mode: SiloMode | SubMode | CarrierMode }
  | { kind: 'launch'; unitId: string; targetZone: ZoneId; targetUnitId?: string; count?: number }
  | { kind: 'sortie'; hostId: string; zone: ZoneId; role: 'scout' | 'intercept' }
  | { kind: 'takeoff'; hostId: string; targetZone: ZoneId }
  | { kind: 'strike'; unitId: string; targetUnitId: string }; // bomber conventional

export type OrderSet = Order[]; // one player's orders for the round

export interface LogEvent {
  phase: number;
  type: string;
  [k: string]: unknown;
}

export type ResolutionLog = LogEvent[];
