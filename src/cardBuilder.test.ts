import { describe, it, expect } from 'vitest';
import { buildCards } from './cardBuilder';
import type { AnkiCard } from './cardBuilder';
import type { QuestionRecord } from './fetchExamData';
import type { QuestionResult } from './harvestScores';
import type { ExamRoute } from './parseExamRoute';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE_KARIMEN: ExamRoute = { examType: 'karimen', examId: '10' };
const ROUTE_HONMEN: ExamRoute = { examType: 'honmen', examId: '3' };
const ROUTE_GENTSUKI: ExamRoute = { examType: 'gentsuki', examId: '1' };

const Q1: QuestionRecord = {
  question: 1,
  ja: '車両の衝突時の衝撃力は速度の2乗に比例する。',
  en: 'The impact force of a collision is proportional to the square of the speed.',
  correct: true,
  explanation_ja: '速度が2倍になれば衝撃力は4倍になる。',
  explanation_en: 'If speed doubles, impact force increases fourfold.',
  images: ['/img/sign.png'],
};

const Q2: QuestionRecord = {
  question: 2,
  ja: '歩行者のそばを通るときは、必ず一時停止しなければならない。',
  en: 'When passing pedestrians, you must always come to a complete stop.',
  correct: false,
  explanation_ja: '徐行でよい場合もある。',
  explanation_en: 'Slow down is sufficient in some cases.',
  images: [],
};

const SCORES: Map<number, QuestionResult> = new Map([
  [1, { passed: false, userChoice: 'false' }],
  [2, { passed: true, userChoice: 'true' }],
]);

// ---------------------------------------------------------------------------
// UID tests
// ---------------------------------------------------------------------------

describe('UID', () => {
  it('determinism: identical input produces the same UID across two calls', () => {
    const cards1 = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    const cards2 = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(cards1[0]!.UID).toBe(cards2[0]!.UID);
  });

  it('UID has the format q_ followed by exactly 8 lowercase hex characters', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.UID).toMatch(/^q_[0-9a-f]{8}$/);
  });

  it('uniqueness: two different Japanese question strings produce different UIDs', () => {
    const cards = buildCards([Q1, Q2], SCORES, ROUTE_KARIMEN);
    expect(cards[0]!.UID).not.toBe(cards[1]!.UID);
  });

  it('UID is stable even with extra surrounding whitespace in ja', () => {
    const qWithSpaces: QuestionRecord = {
      ...Q1,
      ja: '  ' + Q1.ja + '  ',
    };
    const [normal] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    const [padded] = buildCards([qWithSpaces], SCORES, ROUTE_KARIMEN);
    expect(normal!.UID).toBe(padded!.UID);
  });

  it('UID is stable even with collapsed internal whitespace in ja', () => {
    const qWithSpaces: QuestionRecord = {
      ...Q1,
      ja: Q1.ja.replace('の', 'の  '),
    };
    const qWithSingleSpace: QuestionRecord = {
      ...Q1,
      ja: Q1.ja.replace('の', 'の '),
    };
    const [multi] = buildCards([qWithSpaces], SCORES, ROUTE_KARIMEN);
    const [single] = buildCards([qWithSingleSpace], SCORES, ROUTE_KARIMEN);
    expect(multi!.UID).toBe(single!.UID);
  });
});

// ---------------------------------------------------------------------------
// Exam_Category and Exam_Title tests
// ---------------------------------------------------------------------------

describe('Exam_Category', () => {
  it('karimen → Karimen (仮免)', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.Exam_Category).toBe('Karimen (仮免)');
  });

  it('honmen → Honmen (本免)', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_HONMEN);
    expect(card!.Exam_Category).toBe('Honmen (本免)');
  });

  it('gentsuki → Gentsuke (原付)', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_GENTSUKI);
    expect(card!.Exam_Category).toBe('Gentsuke (原付)');
  });
});

describe('Exam_Title', () => {
  it('karimen exam no 10', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.Exam_Title).toBe('Karimen exam no 10');
  });

  it('honmen exam no 3', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_HONMEN);
    expect(card!.Exam_Title).toBe('Honmen exam no 3');
  });

  it('gentsuki exam no 1', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_GENTSUKI);
    expect(card!.Exam_Title).toBe('Gentsuke exam no 1');
  });
});

// ---------------------------------------------------------------------------
// Image field / imageUrls tests
// ---------------------------------------------------------------------------

describe('Image field', () => {
  it('Image is always empty string (assembled by syncCards after storeMediaFile)', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.Image).toBe('');
  });

  it('blank: question with empty images array has empty Image and empty imageUrls', () => {
    const [card] = buildCards([Q2], SCORES, ROUTE_KARIMEN);
    expect(card!.Image).toBe('');
    expect(card!.imageUrls).toEqual([]);
  });

  it('blank: question with missing images field has empty Image and empty imageUrls', () => {
    const qNoImages: QuestionRecord = {
      ...Q1,
      images: [],
    };
    const [card] = buildCards([qNoImages], SCORES, ROUTE_KARIMEN);
    expect(card!.Image).toBe('');
    expect(card!.imageUrls).toEqual([]);
  });
});

describe('imageUrls field', () => {
  it('single image: imageUrls contains one full https:// URL', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.imageUrls).toEqual(['https://karimen-honmen.com//img/sign.png']);
  });

  it('multiple images: imageUrls contains one URL per image in order', () => {
    const qMulti: QuestionRecord = {
      ...Q1,
      images: ['/img/sign.png', '/img/road.jpg'],
    };
    const [card] = buildCards([qMulti], SCORES, ROUTE_KARIMEN);
    expect(card!.imageUrls).toEqual([
      'https://karimen-honmen.com//img/sign.png',
      'https://karimen-honmen.com//img/road.jpg',
    ]);
  });

  it('no images: imageUrls is an empty array', () => {
    const [card] = buildCards([Q2], SCORES, ROUTE_KARIMEN);
    expect(card!.imageUrls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Answer fields
// ---------------------------------------------------------------------------

describe('Answer fields', () => {
  it('correct=true → Answer_Symbol=⭕, Answer_Text=TRUE (正しい)', () => {
    const [card] = buildCards([Q1], SCORES, ROUTE_KARIMEN);
    expect(card!.Answer_Symbol).toBe('⭕');
    expect(card!.Answer_Text).toBe('TRUE (正しい)');
  });

  it('correct=false → Answer_Symbol=❌, Answer_Text=FALSE (誤り)', () => {
    const [card] = buildCards([Q2], SCORES, ROUTE_KARIMEN);
    expect(card!.Answer_Symbol).toBe('❌');
    expect(card!.Answer_Text).toBe('FALSE (誤り)');
  });
});

// ---------------------------------------------------------------------------
// User_Choice and Test_Result
// ---------------------------------------------------------------------------

describe('User_Choice and Test_Result', () => {
  it('userChoice=true → User_Choice=⭕', () => {
    const scores = new Map([[2, { passed: true, userChoice: 'true' as const }]]);
    const [card] = buildCards([Q2], scores, ROUTE_KARIMEN);
    expect(card!.User_Choice).toBe('⭕');
  });

  it('userChoice=false → User_Choice=❌', () => {
    const scores = new Map([[1, { passed: false, userChoice: 'false' as const }]]);
    const [card] = buildCards([Q1], scores, ROUTE_KARIMEN);
    expect(card!.User_Choice).toBe('❌');
  });

  it('passed=true → Test_Result=Passed', () => {
    const scores = new Map([[2, { passed: true, userChoice: 'true' as const }]]);
    const [card] = buildCards([Q2], scores, ROUTE_KARIMEN);
    expect(card!.Test_Result).toBe('Passed');
  });

  it('passed=false → Test_Result=Failed', () => {
    const scores = new Map([[1, { passed: false, userChoice: 'false' as const }]]);
    const [card] = buildCards([Q1], scores, ROUTE_KARIMEN);
    expect(card!.Test_Result).toBe('Failed');
  });
});

// ---------------------------------------------------------------------------
// Full card fixture test (all fields)
// ---------------------------------------------------------------------------

describe('Full card fixture', () => {
  it('all fields populated correctly for Q1 (correct answer, failed result)', () => {
    const scores: Map<number, QuestionResult> = new Map([
      [1, { passed: false, userChoice: 'false' }],
    ]);
    const [card] = buildCards([Q1], scores, ROUTE_KARIMEN);

    expect(card).toBeDefined();
    const c = card as AnkiCard;

    expect(c.UID).toMatch(/^q_[0-9a-f]{8}$/);
    expect(c.Exam_Category).toBe('Karimen (仮免)');
    expect(c.Exam_Title).toBe('Karimen exam no 10');
    expect(c.Question_JA).toBe(Q1.ja);
    expect(c.Question_EN).toBe(Q1.en);
    expect(c.Image).toBe('');
    expect(c.imageUrls).toEqual(['https://karimen-honmen.com//img/sign.png']);
    expect(c.Answer_Symbol).toBe('⭕');
    expect(c.Answer_Text).toBe('TRUE (正しい)');
    expect(c.Explanation_JA).toBe(Q1.explanation_ja);
    expect(c.Explanation_EN).toBe(Q1.explanation_en);
    expect(c.User_Choice).toBe('❌');
    expect(c.Test_Result).toBe('Failed');
  });
});

// ---------------------------------------------------------------------------
// Output length
// ---------------------------------------------------------------------------

describe('buildCards', () => {
  it('returns one AnkiCard per question', () => {
    const cards = buildCards([Q1, Q2], SCORES, ROUTE_KARIMEN);
    expect(cards).toHaveLength(2);
  });

  it('returns empty array for empty questions', () => {
    const cards = buildCards([], new Map(), ROUTE_KARIMEN);
    expect(cards).toHaveLength(0);
  });
});
