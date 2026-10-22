export interface MusasiQuestionRecord {
  questionNumber: number;
  ja: string;
  correct: boolean;
  userAnswer: boolean;
  passed: boolean;
  explanation_ja?: string;
}

// TODO: verify selectors against live musasi.jp DOM
const QUESTION_ITEM_SELECTOR = ".question-item";

// TODO: verify selectors against live musasi.jp DOM
const QUESTION_NUMBER_SELECTOR = ".question-number";

// TODO: verify selectors against live musasi.jp DOM
const QUESTION_TEXT_SELECTOR = ".question-text";

// TODO: verify selectors against live musasi.jp DOM
const CORRECT_ANSWER_SELECTOR = ".correct-answer";

// TODO: verify selectors against live musasi.jp DOM
const USER_ANSWER_SELECTOR = ".user-answer";

// TODO: verify selectors against live musasi.jp DOM
const EXPLANATION_SELECTOR = ".explanation";

/**
 * Reads the rendered DOM of a musasi.jp test results page and returns
 * structured question data. Returns an empty array when no question elements
 * are found.
 */
export function harvestMusasiQuestions(document: Document): MusasiQuestionRecord[] {
  const records: MusasiQuestionRecord[] = [];

  const questionItems = document.querySelectorAll<HTMLElement>(QUESTION_ITEM_SELECTOR);
  if (questionItems.length === 0) {
    return records;
  }

  for (const item of Array.from(questionItems)) {
    const numberEl = item.querySelector<HTMLElement>(QUESTION_NUMBER_SELECTOR);
    const textEl = item.querySelector<HTMLElement>(QUESTION_TEXT_SELECTOR);
    const correctEl = item.querySelector<HTMLElement>(CORRECT_ANSWER_SELECTOR);
    const userAnswerEl = item.querySelector<HTMLElement>(USER_ANSWER_SELECTOR);

    if (!numberEl || !textEl || !correctEl || !userAnswerEl) continue;

    const questionNumber = parseInt(numberEl.textContent?.trim() ?? "", 10);
    if (isNaN(questionNumber)) continue;

    const ja = textEl.textContent?.trim() ?? "";

    // data-value="true" means the correct answer is ⭕ (true), "false" means ❌ (false)
    const correct = (correctEl.dataset["value"] ?? correctEl.textContent?.trim()) === "true";
    const userAnswer = (userAnswerEl.dataset["value"] ?? userAnswerEl.textContent?.trim()) === "true";
    const passed = correct === userAnswer;

    const explanationEl = item.querySelector<HTMLElement>(EXPLANATION_SELECTOR);
    const explanation_ja = explanationEl?.textContent?.trim() || undefined;

    records.push({ questionNumber, ja, correct, userAnswer, passed, explanation_ja });
  }

  return records;
}
