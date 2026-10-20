import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnkiCard } from './cardBuilder';
import type { ExamRoute } from './parseExamRoute';
import { serializeTsv, exportTsv } from './exportTsv';

const FIXTURE_CARD: AnkiCard = {
  UID: 'q_1a2b3c4d',
  Exam_Category: 'Karimen (仮免)',
  Exam_Title: 'Karimen exam no 10',
  Question_JA: '車両の衝突時の衝撃力は速度の2乗に比例する。',
  Question_EN: 'The impact force of a collision is proportional to the square of the speed.',
  Image: '<img src="https://karimen-honmen.com/signs/stop.png">',
  Answer_Symbol: '⭕',
  Answer_Text: 'TRUE (正しい)',
  Explanation_JA: '速度が2倍になれば衝撃力は4倍になる。',
  Explanation_EN: 'If speed doubles, impact force increases fourfold.',
  User_Choice: '❌',
  Test_Result: 'Failed',
};

const FIXTURE_ROUTE: ExamRoute = {
  examType: 'karimen',
  examId: '10',
};

describe('serializeTsv', () => {
  it('produces exactly three header lines', () => {
    const output = serializeTsv([FIXTURE_CARD]);
    const lines = output.split('\n');
    expect(lines[0]).toBe('#separator:tab');
    expect(lines[1]).toBe('#html:true');
    expect(lines[2]).toBe('#tags column:12');
  });

  it('produces a data row on line 4 (index 3)', () => {
    const output = serializeTsv([FIXTURE_CARD]);
    const lines = output.split('\n');
    expect(lines[3]).toBeDefined();
    expect(lines[3]).not.toBe('');
  });

  it('data row has all 12 fields in the correct order', () => {
    const output = serializeTsv([FIXTURE_CARD]);
    const dataRow = output.split('\n')[3]!;
    const cols = dataRow.split('\t');

    expect(cols).toHaveLength(12);
    expect(cols[0]).toBe(FIXTURE_CARD.UID);
    expect(cols[1]).toBe(FIXTURE_CARD.Exam_Category);
    expect(cols[2]).toBe(FIXTURE_CARD.Exam_Title);
    expect(cols[3]).toBe(FIXTURE_CARD.Question_JA);
    expect(cols[4]).toBe(FIXTURE_CARD.Question_EN);
    expect(cols[5]).toBe(FIXTURE_CARD.Image);
    expect(cols[6]).toBe(FIXTURE_CARD.Answer_Symbol);
    expect(cols[7]).toBe(FIXTURE_CARD.Answer_Text);
    expect(cols[8]).toBe(FIXTURE_CARD.Explanation_JA);
    expect(cols[9]).toBe(FIXTURE_CARD.Explanation_EN);
    expect(cols[10]).toBe(FIXTURE_CARD.User_Choice);
    expect(cols[11]).toBe(FIXTURE_CARD.Test_Result);
  });

  it('handles an empty card array (header only)', () => {
    const output = serializeTsv([]);
    const lines = output.split('\n');
    expect(lines[0]).toBe('#separator:tab');
    expect(lines[1]).toBe('#html:true');
    expect(lines[2]).toBe('#tags column:12');
    // No data rows after header
    expect(lines[3]).toBe('');
  });

  it('serializes multiple cards as separate rows', () => {
    const secondCard: AnkiCard = { ...FIXTURE_CARD, UID: 'q_ffffffff' };
    const output = serializeTsv([FIXTURE_CARD, secondCard]);
    const lines = output.split('\n');
    expect(lines[3]!.split('\t')[0]).toBe(FIXTURE_CARD.UID);
    expect(lines[4]!.split('\t')[0]).toBe(secondCard.UID);
  });
});

describe('exportTsv', () => {
  beforeEach(() => {
    // Provide global stubs required by exportTsv
    (globalThis as unknown as Record<string, unknown>)['GM_download'] = vi.fn();
    (globalThis as unknown as Record<string, unknown>)['URL'] = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    };
    (globalThis as unknown as Record<string, unknown>)['Blob'] = class {
      constructor(public parts: unknown[], public options: unknown) {}
    };
  });

  it('calls GM_download with the correct filename', () => {
    exportTsv([FIXTURE_CARD], FIXTURE_ROUTE);
    const gmDownload = (globalThis as unknown as Record<string, unknown>)['GM_download'] as ReturnType<typeof vi.fn>;
    expect(gmDownload).toHaveBeenCalledOnce();
    const [, filename] = gmDownload.mock.calls[0] as [string, string];
    expect(filename).toBe('karimen_10_anki.txt');
  });

  it('derives filename from route.examType and route.examId', () => {
    const route: ExamRoute = { examType: 'honmen', examId: '3' };
    exportTsv([FIXTURE_CARD], route);
    const gmDownload = (globalThis as unknown as Record<string, unknown>)['GM_download'] as ReturnType<typeof vi.fn>;
    const [, filename] = gmDownload.mock.calls[0] as [string, string];
    expect(filename).toBe('honmen_3_anki.txt');
  });
});
