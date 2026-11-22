// Neon Bay 3D r14 — effects. Short-lived particles (muzzle sparks, smoke,
// explosion fireballs, cash sparkles), the golden mission beacon column, and
// the HALO-1 searchlight cone. Everything is pooled and recycled; nothing
// allocates per frame while the game runs.

import * as THREE from '../vendor/three.module.min.js';

const MAX_PARTICLES = 240;

export function createFx(scene) {
  const group = new THREE.Group();
  group.name = 'Effects';
  scene.add(group);

  const particles = [];
  const geo = new THREE.SphereGeometry(0.16, 6, 5);
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    particles.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 0, size: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, color, count, speed, life, gravity, size = 1) {
    for (let i = 0; i < count; i += 1) {
      const p = particles[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.set(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * Math.cos(b) * s;
      p.vy = Math.sin(b) * s + speed * 0.3;
      p.vz = Math.sin(a) * Math.cos(b) * s;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.maxLife = p.life;
      p.gravity = gravity;
      p.size = size;
    }
  }

  function muzzle(x, y, z, direction) {
    spawn(x, y, z, '#ffd166', 6, 6, 0.18, 0, 1.4);
    spawn(x + Math.sin(direction) * 0.8, y, z + Math.cos(direction) * 0.8, '#ff8a3c', 4, 9, 0.14, 0, 1);
  }

  function explosion(x, y, z) {
    spawn(x, y + 0.5, z, '#ff6b2e', 26, 12, 0.8, -6, 2.6);
    spawn(x, y + 1, z, '#ffd166', 18, 9, 0.6, -4, 2);
    spawn(x, y + 2, z, '#5a5a6e', 16, 5, 1.6, 3, 2.2);
  }

  function smoke(x, y, z, count = 8) {
    spawn(x, y, z, '#8a8a9a', count, 1.5, 1.4, 2.5, 1.8);
  }

  function cashBurst(x, y, z) {
    spawn(x, y + 1, z, '#7dff9a', 14, 4, 0.9, -3, 1.1);
    spawn(x, y + 1, z, '#ffd166', 10, 3, 1.1, -2, 1.1);
  }

  /** A quick puff of dust where tyres scuff, for hard turns and landings. */
  function dust(x, y, z) {
    spawn(x, y + 0.2, z, '#b9a98a', 5, 2, 0.7, -1, 1.5);
  }

  function step(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = p.life / p.maxLife;
      p.mesh.scale.setScalar(p.size * (0.6 + 0.4 * (p.life / p.maxLife)));
    }
  }

  // The mission beacon: a tall golden column of light marking the objective.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 90, 12, 1, true), beaconMat);
  beacon.visible = false;
  group.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 4.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.visible = false;
  group.add(beaconRing);

  function setBeacon(x, z, visible) {
    beacon.visible = visible;
    beaconRing.visible = visible;
    if (visible) {
      beacon.position.set(x, 45, z);
      beaconRing.position.set(x, 0.15, z);
    }
  }

  function pulseBeacon(time) {
    if (!beacon.visible) return;
    beaconMat.opacity = 0.28 + Math.sin(time * 3) * 0.12;
    const s = 1 + Math.sin(time * 3) * 0.12;
    beaconRing.scale.set(s, s, 1);
  }

  // Searchlight cone for HALO-1: a translucent cone from the heli to the ground.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 44, 20, 1, true), coneMat);
  cone.visible = false;
  group.add(cone);

  function setSearchlight(fromX, fromY, fromZ, toX, toZ, visible) {
    cone.visible = visible;
    if (!visible) return;
    cone.position.set((fromX + toX) / 2, (fromY + 0) / 2, (fromZ + toZ) / 2);
    cone.lookAt(toX, 0, toZ);
    cone.rotateX(Math.PI / 2);
  }

  return { group, muzzle, explosion, smoke, cashBurst, dust, step, setBeacon, pulseBeacon, setSearchlight };
}
