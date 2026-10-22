import type { MusasiQuestionRecord } from './harvestMusasiQuestions';
import type { MusasiRoute } from './parseMusasiRoute';

declare function GM_download(url: string, filename: string): void;

const CSV_HEADER = 'Question_Number,Question_JA,Correct_Answer,Your_Answer,Result,Explanation_JA';

/**
 * Escapes a single CSV field per RFC 4180:
 * - If the field contains a comma, double-quote, or newline, wrap it in double-quotes.
 * - Internal double-quotes are doubled to "".
 */
export function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Serializes an array of MusasiQuestionRecord into a UTF-8 BOM CSV string.
 */
export function serializeMusasiCsv(questions: MusasiQuestionRecord[]): string {
  const BOM = '﻿';
  const rows = questions.map((q) => {
    const correctAnswer = q.correct ? '⭕' : '❌';
    const yourAnswer = q.userAnswer ? '⭕' : '❌';
    const result = q.passed ? 'Passed' : 'Failed';
    const explanation = q.explanation_ja ?? '';
    return [
      escapeField(String(q.questionNumber)),
      escapeField(q.ja),
      escapeField(correctAnswer),
      escapeField(yourAnswer),
      escapeField(result),
      escapeField(explanation),
    ].join(',');
  });
  return BOM + CSV_HEADER + '\n' + rows.join('\n');
}

/**
 * Serializes `questions` into a UTF-8 BOM CSV file and triggers a browser
 * download via GM_download. The filename is derived from `route.sessionId`.
 */
export function exportMusasiCsv(questions: MusasiQuestionRecord[], route: MusasiRoute): void {
  const content = serializeMusasiCsv(questions);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const sessionId = route.sessionId && route.sessionId !== 'unknown' ? route.sessionId : '';
  const filename = sessionId ? `musasi_${sessionId}_results.csv` : 'musasi_results.csv';
  GM_download(url, filename);
}
