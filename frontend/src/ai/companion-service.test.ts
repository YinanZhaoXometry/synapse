/**
 * The CompanionService seam-picker proof (epic P2-8 T5, AD-18): runtime picks
 * the SERVER adapter, vitest picks the SIMULATED double — by one explicit
 * flag (src/test/setup.ts → seam-preference.ts), never magic.
 *
 * The ticket AC this pins: all existing AI-adjacent specs keep running
 * against the double OFFLINE UNMODIFIED — the flip above is the mechanism,
 * the first test here is its proof.
 */
import { describe, expect, it, vi } from "vitest";
import { getCompanionService, setCompanionService } from "./companion-service";
import { forceSimulatedCompanion } from "./seam-preference";
import { SimulatedCompanion } from "./simulated/companion";
import { ServerCompanionService } from "./companion-service-server";

describe("the CompanionService seam picker (epic P2-8 T5, AD-18)", () => {
  it("under vitest the default pick is the simulated double (the setup.ts flip — the offline AC)", () => {
    setCompanionService(null); // default pick, not an injection
    expect(getCompanionService()).toBeInstanceOf(SimulatedCompanion);
  });

  it("a fresh module graph (no vitest flip) picks the SERVER adapter — the runtime default", async () => {
    vi.resetModules(); // this file's static imports stay on the flipped graph
    const fresh = await import("./companion-service");
    const freshServer = await import("./companion-service-server");
    expect(fresh.getCompanionService()).toBeInstanceOf(freshServer.ServerCompanionService);
  });

  it("setCompanionService is the explicit injection point; null returns to the pick", () => {
    const injected = new SimulatedCompanion();
    setCompanionService(injected);
    expect(getCompanionService()).toBe(injected);
    setCompanionService(null);
    expect(getCompanionService()).toBeInstanceOf(SimulatedCompanion);
  });

  it("the flipped preference re-picks the double once the cached instance is cleared", () => {
    setCompanionService(new ServerCompanionService());
    expect(getCompanionService()).toBeInstanceOf(ServerCompanionService);
    forceSimulatedCompanion(); // the bootstrap's flip
    setCompanionService(null); // the cached pick goes — the flag decides next
    expect(getCompanionService()).toBeInstanceOf(SimulatedCompanion);
  });
});
