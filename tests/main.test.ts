import { describe, it, expect, vi } from "vitest";

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
