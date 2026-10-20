import { describe, it, expect } from 'vitest';
import { parseExamRoute } from './parseExamRoute';

describe('parseExamRoute', () => {
  it('returns karimen route for /exam/karimen/10', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/karimen/10')).toEqual({
      examType: 'karimen',
      examId: '10',
      locale: undefined,
    });
  });

  it('returns karimen route for /en/exam/karimen/10 (locale prefix)', () => {
    expect(parseExamRoute('https://karimen-honmen.com/en/exam/karimen/10')).toEqual({
      examType: 'karimen',
      examId: '10',
      locale: 'en',
    });
  });

  it('returns honmen route for /exam/honmen/3', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/honmen/3')).toEqual({
      examType: 'honmen',
      examId: '3',
      locale: undefined,
    });
  });

  it('returns gentsuki route for /exam/gentsuki/1', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/gentsuki/1')).toEqual({
      examType: 'gentsuki',
      examId: '1',
      locale: undefined,
    });
  });

  it('returns null for the site root', () => {
    expect(parseExamRoute('https://karimen-honmen.com/')).toBeNull();
  });

  it('returns null for a non-exam path', () => {
    expect(parseExamRoute('https://karimen-honmen.com/about')).toBeNull();
  });

  it('returns null for an unrecognised exam type', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/motorcycle/1')).toBeNull();
  });

  it('returns null when exam ID segment is missing (/exam/karimen)', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/karimen')).toBeNull();
  });

  it('returns null when exam ID segment is an empty string (/exam/karimen/)', () => {
    expect(parseExamRoute('https://karimen-honmen.com/exam/karimen/')).toBeNull();
  });

  it('returns null for a completely unrelated URL', () => {
    expect(parseExamRoute('https://example.com')).toBeNull();
  });

  it('returns null for an empty string without throwing', () => {
    expect(parseExamRoute('')).toBeNull();
  });
});
