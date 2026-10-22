import { describe, it, expect } from 'vitest';
import { parseMusasiRoute } from './parseMusasiRoute';

describe('parseMusasiRoute', () => {
  it('returns a MusasiRoute for a plausible exam result URL', () => {
    const result = parseMusasiRoute('https://musasi.jp/pids/exam/result/12345');
    expect(result).not.toBeNull();
    expect(result?.sessionId).toBe('12345');
    expect(result?.label).toBe('Musasi Practice');
  });

  it('returns a MusasiRoute for a mondai URL', () => {
    const result = parseMusasiRoute('https://musasi.jp/pids/mondai/67890');
    expect(result).not.toBeNull();
    expect(result?.sessionId).toBe('67890');
    expect(result?.label).toBe('Musasi Practice');
  });

  it('returns null for the login page', () => {
    const result = parseMusasiRoute('https://musasi.jp/pids/login');
    expect(result).toBeNull();
  });

  it('returns null for a generic non-test dashboard path', () => {
    const result = parseMusasiRoute('https://musasi.jp/pids/top');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseMusasiRoute('')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(parseMusasiRoute('not-a-url')).toBeNull();
  });
});
