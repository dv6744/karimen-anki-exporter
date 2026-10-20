import { parseExamRoute } from './parseExamRoute';
import { fetchExamData } from './fetchExamData';
import { harvestScores } from './harvestScores';
import { buildCards } from './cardBuilder';
import { ensureAnkiSetup } from './ankiSetup';
import { syncCards } from './syncCards';
import { exportTsv } from './exportTsv';

export const BUTTON_ID = 'karimen-anki-export-btn';

function createExportButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = '📥 Export to Anki';
  btn.className =
    'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded ml-2';
  return btn;
}

export async function runPipeline(btn: HTMLButtonElement): Promise<void> {
  // Loading state
  btn.textContent = '⏳ Exporting…';
  btn.disabled = true;

  try {
    // Step 1 — parse route
    const route = parseExamRoute(location.href);
    if (!route) {
      btn.textContent = '❌ Error: invalid exam URL';
      return;
    }

    // Step 2 — fetch exam data
    const examData = await fetchExamData(route);

    // Step 3 — harvest scores from live DOM
    const scoreMap = harvestScores(document);

    // Step 4 — build card array
    const cards = buildCards(examData, scoreMap, route);

    // Steps 5 & 6 — AnkiConnect with TSV fallback
    try {
      await ensureAnkiSetup(route);
      const result = await syncCards(cards);
      const count = result.added + result.updated;
      btn.textContent = `✅ ${count} cards synced`;
    } catch {
      // AnkiConnect unavailable — fall back to TSV download
      exportTsv(cards, route);
      btn.textContent = '📄 Saved as TSV';
    }
  } catch (err) {
    btn.textContent = `❌ Error: ${err instanceof Error ? err.message : 'unknown error'}`;
  } finally {
    btn.disabled = false;
  }
}

/**
 * Sets up a MutationObserver on document.body that watches for the scored
 * question grid to appear (buttons with bg-green-300 or bg-red-300), then
 * injects the "📥 Export to Anki" button adjacent to the grid container.
 * Disconnects immediately after injection to prevent duplicate buttons.
 */
export function setupObserver(): void {
  function tryInject(): void {
    // Guard against duplicate injection
    if (document.getElementById(BUTTON_ID)) return;

    // Check for scored grid buttons
    const scoredBtn = document.querySelector<HTMLElement>(
      'button.bg-green-300, button.bg-red-300',
    );
    if (!scoredBtn) return;

    // Find the container holding the scored grid
    const container = scoredBtn.closest('div') ?? scoredBtn.parentElement;
    if (!container) return;

    const btn = createExportButton();
    btn.addEventListener('click', () => void runPipeline(btn));

    // Insert adjacent to the grid container (as a sibling)
    const parent = container.parentElement;
    if (parent) {
      parent.insertBefore(btn, container.nextSibling);
    } else {
      container.appendChild(btn);
    }

    observer.disconnect();
  }

  const observer = new MutationObserver(() => tryInject());

  // Try immediately in case the DOM is already in scored state
  tryInject();

  // Only start observing if the button wasn't already injected
  if (!document.getElementById(BUTTON_ID)) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
