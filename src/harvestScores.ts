export interface QuestionResult {
  passed: boolean;
  userChoice: "true" | "false";
}

/**
 * Reads pass/fail and the user's answer choice from the scored exam DOM.
 * Returns a Map keyed by 1-based question number (from button visible text).
 * Returns an empty Map if no scored grid buttons are found.
 */
export function harvestScores(document: Document): Map<number, QuestionResult> {
  const results = new Map<number, QuestionResult>();

  // Grid buttons are numbered 1–50; they carry bg-green-300 (passed) or bg-red-300 (failed)
  const gridButtons = document.querySelectorAll<HTMLElement>(
    "button.bg-green-300, button.bg-red-300"
  );

  for (const gridBtn of Array.from(gridButtons)) {
    const label = gridBtn.textContent?.trim();
    if (!label) continue;

    const questionNumber = parseInt(label, 10);
    if (isNaN(questionNumber)) continue;

    const passed = gridBtn.classList.contains("bg-green-300");

    // Find the choice button the user selected: carries ring-3 and ring-black classes.
    // The choice buttons are scoped to the section/container of this question.
    // Since the DOM structure is not fully known, we search globally for the selected
    // choice button. When processing multiple questions we rely on the data-question
    // attribute or similar scoping — but the spec only mentions ring-3 ring-black.
    // For a single-question view (the site shows one question at a time after clicking
    // a grid button), there will be exactly one selected choice button in the DOM.
    const selectedChoiceBtn = document.querySelector<HTMLElement>(
      "button.ring-3.ring-black"
    );

    let userChoice: "true" | "false" = "false";
    if (selectedChoiceBtn) {
      const rawValue =
        selectedChoiceBtn.dataset["value"] ??
        selectedChoiceBtn.textContent?.trim() ??
        "";
      // The value is "true" for ⭕ and "false" for ❌
      userChoice = rawValue === "true" ? "true" : "false";
    }

    results.set(questionNumber, { passed, userChoice });
  }

  return results;
}
