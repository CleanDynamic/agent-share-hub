// SV-04 P5: the card's cover heights, on their own so a placeholder can size a cover without the card's code.

/** Cover heights by where the card stands, as the design draws them. */
export const COVER_HEIGHT = {
  /** The catalogue. */
  catalogue: 112,
  /** The gallery wall. */
  wall: 92,
  /** A profile's works. */
  works: 86,
  /** Mobile, two columns. */
  mobile: 96,
} as const;
