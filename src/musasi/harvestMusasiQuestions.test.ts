// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { harvestMusasiQuestions } from "./harvestMusasiQuestions";

function makeDocument(html: string): Document {
  const doc = document.implementation.createHTMLDocument("test");
  doc.body.innerHTML = html;
  return doc;
}

describe("harvestMusasiQuestions", () => {
  it("returns a correctly-answered question with passed: true", () => {
    // The user chose ⭕ (true) and the correct answer is also ⭕ (true)
    const doc = makeDocument(`
      <div class="question-item">
        <span class="question-number">1</span>
        <p class="question-text">危険物取扱者甲種の試験に関する記述として、正しいものはどれか。</p>
        <span class="correct-answer" data-value="true">⭕</span>
        <span class="user-answer" data-value="true">⭕</span>
        <p class="explanation">この記述は正しい。甲種危険物取扱者は全種類の危険物を取り扱える。</p>
      </div>
    `);

    const results = harvestMusasiQuestions(doc);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      questionNumber: 1,
      ja: "危険物取扱者甲種の試験に関する記述として、正しいものはどれか。",
      correct: true,
      userAnswer: true,
      passed: true,
      explanation_ja: "この記述は正しい。甲種危険物取扱者は全種類の危険物を取り扱える。",
    });
  });

  it("returns an incorrectly-answered question with passed: false", () => {
    // The correct answer is ❌ (false) but the user chose ⭕ (true)
    const doc = makeDocument(`
      <div class="question-item">
        <span class="question-number">2</span>
        <p class="question-text">乙種第4類危険物取扱者は、すべての危険物を取り扱うことができる。</p>
        <span class="correct-answer" data-value="false">❌</span>
        <span class="user-answer" data-value="true">⭕</span>
      </div>
    `);

    const results = harvestMusasiQuestions(doc);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      questionNumber: 2,
      ja: "乙種第4類危険物取扱者は、すべての危険物を取り扱うことができる。",
      correct: false,
      userAnswer: true,
      passed: false,
      explanation_ja: undefined,
    });
  });

  it("returns an empty array when no question elements are found", () => {
    const doc = makeDocument(`
      <div>
        <p>No exam content here.</p>
      </div>
    `);

    const results = harvestMusasiQuestions(doc);
    expect(results).toEqual([]);
  });
});
