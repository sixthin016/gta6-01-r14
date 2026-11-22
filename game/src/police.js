// Neon Bay 3D r14 — NBPD dispatch. A dynamic wanted system, 0–5 stars.
// Wanted rises with crimes and decays while the player stays clean. At 3+
// stars NBPD sets roadblocks on the roads ahead; at 4+ the HALO-1 helicopter
// joins the hunt with a visible searchlight cone. The dispatch board lists
// every active unit, roadblock and HALO-1 status for the HUD.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, POLICE } from './config.js';

const UNIT_NAMES = ['NBPD-07', 'NBPD-12', 'NBPD-19', 'NBPD-23', 'NBPD-31', 'NBPD-44'];

function buildPoliceCarMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.62, 4.4),
    new THREE.MeshStandardMaterial({ color: '#101018', roughness: 0.4, metalness: 0.5 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: '#14121f', roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 0.2, 4.42),
    new THREE.MeshStandardMaterial({ color: '#e8e8f0', roughness: 0.5 }),
  );
  stripe.position.y = 0.6;
  // Light bar: red and blue beacons that flash in the update loop.
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: '#22222e' }));
  barBase.position.set(0, 1.44, -0.2);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2a6bff });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), redMat);
  red.position.set(-0.32, 1.52, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), blueMat);
  blue.position.set(0.32, 1.52, -0.2);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  group.add(body, cabin, stripe, barBase, red, blue);
  return { group, redMat, blueMat };
}

function buildHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1c1c28', roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), bodyMat);
  body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 7), bodyMat);
  tail.position.set(0, 0.3, -6);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: '#9fd8ff', roughness: 0.1, metalness: 0.8 }),
  );
  glass.position.set(0, 0.2, 3.0);
  const rotorGeo = new THREE.BoxGeometry(11, 0.12, 0.7);
  const rotorMat = new THREE.MeshStandardMaterial({ color: '#33333f', roughness: 0.6 });
  const rotor = new THREE.Mesh(rotorGeo, rotorMat);
  rotor.position.y = 1.3;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.5), rotorMat);
  tailRotor.position.set(0.6, 0.4, -8.5);
  // Searchlight housing under the nose.
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  lamp.position.set(0, -0.9, 2.6);
  const spot = new THREE.SpotLight(0xfff2c0, 900, 120, 0.28, 0.45, 1.2);
  spot.position.set(0, -0.9, 2.6);
  group.add(body, tail, glass, rotor, tailRotor, lamp, spot);
  return { group, rotor, tailRotor, spot, lamp };
}

export function createPolice(scene, fx) {
  const group = new THREE.Group();
  group.name = 'NBPD';
  scene.add(group);

  let wanted = 0; // float; the HUD shows ceil() as stars
  const units = [];
  const roadblocks = [];
  const heli = {
    active: false,
    angle: 0,
    x: 0, z: 0, y: POLICE.heliHeight,
    mesh: null, rotor: null, spot: null,
  };
  const heliBuilt = buildHeliMesh();
  heli.mesh = heliBuilt.group;
  heli.rotor = heliBuilt.rotor;
  heli.tailRotor = heliBuilt.tailRotor;
  heli.spot = heliBuilt.spot;
  heli.mesh.visible = false;
  group.add(heli.mesh);

  function stars() {
    return Math.max(0, Math.min(5, Math.ceil(wanted - 0.001)));
  }

  function addWanted(amount) {
    wanted = Math.min(5, wanted + amount);
  }

  function spawnUnit(index) {
    const { group: mesh, redMat, blueMat } = buildPoliceCarMesh();
    const angle = (index / POLICE.maxUnits) * Math.PI * 2;
    const unit = {
      name: UNIT_NAMES[index % UNIT_NAMES.length],
      mesh, redMat, blueMat,
      x: Math.cos(angle) * 120, z: Math.sin(angle) * 120,
      angle: 0, speed: 0,
      status: 'RESPONDING',
      flashPhase: Math.random() * Math.PI * 2,
    };
    mesh.position.set(unit.x, 0, unit.z);
    group.add(mesh);
    return unit;
  }

  function spawnRoadblock(x, z, angle) {
    const block = new THREE.Group();
    const barrierMat = new THREE.MeshStandardMaterial({ color: '#e8e8f0', roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#ff2a2a', roughness: 0.6 });
    for (let i = -1; i <= 1; i += 1) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), i % 2 === 0 ? barrierMat : stripeMat);
      barrier.position.set(i * 3.6, 0.85, 0);
      barrier.castShadow = true;
      block.add(barrier);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.5), barrierMat);
      leg.position.set(i * 3.6, 0.3, 0);
      block.add(leg);
    }
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6b2e', roughness: 0.8 });
    for (const cx of [-6, 6]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 10), coneMat);
      cone.position.set(cx, 0.55, 2.5);
      block.add(cone);
    }
    block.position.set(x, 0, z);
    block.rotation.y = angle;
    group.add(block);
    const entry = { x, z, angle, mesh: block, id: `RB-${roadblocks.length + 1}` };
    roadblocks.push(entry);
    return entry;
  }

  function clearRoadblocks() {
    for (const rb of roadblocks) group.remove(rb.mesh);
    roadblocks.length = 0;
  }

  function step(dt, playerX, playerZ, playerSpeed, time) {
    // Decay while clean; a hot pursuit keeps the heat.
    if (wanted > 0) wanted = Math.max(0, wanted - 0.045 * dt);
    const target = stars();
    // NBPD units: one per wanted star (plus one), capped at six.
    const wantUnits = target === 0 ? 0 : Math.min(POLICE.maxUnits, target + 1);
    while (units.length < wantUnits) units.push(spawnUnit(units.length));
    while (units.length > wantUnits) {
      const unit = units.pop();
      group.remove(unit.mesh);
    }
    // Chase: steer toward the player, faster than traffic, slower than a
    // fully upgraded ride so escape stays possible.
    for (const unit of units) {
      const dx = playerX - unit.x;
      const dz = playerZ - unit.z;
      const dist = Math.hypot(dx, dz) || 1;
      const desired = Math.atan2(dx, dz);
      let diff = desired - unit.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      unit.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const cruise = dist > 26 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.72;
      unit.speed += (cruise - unit.speed) * Math.min(1, dt * 1.5);
      unit.x += Math.sin(unit.angle) * unit.speed * dt;
      unit.z += Math.cos(unit.angle) * unit.speed * dt;
      unit.mesh.position.set(unit.x, 0, unit.z);
      unit.mesh.rotation.y = unit.angle;
      unit.status = dist < 14 ? 'ON SCENE' : dist < 60 ? 'PURSUIT' : 'RESPONDING';
      // Flashing light bar, alternating red/blue.
      const phase = Math.sin(time * 9 + unit.flashPhase) > 0;
      unit.redMat.color.set(phase ? 0xff2a2a : 0x550000);
      unit.blueMat.color.set(phase ? 0x000055 : 0x2a6bff);
      // A unit that rams the player at speed costs health (handled by main).
      unit.dist = dist;
    }
    // Roadblocks at 3+ stars: two barriers on the roads ahead of the player.
    if (target >= POLICE.roadblockAt && roadblocks.length === 0) {
      const roads = [-180, -90, 0, 90, 180];
      const nearRoad = roads.reduce((a, b) => (Math.abs(b - playerX) < Math.abs(a - playerX) ? b : a));
      spawnRoadblock(nearRoad, playerZ - 70, 0);
      spawnRoadblock(nearRoad + 90 > 180 ? nearRoad - 90 : nearRoad + 90, playerZ + 60, Math.PI / 2);
    }
    if (target < POLICE.roadblockAt && roadblocks.length > 0) clearRoadblocks();
    // HALO-1 at 4+ stars: orbit the player, searchlight pinned on them.
    if (target >= POLICE.heliAt) {
      if (!heli.active) {
        heli.active = true;
        heli.mesh.visible = true;
      }
      heli.angle += dt * 0.45;
      heli.x = playerX + Math.cos(heli.angle) * POLICE.heliOrbit;
      heli.z = playerZ + Math.sin(heli.angle) * POLICE.heliOrbit;
      heli.mesh.position.set(heli.x, heli.y, heli.z);
      heli.mesh.rotation.y = Math.atan2(playerX - heli.x, playerZ - heli.z);
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.x += dt * 30;
      heli.spot.target.position.set(playerX, 0, playerZ);
      heli.spot.target.updateMatrixWorld();
      fx.setSearchlight(heli.x, heli.y, heli.z, playerX, playerZ, true);
    } else if (heli.active) {
      heli.active = false;
      heli.mesh.visible = false;
      fx.setSearchlight(0, 0, 0, 0, 0, false);
    }
  }

  function dispatchSummary() {
    return {
      wanted: stars(),
      units: units.map((u) => ({ name: u.name, status: u.status, dist: Math.round(u.dist ?? 0) })),
      roadblocks: roadblocks.map((rb) => rb.id),
      halo: heli.active ? 'HALO-1 AIRBORNE — SEARCHLIGHT ON TARGET' : 'HALO-1 STANDBY',
    };
  }

  /** True when any NBPD unit is close enough to ram the player this frame. */
  function rammingUnit() {
    for (const unit of units) {
      if (unit.dist !== undefined && unit.dist < 3.4 && unit.speed > 12) return unit;
    }
    return null;
  }

  function reset() {
    wanted = 0;
    while (units.length > 0) group.remove(units.pop().mesh);
    clearRoadblocks();
    heli.active = false;
    heli.mesh.visible = false;
    fx.setSearchlight(0, 0, 0, 0, 0, false);
  }

  return {
    group, units, roadblocks, heli,
    stars, addWanted, step, dispatchSummary, rammingUnit, reset,
    get wanted() {
      return wanted;
    },
    set wanted(value) {
      wanted = Math.max(0, Math.min(5, value));
    },
  };
}
