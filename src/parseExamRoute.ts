export type ExamType = 'karimen' | 'honmen' | 'gentsuki';

export interface ExamRoute {
  examType: ExamType;
  examId: string;
}

const VALID_EXAM_TYPES = new Set<ExamType>(['karimen', 'honmen', 'gentsuki']);

/**
 * Extracts the exam type and exam ID from a karimen-honmen.com page URL.
 * Expects paths of the form /exam/{examType}/{examId}.
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

  // Path must be /exam/{examType}/{examId}
  const parts = parsed.pathname.split('/').filter(Boolean);
  // parts[0] === 'exam', parts[1] === examType, parts[2] === examId
  if (parts.length < 3 || parts[0] !== 'exam') return null;

  const examType = parts[1] as ExamType;
  if (!VALID_EXAM_TYPES.has(examType)) return null;

  const examId = parts[2];
  if (!examId) return null;

  return { examType, examId };
}
