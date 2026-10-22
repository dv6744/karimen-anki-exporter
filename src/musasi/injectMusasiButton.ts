import { parseMusasiRoute } from './parseMusasiRoute';
import { harvestMusasiQuestions } from './harvestMusasiQuestions';
import type { QuestionRecord } from '../fetchExamData';
import type { QuestionResult } from '../harvestScores';
import { buildCards } from '../cardBuilder';
import { ensureAnkiSetup } from '../ankiSetup';
import { syncCards } from '../syncCards';
import { exportTsv } from '../exportTsv';

export const MUSASI_BUTTON_ID = 'musasi-anki-export-btn';

function createExportButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = MUSASI_BUTTON_ID;
  btn.textContent = '📥 Export to Anki';
  btn.className =
    'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded ml-2';
  return btn;
}

export async function runMusasiPipeline(btn: HTMLButtonElement): Promise<void> {
  // Loading state
  btn.textContent = '⏳ Exporting…';
  btn.disabled = true;

  try {
    // Step 1 — parse route
    const musasiRoute = parseMusasiRoute(location.href);
    if (!musasiRoute) {
      btn.textContent = '❌ Error: not a test page';
      return;
    }

    // Step 2 — harvest questions from DOM
    const musasiQuestions = harvestMusasiQuestions(document);
    if (musasiQuestions.length === 0) {
      btn.textContent = '❌ Error: no questions found';
      return;
    }

    // Step 3 — adapt MusasiQuestionRecord[] → QuestionRecord[] and Map<number, QuestionResult>
    const questions: QuestionRecord[] = musasiQuestions.map((q) => ({
      question: q.questionNumber,
      ja: q.ja,
      en: '',
      correct: q.correct,
      explanation_ja: q.explanation_ja ?? '',
      explanation_en: '',
      images: [],
    }));

    const scoreMap = new Map<number, QuestionResult>(
      musasiQuestions.map((q) => [
        q.questionNumber,
        {
          passed: q.passed,
          userChoice: q.userAnswer ? 'true' : 'false',
        },
      ]),
    );

    // Step 4 — synthetic ExamRoute for downstream functions
    const examRoute = {
      examType: 'karimen' as const,
      examId: musasiRoute.sessionId,
    };

    // Step 5 — build cards
    const cards = buildCards(questions, scoreMap, examRoute);

    // Step 6 — AnkiConnect with TSV fallback
    try {
      await ensureAnkiSetup(examRoute);
      const result = await syncCards(cards);
      const count = result.added + result.updated;
      btn.textContent = `✅ ${count} cards synced`;
    } catch {
      exportTsv(cards, examRoute);
      btn.textContent = '📄 Saved as TSV';
    }
  } catch (err) {
    btn.textContent = `❌ Error: ${err instanceof Error ? err.message : 'unknown error'}`;
  } finally {
    btn.disabled = false;
  }
}

/**
 * Sets up a MutationObserver that watches for musasi.jp question elements to
 * appear, then injects a single "📥 Export to Anki" button. Disconnects after
 * injection to prevent duplicate buttons on re-render.
 */
export function setupMusasiObserver(): void {
  function tryInject(): void {
    // Guard against duplicate injection
    if (document.getElementById(MUSASI_BUTTON_ID)) return;

    // Check for question elements
    const questionItem = document.querySelector<HTMLElement>('.question-item');
    if (!questionItem) return;

    // Find a suitable container to attach the button to
    const container = questionItem.closest('div') ?? questionItem.parentElement;
    if (!container) return;

    const btn = createExportButton();
    btn.addEventListener('click', () => void runMusasiPipeline(btn));

    const parent = container.parentElement;
    if (parent) {
      parent.insertBefore(btn, container.nextSibling);
    } else {
      container.appendChild(btn);
    }

    observer.disconnect();
  }

  const observer = new MutationObserver(() => tryInject());

  // Try immediately in case the DOM is already ready
  tryInject();

  // Only start observing if the button wasn't already injected
  if (!document.getElementById(MUSASI_BUTTON_ID)) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
