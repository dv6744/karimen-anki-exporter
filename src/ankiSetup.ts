import { createModel, createDeck } from './ankiConnect';
import { ExamRoute } from './parseExamRoute';

const MODEL_NAME = 'Japanese Driving License (Bilingual)';

const FIELDS = [
  'UID',
  'Exam_Category',
  'Exam_Title',
  'Question_JA',
  'Question_EN',
  'Image',
  'Answer_Symbol',
  'Answer_Text',
  'Explanation_JA',
  'Explanation_EN',
  'User_Choice',
  'Test_Result',
];

const FRONT_TEMPLATE = `<div class="card-container">
  <div class="badge-header">{{Exam_Category}} &bull; {{Exam_Title}}</div>

  {{#Image}}
  <div class="question-image">{{Image}}</div>
  {{/Image}}

  <div class="question-en">{{Question_EN}}</div>
  <hr class="divider">
  <div class="question-ja">{{Question_JA}}</div>
</div>`;

const BACK_TEMPLATE = `{{FrontSide}}

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
</details>`;

const EXAM_TYPE_LABELS: Record<string, string> = {
  karimen: 'Karimen (仮免)',
  honmen: 'Honmen (本免)',
  gentsuki: 'Gentsuke (原付)',
};

const EXAM_TYPE_TITLES: Record<string, string> = {
  karimen: 'Karimen',
  honmen: 'Honmen',
  gentsuki: 'Gentsuke',
};

/**
 * Creates the `Japanese Driving License (Bilingual)` note type and the
 * correct subdeck for the given exam route. Both operations are idempotent:
 * if the model or deck already exists the function resolves without error.
 */
export async function ensureAnkiSetup(route: ExamRoute): Promise<void> {
  try {
    await createModel({
      modelName: MODEL_NAME,
      inOrderFields: FIELDS,
      css: '',
      cardTemplates: [
        {
          Name: 'Recognition',
          Front: FRONT_TEMPLATE,
          Back: BACK_TEMPLATE,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Model name already exists') {
      // idempotent — model already set up, continue
    } else {
      throw err;
    }
  }

  const label = EXAM_TYPE_LABELS[route.examType];
  const titlePrefix = EXAM_TYPE_TITLES[route.examType];
  const examTitle = `${titlePrefix} exam no ${route.examId}`;
  const deckName = `Japanese Driving License::${label}::${examTitle}`;

  await createDeck(deckName);
}
