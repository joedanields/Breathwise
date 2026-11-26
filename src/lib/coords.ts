/** Rounds a coordinate to `decimals` places (2 dp is about 1 km). Used for cache keys and privacy. */
export function roundCoordinate(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** "28.61, 77.21" — latitude first, two decimals. */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}
