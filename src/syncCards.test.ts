import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCards } from './syncCards';
import * as ankiConnect from './ankiConnect';

vi.mock('./ankiConnect', () => ({
  findNotes: vi.fn(),
  addNote: vi.fn(),
  addTags: vi.fn(),
}));

const mockFindNotes = vi.mocked(ankiConnect.findNotes);
const mockAddNote = vi.mocked(ankiConnect.addNote);
const mockAddTags = vi.mocked(ankiConnect.addTags);

/** A representative card that failed the mock exam. */
const failedCard = {
  UID: 'q_abc12345',
  Exam_Category: 'Karimen (仮免)',
  Exam_Title: 'Karimen exam no 10',
  Question_JA: 'テスト問題',
  Question_EN: 'Test question',
  Image: '',
  Answer_Symbol: '⭕',
  Answer_Text: 'TRUE (正しい)',
  Explanation_JA: '説明',
  Explanation_EN: 'Explanation',
  User_Choice: '❌',
  Test_Result: 'Failed',
};

/** Same card but answered correctly. */
const passedCard = {
  ...failedCard,
  UID: 'q_def67890',
  User_Choice: '⭕',
  Test_Result: 'Passed',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncCards', () => {
  describe('new note path', () => {
    it('calls addNote with all 12 fields and correct tags when findNotes returns []', async () => {
      mockFindNotes.mockResolvedValue([]);
      mockAddNote.mockResolvedValue(99999);

      const result = await syncCards([failedCard]);

      // findNotes query uses UID field prefix
      expect(mockFindNotes).toHaveBeenCalledOnce();
      expect(mockFindNotes).toHaveBeenCalledWith('UID:q_abc12345');

      // addNote must be called, addTags must not
      expect(mockAddNote).toHaveBeenCalledOnce();
      expect(mockAddTags).not.toHaveBeenCalled();

      const payload = mockAddNote.mock.calls[0][0];

      // All 12 fields present
      expect(payload.fields).toMatchObject({
        UID: 'q_abc12345',
        Exam_Category: 'Karimen (仮免)',
        Exam_Title: 'Karimen exam no 10',
        Question_JA: 'テスト問題',
        Question_EN: 'Test question',
        Image: '',
        Answer_Symbol: '⭕',
        Answer_Text: 'TRUE (正しい)',
        Explanation_JA: '説明',
        Explanation_EN: 'Explanation',
        User_Choice: '❌',
        Test_Result: 'Failed',
      });

      // Initial tags: license_jp, exam-type, exam_{id}, failed (because Test_Result === "Failed")
      expect(payload.tags).toContain('license_jp');
      expect(payload.tags).toContain('karimen');
      expect(payload.tags).toContain('exam_10');
      expect(payload.tags).toContain('failed');

      expect(result).toEqual({ added: 1, updated: 0, failed: 0 });
    });

    it('omits "failed" tag when Test_Result is not "Failed"', async () => {
      mockFindNotes.mockResolvedValue([]);
      mockAddNote.mockResolvedValue(88888);

      await syncCards([passedCard]);

      const payload = mockAddNote.mock.calls[0][0];
      expect(payload.tags).not.toContain('failed');
      expect(payload.tags).toContain('license_jp');
      expect(payload.tags).toContain('karimen');
      expect(payload.tags).toContain('exam_10');
    });

    it('uses the correct deckName derived from card category and title', async () => {
      mockFindNotes.mockResolvedValue([]);
      mockAddNote.mockResolvedValue(77777);

      await syncCards([failedCard]);

      const payload = mockAddNote.mock.calls[0][0];
      expect(payload.deckName).toBe(
        'Japanese Driving License::Karimen (仮免)::Karimen exam no 10',
      );
      expect(payload.modelName).toBe('Japanese Driving License (Bilingual)');
    });
  });

  describe('duplicate path', () => {
    it('calls addTags with the returned note IDs and does NOT call addNote', async () => {
      mockFindNotes.mockResolvedValue([12345]);
      mockAddTags.mockResolvedValue(null);

      const result = await syncCards([failedCard]);

      expect(mockFindNotes).toHaveBeenCalledOnce();
      expect(mockAddNote).not.toHaveBeenCalled();
      expect(mockAddTags).toHaveBeenCalledOnce();

      const [noteIds, tagsStr] = mockAddTags.mock.calls[0];
      expect(noteIds).toEqual([12345]);
      expect(tagsStr).toContain('exam_10');
      expect(tagsStr).toContain('failed');

      expect(result).toEqual({ added: 0, updated: 1, failed: 0 });
    });

    it('passes multiple note IDs to addTags when findNotes returns more than one', async () => {
      mockFindNotes.mockResolvedValue([111, 222]);
      mockAddTags.mockResolvedValue(null);

      await syncCards([failedCard]);

      const [noteIds] = mockAddTags.mock.calls[0];
      expect(noteIds).toEqual([111, 222]);
    });

    it('does not include license_jp or exam-type tag in addTags call', async () => {
      mockFindNotes.mockResolvedValue([12345]);
      mockAddTags.mockResolvedValue(null);

      await syncCards([failedCard]);

      const [, tagsStr] = mockAddTags.mock.calls[0];
      expect(tagsStr).not.toContain('license_jp');
      expect(tagsStr).not.toContain('karimen');
    });
  });

  describe('failure path', () => {
    it('increments failed when findNotes rejects and does not propagate the error', async () => {
      mockFindNotes.mockRejectedValue(new Error('AnkiConnect not running'));

      const result = await syncCards([failedCard]);

      expect(mockAddNote).not.toHaveBeenCalled();
      expect(mockAddTags).not.toHaveBeenCalled();
      expect(result).toEqual({ added: 0, updated: 0, failed: 1 });
    });

    it('continues processing subsequent cards after a failure', async () => {
      mockFindNotes
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce([]);
      mockAddNote.mockResolvedValue(55555);

      const result = await syncCards([failedCard, passedCard]);

      expect(result.failed).toBe(1);
      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('increments failed when addNote rejects', async () => {
      mockFindNotes.mockResolvedValue([]);
      mockAddNote.mockRejectedValue(new Error('duplicate note'));

      const result = await syncCards([failedCard]);

      expect(result).toEqual({ added: 0, updated: 0, failed: 1 });
    });
  });
});
