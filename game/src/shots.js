// Neon Bay 3D r14 — screenshot scenes behind ?shot=cover|carjack|start|chase.
// Each scene stages the real game (same systems, same HUD) into a named
// moment, plays it forward a few seconds so traffic, pedestrians, NBPD units
// and HALO-1 settle into place, and leaves the frame ready for capture.
// The same seed always gives the same frame.

import { STEP } from './config.js';

const DRIVE_SECONDS = 2.5;
const SETTLE_SECONDS = 1.5;

/** Place the player (on foot or in the car) at (x, z) facing `angle`. */
function placePlayer(game, x, z, angle, inCar, speed) {
  const G = game.G;
  const car = game.vehicles.playerCar;
  G.x = x;
  G.z = z;
  G.angle = angle;
  if (inCar) {
    G.onFoot = false;
    car.x = x;
    car.z = z;
    car.angle = angle;
    car.speed = speed;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = angle;
    G.speed = speed;
  } else {
    G.onFoot = true;
    G.speed = 0;
    car.speed = 0;
  }
}

function setStats(game, { cash, respect, health, wanted }) {
  const G = game.G;
  if (cash !== undefined) G.cash = cash;
  if (respect !== undefined) {
    G.respect = respect;
    game.missions.state.totalRespect = respect;
  }
  if (health !== undefined) G.health = health;
  if (wanted !== undefined) game.police.wanted = wanted;
}

/** Drive the staged scene forward `seconds` with optional throttle input. */
function advance(game, seconds, throttle = 0) {
  const steps = Math.round(seconds / STEP);
  const simInput = {
    throttle: () => throttle,
    steer: () => 0,
    nitro: () => false,
  };
  for (let i = 0; i < steps; i += 1) game.stepSim(STEP, simInput);
}

/**
 * Stage one of the four shots. `game` is the object main.js assembles.
 * Returns the screen name the renderer should draw over the scene.
 */
export function stageShot(name, game) {
  const G = game.G;
  game.resetWorld();
  G.screen = 'play';
  game.hud.hideStart();
  game.hud.hideWheel();
  game.hud.hideGarage();
  game.photomode.set(false);

  if (name === 'cover') {
    // COVER: driving up Neon Row at golden hour — traffic, pedestrians, HUD,
    // minimap, wanted stars and the Radio Neon FM widget all visible.
    setStats(game, { cash: 12450, respect: 420, health: 100, wanted: 2 });
    game.missions.state.activeId = 5;
    game.radio.setStation(0);
    placePlayer(game, 0, 70, Math.PI, true, 16);
    // Stage traffic on the avenue ahead and pedestrians on the sidewalks, so
    // the cover frame is a living street, not an empty road.
    let placedCars = 0;
    for (const car of game.vehicles.traffic) {
      if (placedCars >= 6) break;
      car.horizontal = false;
      car.direction = placedCars % 2 === 0 ? 1 : -1;
      car.x = placedCars % 2 === 0 ? 3.6 : -3.6;
      car.z = 40 - placedCars * 14;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.direction > 0 ? 0 : Math.PI;
      placedCars += 1;
    }
    let placedPeds = 0;
    for (const ped of game.people.peds) {
      if (placedPeds >= 6) break;
      ped.x = (placedPeds % 2 === 0 ? 10.5 : -10.5) + (placedPeds % 3);
      ped.z = 55 - placedPeds * 9;
      ped.mesh.position.set(ped.x, 0, ped.z);
      placedPeds += 1;
    }
    advance(game, SETTLE_SECONDS, 1);
    game.render.snap({ x: G.x, z: G.z, angle: G.angle, speed: 16, onFoot: false });
    return 'play';
  }

  if (name === 'carjack') {
    // CARJACKING / COMBAT: on foot in Neon Row, weapon wheel open, the photo
    // facades on the buildings behind, wanted stars up.
    setStats(game, { cash: 9850, respect: 640, health: 88, wanted: 3 });
    game.missions.state.activeId = 7;
    game.radio.setStation(0);
    placePlayer(game, 10, 58, Math.PI, false, 0);
    // Park a traffic car right beside the player: the carjack target.
    const car = game.vehicles.nearestTraffic(G.x, G.z, 400);
    if (car) {
      car.x = 14.5;
      car.z = 54;
      car.horizontal = false;
      car.direction = 1;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = 0;
    }
    game.combat.select(1); // SMG in hand
    game.combat.state.wheelOpen = true;
    game.hud.showWheel(1);
    advance(game, SETTLE_SECONDS, 0);
    game.render.snap({ x: G.x, z: G.z, angle: G.angle, speed: 0, onFoot: true });
    return 'play';
  }

  if (name === 'start') {
    // START SCREEN: 3 save slots (two filled, one empty), all 10 missions,
    // respect rank and the garage summary, city glowing behind the panel.
    // The two demo saves below are written by the stager into this browser
    // profile only, so the start screen shows real slot summaries.
    game.missions.state.list[0].done = true;
    game.missions.state.list[1].done = true;
    game.missions.state.completedCount = 2;
    game.missions.state.totalEarned = 6500;
    game.missions.state.totalRespect = 420;
    game.vehicles.playerCar.upgrades.engine = 1;
    game.vehicles.playerCar.upgrades.armor = 1;
    G.cash = 12450;
    G.respect = 420;
    // Demo saves, written to this browser profile only, so the start screen
    // shows real slot summaries instead of three empty boxes.
    game.saves.save(1, {
      cash: 12450, respect: 420, rank: 'Street Hustler', district: 'Neon Row',
      missions: game.missions.serialize(),
      garage: { ...game.vehicles.playerCar.upgrades },
      x: 0, z: 70, angle: Math.PI, inCar: true, health: 100,
      clockMinutes: G.clockMinutes, hurricaneSeconds: G.hurricaneSeconds, weaponIndex: 0,
    });
    game.saves.save(2, {
      cash: 3120, respect: 160, rank: 'Small Timer', district: 'Harbor Docks',
      missions: { activeId: 2, completedCount: 1, totalEarned: 2500, totalRespect: 60, doneIds: [1] },
      garage: { engine: 0, armor: 0, nitro: 0 },
      x: 150, z: 20, angle: 0, inCar: false, health: 76,
      clockMinutes: G.clockMinutes, hurricaneSeconds: G.hurricaneSeconds, weaponIndex: 0,
    });
    G.screen = 'title';
    placePlayer(game, 0, 110, Math.PI, true, 0);
    advance(game, SETTLE_SECONDS, 0);
    game.hud.showStart(
      game.saves.summaries(),
      game.missions.listAll(),
      game.vehicles.playerCar.upgrades,
      G.respect,
      game.missions.rank().name,
      12450,
    );
    game.render.snap({ x: G.x, z: G.z, angle: G.angle, speed: 0, onFoot: false });
    return 'title';
  }

  // chase (default): a five-star NBPD pursuit — roadblock ahead, HALO-1
  // overhead with its searchlight on the player, dispatch board live.
  setStats(game, { cash: 21480, respect: 980, health: 62, wanted: 0 });
  game.missions.state.activeId = 8;
  game.radio.setStation(2);
  placePlayer(game, 0, 40, Math.PI, true, 24);
  advance(game, 1, 1);
  game.police.wanted = 5;
  advance(game, DRIVE_SECONDS, 1);
  // Put HALO-1 in the frame: ahead and to the right of the player. The chase
  // camera pitches down ~18 deg, so the top of the frame is only ~13 deg above
  // horizontal — the heli must be far ahead and low to clear it.
  const heli = game.police.heli;
  heli.x = G.x + 8;
  heli.z = G.z - 35;
  heli.y = 18;
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  heli.mesh.rotation.y = Math.atan2(G.x - heli.x, G.z - heli.z);
  game.fx.setSearchlight(heli.x, heli.y, heli.z, G.x, G.z, true);
  game.render.snap({ x: G.x, z: G.z, angle: G.angle, speed: 24, onFoot: false });
  return 'play';
}
