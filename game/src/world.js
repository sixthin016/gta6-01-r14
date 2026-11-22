// Neon Bay 3D r14 — the city. One road loop with five named districts, built
// procedurally from a seed: ground planes, the bay, a sky dome wearing the
// golden-hour photograph, and every building as a box with a collision AABB.
// Neon Row storefronts wear the generated facades photograph; other blocks get
// coloured concrete and neon sign boards.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, DISTRICTS, PALETTE } from './config.js';
import { facadesTexture, palmTexture, roadTexture, roofTexture, sandTexture, signTexture, skyTexture, waterTexture } from './textures.js';

const ROADS = [-180, -90, 0, 90, 180];
const BUILDING_COLORS = ['#5a5478', '#6b5578', '#4a5a78', '#785a6e', '#5a6a7a', '#7a5a5e'];
const SIGN_WORDS = [
  ['PALMS', '#ff5ea8'], ['TIKI', '#ffd166'], ['GELATO', '#4ae3ff'], ['HOTEL', '#ff8a5e'],
  ['CASINO', '#b78bff'], ['DINER', '#5eff8a'], ['PIER 9', '#5ec8ff'], ['SUNSET', '#ff9e5e'],
];

export function createWorld(seedRandom) {
  const buildings = []; // {x, z, hw, hd, height, mesh}
  const colliders = []; // {x0, z0, x1, z1} AABBs, for cars and feet
  const group = new THREE.Group();
  group.name = 'Neon Bay';

  function addCollider(x, z, hw, hd) {
    colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
  }

  function buildGround(scene) {
    // Base ground: dark city floor.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads: long dark strips with the dashed texture, avenues and streets.
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95 });
    roadMat.map.repeat.set(1, 26);
    for (const x of ROADS) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.half * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.02, 0);
      road.receiveShadow = true;
      scene.add(road);
    }
    for (const z of ROADS) {
      const streetMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95 });
      streetMat.map = roadTexture().clone();
      streetMat.map.needsUpdate = true;
      streetMat.map.repeat.set(26, 1);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.roadWidth), streetMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.02, z);
      road.receiveShadow = true;
      scene.add(road);
    }

    // Coral Beach sand, south of the beach line.
    const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 });
    sandMat.map.repeat.set(6, 2);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.half - CITY.beachZ), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, (CITY.beachZ + CITY.half) / 2);
    sand.receiveShadow = true;
    scene.add(sand);

    // The bay: water plane past the sand, catching the sunset.
    const waterMat = new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.35, metalness: 0.25 });
    waterMat.map.repeat.set(8, 3);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 200, 260), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, CITY.waterZ + 120);
    scene.add(water);

    // Boardwalk edge between sand and city.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(CITY.half * 2, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1 }),
    );
    walk.position.set(0, 0.25, CITY.beachZ);
    scene.add(walk);
  }

  function buildSky(scene) {
    // Sky dome: a big sphere wearing the golden-hour photograph, inside-out.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 18),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
    );
    sky.position.set(0, 0, 0);
    scene.add(sky);
    scene.fog = new THREE.Fog(PALETTE.fog, 220, 820);
  }

  function buildLights(scene) {
    // Low golden sun from the west, long shadows; warm ambient fill. The sun
    // sits high enough that the roads stay readable in screenshots.
    const sun = new THREE.DirectionalLight(0xffb36b, 3.4);
    sun.position.set(-260, 190, 180);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 900;
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xff9a5e, 0x2a1e4a, 1.5);
    scene.add(hemi);
    return sun;
  }

  function districtOf(x, z) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
    }
    return DISTRICTS[2];
  }

  function buildBuildings(scene) {
    const facadeMat = new THREE.MeshStandardMaterial({ map: facadesTexture(), roughness: 0.8 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    let signIndex = 0;
    for (const bx of CITY.blockCenters) {
      for (const bz of CITY.blockCenters) {
        if (bz >= CITY.beachZ) continue; // beach blocks stay open
        const district = districtOf(bx, bz);
        const count = 1 + Math.floor(seedRandom() * 3); // 1-3 buildings per block
        for (let i = 0; i < count; i += 1) {
          const w = 16 + seedRandom() * 14;
          const d = 16 + seedRandom() * 14;
          const h = 10 + seedRandom() * (district.name === 'Neon Row' ? 26 : 40);
          const ox = (seedRandom() - 0.5) * (CITY.roadSpacing - CITY.roadWidth - w - 6);
          const oz = (seedRandom() - 0.5) * (CITY.roadSpacing - CITY.roadWidth - d - 6);
          const x = bx + ox;
          const z = bz + oz;
          const isFacade = district.name === 'Neon Row' && seedRandom() < 0.55;
          const color = BUILDING_COLORS[Math.floor(seedRandom() * BUILDING_COLORS.length)];
          const mat = isFacade
            ? facadeMat
            : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.scale.set(w, h, d);
          mesh.position.set(x, h / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          buildings.push({ x, z, hw: w / 2, hd: d / 2, height: h, mesh });
          addCollider(x, z, w / 2 + 0.4, d / 2 + 0.4);
          // Roof cap so the top is not a stretched wall texture.
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4),
            new THREE.MeshStandardMaterial({ map: roofTexture(color), roughness: 1 }),
          );
          roof.position.set(x, h + 0.3, z);
          scene.add(roof);
          // Neon sign board on tall Neon Row buildings.
          if (district.name === 'Neon Row' && h > 22) {
            const [word, signColor] = SIGN_WORDS[signIndex % SIGN_WORDS.length];
            signIndex += 1;
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(Math.min(22, w * 0.8), 5.5),
              new THREE.MeshBasicMaterial({ map: signTexture(word, signColor), transparent: false }),
            );
            sign.position.set(x, h - 4, z + d / 2 + 0.15);
            scene.add(sign);
          }
        }
      }
    }
    // Harbor cranes: two tall frames at the docks, silhouetted against the sun.
    for (const cx of [150, 205]) {
      const crane = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: '#c96a2e', roughness: 0.7, metalness: 0.4 });
      for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 46, 1.4), legMat);
        leg.position.set(lx, 23, lz);
        crane.add(leg);
      }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 2), legMat);
      arm.position.set(8, 44, 0);
      crane.add(arm);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), legMat);
      cab.position.set(0, 40, 0);
      crane.add(cab);
      crane.position.set(cx, 0, -100);
      scene.add(crane);
      addCollider(cx, -100, 5, 5);
    }
    // Palm billboards along the beachfront: flat sunset cards that read as
    // palm silhouettes from the road.
    const palmMat = new THREE.MeshBasicMaterial({ map: palmTexture(), transparent: false });
    for (const px of [-170, -90, -10, 70, 150]) {
      const palm = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), palmMat);
      palm.position.set(px, 9, CITY.beachZ - 6);
      scene.add(palm);
    }
  }

  function build(scene) {
    buildGround(scene);
    buildSky(scene);
    const sun = buildLights(scene);
    buildBuildings(scene);
    return { sun };
  }

  /** Push a circle (x, z, radius) out of every building AABB it overlaps. */
  function resolveCollision(x, z, radius) {
    let px = x;
    let pz = z;
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(px, c.x1));
      const nz = Math.max(c.z0, Math.min(pz, c.z1));
      const dx = px - nx;
      const dz = pz - nz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        px = nx + (dx / dist) * radius;
        pz = nz + (dz / dist) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushLeft = px - c.x0;
        const pushRight = c.x1 - px;
        const pushUp = pz - c.z0;
        const pushDown = c.z1 - pz;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) px = c.x0 - radius;
        else if (min === pushRight) px = c.x1 + radius;
        else if (min === pushUp) pz = c.z0 - radius;
        else pz = c.z1 + radius;
      }
    }
    return { x: px, z: pz };
  }

  function randomStreetPoint() {
    const road = ROADS[Math.floor(seedRandom() * ROADS.length)];
    const along = (seedRandom() - 0.5) * (CITY.half * 2 - 40);
    return seedRandom() < 0.5 ? { x: road, z: along } : { x: along, z: road };
  }

  return { group, buildings, colliders, build, resolveCollision, randomStreetPoint, districtOf };
}
