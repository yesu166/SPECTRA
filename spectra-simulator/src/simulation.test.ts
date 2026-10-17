import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, generateEntities, getObservation, scenarioFor } from "./simulation";

describe("synthetic scenario generation", () => {
  it("generates identical entities for the same seed and configuration", () => {
    const first = generateEntities({ ...DEFAULT_CONFIG, seed: 98765 });
    const second = generateEntities({ ...DEFAULT_CONFIG, seed: 98765 });
    expect(first).toEqual(second);
  });

  it("changes the generated scenario when the seed changes", () => {
    const first = generateEntities({ ...DEFAULT_CONFIG, seed: 123 });
    const second = generateEntities({ ...DEFAULT_CONFIG, seed: 456 });
    expect(first).not.toEqual(second);
  });

  it("respects the configured contact count within supported bounds", () => {
    expect(generateEntities({ ...DEFAULT_CONFIG, contactCount: 7 })).toHaveLength(7);
    expect(generateEntities({ ...DEFAULT_CONFIG, contactCount: 99 })).toHaveLength(30);
  });

  it("varies the synthetic observation model with sensor quality and conditions", () => {
    const entity = generateEntities({ ...DEFAULT_CONFIG, seed: 44 })[0];
    const good = getObservation({ ...DEFAULT_CONFIG, seed: 44, sensorQuality: 100, visibility: "clear", lighting: "day" }, entity, 1);
    const degraded = getObservation({ ...DEFAULT_CONFIG, seed: 44, sensorQuality: 25, visibility: "fog", lighting: "night" }, entity, 1);
    expect(good.source).toBe("SIMULATED RADAR");
    expect(degraded.source).toBe("SIMULATED RADAR");
    expect(good.confidence).toBeGreaterThanOrEqual(degraded.confidence);
  });

  it("loads scenario templates with their predefined environments", () => {
    expect(scenarioFor("urban-observation").environment).toBe("urban");
    expect(scenarioFor("rural-site").environment).toBe("rural");
    expect(scenarioFor("perimeter-watch").contactCount).toBeGreaterThan(0);
  });
});
