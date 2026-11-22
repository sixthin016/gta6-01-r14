// Neon Bay 3D r14 — seeded randomness. One mulberry32 stream per purpose so the
// city, the traffic and the pedestrians are all reproducible from a single seed.

export function mulberry32(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small helper bag around one seeded stream: ranges, ints, picks, shuffles. */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
    /** A shuffled copy of `items` (Fisher-Yates). */
    shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    /** Gaussian-ish value in [-1, 1] from three uniform draws. */
    bell() {
      return (next() + next() + next() - 1.5) / 1.5;
    },
    /** A random angle in radians, for headings and orbit positions. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}

/** Hash a short string into a 32-bit seed (FNV-1a), for named seeds like "neon". */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
