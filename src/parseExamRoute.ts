export type ExamType = 'karimen' | 'honmen' | 'gentsuki';

export interface ExamRoute {
  examType: ExamType;
  examId: string;
  /** Path segments before /exam/, e.g. "en" for /en/exam/karimen/10 */
  locale?: string;
}

const VALID_EXAM_TYPES = new Set<ExamType>(['karimen', 'honmen', 'gentsuki']);

/**
 * Extracts the exam type and exam ID from a karimen-honmen.com page URL.
 * Handles optional locale prefix, e.g. /en/exam/{examType}/{examId}.
 * Returns null if the URL does not match the expected pattern.
 */
export function parseExamRoute(url: string): ExamRoute | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  // Find 'exam' at any position to handle locale prefixes like /en/exam/...
  const examIndex = parts.indexOf('exam');
  if (examIndex === -1 || parts.length < examIndex + 3) return null;

  const examType = parts[examIndex + 1] as ExamType;
  if (!VALID_EXAM_TYPES.has(examType)) return null;

  const examId = parts[examIndex + 2];
  if (!examId) return null;

  const locale = parts.slice(0, examIndex).join('/') || undefined;
  return { examType, examId, locale };
}
