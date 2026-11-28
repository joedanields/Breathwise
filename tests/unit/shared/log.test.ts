import { describe, expect, it, vi } from 'vitest';
import { createLogger, isTestRun, log } from '@shared/log';

function fakeSink() {
  return { error: vi.fn(), warn: vi.fn() };
}

describe('isTestRun', () => {
  it('is true when VITEST is set', () => {
    expect(isTestRun({ env: { VITEST: 'true' } })).toBe(true);
  });

  it('is false without process (browser, Workers) or without VITEST', () => {
    expect(isTestRun(null)).toBe(false);
    expect(isTestRun({})).toBe(false);
    expect(isTestRun({ env: {} })).toBe(false);
  });

  it('detects the current Vitest run by default', () => {
    expect(isTestRun()).toBe(true);
  });
});

describe('createLogger', () => {
  it('forwards errors and warnings with their details', () => {
    const sink = fakeSink();
    const logger = createLogger({ sink, silent: false });

    logger.error('boom', { code: 1 });
    logger.warn('careful');

    expect(sink.error).toHaveBeenCalledWith('boom', { code: 1 });
    expect(sink.warn).toHaveBeenCalledWith('careful');
  });

  it('writes nothing when silent', () => {
    const sink = fakeSink();
    const logger = createLogger({ sink, silent: true });

    logger.error('boom');
    logger.warn('careful');

    expect(sink.error).not.toHaveBeenCalled();
    expect(sink.warn).not.toHaveBeenCalled();
  });

  it('is silent under test by default', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    createLogger().error('boom');
    log.warn('careful');

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
  });
});
