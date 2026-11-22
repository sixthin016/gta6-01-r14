// Neon Bay 3D r14 — saves. Save Anywhere: three slots in localStorage, each
// holding cash, respect, mission progress, garage tiers, position, clock and
// the hurricane countdown. The start screen lists all three slots with a
// summary (or "Empty slot"); S... C quick-saves to the last-used slot, and the
// save UI lets the player pick a slot. Storage failures (private mode) are
// swallowed: the game keeps running, the slot just reads empty.

import { SAVE_PREFIX, SAVE_SLOTS } from './config.js';

function key(slot) {
  return `${SAVE_PREFIX}${slot}`;
}

function readRaw(slot) {
  try {
    const raw = window.localStorage.getItem(key(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createSaves() {
  let lastSlot = 1;

  function save(slot, data) {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...data,
    };
    try {
      window.localStorage.setItem(key(slot), JSON.stringify(payload));
      lastSlot = slot;
      return true;
    } catch {
      return false;
    }
  }

  function load(slot) {
    const data = readRaw(slot);
    if (data) lastSlot = slot;
    return data;
  }

  function clear(slot) {
    try {
      window.localStorage.removeItem(key(slot));
      return true;
    } catch {
      return false;
    }
  }

  /** Summaries for all three slots, for the start screen. */
  function summaries() {
    const out = [];
    for (let slot = 1; slot <= SAVE_SLOTS; slot += 1) {
      const data = readRaw(slot);
      if (!data) {
        out.push({ slot, empty: true });
        continue;
      }
      out.push({
        slot,
        empty: false,
        savedAt: data.savedAt ?? null,
        cash: data.cash ?? 0,
        respect: data.respect ?? 0,
        missionsDone: data.missions?.completedCount ?? 0,
        district: data.district ?? 'Neon Bay',
        rank: data.rank ?? 'Nobody',
      });
    }
    return out;
  }

  function hasAny() {
    return summaries().some((s) => !s.empty);
  }

  /** True when every slot holds a save (used to warn before overwriting). */
  function allFull() {
    return summaries().every((s) => !s.empty);
  }

  function getLastSlot() {
    return lastSlot;
  }

  function setLastSlot(slot) {
    lastSlot = slot;
  }

  return { save, load, clear, summaries, hasAny, allFull, getLastSlot, setLastSlot };
}
