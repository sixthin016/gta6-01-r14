// Neon Bay 3D r14 — combat. The weapon wheel (Q) holds four weapons with
// distinct damage, rate, range and spread: Pistol, SMG, Shotgun, Rifle.
// Firing is hitscan against the nearest ped, traffic car or NBPD unit inside
// the aim cone; hits raise the wanted level, spawn muzzle flash and tracer
// particles, and scatter nearby pedestrians. The wheel overlay is DOM (hud.js);
// this module owns the numbers and the trigger.

import { WEAPONS, WANTED } from './config.js';

export function createCombat(fx, people, vehicles, police) {
  const state = {
    weaponIndex: 0,
    wheelOpen: false,
    cooldown: 0,
    lastShotAt: -10,
    shotsFired: 0,
    hits: 0,
  };

  function weapon() {
    return WEAPONS[state.weaponIndex];
  }

  function select(index) {
    state.weaponIndex = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  }

  function toggleWheel() {
    state.wheelOpen = !state.wheelOpen;
    return state.wheelOpen;
  }

  function closeWheel() {
    state.wheelOpen = false;
  }

  /**
   * Fire from (x, z) along `angle` (radians, 0 = +z). Returns the hit, if any:
   * { kind: 'ped' | 'traffic' | 'police', target, distance }.
   */
  function fire(x, z, angle, time, onWanted) {
    const w = weapon();
    if (time - state.lastShotAt < w.rate) return null;
    state.lastShotAt = time;
    state.shotsFired += 1;
    state.cooldown = w.rate;
    const muzzleX = x + Math.sin(angle) * 1.6;
    const muzzleZ = z + Math.cos(angle) * 1.6;
    fx.muzzle(muzzleX, 1.3, muzzleZ, angle);

    let best = null;
    let bestDist = w.range;
    function consider(tx, tz, kind, target) {
      const dx = tx - x;
      const dz = tz - z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist || dist < 0.5) return;
      const targetAngle = Math.atan2(dx, dz);
      let diff = Math.abs(targetAngle - angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      // Aim cone widens with spread; shotguns forgive a lot, rifles forgive little.
      if (diff < 0.22 + w.spread * 2) {
        bestDist = dist;
        best = { kind, target, distance: dist };
      }
    }
    for (const ped of people.peds) {
      if (ped.alive) consider(ped.x, ped.z, 'ped', ped);
    }
    for (const car of vehicles.traffic) {
      if (car.alive) consider(car.x, car.z, 'traffic', car);
    }
    for (const unit of police.units) consider(unit.x, unit.z, 'police', unit);

    if (best) {
      state.hits += 1;
      const hx = x + Math.sin(angle) * best.distance;
      const hz = z + Math.cos(angle) * best.distance;
      if (best.kind === 'ped') {
        people.kill(best.target);
        people.scatter(hx, hz, 26);
        if (onWanted) onWanted(WANTED.shootPed);
      } else if (best.kind === 'traffic') {
        best.target.alive = false;
        best.target.mesh.visible = false;
        fx.explosion(best.target.x, 1, best.target.z);
        vehicles.respawnTraffic(best.target);
        if (onWanted) onWanted(WANTED.shootPed);
      } else {
        fx.explosion(best.target.x, 1, best.target.z);
        if (onWanted) onWanted(WANTED.shootCop);
      }
    } else {
      // A miss still startles the street.
      people.scatter(muzzleX + Math.sin(angle) * 12, muzzleZ + Math.cos(angle) * 12, 14);
    }
    return best;
  }

  function step(dt) {
    if (state.cooldown > 0) state.cooldown -= dt;
  }

  function accuracy() {
    return state.shotsFired === 0 ? 0 : Math.round((state.hits / state.shotsFired) * 100);
  }

  /** Cycle to the next weapon (used by the wheel's number keys and scroll). */
  function cycle() {
    select(state.weaponIndex + 1);
    return weapon();
  }

  return { state, weapon, select, cycle, toggleWheel, closeWheel, fire, step, accuracy };
}
