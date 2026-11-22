// Neon Bay 3D r14 — textures. The two photo assets (golden-hour sky and the
// art-deco shopfront strip) are JPEGs generated in-session by tools/gen_assets.py
// and loaded here; everything else is drawn procedurally onto canvases so the
// game never needs a network request at runtime.

import * as THREE from '../vendor/three.module.min.js';

const cache = new Map();

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function loadPhoto(path) {
  if (cache.has(path)) return cache.get(path);
  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(path, texture);
  return texture;
}

/** The golden-hour sky photograph, used on the sky dome and as scene background. */
export function skyTexture() {
  return loadPhoto('./assets/sky.jpg');
}

/** The art-deco shopfront strip, tiled across Neon Row storefronts. */
export function facadesTexture() {
  const texture = loadPhoto('./assets/facades.jpg');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Asphalt with a centre dash and edge wear, repeated along the roads. */
export function roadTexture() {
  if (cache.has('road')) return cache.get('road');
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3d3949';
    ctx.fillRect(0, 0, w, h);
    // speckle
    for (let i = 0; i < 900; i += 1) {
      const v = 34 + Math.random() * 26;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${(v + 8) | 0})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // centre dashes, gold like the setting sun
    ctx.fillStyle = '#e8c96a';
    ctx.fillRect(w / 2 - 3, 8, 6, 52);
    ctx.fillRect(w / 2 - 3, h - 60, 6, 52);
    // edge lines
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cache.set('road', texture);
  return texture;
}

/** Warm sand for Coral Beach, with a darker wet band at the waterline. */
export function sandTexture() {
  if (cache.has('sand')) return cache.get('sand');
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e0aa63');
    grad.addColorStop(0.7, '#d9a05b');
    grad.addColorStop(1, '#b57a42');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i += 1) {
      const v = 150 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v | 0},${(v * 0.72) | 0},${(v * 0.4) | 0},0.5)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cache.set('sand', texture);
  return texture;
}

/** Bay water: deep teal with slow light streaks. */
export function waterTexture() {
  if (cache.has('water')) return cache.get('water');
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1d5e7a');
    grad.addColorStop(0.5, '#1d4e6b');
    grad.addColorStop(1, '#173d55');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i += 1) {
      const y = Math.random() * h;
      const x = Math.random() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 24 + Math.random() * 50, y);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cache.set('water', texture);
  return texture;
}

/** A plain coloured roof with a lighter rim, for building tops. */
export function roofTexture(color) {
  const key = `roof:${color}`;
  if (cache.has(key)) return cache.get(key);
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
  });
  cache.set(key, texture);
  return texture;
}

/** A glowing neon sign strip: coloured background, bright text, dark border. */
export function signTexture(text, color) {
  const key = `sign:${text}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const texture = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0d0a1e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = color;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 2);
  });
  cache.set(key, texture);
  return texture;
}

/** A palm-tree silhouette strip for Coral Beach: dark palms on a sunset band.
 * Drawn once and reused as a cheap billboard texture on the beachfront. */
export function palmTexture() {
  const key = 'palm';
  if (cache.has(key)) return cache.get(key);
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff9e5e');
    grad.addColorStop(1, '#7a2e6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1c0f2e';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const px of [52, 128, 204]) {
      ctx.beginPath();
      ctx.moveTo(px, h);
      ctx.quadraticCurveTo(px + 14, h * 0.55, px - 6, h * 0.34);
      ctx.stroke();
      for (let f = 0; f < 6; f += 1) {
        const a = -Math.PI * (0.15 + f * 0.14);
        ctx.beginPath();
        ctx.moveTo(px - 6, h * 0.34);
        ctx.quadraticCurveTo(
          px - 6 + Math.cos(a) * 42, h * 0.34 + Math.sin(a) * 26,
          px - 6 + Math.cos(a) * 62, h * 0.34 + Math.sin(a) * 52,
        );
        ctx.stroke();
      }
    }
  });
  cache.set(key, texture);
  return texture;
}

/** Load every photo texture up front; returns a promise that resolves when
 * the JPEGs have arrived (or failed — the game still boots on a fallback). */
export function preloadPhotos() {
  return Promise.all([
    new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = './assets/sky.jpg';
    }),
    new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = './assets/facades.jpg';
    }),
  ]);
}
