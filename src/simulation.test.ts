import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, SimulationSession, scenarioFor, type ContactView } from "./simulation";

function runTo(seed: number, ticks: number, patch: Partial<typeof DEFAULT_CONFIG> = {}): ContactView[] {
  const session = new SimulationSession({ ...DEFAULT_CONFIG, ...patch, seed });
  for (let tick = 0; tick < ticks; tick += 1) session.step();
  return session.getContacts();
}

describe("trainee-safe simulation facade", () => {
  it("does not expose truth labels, velocity, phase, or current truth positions", () => {
    const session = new SimulationSession(DEFAULT_CONFIG);
    const initial = session.getContacts();

    expect(initial.length).toBe(DEFAULT_CONFIG.contactCount);
    expect(initial.every((contact) => contact.x === undefined && contact.y === undefined)).toBe(true);
    for (const contact of initial) {
      const keys = Object.keys(contact);
      expect(keys).not.toContain("kind");
      expect(keys).not.toContain("label");
      expect(keys).not.toContain("vx");
      expect(keys).not.toContain("vy");
      expect(keys).not.toContain("phase");
    }

    const serialized = JSON.stringify(runTo(DEFAULT_CONFIG.seed, 12));
    expect(serialized).not.toContain("simulated-threat");
    expect(serialized).not.toContain("AUTHORIZED");
    expect(serialized).not.toContain("UNRESOLVED");
  });

  it("reproduces the same trainee-visible view for the same seed and inputs", () => {
    expect(runTo(98765, 25)).toEqual(runTo(98765, 25));
  });

  it("changes the generated view when the seed changes", () => {
    expect(runTo(123, 12)).not.toEqual(runTo(456, 12));
  });

  it("preserves the last observed position instead of revealing a position during an outage", () => {
    const session = new SimulationSession({ ...DEFAULT_CONFIG, seed: 9127, sensorQuality: 45 });
    let prior = session.getContacts();
    let checked = false;

    for (let tick = 0; tick < 150; tick += 1) {
      const current = session.step();
      for (const contact of current) {
        const previous = prior.find((candidate) => candidate.id === contact.id);
        if (contact.status === "UNOBSERVED" && previous?.lastObservedAt !== undefined) {
          expect(contact.x).toBe(previous.x);
          expect(contact.y).toBe(previous.y);
          checked = true;
        }
      }
      prior = current;
    }
    expect(checked).toBe(true);
  });

  it("reconstructs the same view when advancing a new session to a saved tick", () => {
    const active = new SimulationSession({ ...DEFAULT_CONFIG, seed: 44 });
    for (let tick = 0; tick < 36; tick += 1) active.step();

    const restored = new SimulationSession({ ...DEFAULT_CONFIG, seed: 44 });
    restored.advanceTo(36);
    expect(restored.getContacts()).toEqual(active.getContacts());
  });

  it("reduces synthetic confidence under degraded conditions", () => {
    const clear = runTo(44, 8, { sensorQuality: 100, visibility: "clear", lighting: "day" });
    const degraded = runTo(44, 8, { sensorQuality: 25, visibility: "fog", lighting: "night" });
    const mean = (contacts: ContactView[]) => contacts.reduce((sum, contact) => sum + (contact.confidence ?? 0), 0) / contacts.length;
    expect(mean(clear)).toBeGreaterThan(mean(degraded));
  });

  it("uses expected environment settings for scenario templates", () => {
    expect(scenarioFor("urban-observation").environment).toBe("urban");
    expect(scenarioFor("rural-site").environment).toBe("rural");
    expect(scenarioFor("perimeter-watch").contactCount).toBeGreaterThan(0);
  });
});
