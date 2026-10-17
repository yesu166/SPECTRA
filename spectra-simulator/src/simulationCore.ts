/**
 * Internal simulation core.
 *
 * Ground-truth tracks live here. UI modules should import only the public
 * facade from ./simulation, never this file. This is an application-layer
 * separation, not a security boundary against someone inspecting a browser bundle.
 */
export type EnvironmentKind = "urban" | "rural" | "perimeter";
export type Lighting = "day" | "dusk" | "night";
export type Visibility = "clear" | "haze" | "fog";
export type EntityKind = "authorized" | "unknown" | "simulated-threat";
export type SensorStatus = "TRACK" | "INTERMITTENT" | "UNOBSERVED";

export interface Config {
  scenarioId: string;
  environment: EnvironmentKind;
  lighting: Lighting;
  visibility: Visibility;
  difficulty: number;
  seed: number;
  contactCount: number;
  sensorQuality: number;
}

export interface TruthTrack {
  id: string;
  kind: EntityKind;
  label: string;
  x: number;
  y: number;
  altitude: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface RawObservation {
  entityId: string;
  observedAt: number;
  status: SensorStatus;
  confidence: number;
  source: "SIMULATED RADAR";
  note: string;
  x?: number;
  y?: number;
  altitude?: number;
  lastObservedAt?: number;
}

export interface SessionEvent {
  id: string;
  time: number;
  type: "SESSION" | "DETECTION" | "SENSOR" | "OPERATOR" | "ENVIRONMENT" | "OBSERVATION" | "ACTION" | "SCORE";
  title: string;
  detail: string;
  tick?: number;
  evidenceEventIds?: string[];
}

export const SCENARIOS = [
  { id: "perimeter-watch", name: "Perimeter watch", description: "A routine site watch with authorized and unknown contacts.", count: 5, environment: "perimeter" as const },
  { id: "urban-observation", name: "Urban observation", description: "A built-up training area with obstructed visibility.", count: 7, environment: "urban" as const },
  { id: "rural-site", name: "Rural site", description: "An open training landscape with changing sensor quality.", count: 6, environment: "rural" as const },
  { id: "multi-contact", name: "Multi-contact exercise", description: "Several simultaneous synthetic contacts and intermittent observations.", count: 12, environment: "perimeter" as const },
];

export const DEFAULT_CONFIG: Config = {
  scenarioId: "perimeter-watch",
  environment: "perimeter",
  lighting: "day",
  visibility: "clear",
  difficulty: 2,
  seed: 26247,
  contactCount: 5,
  sensorQuality: 78,
};

export function createRng(seed: number): () => number {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateTruthTracks(config: Config): TruthTrack[] {
  const rng = createRng(config.seed);
  const count = Math.max(1, Math.min(30, Math.floor(config.contactCount)));
  return Array.from({ length: count }, (_, index) => {
    const kindRoll = rng();
    const kind: EntityKind = index === 0 || kindRoll < 0.25 ? "authorized" : kindRoll < 0.69 ? "unknown" : "simulated-threat";
    const angle = rng() * Math.PI * 2;
    const speed = 0.006 + rng() * 0.012 * (config.difficulty / 3);
    return {
      id: `C-${String(index + 1).padStart(2, "0")}`,
      kind,
      label: kind === "authorized" ? "AUTHORIZED" : kind === "unknown" ? "UNRESOLVED" : "SIMULATED THREAT",
      x: 0.12 + rng() * 0.76,
      y: 0.12 + rng() * 0.76,
      altitude: 55 + Math.round(rng() * 180),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      phase: rng() * Math.PI * 2,
    };
  });
}

export function observeTruth(config: Config, track: TruthTrack, tick: number): RawObservation {
  const rng = createRng((config.seed ^ (tick * 971) ^ stableHash(track.id)) >>> 0);
  const lightingPenalty = config.lighting === "night" ? 9 : config.lighting === "dusk" ? 4 : 0;
  const visibilityPenalty = config.visibility === "fog" ? 28 : config.visibility === "haze" ? 12 : 0;
  const difficultyPenalty = (config.difficulty - 1) * 5;
  const base = config.sensorQuality - lightingPenalty - visibilityPenalty - difficultyPenalty;
  const confidence = Math.max(12, Math.min(99, Math.round(base + (rng() - 0.5) * 26)));
  const dropProbability = Math.min(0.8, (100 - config.sensorQuality + visibilityPenalty + difficultyPenalty) / 130);

  if (rng() < dropProbability * 0.32) {
    return {
      entityId: track.id, observedAt: tick, status: "UNOBSERVED", confidence: 0,
      source: "SIMULATED RADAR", note: "No observation this tick",
    };
  }

  const intermittent = rng() < dropProbability;
  const jitter = 0.012 + (100 - config.sensorQuality) / 100 * 0.02;
  return {
    entityId: track.id,
    observedAt: tick,
    status: intermittent ? "INTERMITTENT" : "TRACK",
    confidence,
    source: "SIMULATED RADAR",
    note: intermittent ? "Intermittent synthetic observation" : "Synthetic track observation",
    x: Math.max(0.02, Math.min(0.98, track.x + (rng() - 0.5) * jitter)),
    y: Math.max(0.02, Math.min(0.98, track.y + (rng() - 0.5) * jitter)),
    altitude: Math.max(0, Math.round(track.altitude + (rng() - 0.5) * 18)),
  };
}

export function moveTruthTracks(tracks: TruthTrack[], tick: number): TruthTrack[] {
  return tracks.map((track) => {
    const step = tick % 2 === 0 ? 1 : 0.65;
    let x = track.x + track.vx * step;
    let y = track.y + track.vy * step;
    let vx = track.vx;
    let vy = track.vy;
    if (x < 0.06 || x > 0.94) vx *= -1;
    if (y < 0.06 || y > 0.94) vy *= -1;
    x = Math.max(0.06, Math.min(0.94, x));
    y = Math.max(0.06, Math.min(0.94, y));
    return { ...track, x, y, vx, vy };
  });
}

export function scenarioFor(id: string): Config {
  const scenario = SCENARIOS.find((item) => item.id === id) ?? SCENARIOS[0];
  return { ...DEFAULT_CONFIG, scenarioId: scenario.id, environment: scenario.environment, contactCount: scenario.count };
}

export function createEvent(
  type: SessionEvent["type"],
  title: string,
  detail: string,
  time: number,
  id: string,
  tick?: number,
  evidenceEventIds?: string[],
): SessionEvent {
  return { id, type, title, detail, time, ...(tick === undefined ? {} : { tick }), ...(evidenceEventIds ? { evidenceEventIds } : {}) };
}
