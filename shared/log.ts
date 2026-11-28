// Tiny logger shared by the SPA and the Pages Function. Silent under Vitest so test output
// stays clean. Callers pass diagnostic fields only: never a profile, a prompt or a key.

/** The console methods the logger writes to. */
export type LogSink = Pick<Console, 'error' | 'warn'>;

/** Error and warning logging; extra arguments are passed through to the sink. */
export interface Logger {
  error: (message: string, ...details: unknown[]) => void;
  warn: (message: string, ...details: unknown[]) => void;
}

interface ProcessLike {
  env?: Record<string, string | undefined>;
}

function currentProcess(): ProcessLike | null {
  return (globalThis as { process?: ProcessLike }).process ?? null;
}

/** True when running inside Vitest (it sets `process.env.VITEST`); false in browsers and Workers. */
export function isTestRun(proc: ProcessLike | null = currentProcess()): boolean {
  return proc?.env?.VITEST !== undefined;
}

/** Creates a logger that forwards to `sink` unless `silent`. */
export function createLogger({
  sink = console,
  silent = isTestRun(),
}: { sink?: LogSink; silent?: boolean } = {}): Logger {
  return {
    error: (message, ...details) => {
      if (!silent) sink.error(message, ...details);
    },
    warn: (message, ...details) => {
      if (!silent) sink.warn(message, ...details);
    },
  };
}

/** The app-wide logger. */
export const log: Logger = createLogger();
