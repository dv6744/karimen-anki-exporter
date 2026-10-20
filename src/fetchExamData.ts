import type { ExamRoute } from './parseExamRoute';

export interface QuestionRecord {
  question: number;
  ja: string;
  en: string;
  correct: boolean;
  explanation_ja: string;
  explanation_en: string;
  images: string[];
}

interface RawQuestion {
  question: number;
  ja: string;
  en: string;
  correct: boolean;
  explanation_ja: string;
  explanation_en: string;
  images?: string[];
}

function buildUrl(route: ExamRoute): string {
  return `/${route.examType}/exams/${route.examId}/exam.json`;
}

function mapRecord(raw: RawQuestion): QuestionRecord {
  return {
    question: raw.question,
    ja: raw.ja,
    en: raw.en,
    correct: Boolean(raw.correct),
    explanation_ja: raw.explanation_ja,
    explanation_en: raw.explanation_en,
    images: Array.isArray(raw.images) ? raw.images : [],
  };
}

/**
 * Fetches exam question data for the given route.
 * Rejects on network error, non-200 status, or invalid JSON.
 */
export async function fetchExamData(route: ExamRoute): Promise<QuestionRecord[]> {
  const url = buildUrl(route);

  const response = await fetch(url);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch exam data: HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Failed to parse exam JSON: invalid JSON response');
  }

  if (!Array.isArray(data)) {
    throw new Error('Failed to parse exam JSON: expected an array');
  }

  return (data as RawQuestion[]).map(mapRecord);
}
