import type { ExamRoute } from './parseExamRoute';
import type { QuestionRecord } from './fetchExamData';
import type { QuestionResult } from './harvestScores';

// UID hashing uses a pure-JS CRC32 (no runtime dependencies required).
// CRC32 was chosen over Web Crypto (crypto.subtle.digest) because CRC32 is
// synchronous, keeping buildCards() a plain synchronous function that returns
// AnkiCard[] directly. Web Crypto is async-only; using it would require
// returning Promise<AnkiCard[]> and async test infrastructure. CRC32 produces
// a 32-bit value encoded as exactly 8 lowercase hex digits, which matches
// the q_<8hex> UID format specified in the plan.

/** Pre-computed CRC32 lookup table (IEEE polynomial 0xEDB88320). */
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(str: string): number {
  const bytes = new TextEncoder().encode(str);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0; // unsigned 32-bit
}

/** Normalize Japanese question text: strip leading/trailing whitespace,
 *  collapse internal whitespace runs to a single space. */
function normalizeJa(ja: string): string {
  return ja.trim().replace(/\s+/g, ' ');
}

function buildUid(ja: string): string {
  const normalized = normalizeJa(ja);
  const hash = crc32(normalized);
  return 'q_' + hash.toString(16).padStart(8, '0');
}

export interface AnkiCard {
  UID: string;
  Exam_Category: string;
  Exam_Title: string;
  Question_JA: string;
  Question_EN: string;
  /** Final HTML for the Anki Image field. Populated by syncCards after
   *  storeMediaFile resolves image URLs to local filenames. Empty string
   *  when there are no images. */
  Image: string;
  /** Full https:// URLs of all images for this question. syncCards uses these
   *  to call storeMediaFile and then assembles the Image field. */
  imageUrls: string[];
  Answer_Symbol: string;
  Answer_Text: string;
  Explanation_JA: string;
  Explanation_EN: string;
  User_Choice: string;
  Test_Result: string;
}

interface ExamTypeMeta {
  category: string;
  label: string;
}

const EXAM_TYPE_META: Record<string, ExamTypeMeta> = {
  karimen:  { category: 'Karimen (仮免)',  label: 'Karimen' },
  honmen:   { category: 'Honmen (本免)',   label: 'Honmen' },
  gentsuki: { category: 'Gentsuke (原付)', label: 'Gentsuke' },
};

/**
 * Merges fetched question data and harvested scores into fully-populated
 * Anki card records ready for sync or TSV export.
 */
export function buildCards(
  questions: QuestionRecord[],
  scores: Map<number, QuestionResult>,
  route: ExamRoute,
): AnkiCard[] {
  const meta = EXAM_TYPE_META[route.examType];
  if (!meta) {
    throw new Error(`Unknown examType: ${route.examType}`);
  }

  const examCategory = meta.category;
  const examTitle = `${meta.label} exam no ${route.examId}`;

  return questions.map((q) => {
    const uid = buildUid(q.ja);

    // imageUrls: full https:// URLs for all images on this question.
    // Image field is left empty here; syncCards assembles it after calling
    // storeMediaFile to place images into Anki's local media collection.
    const imageUrls = (q.images ?? []).map(
      (path) => `https://karimen-honmen.com/${path}`,
    );

    // Correct answer fields
    const answerSymbol = q.correct ? '⭕' : '❌';
    const answerText = q.correct ? 'TRUE (正しい)' : 'FALSE (誤り)';

    // Score fields (default to safe values if no score recorded for this question)
    const score = scores.get(q.question);
    const userChoice = score
      ? score.userChoice === 'true'
        ? '⭕'
        : '❌'
      : '';
    const testResult = score ? (score.passed ? 'Passed' : 'Failed') : '';

    return {
      UID: uid,
      Exam_Category: examCategory,
      Exam_Title: examTitle,
      Question_JA: q.ja,
      Question_EN: q.en,
      Image: '',
      imageUrls,
      Answer_Symbol: answerSymbol,
      Answer_Text: answerText,
      Explanation_JA: q.explanation_ja,
      Explanation_EN: q.explanation_en,
      User_Choice: userChoice,
      Test_Result: testResult,
    };
  });
}
