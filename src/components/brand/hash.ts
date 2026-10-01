// A stable string hash, for the places where "the same id always gets the same
// pick" is the whole requirement: the cover fallback's sky and the avatar's hue.
// FNV-1a, 32-bit — the same across runs and platforms, which `Math.random` and
// object iteration order are not.

export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
