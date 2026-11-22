// Neon Bay 3D r14 — vehicles. The player's car, the traffic stream, carjacking
// and the garage. Traffic cars drive the road loop on lanes; the player car is
// arcade physics (accelerate, steer, brake, nitro). Carjacking (E near a
// traffic car) steals it and earns a wanted star. The garage sells three
// upgrade lines in three tiers each, paid with mission cash.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, GARAGE, PLAYER, TRAFFIC_COUNT, WANTED } from './config.js';

const CAR_COLORS = ['#e84a4a', '#4a8ae8', '#e8c94a', '#7de84a', '#e8e8e8', '#2b2b33', '#e88a4a', '#8a4ae8'];
const ROADS = [-180, -90, 0, 90, 180];

function buildCarMesh(color, isPlayer) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: '#14121f', roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheels.push(wheel);
    group.add(wheel);
  }
  // Headlights: two small emissive boxes, bright at golden hour.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
    light.position.set(lx, 0.62, 2.22);
    group.add(light);
  }
  if (isPlayer) {
    // The player's ride gets a gold roof stripe so it reads in screenshots.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.06, 4.0),
      new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.3, metalness: 0.8 }),
    );
    stripe.position.set(0, 0.88, 0);
    group.add(stripe);
  }
  group.add(body, cabin);
  return { group, wheels };
}

export function createVehicles(rng, world, fx) {
  const group = new THREE.Group();
  group.name = 'Vehicles';

  const playerCar = {
    x: PLAYER.startX, z: PLAYER.startZ + 6, angle: 0, speed: 0,
    color: '#ff5ea8',
    mesh: null, wheels: null,
    upgrades: { engine: 0, armor: 0, nitro: 0 },
    nitroCharge: 100,
  };
  const built = buildCarMesh(playerCar.color, true);
  playerCar.mesh = built.group;
  playerCar.wheels = built.wheels;
  playerCar.mesh.position.set(playerCar.x, 0, playerCar.z);
  group.add(playerCar.mesh);

  const traffic = [];
  function spawnTrafficCar(index) {
    const horizontal = rng.chance(0.5);
    const road = ROADS[rng.int(0, ROADS.length - 1)];
    const lane = (rng.chance(0.5) ? 1 : -1) * 3.6;
    const along = rng.range(-220, 220);
    const direction = rng.chance(0.5) ? 1 : -1;
    const color = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
    const { group: mesh, wheels } = buildCarMesh(color, false);
    const car = {
      index, mesh, wheels,
      x: horizontal ? along : road + lane,
      z: horizontal ? road + lane : along,
      horizontal, direction,
      speed: rng.range(9, 15),
      color,
      alive: true,
      turnCooldown: rng.range(1, 4),
    };
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = horizontal ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? 0 : Math.PI);
    group.add(mesh);
    return car;
  }
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) traffic.push(spawnTrafficCar(i));

  function topSpeed() {
    const tier = playerCar.upgrades.engine;
    return GARAGE.engine.speeds[tier];
  }

  function armorReduction() {
    return GARAGE.armor.reduction[playerCar.upgrades.armor];
  }

  function nitroMultiplier() {
    return GARAGE.nitro.boost[playerCar.upgrades.nitro];
  }

  /** Drive the player car one step. Returns nothing; mutates playerCar. */
  function drivePlayer(dt, throttle, steer, nitro) {
    const max = topSpeed();
    let target = 0;
    if (throttle > 0) target = max;
    else if (throttle < 0) target = playerCar.speed > 0.5 ? 0 : -9;
    const accel = throttle < 0 && playerCar.speed > 0.5 ? PLAYER.brake : PLAYER.accel;
    if (playerCar.speed < target) playerCar.speed = Math.min(target, playerCar.speed + accel * dt);
    else if (playerCar.speed > target) playerCar.speed = Math.max(target, playerCar.speed - PLAYER.brake * dt);
    // Nitro: only with a nitro tier bought, drains the charge, refills slowly.
    let boost = 1;
    if (nitro && playerCar.upgrades.nitro > 0 && playerCar.nitroCharge > 0 && playerCar.speed > 4) {
      boost = nitroMultiplier();
      playerCar.nitroCharge = Math.max(0, playerCar.nitroCharge - 38 * dt);
      if (Math.random() < 0.35) fx.smoke(playerCar.x, 0.4, playerCar.z, 1);
    } else {
      playerCar.nitroCharge = Math.min(100, playerCar.nitroCharge + 6 * dt);
    }
    const speed = playerCar.speed * boost;
    if (Math.abs(speed) > 0.5) {
      playerCar.angle += steer * PLAYER.steer * dt * Math.sign(speed) * Math.min(1, Math.abs(speed) / 12);
    }
    const nx = playerCar.x + Math.sin(playerCar.angle) * speed * dt;
    const nz = playerCar.z + Math.cos(playerCar.angle) * speed * dt;
    const fixed = world.resolveCollision(nx, nz, PLAYER.carRadius);
    if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(speed) > 14) {
      fx.dust(fixed.x, 0.3, fixed.z);
      playerCar.speed *= 0.55; // a hard hit scrubs speed
    }
    playerCar.x = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, fixed.x));
    playerCar.z = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, fixed.z));
    playerCar.mesh.position.set(playerCar.x, 0, playerCar.z);
    playerCar.mesh.rotation.y = playerCar.angle;
    for (const wheel of playerCar.wheels) wheel.rotation.x += speed * dt * 2;
  }

  function stepTraffic(dt) {
    for (const car of traffic) {
      if (!car.alive) continue;
      car.turnCooldown -= dt;
      if (car.horizontal) {
        car.x += car.direction * car.speed * dt;
        if (car.x > CITY.half - 8 || car.x < -CITY.half + 8) {
          car.direction *= -1;
          car.mesh.rotation.y = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else {
        car.z += car.direction * car.speed * dt;
        if (car.z > CITY.half - 8 || car.z < -CITY.half + 8) {
          car.direction *= -1;
          car.mesh.rotation.y = car.direction > 0 ? 0 : Math.PI;
        }
      }
      // At a crossing, sometimes turn onto the other road.
      const nearCrossX = ROADS.some((r) => Math.abs(car.x - r) < 1.2);
      const nearCrossZ = ROADS.some((r) => Math.abs(car.z - r) < 1.2);
      if (car.turnCooldown <= 0 && nearCrossX && nearCrossZ && Math.random() < 0.25) {
        car.turnCooldown = 3 + Math.random() * 4;
        car.horizontal = !car.horizontal;
        const lane = (Math.random() < 0.5 ? 1 : -1) * 3.6;
        if (car.horizontal) {
          car.z = ROADS.reduce((a, b) => (Math.abs(b - car.z) < Math.abs(a - car.z) ? b : a)) + lane;
          car.mesh.rotation.y = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.x = ROADS.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a)) + lane;
          car.mesh.rotation.y = car.direction > 0 ? 0 : Math.PI;
        }
      }
      car.mesh.position.set(car.x, 0, car.z);
      for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2;
    }
  }

  /** Nearest live traffic car to (x, z) within `maxDist`, or null. */
  function nearestTraffic(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of traffic) {
      if (!car.alive) continue;
      const dist = Math.hypot(car.x - x, car.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  /**
   * Carjack: pull the driver out of `car`, put the player in it. The stolen
   * car becomes the player car (new colour, old one despawns as traffic).
   * Returns the stolen car, or null when nothing is in reach.
   */
  function carjack(x, z, onWanted) {
    const car = nearestTraffic(x, z, 6);
    if (!car) return null;
    car.alive = false;
    car.mesh.visible = false;
    playerCar.x = car.x;
    playerCar.z = car.z;
    playerCar.angle = car.horizontal
      ? (car.direction > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.direction > 0 ? 0 : Math.PI);
    playerCar.speed = 0;
    playerCar.color = car.color;
    playerCar.mesh.children.forEach((child) => {
      if (child.material && child.material.color && child.geometry && child.geometry.type === 'BoxGeometry') {
        // recolour only the body box (the widest box in the group)
        if (child.geometry.parameters && child.geometry.parameters.width === 2.0) {
          child.material.color.set(car.color);
        }
      }
    });
    playerCar.mesh.position.set(playerCar.x, 0, playerCar.z);
    playerCar.mesh.rotation.y = playerCar.angle;
    if (onWanted) onWanted(WANTED.carjack);
    return car;
  }

  /** Garage price for the NEXT tier of `line`, or null when maxed out. */
  function upgradeCost(line) {
    const tier = playerCar.upgrades[line];
    if (tier >= GARAGE[line].costs.length) return null;
    return GARAGE[line].costs[tier];
  }

  /** Buy the next tier of `line` if `cash` covers it. Returns the new cash. */
  function buyUpgrade(line, cash) {
    const cost = upgradeCost(line);
    if (cost === null || cash < cost) return { ok: false, cash };
    playerCar.upgrades[line] += 1;
    return { ok: true, cash: cash - cost, tier: playerCar.upgrades[line] };
  }

  function respawnTraffic(car) {
    const fresh = spawnTrafficCar(car.index);
    traffic[car.index] = fresh;
  }

  /** How many traffic cars are still on the road (alive). */
  function aliveCount() {
    return traffic.filter((c) => c.alive).length;
  }

  return {
    group, playerCar, traffic,
    drivePlayer, stepTraffic, nearestTraffic, carjack,
    topSpeed, armorReduction, nitroMultiplier,
    upgradeCost, buyUpgrade, respawnTraffic, aliveCount,
  };
}
