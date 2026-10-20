import { setupObserver } from './injectButton';

export function main(): void {
  console.log('[karimen-anki-exporter] loaded');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }
}

main();
