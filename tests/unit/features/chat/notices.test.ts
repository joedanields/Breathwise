import { describe, expect, it } from 'vitest';
import { noticeFor } from '@/features/chat/useChat';

describe('noticeFor', () => {
  it('explains rate limits and rejected keys', () => {
    expect(noticeFor('rate_limited')).toMatch(/try again in a minute/);
    expect(noticeFor('auth')).toMatch(/key was rejected/);
  });

  it('falls back to a general notice for every other failure', () => {
    for (const error of ['upstream', 'invalid_output', 'bad_request', undefined] as const) {
      expect(noticeFor(error)).toBe(
        "Breathwise couldn't answer right now. Please try again in a moment.",
      );
    }
  });
});
