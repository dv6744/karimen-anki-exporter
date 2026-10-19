# Backlog: karimen-anki-exporter

---

## 1. Project Scaffolding & First Passing Test
Goal: Bootstrap an empty TypeScript + esbuild project with a test runner and one green test.
Description: Initialize `package.json`, install TypeScript, esbuild, and Vitest. Add a `build` script that compiles `src/main.ts` into `dist/karimen-anki-exporter.user.js`. Write one trivial test (e.g. `1 + 1 === 2`) to confirm the test runner works end-to-end.

---

## 2. Userscript Metadata & Entry Point
Goal: Produce a valid `.user.js` file with the correct Tampermonkey header and a no-op `main()` that runs on page load.
Description: Write the `==UserScript==` metadata block with all required directives: `@name`, `@match https://karimen-honmen.com/*`, `@grant GM_xmlhttpRequest`, and `@grant GM_download`. Wire the build so esbuild prepends the header verbatim to the output. Verify by installing the built file in Tampermonkey and confirming it activates on the target site (a `console.log` is enough).

---

## 3. Exam Route Parser
Goal: Extract exam type and exam ID from the current page URL.
Description: Write a pure function `parseExamRoute(url: string): ExamRoute | null` that accepts a URL string and returns a typed object `{ examType: "karimen" | "honmen" | "gentsuki", examId: string }`, or `null` if the URL does not match an exam page. Cover all three exam types and a non-matching URL with unit tests.

---

## 4. Exam JSON Fetcher
Goal: Fetch and type the static `exam.json` for a given exam route.
Description: Write `fetchExamData(route: ExamRoute): Promise<QuestionRecord[]>` that constructs the URL `/${examType}/exams/${examId}/exam.json`, fetches it via the native `fetch` API (usable from the userscript context), and maps the raw payload to the `QuestionRecord` type (`question`, `ja`, `en`, `correct`, `explanation_ja`, `explanation_en`, `images`). Add a unit test using a mocked fetch response.

---

## 5. DOM Score Harvester
Goal: Read per-question pass/fail and the user's choice from the scored exam DOM.
Description: Write `harvestScores(document: Document): Map<number, QuestionResult>` where `QuestionResult` is `{ passed: boolean, userChoice: "true" | "false" }`. The function reads the numbered grid buttons (CSS classes `bg-green-300` / `bg-red-300`) and the choice buttons (`ring-3 ring-black` for user selection, `bg-green-200` for correct). Unit-test it against fixture HTML strings that simulate both a correct and an incorrect answer.

---

## 6. Card Builder
Goal: Combine fetched question data and harvested scores into fully-populated Anki card records.
Description: Write `buildCards(questions: QuestionRecord[], scores: Map<number, QuestionResult>, route: ExamRoute): AnkiCard[]` that merges both data sources into the `AnkiCard` type matching the note field specification in the plan (UID, Exam_Category, Exam_Title, Question_JA/EN, Image, Answer_Symbol/Text, Explanation_JA/EN, User_Choice, Test_Result). The UID must be a deterministic hash derived from the normalized Japanese question text. Cover UID stability and image-field population with unit tests.

---

## 7. AnkiConnect Client
Goal: Implement a typed low-level client for the AnkiConnect REST API.
Description: Write an `ankiConnect(action, params)` function that posts to `http://localhost:8765` via `GM_xmlhttpRequest` and rejects on AnkiConnect-level errors. Build typed wrappers on top: `createModel(spec)`, `createDeck(name)`, `findNotes(query)`, `addNote(note)`, `addTags(noteIds, tags)`. Unit-test each wrapper against mocked `GM_xmlhttpRequest` responses, including the error path.

---

## 8. Note Type & Deck Initializer
Goal: Ensure the required Anki model and deck hierarchy exist before syncing cards.
Description: Write `ensureAnkiSetup(route: ExamRoute): Promise<void>` that calls `createModel` with the full field list and card templates from the plan, then calls `createDeck` with the correct hierarchical name (`Japanese Driving License::{ExamTypeLabel}::{ExamTitle}`). Both calls must be idempotent — AnkiConnect returns a benign response when the model/deck already exists. Add a test confirming no error is thrown on a "already exists" response.

---

## 9. Sync Logic (Duplicate Handling)
Goal: Push cards to Anki, updating tags on duplicates instead of creating new notes.
Description: Write `syncCards(cards: AnkiCard[]): Promise<SyncResult>` that iterates over each card, calls `findNotes("UID:" + card.uid)` to check for an existing note, and either updates tags via `addTags` (existing) or creates a new note via `addNote` (new). Return a `SyncResult` summary `{ added, updated, failed }`. Unit-test the three paths: new note, duplicate, and AnkiConnect failure.

---

## 10. TSV Fallback Exporter
Goal: Generate and trigger a browser download of an Anki-compatible TSV file.
Description: Write `exportTsv(cards: AnkiCard[], route: ExamRoute): void` that serializes the card array into a tab-separated file with the Anki header lines (`#separator:tab`, `#html:true`, `#tags column:12`), then calls `GM_download` to save it as `{examType}_{examId}_anki.txt`. Unit-test the serialization output against a one-card fixture, checking the header and field order exactly.

---

## 11. UI Injection & Main Orchestration
Goal: Inject the "Export to Anki" button and wire all modules together into a working end-to-end flow.
Description: Write a `MutationObserver` that waits for the score toolbar to appear in the DOM, then injects a styled "📥 Export to Anki" button beside it. On click, the button runs the full pipeline: parse route → fetch exam JSON → harvest scores → build cards → ensure Anki setup → sync cards; on AnkiConnect failure it falls back to TSV export. Display inline status feedback (loading spinner, success count, or error message) directly on the button. This task assumes all previous modules are complete and tested.
