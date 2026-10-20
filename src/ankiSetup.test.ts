import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureAnkiSetup } from './ankiSetup';
import * as ankiConnect from './ankiConnect';

vi.mock('./ankiConnect', () => ({
  createModel: vi.fn(),
  createDeck: vi.fn(),
}));

const mockCreateModel = vi.mocked(ankiConnect.createModel);
const mockCreateDeck = vi.mocked(ankiConnect.createDeck);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureAnkiSetup', () => {
  describe('model creation', () => {
    it('calls createModel with the correct model name and 12 fields', async () => {
      mockCreateModel.mockResolvedValue(123456);
      mockCreateDeck.mockResolvedValue(1);

      await ensureAnkiSetup({ examType: 'karimen', examId: '1' });

      expect(mockCreateModel).toHaveBeenCalledOnce();
      const spec = mockCreateModel.mock.calls[0][0];
      expect(spec.modelName).toBe('Japanese Driving License (Bilingual)');
      expect(spec.inOrderFields).toEqual([
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
      ]);
      expect(spec.inOrderFields).toHaveLength(12);
    });

    it('calls createModel with a single "Recognition" card template', async () => {
      mockCreateModel.mockResolvedValue(123456);
      mockCreateDeck.mockResolvedValue(1);

      await ensureAnkiSetup({ examType: 'karimen', examId: '1' });

      const spec = mockCreateModel.mock.calls[0][0];
      expect(spec.cardTemplates).toHaveLength(1);
      expect(spec.cardTemplates[0].Name).toBe('Recognition');
      expect(spec.cardTemplates[0].Front).toContain('{{Question_EN}}');
      expect(spec.cardTemplates[0].Front).toContain('{{Question_JA}}');
      expect(spec.cardTemplates[0].Back).toContain('{{FrontSide}}');
      expect(spec.cardTemplates[0].Back).toContain('{{Answer_Symbol}}');
      expect(spec.cardTemplates[0].Back).toContain('{{Explanation_EN}}');
      expect(spec.cardTemplates[0].Back).toContain('{{Explanation_JA}}');
      expect(spec.cardTemplates[0].Back).toContain('{{User_Choice}}');
      expect(spec.cardTemplates[0].Back).toContain('{{Test_Result}}');
    });
  });

  describe('deck creation', () => {
    it('creates karimen deck with correct hierarchical name', async () => {
      mockCreateModel.mockResolvedValue(null);
      mockCreateDeck.mockResolvedValue(1);

      await ensureAnkiSetup({ examType: 'karimen', examId: '10' });

      expect(mockCreateDeck).toHaveBeenCalledWith(
        'Japanese Driving License::Karimen (仮免)::Karimen exam no 10',
      );
    });

    it('creates honmen deck with correct hierarchical name', async () => {
      mockCreateModel.mockResolvedValue(null);
      mockCreateDeck.mockResolvedValue(2);

      await ensureAnkiSetup({ examType: 'honmen', examId: '5' });

      expect(mockCreateDeck).toHaveBeenCalledWith(
        'Japanese Driving License::Honmen (本免)::Honmen exam no 5',
      );
    });

    it('creates gentsuki deck with correct hierarchical name', async () => {
      mockCreateModel.mockResolvedValue(null);
      mockCreateDeck.mockResolvedValue(3);

      await ensureAnkiSetup({ examType: 'gentsuki', examId: '1' });

      expect(mockCreateDeck).toHaveBeenCalledWith(
        'Japanese Driving License::Gentsuke (原付)::Gentsuke exam no 1',
      );
    });
  });

  describe('idempotency', () => {
    it('resolves without error when createModel rejects with "Model name already exists"', async () => {
      mockCreateModel.mockRejectedValue(new Error('Model name already exists'));
      mockCreateDeck.mockResolvedValue(1);

      await expect(
        ensureAnkiSetup({ examType: 'karimen', examId: '1' }),
      ).resolves.toBeUndefined();

      expect(mockCreateDeck).toHaveBeenCalledOnce();
    });

    it('resolves without error when both createModel and createDeck succeed', async () => {
      mockCreateModel.mockResolvedValue(123456);
      mockCreateDeck.mockResolvedValue(1);

      await expect(
        ensureAnkiSetup({ examType: 'honmen', examId: '3' }),
      ).resolves.toBeUndefined();
    });

    it('re-throws unexpected errors from createModel', async () => {
      mockCreateModel.mockRejectedValue(new Error('AnkiConnect not running'));
      mockCreateDeck.mockResolvedValue(1);

      await expect(
        ensureAnkiSetup({ examType: 'karimen', examId: '1' }),
      ).rejects.toThrow('AnkiConnect not running');
    });
  });
});
