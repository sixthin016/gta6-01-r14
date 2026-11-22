// Neon Bay 3D r14 — missions. Ten named story jobs forming one arc: the
// $250,000 Harbor Reserve vault, hit before Hurricane Solana makes landfall.
// Each mission has a district, a payout and respect. The active mission shows
// a golden beacon and a tracker line; reaching the beacon completes it, pays
// out, and advances the story. Completing all ten is the Neon Legend run.

import { MISSIONS, rankFor } from './config.js';

export function createMissions(fx) {
  const state = {
    list: MISSIONS.map((m) => ({ ...m, done: false })),
    activeId: 1,
    completedCount: 0,
    totalEarned: 0,
    totalRespect: 0,
    lastPayout: null,
  };

  function active() {
    return state.list.find((m) => m.id === state.activeId) ?? null;
  }

  function currentIndex() {
    return state.list.findIndex((m) => m.id === state.activeId);
  }

  /** Distance from (x, z) to the active mission beacon, or Infinity. */
  function distanceToTarget(x, z) {
    const m = active();
    if (!m) return Infinity;
    return Math.hypot(m.x - x, m.z - z);
  }

  /**
   * Check the beacon: if the player is close enough, complete the mission.
   * Returns the completed mission, or null.
   */
  function checkArrival(x, z, onComplete) {
    const m = active();
    if (!m) return null;
    if (Math.hypot(m.x - x, m.z - z) > 9) return null;
    m.done = true;
    state.completedCount += 1;
    state.totalEarned += m.payout;
    state.totalRespect += m.respect;
    state.lastPayout = { name: m.name, payout: m.payout, respect: m.respect };
    fx.cashBurst(m.x, 1, m.z);
    const next = state.list.find((job) => !job.done);
    state.activeId = next ? next.id : null;
    if (onComplete) onComplete(m, next);
    return m;
  }

  function respectTotal() {
    return state.totalRespect;
  }

  function rank() {
    return rankFor(state.totalRespect);
  }

  /** Story progress: how many of the ten jobs are done, and what is next. */
  function progress() {
    const next = active();
    return {
      done: state.completedCount,
      total: state.list.length,
      next: next ? next.name : 'All jobs complete — Neon Legend',
      earned: state.totalEarned,
    };
  }

  /** Serialisable mission state for saves. */
  function serialize() {
    return {
      activeId: state.activeId,
      completedCount: state.completedCount,
      totalEarned: state.totalEarned,
      totalRespect: state.totalRespect,
      doneIds: state.list.filter((m) => m.done).map((m) => m.id),
    };
  }

  function restore(data) {
    if (!data) return;
    state.activeId = data.activeId ?? 1;
    state.completedCount = data.completedCount ?? 0;
    state.totalEarned = data.totalEarned ?? 0;
    state.totalRespect = data.totalRespect ?? 0;
    const done = new Set(data.doneIds ?? []);
    for (const m of state.list) m.done = done.has(m.id);
    state.lastPayout = null;
  }

  function reset() {
    for (const m of state.list) m.done = false;
    state.activeId = 1;
    state.completedCount = 0;
    state.totalEarned = 0;
    state.totalRespect = 0;
    state.lastPayout = null;
  }

  /** The full named list, for the start screen and the HUD mission panel. */
  function listAll() {
    return state.list.map((m) => ({
      id: m.id, name: m.name, district: m.district, payout: m.payout, respect: m.respect, done: m.done,
    }));
  }

  return { state, active, currentIndex, distanceToTarget, checkArrival, respectTotal, rank, progress, serialize, restore, reset, listAll };
}
