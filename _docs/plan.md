# Specification & Plan: Karimen & Honmen Anki Exporter

**Project Name**: `karimen-anki-exporter`  
**Target Website**: [karimen-honmen.com](https://karimen-honmen.com)  
**Tool Type**: Tampermonkey / Violentmonkey Userscript (`.user.js`)  
**Sync Mechanism**: AnkiConnect REST API (`http://localhost:8765`) + Fallback TSV/CSV Export  

---

## 1. Project Overview & Objective

To streamline studying for the Japanese driver's license theoretical exams (仮免 *Karimen*, 本免 *Honmen*, and 原付 *Gentsuki*) by converting mock exam results into high-quality, bilingual Anki flashcards.

### Key Goals:
- **Zero-friction workflow**: A single "Export to Anki" button injected into the mock exam interface.
- **Bilingual precision**: Captures both Japanese (canonical legal phrasing) and English translations for all questions and explanations.
- **Mistake tracking**: Automatically marks cards failed during tests with the `failed` tag in Anki.
- **Clean card design**: Large ⭕/❌ status badges and a collapsible `<details>` toggle showing original test choices without spoiling the answer during review.
- **Smart deduplication**: Avoids duplicate cards across mock tests by updating tags on existing cards.
- **Reliable fallback**: Prompts to download an Anki-compatible TSV/CSV file if Anki is not open.

---

## 2. Deck Hierarchy Architecture

The script automatically creates and organizes subdecks under a clean parent hierarchy:

```text
Japanese Driving License
├── Karimen (仮免)
│   ├── Exam 1
│   ├── Exam 2
│   └── Exam 10
├── Honmen (本免)
│   ├── Exam 1
│   └── ...
└── Gentsuki (原付)
    └── Exam 1
```

* **Target Deck String**:  
  `Japanese Driving License::{ExamTypeLabel}::{ExamTitle}`  
  Example: `Japanese Driving License::Karimen (仮免)::Karimen exam no 10`

---

## 3. Data Extraction Strategy

From inspecting `karimen-honmen.com`, the exam viewer works as a client-side Next.js application:

1. **Static Data Endpoint**:  
   The site exposes the complete question bank for each exam at:  
   `/${examType}/exams/${examId}/exam.json`  
   *Contains*: `question` (index), `ja`, `en`, `correct` (`true`/`false`), `explanation_ja`, `explanation_en`, `images` (array of image paths).

2. **Session / DOM State**:  
   After clicking **Score**:
   * Number buttons `1..50` in the top grid carry CSS classes:
     * Passed / Correct: `bg-green-300`
     * Failed / Incorrect: `bg-red-300`
   * Choice buttons carry:
     * User's selection: `ring-3 ring-black`
     * Correct answer: `bg-green-200` or `bg-green-300`
     * Incorrect selection: `bg-red-200`

3. **Combined Data Structure**:  
   The userscript cross-references the session result (pass/fail, user's choice) with the full bilingual JSON to assemble complete card records.

---

## 4. Anki Note Type & Template Specification

### Note Type: `Japanese Driving License (Bilingual)`

#### Fields:
| Field Name | Description | Example |
| :--- | :--- | :--- |
| `UID` | Deterministic hash of Japanese question text | `q_f829d7c1` |
| `Exam_Category` | Exam stage | `Karimen (仮免)` |
| `Exam_Title` | Exam title | `Karimen exam no 10` |
| `Question_JA` | Canonical Japanese text | `車両の衝突時の衝撃力は速度の2乗に比例する。` |
| `Question_EN` | English translation | `The impact force of a collision is proportional to the square of the speed.` |
| `Image` | Road sign or scenario diagram `<img>` tag | `<img src="https://karimen-honmen.com/...">` (or blank) |
| `Answer_Symbol` | True or False symbol | `⭕` or `❌` |
| `Answer_Text` | Text label | `TRUE (正しい)` or `FALSE (誤り)` |
| `Explanation_JA`| Japanese explanation | `速度が2倍になれば衝撃力は4倍になる。` |
| `Explanation_EN`| English explanation | `If speed doubles, impact force increases fourfold.` |
| `User_Choice` | Choice during mock test | `⭕` or `❌` |
| `Test_Result` | Result during test | `Failed` or `Passed` |

---

### Card Templates

#### Front Template:
```html
<div class="card-container">
  <div class="badge-header">{{Exam_Category}} &bull; {{Exam_Title}}</div>
  
  {{#Image}}
  <div class="question-image">{{Image}}</div>
  {{/Image}}

  <div class="question-en">{{Question_EN}}</div>
  <hr class="divider">
  <div class="question-ja">{{Question_JA}}</div>
</div>
```

#### Back Template:
```html
{{FrontSide}}

<hr id="answer">

<div class="answer-box {{#Answer_Symbol}}ans-{{Answer_Symbol}}{{/Answer_Symbol}}">
  <span class="symbol">{{Answer_Symbol}}</span>
  <span class="label">{{Answer_Text}}</span>
</div>

<div class="explanation-box">
  <div class="exp-title">Explanation / 解説:</div>
  {{#Explanation_EN}}
  <div class="exp-en">{{Explanation_EN}}</div>
  {{/Explanation_EN}}
  {{#Explanation_JA}}
  <div class="exp-ja">{{Explanation_JA}}</div>
  {{/Explanation_JA}}
</div>

<details class="test-history">
  <summary>View Mock Exam Result</summary>
  <div class="history-content">
    You answered: <strong>{{User_Choice}}</strong> 
    <span class="status-{{Test_Result}}">({{Test_Result}})</span>
  </div>
</details>
```

#### Styling (CSS):
* Dark/Light mode adaptive typography.
* Prominent green ⭕ (`#22c55e`) and red ❌ (`#ef4444`) badges.
* Distinctive styling for Japanese and English fonts to improve scannability.
* Clean `<details>` toggle styling for the mock exam history.

---

## 5. Duplicate Handling & Tagging Logic

1. **Unique Identification**:  
   The `UID` is computed from the normalized Japanese question text.
2. **AnkiConnect Duplicate Check**:
   * Uses `findNotes("UID:" + uid)` via AnkiConnect.
   * **If Note exists**:
     * Appends tags: `addTags(notes, tags)` (adds `failed` if failed in current test, and `exam_{id}`).
     * Keeps original review scheduling intact.
   * **If Note is new**:
     * Calls `addNote` with full fields and initial tags.
3. **Tags Applied**:
   * `license_jp`
   * `karimen` or `honmen` or `gentsuki`
   * `exam_{id}` (e.g. `exam_10`)
   * `failed` *(only if question was answered incorrectly)*

---

## 6. Export Options

1. **Primary: AnkiConnect**:
   * Endpoint: `POST http://localhost:8765`
   * Bypasses browser CORS via Tampermonkey `GM_xmlhttpRequest`.
   * Automatically initializes the Note Type and Deck if they do not exist.
2. **Fallback: Downloadable TSV**:
   * If AnkiConnect fails or Anki is closed, prompts to save a file named `karimen_10_anki.txt`.
   * Pre-formatted with header `#separator:tab`, `#html:true`, `#tags column:12` for native one-click Anki file import.

---

## 7. Implementation Plan

1. **Userscript Scaffolding**:
   * Tampermonkey metadata (`@match https://karimen-honmen.com/*`, `@grant GM_xmlhttpRequest`, `@grant GM_download`).
2. **DOM Observer & UI Injection**:
   * Injects an styled "📥 Export to Anki" button beside the "Score" and timer toolbar.
3. **Data Harvesting Module**:
   * Reads current exam route (`/exam/karimen/10`).
   * Fetches the matching `/karimen/exams/10/exam.json`.
   * Reads score grid buttons from DOM to identify pass/fail per question.
4. **AnkiConnect Client Module**:
   * `createModelIfNotExists()`
   * `createDeckIfNotExists()`
   * `syncCards(cards)` with duplicate check and tag updates.
5. **Fallback Exporter**:
   * Generates TSV Blob and triggers browser download.
