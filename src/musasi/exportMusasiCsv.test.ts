import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MusasiQuestionRecord } from './harvestMusasiQuestions';
import type { MusasiRoute } from './parseMusasiRoute';
import { escapeField, serializeMusasiCsv, exportMusasiCsv } from './exportMusasiCsv';

const FIXTURE_QUESTIONS: MusasiQuestionRecord[] = [
  {
    questionNumber: 1,
    ja: '車両の衝突時の衝撃力は速度の2乗に比例する。',
    correct: true,
    userAnswer: false,
    passed: false,
    explanation_ja: '速度が2倍になれば衝撃力は4倍になる。',
  },
  {
    questionNumber: 2,
    ja: '安全地帯に歩行者がいる場合は徐行する。',
    correct: false,
    userAnswer: false,
    passed: true,
    explanation_ja: undefined,
  },
];

const FIXTURE_ROUTE: MusasiRoute = {
  sessionId: 'abc123',
  label: 'Musasi Practice',
};

describe('escapeField', () => {
  it('returns the value unchanged when no special characters', () => {
    expect(escapeField('hello')).toBe('hello');
  });

  it('wraps field in double-quotes when it contains a comma', () => {
    expect(escapeField('hello, world')).toBe('"hello, world"');
  });

  it('wraps field and doubles internal double-quotes per RFC 4180', () => {
    expect(escapeField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps field in double-quotes when it contains a newline', () => {
    expect(escapeField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles field with both comma and double-quote', () => {
    expect(escapeField('"a, b"')).toBe('"""a, b"""');
  });
});

describe('serializeMusasiCsv', () => {
  it('starts with UTF-8 BOM (U+FEFF, three bytes EF BB BF)', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    // The BOM character is U+FEFF which encodes to \xEF\xBB\xBF in UTF-8
    // In a JS string it appears as the character
    expect(output.charCodeAt(0)).toBe(0xFEFF);
  });

  it('first row after BOM is the header', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    const lines = output.split('\n');
    expect(lines[0]).toBe('﻿Question_Number,Question_JA,Correct_Answer,Your_Answer,Result,Explanation_JA');
  });

  it('produces one data row per question', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    const lines = output.split('\n');
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
  });

  it('uses ⭕ for true and ❌ for false in Correct_Answer and Your_Answer', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    const lines = output.split('\n');
    const row1 = lines[1]!;
    const cols = row1.split(',');
    expect(cols[2]).toBe('⭕'); // correct: true
    expect(cols[3]).toBe('❌'); // userAnswer: false
  });

  it('uses "Passed" for passed questions and "Failed" for failed', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    const lines = output.split('\n');
    expect(lines[1]).toContain('Failed'); // question 1 failed
    expect(lines[2]).toContain('Passed'); // question 2 passed
  });

  it('uses empty string for missing explanation_ja, not "undefined" or "null"', () => {
    const output = serializeMusasiCsv(FIXTURE_QUESTIONS);
    const lines = output.split('\n');
    // question 2 has no explanation — last field should be empty
    const row2 = lines[2]!;
    expect(row2).not.toContain('undefined');
    expect(row2).not.toContain('null');
    // last field is empty
    expect(row2.endsWith(',')).toBe(true);
  });

  it('RFC 4180: escapes a question text containing a comma', () => {
    const questions: MusasiQuestionRecord[] = [
      {
        questionNumber: 1,
        ja: 'Speed limit is, 60km/h.',
        correct: true,
        userAnswer: true,
        passed: true,
      },
    ];
    const output = serializeMusasiCsv(questions);
    const dataRow = output.split('\n')[1]!;
    // The ja field contains an ASCII comma — it must be wrapped in double-quotes
    expect(dataRow).toContain('"Speed limit is, 60km/h."');
  });

  it('RFC 4180: escapes a question text containing double-quotes', () => {
    const questions: MusasiQuestionRecord[] = [
      {
        questionNumber: 1,
        ja: '「安全」とは何か。',
        correct: false,
        userAnswer: false,
        passed: true,
      },
    ];
    // Force a double-quote character in the text
    const questionWithQuotes: MusasiQuestionRecord = {
      questionNumber: 1,
      ja: 'He said "stop"',
      correct: false,
      userAnswer: false,
      passed: true,
    };
    const output = serializeMusasiCsv([questionWithQuotes]);
    const dataRow = output.split('\n')[1]!;
    // Internal double-quotes should be doubled
    expect(dataRow).toContain('"He said ""stop"""');
  });
});

describe('exportMusasiCsv', () => {
  beforeEach(() => {
    (globalThis as unknown as Record<string, unknown>)['GM_download'] = vi.fn();
    (globalThis as unknown as Record<string, unknown>)['URL'] = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    };
    (globalThis as unknown as Record<string, unknown>)['Blob'] = class {
      constructor(public parts: unknown[], public options: unknown) {}
    };
  });

  it('calls GM_download with the correct filename when sessionId is set', () => {
    exportMusasiCsv(FIXTURE_QUESTIONS, FIXTURE_ROUTE);
    const gmDownload = (globalThis as unknown as Record<string, unknown>)['GM_download'] as ReturnType<typeof vi.fn>;
    expect(gmDownload).toHaveBeenCalledOnce();
    const [, filename] = gmDownload.mock.calls[0] as [string, string];
    expect(filename).toBe('musasi_abc123_results.csv');
  });

  it('falls back to musasi_results.csv when sessionId is "unknown"', () => {
    const routeUnknown: MusasiRoute = { sessionId: 'unknown', label: 'Musasi Practice' };
    exportMusasiCsv(FIXTURE_QUESTIONS, routeUnknown);
    const gmDownload = (globalThis as unknown as Record<string, unknown>)['GM_download'] as ReturnType<typeof vi.fn>;
    const [, filename] = gmDownload.mock.calls[0] as [string, string];
    expect(filename).toBe('musasi_results.csv');
  });
});
