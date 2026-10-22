export interface MusasiRoute {
  /** Session or exam ID extracted from the URL, or "unknown" if absent. */
  sessionId: string;
  /** Human-readable label for the Anki deck. */
  label: string;
}

// TODO: verify against live musasi.jp DOM
const MUSASI_TEST_PATH_PREFIXES = [
  '/pids/exam',
  '/pids/mondai',
];

// TODO: verify against live musasi.jp DOM
const MUSASI_NON_TEST_PATHS = [
  '/pids/login',
  '/pids/top',
];

/**
 * Parses a musasi.jp URL and returns a MusasiRoute if the page is a
 * practice/mock-test results page. Returns null for non-test pages such as
 * the login page or dashboard.
 */
export function parseMusasiRoute(url: string): MusasiRoute | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const pathname = parsed.pathname;

  // Reject known non-test paths
  for (const nonTest of MUSASI_NON_TEST_PATHS) {
    if (pathname === nonTest || pathname.startsWith(nonTest + '/')) {
      return null;
    }
  }

  // Accept known test path prefixes
  for (const prefix of MUSASI_TEST_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      // Extract the trailing ID segment if present
      const parts = pathname.split('/').filter(Boolean);
      const sessionId = parts[parts.length - 1] ?? 'unknown';
      // If the last segment is a known keyword rather than an ID, use "unknown"
      const isId = /^\w+$/.test(sessionId) && sessionId !== 'exam' && sessionId !== 'mondai' && sessionId !== 'result';
      return {
        sessionId: isId ? sessionId : 'unknown',
        label: 'Musasi Practice',
      };
    }
  }

  return null;
}
