export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** The location the user chose, by search or GPS. Never the model grid cell. */
export interface SelectedLocation extends Coordinates {
  /** What we show: "Lucknow, Uttar Pradesh" or "Near 28.61, 77.21 (place name unavailable)". */
  label: string;
  /** False when we only have coordinates (ADR-010); the search box stays visible. */
  nameAvailable: boolean;
  source: 'search' | 'gps';
}
