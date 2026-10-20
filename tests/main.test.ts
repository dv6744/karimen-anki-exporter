// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/injectButton", () => ({
  setupObserver: vi.fn(),
}));

describe("main", () => {
  it("runs without throwing", async () => {
    // Suppress console.log output during the test
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { main } = await import("../src/main");

    expect(() => main()).not.toThrow();
    expect(spy).toHaveBeenCalledWith("[karimen-anki-exporter] loaded");

    spy.mockRestore();
  });
});
