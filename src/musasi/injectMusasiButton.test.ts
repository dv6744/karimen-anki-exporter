// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMusasiPipeline, setupMusasiObserver, MUSASI_BUTTON_ID } from './injectMusasiButton';

// Mock all downstream dependencies
vi.mock('./parseMusasiRoute', () => ({
  parseMusasiRoute: vi.fn(),
}));

vi.mock('./harvestMusasiQuestions', () => ({
  harvestMusasiQuestions: vi.fn(),
}));

vi.mock('../cardBuilder', () => ({
  buildCards: vi.fn(),
}));

vi.mock('../ankiSetup', () => ({
  ensureAnkiSetup: vi.fn(),
}));

vi.mock('../syncCards', () => ({
  syncCards: vi.fn(),
}));

vi.mock('../exportTsv', () => ({
  exportTsv: vi.fn(),
}));

import { parseMusasiRoute } from './parseMusasiRoute';
import { harvestMusasiQuestions } from './harvestMusasiQuestions';
import { buildCards } from '../cardBuilder';
import { ensureAnkiSetup } from '../ankiSetup';
import { syncCards } from '../syncCards';
import { exportTsv } from '../exportTsv';

const mockParseMusasiRoute = vi.mocked(parseMusasiRoute);
const mockHarvestMusasiQuestions = vi.mocked(harvestMusasiQuestions);
const mockBuildCards = vi.mocked(buildCards);
const mockEnsureAnkiSetup = vi.mocked(ensureAnkiSetup);
const mockSyncCards = vi.mocked(syncCards);
const mockExportTsv = vi.mocked(exportTsv);

const FAKE_ROUTE = { sessionId: 'session123', label: 'Musasi Practice' };

const FAKE_QUESTIONS = [
  {
    questionNumber: 1,
    ja: '問題1のテキスト',
    correct: true,
    userAnswer: true,
    passed: true,
    explanation_ja: '解説1',
  },
  {
    questionNumber: 2,
    ja: '問題2のテキスト',
    correct: false,
    userAnswer: false,
    passed: true,
    explanation_ja: undefined,
  },
  {
    questionNumber: 3,
    ja: '問題3のテキスト',
    correct: true,
    userAnswer: false,
    passed: false,
    explanation_ja: '解説3',
  },
];

// Minimal AnkiCard stubs (shape doesn't matter for pipeline tests)
const FAKE_CARDS = [{ UID: 'q_00000001' }, { UID: 'q_00000002' }, { UID: 'q_00000003' }] as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Remove any leftover button from prior tests
  document.getElementById(MUSASI_BUTTON_ID)?.remove();
});

function makeButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  document.body.appendChild(btn);
  return btn;
}

describe('runMusasiPipeline — happy path (AnkiConnect succeeds)', () => {
  it('sets button text to "✅ 3 cards synced" when 3 cards are added', async () => {
    // Arrange
    mockParseMusasiRoute.mockReturnValue(FAKE_ROUTE);
    mockHarvestMusasiQuestions.mockReturnValue(FAKE_QUESTIONS);
    mockBuildCards.mockReturnValue(FAKE_CARDS);
    mockEnsureAnkiSetup.mockResolvedValue(undefined);
    mockSyncCards.mockResolvedValue({ added: 3, updated: 0, failed: 0 });

    const btn = makeButton();

    // Act
    await runMusasiPipeline(btn);

    // Assert
    expect(btn.textContent).toBe('✅ 3 cards synced');
    expect(btn.disabled).toBe(false);
    expect(mockParseMusasiRoute).toHaveBeenCalledOnce();
    expect(mockHarvestMusasiQuestions).toHaveBeenCalledOnce();
    expect(mockBuildCards).toHaveBeenCalledOnce();
    expect(mockEnsureAnkiSetup).toHaveBeenCalledWith({ examType: 'karimen', examId: 'session123' });
    expect(mockSyncCards).toHaveBeenCalledWith(FAKE_CARDS);
    expect(mockExportTsv).not.toHaveBeenCalled();
  });

  it('adapts MusasiQuestionRecord[] to QuestionRecord[] with empty EN fields', async () => {
    mockParseMusasiRoute.mockReturnValue(FAKE_ROUTE);
    mockHarvestMusasiQuestions.mockReturnValue(FAKE_QUESTIONS);
    mockBuildCards.mockReturnValue(FAKE_CARDS);
    mockEnsureAnkiSetup.mockResolvedValue(undefined);
    mockSyncCards.mockResolvedValue({ added: 3, updated: 0, failed: 0 });

    const btn = makeButton();
    await runMusasiPipeline(btn);

    const [questionsArg, scoreMapArg] = mockBuildCards.mock.calls[0] as [
      { question: number; ja: string; en: string; correct: boolean; explanation_ja: string; explanation_en: string; images: string[] }[],
      Map<number, { passed: boolean; userChoice: string }>,
      unknown,
    ];

    expect(questionsArg).toHaveLength(3);
    expect(questionsArg[0]).toMatchObject({
      question: 1,
      ja: '問題1のテキスト',
      en: '',
      correct: true,
      explanation_ja: '解説1',
      explanation_en: '',
      images: [],
    });
    expect(questionsArg[1]).toMatchObject({
      question: 2,
      en: '',
      explanation_ja: '',
      explanation_en: '',
    });

    // Score map
    expect(scoreMapArg.get(1)).toEqual({ passed: true, userChoice: 'true' });
    expect(scoreMapArg.get(2)).toEqual({ passed: true, userChoice: 'false' });
    expect(scoreMapArg.get(3)).toEqual({ passed: false, userChoice: 'false' });
  });
});

describe('runMusasiPipeline — error cases', () => {
  it('shows error text and re-enables button when route is null', async () => {
    mockParseMusasiRoute.mockReturnValue(null);
    const btn = makeButton();
    await runMusasiPipeline(btn);
    expect(btn.textContent).toBe('❌ Error: not a test page');
    expect(btn.disabled).toBe(false);
  });

  it('shows error text when no questions found', async () => {
    mockParseMusasiRoute.mockReturnValue(FAKE_ROUTE);
    mockHarvestMusasiQuestions.mockReturnValue([]);
    const btn = makeButton();
    await runMusasiPipeline(btn);
    expect(btn.textContent).toBe('❌ Error: no questions found');
    expect(btn.disabled).toBe(false);
  });

  it('falls back to TSV when AnkiConnect throws', async () => {
    mockParseMusasiRoute.mockReturnValue(FAKE_ROUTE);
    mockHarvestMusasiQuestions.mockReturnValue(FAKE_QUESTIONS);
    mockBuildCards.mockReturnValue(FAKE_CARDS);
    mockEnsureAnkiSetup.mockRejectedValue(new Error('AnkiConnect unavailable'));
    mockExportTsv.mockReturnValue(undefined);

    const btn = makeButton();
    await runMusasiPipeline(btn);

    expect(btn.textContent).toBe('📄 Saved as TSV');
    expect(btn.disabled).toBe(false);
    expect(mockExportTsv).toHaveBeenCalledWith(FAKE_CARDS, { examType: 'karimen', examId: 'session123' });
  });
});

describe('setupMusasiObserver', () => {
  it('injects a button when a .question-item element is present', () => {
    document.body.innerHTML = `
      <div id="wrapper">
        <div class="question-item"><span class="question-number">1</span></div>
      </div>
    `;

    setupMusasiObserver();

    expect(document.getElementById(MUSASI_BUTTON_ID)).not.toBeNull();
  });

  it('does not inject a duplicate button when called again', () => {
    document.body.innerHTML = `
      <div id="wrapper">
        <div class="question-item"><span class="question-number">1</span></div>
      </div>
    `;

    setupMusasiObserver();
    setupMusasiObserver();

    const buttons = document.querySelectorAll(`#${MUSASI_BUTTON_ID}`);
    expect(buttons).toHaveLength(1);
  });
});
