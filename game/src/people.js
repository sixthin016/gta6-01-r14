// Neon Bay 3D r14 — pedestrians. Thirty-four walkers on the sidewalks and the
// beach, each a simple low-poly figure (body capsule, head, legs that swing)
// with a seeded shirt colour and walking speed. They wander, pause at
// crossings, and scatter when a shot goes off or a car comes too close.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, PED_COUNT } from './config.js';

const SHIRTS = ['#ff5ea8', '#ffd166', '#4ae3ff', '#5eff8a', '#ff8a5e', '#b78bff', '#f4f1ea', '#ff6b4a'];
const SKINS = ['#e8b48a', '#c98a5e', '#8a5a3a', '#f0c8a0', '#a06a42'];

export function createPeople(rng, world) {
  const group = new THREE.Group();
  group.name = 'Pedestrians';
  const peds = [];

  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.7, 3, 8);
  const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);

  function spawnPed(index) {
    // Start on a sidewalk: just off a road line, or on the beach sand.
    let x;
    let z;
    if (rng.chance(0.22)) {
      x = rng.range(-180, 180);
      z = rng.range(CITY.beachZ + 8, CITY.half - 12);
    } else {
      const road = [-180, -90, 0, 90, 180][rng.int(0, 4)];
      const along = rng.range(-200, 200);
      const off = (rng.chance(0.5) ? 1 : -1) * rng.range(9, 12);
      if (rng.chance(0.5)) {
        x = road + off;
        z = along;
      } else {
        x = along;
        z = road + off;
      }
    }
    const shirt = rng.pick(SHIRTS);
    const skin = rng.pick(SKINS);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
    body.position.y = 0.95;
    body.castShadow = true;
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
    head.position.y = 1.62;
    head.castShadow = true;
    const legL = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: '#23202e', roughness: 1 }));
    legL.position.set(-0.12, 0.28, 0);
    const legR = legL.clone();
    legR.position.x = 0.12;
    mesh.add(body, head, legL, legR);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    return {
      index, mesh, legL, legR,
      x, z,
      heading: rng.angle(),
      speed: rng.range(1.1, 2.4),
      turnTimer: rng.range(1, 5),
      pauseTimer: 0,
      panic: 0, // seconds of fleeing left
      alive: true,
      shirt,
    };
  }

  for (let i = 0; i < PED_COUNT; i += 1) peds.push(spawnPed(i));

  /** Flee from (x, z): every living ped within `radius` panics for a while. */
  function scatter(x, z, radius = 22) {
    for (const ped of peds) {
      if (!ped.alive) continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        ped.panic = 2.5 + Math.random() * 2;
        ped.heading = Math.atan2(dx, dz);
        ped.speed = 4.2;
      }
    }
  }

  function step(dt, playerX, playerZ) {
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (ped.panic > 0) {
        ped.panic -= dt;
        if (ped.panic <= 0) ped.speed = 1.1 + Math.random() * 1.3;
      } else {
        ped.turnTimer -= dt;
        if (ped.turnTimer <= 0) {
          ped.turnTimer = 2 + Math.random() * 5;
          if (Math.random() < 0.3) ped.pauseTimer = 0.8 + Math.random() * 2;
          else ped.heading += (Math.random() - 0.5) * 1.8;
        }
      }
      if (ped.pauseTimer > 0) {
        ped.pauseTimer -= dt;
      } else {
        const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
        const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
        // Keep walkers inside the city and off the buildings.
        if (Math.abs(nx) < CITY.half - 4 && Math.abs(nz) < CITY.half - 4) {
          const fixed = world.resolveCollision(nx, nz, 0.6);
          ped.x = fixed.x;
          ped.z = fixed.z;
        } else {
          ped.heading += Math.PI; // turn back at the city edge
        }
      }
      // A car barrelling at a ped makes them dive aside.
      const pdx = ped.x - playerX;
      const pdz = ped.z - playerZ;
      if (pdx * pdx + pdz * pdz < 9 && ped.panic <= 0) {
        ped.panic = 1.2;
        ped.heading = Math.atan2(pdx, pdz);
        ped.speed = 4.5;
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Legs swing while walking; arms stay simple. Panic makes the swing faster.
      const swingSpeed = ped.panic > 0 ? 160 : 90;
      const swing = ped.pauseTimer > 0 ? 0 : Math.sin(performance.now() / swingSpeed + ped.index) * 0.45;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
    }
  }

  /** Nearest living ped to (x, z) within `maxDist`, or null. */
  function nearest(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of peds) {
      if (!ped.alive) continue;
      const dist = Math.hypot(ped.x - x, ped.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = ped;
      }
    }
    return best;
  }

  function kill(ped) {
    ped.alive = false;
    ped.mesh.visible = false;
  }

  function count() {
    return peds.filter((p) => p.alive).length;
  }

  return { group, peds, step, scatter, nearest, kill, count };
}
