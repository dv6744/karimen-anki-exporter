import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExamData, type QuestionRecord } from '../src/fetchExamData';
import type { ExamRoute } from '../src/parseExamRoute';

const karimen10: ExamRoute = { examType: 'karimen', examId: '10' };
const honmen3: ExamRoute = { examType: 'honmen', examId: '3' };
const gentsuki1: ExamRoute = { examType: 'gentsuki', examId: '1' };

const fixtureRaw = [
  {
    question: 1,
    ja: '車両の衝突時の衝撃力は速度の2乗に比例する。',
    en: 'The impact force of a collision is proportional to the square of the speed.',
    correct: true,
    explanation_ja: '速度が2倍になれば衝撃力は4倍になる。',
    explanation_en: 'If speed doubles, impact force increases fourfold.',
    images: [],
  },
  {
    question: 2,
    ja: '交差点では必ず一時停止しなければならない。',
    en: 'You must always stop at intersections.',
    correct: false,
    explanation_ja: '優先道路を走行している場合は一時停止不要。',
    explanation_en: 'No stop required when on a priority road.',
    images: ['/img/sign.png'],
  },
];

const fixtureExpected: QuestionRecord[] = [
  {
    question: 1,
    ja: '車両の衝突時の衝撃力は速度の2乗に比例する。',
    en: 'The impact force of a collision is proportional to the square of the speed.',
    correct: true,
    explanation_ja: '速度が2倍になれば衝撃力は4倍になる。',
    explanation_en: 'If speed doubles, impact force increases fourfold.',
    images: [],
  },
  {
    question: 2,
    ja: '交差点では必ず一時停止しなければならない。',
    en: 'You must always stop at intersections.',
    correct: false,
    explanation_ja: '優先道路を走行している場合は一時停止不要。',
    explanation_en: 'No stop required when on a priority road.',
    images: ['/img/sign.png'],
  },
];

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchThrows(error: Error): typeof fetch {
  return vi.fn().mockRejectedValue(error);
}

function mockFetchInvalidJson(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  } as unknown as Response);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchExamData — URL construction', () => {
  it('constructs /karimen/exams/10/exam.json', async () => {
    const spy = mockFetch(200, fixtureRaw);
    vi.stubGlobal('fetch', spy);

    await fetchExamData(karimen10);

    expect(spy).toHaveBeenCalledWith('/karimen/exams/10/exam.json');
  });

  it('constructs /honmen/exams/3/exam.json', async () => {
    const spy = mockFetch(200, fixtureRaw);
    vi.stubGlobal('fetch', spy);

    await fetchExamData(honmen3);

    expect(spy).toHaveBeenCalledWith('/honmen/exams/3/exam.json');
  });

  it('constructs /gentsuki/exams/1/exam.json', async () => {
    const spy = mockFetch(200, fixtureRaw);
    vi.stubGlobal('fetch', spy);

    await fetchExamData(gentsuki1);

    expect(spy).toHaveBeenCalledWith('/gentsuki/exams/1/exam.json');
  });
});

describe('fetchExamData — happy path', () => {
  it('returns mapped QuestionRecord array on 200', async () => {
    vi.stubGlobal('fetch', mockFetch(200, fixtureRaw));

    const result = await fetchExamData(karimen10);

    expect(result).toEqual(fixtureExpected);
  });

  it('correct field is a boolean true', async () => {
    vi.stubGlobal('fetch', mockFetch(200, fixtureRaw));

    const result = await fetchExamData(karimen10);

    expect(typeof result[0].correct).toBe('boolean');
    expect(result[0].correct).toBe(true);
  });

  it('correct field is a boolean false', async () => {
    vi.stubGlobal('fetch', mockFetch(200, fixtureRaw));

    const result = await fetchExamData(karimen10);

    expect(typeof result[1].correct).toBe('boolean');
    expect(result[1].correct).toBe(false);
  });

  it('images defaults to empty array when field is empty array', async () => {
    vi.stubGlobal('fetch', mockFetch(200, fixtureRaw));

    const result = await fetchExamData(karimen10);

    expect(result[0].images).toEqual([]);
  });

  it('images defaults to empty array when field is missing', async () => {
    const rawWithoutImages = [{ ...fixtureRaw[0] }] as Record<string, unknown>[];
    delete rawWithoutImages[0]['images'];

    vi.stubGlobal('fetch', mockFetch(200, rawWithoutImages));

    const result = await fetchExamData(karimen10);

    expect(result[0].images).toEqual([]);
  });
});

describe('fetchExamData — error handling', () => {
  it('rejects on non-200 status (404)', async () => {
    vi.stubGlobal('fetch', mockFetch(404, null));

    await expect(fetchExamData(karimen10)).rejects.toThrow('HTTP 404');
  });

  it('rejects on non-200 status (500)', async () => {
    vi.stubGlobal('fetch', mockFetch(500, null));

    await expect(fetchExamData(karimen10)).rejects.toThrow('HTTP 500');
  });

  it('rejects when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', mockFetchThrows(new TypeError('Failed to fetch')));

    await expect(fetchExamData(karimen10)).rejects.toThrow('Failed to fetch');
  });

  it('rejects when response body is not valid JSON', async () => {
    vi.stubGlobal('fetch', mockFetchInvalidJson(200));

    await expect(fetchExamData(karimen10)).rejects.toThrow();
  });
});
