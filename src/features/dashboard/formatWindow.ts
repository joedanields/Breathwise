import type { TimeWindow } from '@shared/types';

/** "Fri 3:00 pm–4:00 pm" in the location's time zone. */
export function formatWindow(window: TimeWindow, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone });
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone }).format(
    new Date(window.start),
  );
  return `${day} ${fmt.format(new Date(window.start))}–${fmt.format(new Date(window.end))}`;
}
