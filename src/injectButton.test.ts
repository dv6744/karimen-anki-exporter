// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all pipeline modules before importing the module under test
// ---------------------------------------------------------------------------
vi.mock('./parseExamRoute', () => ({
  parseExamRoute: vi.fn(),
}));
vi.mock('./fetchExamData', () => ({
  fetchExamData: vi.fn(),
}));
vi.mock('./harvestScores', () => ({
  harvestScores: vi.fn(),
}));
vi.mock('./cardBuilder', () => ({
  buildCards: vi.fn(),
}));
vi.mock('./ankiSetup', () => ({
  ensureAnkiSetup: vi.fn(),
}));
vi.mock('./syncCards', () => ({
  syncCards: vi.fn(),
}));
vi.mock('./exportTsv', () => ({
  exportTsv: vi.fn(),
}));

import { parseExamRoute } from './parseExamRoute';
import { fetchExamData } from './fetchExamData';
import { harvestScores } from './harvestScores';
import { buildCards } from './cardBuilder';
import { ensureAnkiSetup } from './ankiSetup';
import { syncCards } from './syncCards';
import { exportTsv } from './exportTsv';
import { setupObserver, runPipeline, BUTTON_ID } from './injectButton';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------
const mockParseExamRoute = vi.mocked(parseExamRoute);
const mockFetchExamData = vi.mocked(fetchExamData);
const mockHarvestScores = vi.mocked(harvestScores);
const mockBuildCards = vi.mocked(buildCards);
const mockEnsureAnkiSetup = vi.mocked(ensureAnkiSetup);
const mockSyncCards = vi.mocked(syncCards);
const mockExportTsv = vi.mocked(exportTsv);

// Default route/data used across most tests
const ROUTE = { examType: 'karimen' as const, examId: '10' };
const CARDS = [{ UID: 'q_abc', Exam_Category: 'Karimen (仮免)', Exam_Title: 'Karimen exam no 10' }] as never;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function injectScoredGrid(): void {
  const grid = document.createElement('div');
  grid.id = 'scored-grid';
  const btn = document.createElement('button');
  btn.className = 'bg-green-300';
  btn.textContent = '1';
  grid.appendChild(btn);
  document.body.appendChild(grid);
}

function makeExportButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = '📥 Export to Anki';
  document.body.appendChild(btn);
  return btn;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  // Set default happy-path mock return values
  mockParseExamRoute.mockReturnValue(ROUTE);
  mockFetchExamData.mockResolvedValue([]);
  mockHarvestScores.mockReturnValue(new Map());
  mockBuildCards.mockReturnValue(CARDS);
  mockEnsureAnkiSetup.mockResolvedValue(undefined);
  mockSyncCards.mockResolvedValue({ added: 5, updated: 3, failed: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Observer tests
// ---------------------------------------------------------------------------
describe('setupObserver', () => {
  it('injects the export button when scored grid buttons are already present', () => {
    injectScoredGrid();
    setupObserver();
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('injects the export button when scored grid buttons appear after observer starts', async () => {
    setupObserver();
    // No scored buttons yet
    expect(document.getElementById(BUTTON_ID)).toBeNull();

    // Now add scored buttons — observer should fire
    injectScoredGrid();

    // Wait for MutationObserver callback (microtask + a tick)
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('does not inject a second button if one already exists', () => {
    injectScoredGrid();
    setupObserver();
    setupObserver(); // call again
    const buttons = document.querySelectorAll(`#${BUTTON_ID}`);
    expect(buttons.length).toBe(1);
  });

  it('injected button has text "📥 Export to Anki"', () => {
    injectScoredGrid();
    setupObserver();
    const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement;
    expect(btn.textContent).toBe('📥 Export to Anki');
  });

  it('injected button is inserted as a sibling of the grid container', () => {
    injectScoredGrid();
    setupObserver();
    const grid = document.getElementById('scored-grid')!;
    const exportBtn = document.getElementById(BUTTON_ID)!;
    expect(grid.parentElement).toBe(exportBtn.parentElement);
  });
});

// ---------------------------------------------------------------------------
// Pipeline order tests
// ---------------------------------------------------------------------------
describe('runPipeline — full pipeline order', () => {
  it('calls all 6 pipeline steps in sequence', async () => {
    const callOrder: string[] = [];
    mockParseExamRoute.mockImplementation(() => { callOrder.push('parseExamRoute'); return ROUTE; });
    mockFetchExamData.mockImplementation(async () => { callOrder.push('fetchExamData'); return []; });
    mockHarvestScores.mockImplementation(() => { callOrder.push('harvestScores'); return new Map(); });
    mockBuildCards.mockImplementation(() => { callOrder.push('buildCards'); return CARDS; });
    mockEnsureAnkiSetup.mockImplementation(async () => { callOrder.push('ensureAnkiSetup'); });
    mockSyncCards.mockImplementation(async () => { callOrder.push('syncCards'); return { added: 1, updated: 0, failed: 0 }; });

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(callOrder).toEqual([
      'parseExamRoute',
      'fetchExamData',
      'harvestScores',
      'buildCards',
      'ensureAnkiSetup',
      'syncCards',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Status state tests
// ---------------------------------------------------------------------------
describe('runPipeline — status states', () => {
  it('shows loading state (disabled) while pipeline runs', async () => {
    let resolveSync!: (v: { added: number; updated: number; failed: number }) => void;
    mockSyncCards.mockReturnValue(
      new Promise<{ added: number; updated: number; failed: number }>((r) => { resolveSync = r; }),
    );

    const btn = makeExportButton();
    const pipelinePromise = runPipeline(btn);

    // While pipeline is awaiting syncCards, button should be disabled with loading text
    expect(btn.textContent).toBe('⏳ Exporting…');
    expect(btn.disabled).toBe(true);

    resolveSync({ added: 2, updated: 0, failed: 0 });
    await pipelinePromise;
  });

  it('shows success state with card count after sync completes', async () => {
    mockSyncCards.mockResolvedValue({ added: 7, updated: 3, failed: 0 });

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(btn.textContent).toBe('✅ 10 cards synced');
    expect(btn.disabled).toBe(false);
  });

  it('shows TSV fallback state when AnkiConnect (ensureAnkiSetup) throws', async () => {
    mockEnsureAnkiSetup.mockRejectedValue(new Error('AnkiConnect unavailable'));

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(mockExportTsv).toHaveBeenCalledOnce();
    expect(btn.textContent).toBe('📄 Saved as TSV');
    expect(btn.disabled).toBe(false);
  });

  it('shows TSV fallback state when AnkiConnect (syncCards) throws', async () => {
    mockSyncCards.mockRejectedValue(new Error('connection refused'));

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(mockExportTsv).toHaveBeenCalledOnce();
    expect(btn.textContent).toBe('📄 Saved as TSV');
    expect(btn.disabled).toBe(false);
  });

  it('shows error state when parseExamRoute returns null', async () => {
    mockParseExamRoute.mockReturnValue(null);

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(btn.textContent).toMatch(/❌ Error:/);
    expect(btn.disabled).toBe(false);
  });

  it('shows error state when fetchExamData throws', async () => {
    mockFetchExamData.mockRejectedValue(new Error('HTTP 404'));

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(btn.textContent).toBe('❌ Error: HTTP 404');
    expect(btn.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TSV fallback — exportTsv called with correct args
// ---------------------------------------------------------------------------
describe('runPipeline — TSV fallback arguments', () => {
  it('passes cards and route to exportTsv on AnkiConnect failure', async () => {
    mockSyncCards.mockRejectedValue(new Error('offline'));

    const btn = makeExportButton();
    await runPipeline(btn);

    expect(mockExportTsv).toHaveBeenCalledWith(CARDS, ROUTE);
  });
});
