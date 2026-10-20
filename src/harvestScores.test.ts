// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { harvestScores } from "./harvestScores";

function makeDocument(html: string): Document {
  const doc = document.implementation.createHTMLDocument("test");
  doc.body.innerHTML = html;
  return doc;
}

describe("harvestScores", () => {
  it("returns correct result for a passed (correct) answer", () => {
    // Grid button has bg-green-300; selected choice button has ring-3 ring-black
    // and data-value="true" (user chose ⭕, which matches correct answer bg-green-200)
    const doc = makeDocument(`
      <div>
        <button class="bg-green-300">1</button>
        <button class="bg-green-200" data-value="true">⭕</button>
        <button class="ring-3 ring-black" data-value="true">⭕</button>
        <button data-value="false">❌</button>
      </div>
    `);

    const result = harvestScores(doc);
    expect(result.size).toBe(1);
    expect(result.get(1)).toEqual({ passed: true, userChoice: "true" });
  });

  it("returns correct result for a failed (incorrect) answer", () => {
    // Grid button has bg-red-300; selected choice button has ring-3 ring-black
    // and data-value="false" (user chose ❌, which is bg-red-200 = wrong answer)
    const doc = makeDocument(`
      <div>
        <button class="bg-red-300">1</button>
        <button class="bg-green-200" data-value="true">⭕</button>
        <button data-value="false">❌</button>
        <button class="ring-3 ring-black bg-red-200" data-value="false">❌</button>
      </div>
    `);

    const result = harvestScores(doc);
    expect(result.size).toBe(1);
    expect(result.get(1)).toEqual({ passed: false, userChoice: "false" });
  });

  it("returns an empty Map when no scored grid buttons are present", () => {
    const doc = makeDocument(`
      <div>
        <button class="bg-blue-300">1</button>
        <p>No exam content</p>
      </div>
    `);

    const result = harvestScores(doc);
    expect(result.size).toBe(0);
  });

  it("uses button text content as userChoice fallback when data-value is absent", () => {
    const doc = makeDocument(`
      <div>
        <button class="bg-green-300">1</button>
        <button class="ring-3 ring-black">true</button>
      </div>
    `);

    const result = harvestScores(doc);
    expect(result.get(1)).toEqual({ passed: true, userChoice: "true" });
  });

  it("maps question number from button text, not DOM position", () => {
    const doc = makeDocument(`
      <div>
        <button class="bg-green-300">42</button>
        <button class="ring-3 ring-black" data-value="true">⭕</button>
      </div>
    `);

    const result = harvestScores(doc);
    expect(result.has(42)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.get(42)).toEqual({ passed: true, userChoice: "true" });
  });
});
