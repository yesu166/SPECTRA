/**
 * Public, trainee-safe simulation API.
 *
 * UI modules use this facade only. Ground-truth labels, current true positions,
 * velocity and behaviour state are held by the internal core and are never
 * included in ContactView or a trainee session export.
 */
import {
  DEFAULT_CONFIG,
  SCENARIOS,
  createEvent,
  generateTruthTracks,
  moveTruthTracks,
  observeTruth,
  scenarioFor,
  type Config,
  type EnvironmentKind,
  type Lighting,
  type RawObservation,
  type SensorStatus,
  type SessionEvent,
  type Visibility,
  type TruthTrack,
} from "./simulationCore";

export { DEFAULT_CONFIG, SCENARIOS, createEvent, scenarioFor };
export type { Config, EnvironmentKind, Lighting, SensorStatus, SessionEvent, Visibility };

export interface Observation {
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

export interface ContactView {
  id: string;
  x?: number;
  y?: number;
  altitude?: number;
  status?: SensorStatus;
  confidence?: number;
  source?: "SIMULATED RADAR";
  note?: string;
  observedAt?: number;
  lastObservedAt?: number;
}

export interface SessionSnapshot {
  id: string;
  startedAt: string;
  config: Config;
  duration: number;
  events: SessionEvent[];
  contacts?: ContactView[];
  tick?: number;
}

function copyObservation(raw: RawObservation, previous?: Observation): Observation {
  if (raw.status === "UNOBSERVED") {
    return {
      ...raw,
      x: previous?.x,
      y: previous?.y,
      altitude: previous?.altitude,
      lastObservedAt: previous?.lastObservedAt,
    };
  }
  return { ...raw, lastObservedAt: raw.observedAt };
}

/**
 * Owns truth privately and exposes only sensor-derived contact views.
 * This is an architectural separation within a browser app, not cryptographic
 * protection against inspecting shipped JavaScript.
 */
export class SimulationSession {
  readonly config: Config;
  #tracks: TruthTrack[];
  #observations = new Map<string, Observation>();
  #tick = 0;

  constructor(config: Config) {
    this.config = { ...config };
    this.#tracks = generateTruthTracks(this.config);
  }

  get tick(): number {
    return this.#tick;
  }

  getContacts(): ContactView[] {
    return this.#tracks.map((track) => {
      const observation = this.#observations.get(track.id);
      return {
        id: track.id,
        x: observation?.x,
        y: observation?.y,
        altitude: observation?.altitude,
        status: observation?.status,
        confidence: observation?.confidence,
        source: observation?.source,
        note: observation?.note,
        observedAt: observation?.observedAt,
        lastObservedAt: observation?.lastObservedAt,
      };
    });
  }

  step(): ContactView[] {
    this.#tick += 1;
    this.#tracks = moveTruthTracks(this.#tracks, this.#tick);
    for (const track of this.#tracks) {
      const raw = observeTruth(this.config, track, this.#tick);
      this.#observations.set(track.id, copyObservation(raw, this.#observations.get(track.id)));
    }
    return this.getContacts();
  }

  /** Rebuild a deterministic session to a given tick without exposing truth. */
  advanceTo(tick: number): ContactView[] {
    const target = Math.max(0, Math.min(36000, Math.floor(tick)));
    while (this.#tick < target) this.step();
    return this.getContacts();
  }
}
