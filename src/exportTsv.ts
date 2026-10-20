import type { AnkiCard } from './cardBuilder';
import type { ExamRoute } from './parseExamRoute';

declare function GM_download(url: string, filename: string): void;

const TSV_HEADER = '#separator:tab\n#html:true\n#tags column:12\n';

/**
 * Serializes an array of AnkiCard records into an Anki-compatible TSV string.
 * The output begins with three Anki import header lines followed by one
 * tab-separated data row per card.
 */
export function serializeTsv(cards: AnkiCard[]): string {
  const rows = cards.map((c) =>
    [
      c.UID,
      c.Exam_Category,
      c.Exam_Title,
      c.Question_JA,
      c.Question_EN,
      c.Image,
      c.Answer_Symbol,
      c.Answer_Text,
      c.Explanation_JA,
      c.Explanation_EN,
      c.User_Choice,
      c.Test_Result,
    ].join('\t'),
  );
  return TSV_HEADER + rows.join('\n');
}

/**
 * Serializes `cards` into an Anki-compatible TSV file and triggers a browser
 * download via GM_download. The filename is derived from `route`.
 */
export function exportTsv(cards: AnkiCard[], route: ExamRoute): void {
  const content = serializeTsv(cards);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `${route.examType}_${route.examId}_anki.txt`;
  GM_download(url, filename);
}
