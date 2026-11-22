// Neon Bay 3D r14 — a small seeded random number generator (mulberry32): the
// same seed gives the same game, which is what makes the screenshot scenes
// repeatable. Kept API-compatible with the kit starter's random.js.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from a `createRandom` stream. */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max] inclusive from a `createRandom` stream. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of `items`, uniformly, from a `createRandom` stream. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** True with probability `p` from a `createRandom` stream. */
export function randomChance(random, p) {
  return random() < p;
}
