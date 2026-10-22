import { setupObserver } from './injectButton';
import { setupMusasiObserver } from './musasi/injectMusasiButton';

export function main(): void {
  console.log('[karimen-anki-exporter] loaded');

  const isMusasi = location.hostname.includes('musasi.jp');
  const activate = isMusasi ? setupMusasiObserver : setupObserver;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate);
  } else {
    activate();
  }
}

main();
