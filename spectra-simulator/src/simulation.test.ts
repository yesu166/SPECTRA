import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, generateEntities, getObservation, scenarioFor } from "./simulation";

describe("synthetic scenario generation", () => {
  it("generates identical entities for the same seed and configuration", () => {
    expect(generateEntities({ ...DEFAULT_CONFIG, seed: 98765 })).toEqual(generateEntities({ ...DEFAULT_CONFIG, seed: 98765 }));
  });

  it("changes generated entities when the seed changes", () => {
    expect(generateEntities({ ...DEFAULT_CONFIG, seed: 123 })).not.toEqual(generateEntities({ ...DEFAULT_CONFIG, seed: 456 }));
  });

  it("respects configured contact count bounds", () => {
    expect(generateEntities({ ...DEFAULT_CONFIG, contactCount: 7 })).toHaveLength(7);
    expect(generateEntities({ ...DEFAULT_CONFIG, contactCount: 99 })).toHaveLength(30);
  });

  it("reproduces observation status and confidence for a fixed seed, entity and tick", () => {
    const config = { ...DEFAULT_CONFIG, seed: 44 };
    const entity = generateEntities(config)[0];
    expect(getObservation(config, entity, 9)).toEqual(getObservation(config, entity, 9));
  });

  it("uses a synthetic source and lowers confidence under degraded conditions", () => {
    const entity = generateEntities({ ...DEFAULT_CONFIG, seed: 44 })[0];
    const good = getObservation({ ...DEFAULT_CONFIG, seed: 44, sensorQuality: 100, visibility: "clear", lighting: "day" }, entity, 1);
    const poor = getObservation({ ...DEFAULT_CONFIG, seed: 44, sensorQuality: 25, visibility: "fog", lighting: "night" }, entity, 1);
    expect(good.source).toBe("SIMULATED RADAR");
    expect(poor.source).toBe("SIMULATED RADAR");
    expect(good.confidence).toBeGreaterThan(poor.confidence);
  });

  it("loads expected environments for scenario templates", () => {
    expect(scenarioFor("urban-observation").environment).toBe("urban");
    expect(scenarioFor("rural-site").environment).toBe("rural");
    expect(scenarioFor("perimeter-watch").contactCount).toBeGreaterThan(0);
  });
});
