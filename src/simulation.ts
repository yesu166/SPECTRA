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
  createRng,
  stableHash,
  generateTruthTracks,
  moveTruthTracks,
  observeTruth,
  scenarioFor,
  type Config,
  type EnvironmentKind,
  type Lighting,
  type InputMethod,
  type ConfidenceLevel,
  type ContactClassification,
  type TraineeAction,
  type RawObservation,
  type SensorStatus,
  type SensorSource,
  type SessionEvent,
  type Visibility,
  type TruthTrack,
} from "./simulationCore";

export { DEFAULT_CONFIG, SCENARIOS, createEvent, scenarioFor };
export type {
  Config, EnvironmentKind, Lighting, SensorStatus, SensorSource, SessionEvent, Visibility,
  InputMethod, ConfidenceLevel, ContactClassification, TraineeAction,
};

export interface Observation {
  entityId: string;
  observedAt: number;
  status: SensorStatus;
  confidence: number;
  source: SensorSource;
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
  source?: SensorSource;
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

  step(deltaSeconds = 1): ContactView[] {
    this.#tick += 1;
    this.#tracks = moveTruthTracks(this.#tracks, deltaSeconds);
    for (const track of this.#tracks) {
      const raw = observeTruth(this.config, track, this.#tick);
      this.#observations.set(track.id, copyObservation(raw, this.#observations.get(track.id)));
    }
    return this.getContacts();
  }

  /**
   * Generate an extra, on-demand synthetic camera observation for one selected
   * contact. Environmental degradation may still prevent a usable observation.
   * This is an exercise interaction, not a physical sensor model.
   */
  requestMoreInfo(contactId: string): ContactView[] {
    const track = this.#tracks.find((item) => item.id === contactId);
    if (!track) return this.getContacts();

    const previous = this.#observations.get(contactId);
    const requestSeed = (
      this.config.seed ^
      (this.#tick * 104729) ^
      stableHash(`${contactId}:secondary-camera`)
    ) >>> 0;
    const rng = createRng(requestSeed);
    const lightingPenalty = this.config.lighting === "night" ? 30 : this.config.lighting === "dusk" ? 10 : 0;
    const visibilityPenalty = this.config.visibility === "fog" ? 34 : this.config.visibility === "haze" ? 15 : 0;
    const difficultyPenalty = (this.config.difficulty - 1) * 4;
    const failureProbability = Math.min(
      0.82,
      0.1 + (100 - this.config.sensorQuality) / 180 + lightingPenalty / 140 + visibilityPenalty / 130 + difficultyPenalty / 160,
    );
    const observedAt = this.#tick;

    if (rng() < failureProbability) {
      this.#observations.set(contactId, {
        entityId: contactId,
        observedAt,
        status: "UNOBSERVED",
        confidence: previous?.confidence ?? 0,
        source: "SIMULATED CAMERA",
        note: "Additional synthetic camera observation unavailable under current conditions; last known position retained.",
        x: previous?.x,
        y: previous?.y,
        altitude: previous?.altitude,
        lastObservedAt: previous?.lastObservedAt,
      });
      return this.getContacts();
    }

    const cameraConfidence = Math.max(
      10,
      Math.min(
        98,
        Math.round(this.config.sensorQuality - lightingPenalty - visibilityPenalty - difficultyPenalty + (rng() - 0.5) * 24),
      ),
    );
    const jitter = 0.008 + (100 - this.config.sensorQuality) / 100 * 0.018;
    const cameraX = Math.max(0.02, Math.min(0.98, track.x + (rng() - 0.5) * jitter));
    const cameraY = Math.max(0.02, Math.min(0.98, track.y + (rng() - 0.5) * jitter));
    const cameraAltitude = Math.max(0, Math.round(track.altitude + (rng() - 0.5) * 12));
    const canFuse = previous?.status === "TRACK" && typeof previous.x === "number" && typeof previous.y === "number";
    const x = canFuse ? (previous.x! + cameraX) / 2 : cameraX;
    const y = canFuse ? (previous.y! + cameraY) / 2 : cameraY;
    const altitude = canFuse && typeof previous.altitude === "number"
      ? Math.round((previous.altitude + cameraAltitude) / 2)
      : cameraAltitude;
    const confidence = canFuse
      ? Math.min(99, Math.round((previous.confidence + cameraConfidence) / 2 + 5))
      : cameraConfidence;

    this.#observations.set(contactId, {
      entityId: contactId,
      observedAt,
      status: canFuse ? "TRACK" : "INTERMITTENT",
      confidence,
      source: canFuse ? "SYNTHETIC FUSION" : "SIMULATED CAMERA",
      note: canFuse
        ? "On-demand camera sample combined with the latest synthetic radar observation; identity remains unconfirmed."
        : "Additional synthetic camera observation received; identity remains unconfirmed.",
      x,
      y,
      altitude,
      lastObservedAt: observedAt,
    });
    return this.getContacts();
  }

  /** Rebuild a deterministic session to a given tick without exposing truth. */
  advanceTo(tick: number): ContactView[] {
    const target = Math.max(0, Math.min(36000, Math.floor(tick)));
    while (this.#tick < target) this.step();
    return this.getContacts();
  }
}
