import { findNotes, addNote, addTags } from './ankiConnect';
import type { AnkiCard } from './cardBuilder';

export interface SyncResult {
  added: number;
  updated: number;
  failed: number;
}

const MODEL_NAME = 'Japanese Driving License (Bilingual)';

/** Maps Exam_Category field values to lowercase exam-type tag strings. */
const CATEGORY_TO_EXAM_TYPE: Record<string, string> = {
  'Karimen (仮免)': 'karimen',
  'Honmen (本免)': 'honmen',
  'Gentsuke (原付)': 'gentsuki',
};

/**
 * Builds the tag array for a card.
 * @param card - The AnkiCard to derive tags from.
 * @param includeBase - When true, adds the static `license_jp` and exam-type tags
 *   (used for new notes). Duplicates only get `exam_{id}` and optionally `failed`.
 */
function buildTags(card: AnkiCard, includeBase: boolean): string[] {
  const examType = CATEGORY_TO_EXAM_TYPE[card.Exam_Category] ?? 'unknown';

  // Parse exam id from Exam_Title: e.g. "Karimen exam no 10" → "10"
  const match = /(\d+)$/.exec(card.Exam_Title);
  const examId = match ? match[1] : '0';

  const tags: string[] = [];
  if (includeBase) {
    tags.push('license_jp', examType);
  }
  tags.push(`exam_${examId}`);
  if (card.Test_Result === 'Failed') {
    tags.push('failed');
  }
  return tags;
}

/**
 * Syncs an array of AnkiCards to Anki via AnkiConnect.
 *
 * For each card:
 * - If no matching note exists (`findNotes` returns `[]`), a new note is created
 *   via `addNote` and `added` is incremented.
 * - If one or more matching notes exist, their tags are updated via `addTags`
 *   and `updated` is incremented.
 * - If any AnkiConnect call throws, `failed` is incremented and processing
 *   continues with the next card.
 */
export async function syncCards(cards: AnkiCard[]): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, failed: 0 };

  for (const card of cards) {
    try {
      const noteIds = await findNotes('UID:' + card.UID);

      if (noteIds.length === 0) {
        // New note path
        const deckName = `Japanese Driving License::${card.Exam_Category}::${card.Exam_Title}`;
        const tags = buildTags(card, true);
        await addNote({
          deckName,
          modelName: MODEL_NAME,
          fields: {
            UID: card.UID,
            Exam_Category: card.Exam_Category,
            Exam_Title: card.Exam_Title,
            Question_JA: card.Question_JA,
            Question_EN: card.Question_EN,
            Image: card.Image,
            Answer_Symbol: card.Answer_Symbol,
            Answer_Text: card.Answer_Text,
            Explanation_JA: card.Explanation_JA,
            Explanation_EN: card.Explanation_EN,
            User_Choice: card.User_Choice,
            Test_Result: card.Test_Result,
          },
          tags,
        });
        result.added++;
      } else {
        // Duplicate path — update tags only
        const tags = buildTags(card, false);
        await addTags(noteIds, tags.join(' '));
        result.updated++;
      }
    } catch {
      result.failed++;
    }
  }

  return result;
}
