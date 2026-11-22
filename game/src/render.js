// Neon Bay 3D r14 — rendering. The Three.js renderer, the chase camera and
// the per-frame scene update: camera follows behind the player (farther and
// higher while driving), the player figure walks or the car rolls, traffic and
// pedestrians are already moved by their own modules — this file only puts
// the camera where it belongs and draws the frame.

import * as THREE from '../vendor/three.module.min.js';
import { CAMERA } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // The player on foot: a simple figure (body, head, legs) that leans into
  // motion. The car is its own mesh in vehicles.js; this figure is only
  // visible while walking.
  const figure = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.75, 3, 8),
    new THREE.MeshStandardMaterial({ color: '#ff5ea8', roughness: 0.85 }),
  );
  body.position.y = 1.0;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#e8b48a', roughness: 0.8 }),
  );
  head.position.y = 1.68;
  head.castShadow = true;
  const legGeo = new THREE.BoxGeometry(0.17, 0.6, 0.17);
  const legMat = new THREE.MeshStandardMaterial({ color: '#23202e', roughness: 1 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.13, 0.3, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.13, 0.3, 0);
  figure.add(body, head, legL, legR);
  scene.add(figure);

  // Camera smoothing: the rig chases a target position instead of snapping.
  const camPos = new THREE.Vector3(0, 10, -20);
  const camTarget = new THREE.Vector3(0, 1, 0);
  let walkPhase = 0;

  /**
   * One frame: place the player figure, swing the camera behind the player,
   * and render. `state` carries x, z, angle, speed, onFoot and a time value.
   */
  function draw(state, time) {
    const dist = state.onFoot ? CAMERA.walkDistance : CAMERA.driveDistance;
    const height = state.onFoot ? CAMERA.walkHeight : CAMERA.driveHeight;
    const fx = Math.sin(state.angle);
    const fz = Math.cos(state.angle);
    // Figure: visible on foot, hidden in the car; legs swing with speed.
    figure.visible = state.onFoot;
    if (state.onFoot) {
      figure.position.set(state.x, 0, state.z);
      figure.rotation.y = state.angle;
      walkPhase += Math.abs(state.speed) * 0.09;
      const swing = Math.min(0.5, Math.abs(state.speed) * 0.07) * Math.sin(walkPhase * 6);
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      body.rotation.x = Math.min(0.18, Math.abs(state.speed) * 0.015);
    }
    const desiredPos = new THREE.Vector3(
      state.x - fx * dist,
      height,
      state.z - fz * dist,
    );
    const desiredTarget = new THREE.Vector3(
      state.x + fx * CAMERA.lookAhead,
      1.2,
      state.z + fz * CAMERA.lookAhead,
    );
    // Fixed-step smoothing: the same lerp factor every frame at 60 Hz.
    const k = 1 - Math.exp(-6 * (1 / 60));
    camPos.lerp(desiredPos, k);
    camTarget.lerp(desiredTarget, k);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }

  /** Snap the camera to the player immediately (used when staging shots). */
  function snap(state) {
    const dist = state.onFoot ? CAMERA.walkDistance : CAMERA.driveDistance;
    const height = state.onFoot ? CAMERA.walkHeight : CAMERA.driveHeight;
    const fx = Math.sin(state.angle);
    const fz = Math.cos(state.angle);
    camPos.set(state.x - fx * dist, height, state.z - fz * dist);
    camTarget.set(state.x + fx * CAMERA.lookAhead, 1.2, state.z + fz * CAMERA.lookAhead);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  function dispose() {
    renderer.dispose();
  }

  return { renderer, scene, camera, figure, draw, snap, dispose };
}
