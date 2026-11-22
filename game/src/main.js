// Neon Bay 3D r14 — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city layout. ?shot=cover|carjack|start|chase (with
// &seed=N) stages that scene instead of running the loop, paints it several
// times and sets window.__shotReady for a screenshot.

import {
  ACTION_CARJACK, ACTION_CONFIRM, ACTION_FIRE, ACTION_GARAGE, ACTION_MISSION,
  ACTION_PAUSE, ACTION_PHOTO, ACTION_RADIO, ACTION_SAVE, ACTION_WHEEL,
  createInput,
} from './input.js';
import { createRandom } from './random.js';
import { createRng } from './rng.js';
import { createWorld } from './world.js';
import { createRender } from './render.js';
import { createPeople } from './people.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createRadio } from './radio.js';
import { createAudio } from './audio.js';
import { createSaves } from './saves.js';
import { createPhotomode } from './photomode.js';
import { createHud } from './hud.js';
import { createFx } from './fx.js';
import { preloadPhotos } from './textures.js';
import { stageShot } from './shots.js';
import {
  BEST_KEY, CITY, GARAGE, GOLDEN_HOUR, HURRICANE, PLAYER, STEP, WANTED,
} from './config.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

// Capture diagnostics: any uncaught error or failed resource is recorded
// where the screenshot tool can read it, instead of failing silently.
window.__shotErrors = [];
window.addEventListener('error', (event) => {
  window.__shotErrors.push(String(event.message ?? event.error ?? 'unknown error'));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__shotErrors.push(`unhandled rejection: ${String(event.reason ?? 'unknown')}`);
});

// ---- world assembly -------------------------------------------------------
const rng = createRng(seed);
const world = createWorld(createRandom(seed));
const render = createRender(canvas);
const built = world.build(render.scene);
const fx = createFx(render.scene);
const people = createPeople(rng, world);
const vehicles = createVehicles(rng, world, fx);
const police = createPolice(render.scene, fx);
const missions = createMissions(fx);
const combat = createCombat(fx, people, vehicles, police);
const radio = createRadio();
const audio = createAudio();
const saves = createSaves();
const hud = createHud();
const photomode = createPhotomode(canvas, hud.els.hud);
render.scene.add(people.group);
render.scene.add(vehicles.group);

// ---- game state ------------------------------------------------------------
const G = {
  screen: 'title',
  time: 0,
  clockMinutes: GOLDEN_HOUR.hour * 60 + GOLDEN_HOUR.minute,
  hurricaneSeconds: HURRICANE.landfallInSeconds,
  cash: PLAYER.startCash,
  health: PLAYER.health,
  respect: 0,
  onFoot: true,
  x: PLAYER.startX,
  z: PLAYER.startZ,
  angle: 0,
  speed: 0,
  garageOpen: false,
  ramCooldown: 0,
  best: 0,
};

try {
  G.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  G.best = 0;
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.max(G.best, G.cash)));
  } catch {
    // Storage can be off: the best cash then lasts this visit only.
  }
}

function announce(message) {
  status.textContent = message;
}

function addWanted(amount) {
  police.addWanted(amount);
}

function snapshot() {
  const active = missions.active();
  const dispatch = police.dispatchSummary();
  return {
    cash: G.cash,
    wanted: police.stars(),
    clockMinutes: G.clockMinutes,
    health: G.health,
    respect: G.respect,
    rank: missions.rank().name,
    radioLabel: radio.label(),
    missionName: active ? `${active.id}. ${active.name} — ${active.district}` : 'All 10 jobs complete — Neon Legend',
    missionDist: missions.distanceToTarget(G.x, G.z),
    district: world.districtOf(G.x, G.z).name,
    hurricaneName: HURRICANE.name,
    hurricaneSeconds: G.hurricaneSeconds,
    speed: G.onFoot ? G.speed : vehicles.playerCar.speed,
    inCar: !G.onFoot,
    beacon: active ? { x: active.x, z: active.z } : null,
    policeUnits: police.units,
    heli: police.heli.active ? { x: police.heli.x, z: police.heli.z } : null,
    dispatchUnits: dispatch.units,
    dispatchBlocks: dispatch.roadblocks,
    dispatchHalo: dispatch.halo,
    forceDispatch: shot === 'chase',
    playerX: G.x,
    playerZ: G.z,
    playerAngle: G.angle,
  };
}

function refreshBeacon() {
  const active = missions.active();
  fx.setBeacon(active ? active.x : 0, active ? active.z : 0, Boolean(active));
}

// ---- saves -----------------------------------------------------------------
function saveData() {
  return {
    cash: G.cash,
    respect: G.respect,
    rank: missions.rank().name,
    district: world.districtOf(G.x, G.z).name,
    missions: missions.serialize(),
    garage: { ...vehicles.playerCar.upgrades },
    x: G.x, z: G.z, angle: G.angle, inCar: !G.onFoot,
    health: G.health,
    clockMinutes: G.clockMinutes,
    hurricaneSeconds: G.hurricaneSeconds,
    weaponIndex: combat.state.weaponIndex,
  };
}

function applySave(data) {
  G.cash = data.cash ?? PLAYER.startCash;
  G.respect = data.respect ?? 0;
  G.health = data.health ?? PLAYER.health;
  G.clockMinutes = data.clockMinutes ?? GOLDEN_HOUR.hour * 60 + GOLDEN_HOUR.minute;
  G.hurricaneSeconds = data.hurricaneSeconds ?? HURRICANE.landfallInSeconds;
  missions.restore(data.missions);
  if (data.garage) vehicles.playerCar.upgrades = { ...vehicles.playerCar.upgrades, ...data.garage };
  if (typeof data.weaponIndex === 'number') combat.select(data.weaponIndex);
  G.onFoot = !data.inCar;
  G.x = data.x ?? PLAYER.startX;
  G.z = data.z ?? PLAYER.startZ;
  G.angle = data.angle ?? 0;
  const car = vehicles.playerCar;
  car.x = G.x;
  car.z = G.z;
  car.angle = G.angle;
  car.speed = 0;
  car.mesh.position.set(G.x, 0, G.z);
  car.mesh.rotation.y = G.angle;
  police.reset();
  refreshBeacon();
}

function quickSave() {
  const slot = saves.getLastSlot();
  if (saves.save(slot, saveData())) {
    hud.toast(`Saved to slot ${slot} — ${hud.formatCash(G.cash)} · ${missions.progress().done}/10 missions`);
    audio.cash();
  } else {
    hud.toast('Save failed — storage unavailable in this browser');
  }
}

function loadSlot(slot) {
  const data = saves.load(slot);
  if (!data) {
    hud.toast(`Slot ${slot} is empty`);
    return false;
  }
  applySave(data);
  G.screen = 'play';
  hud.hideStart();
  hud.toast(`Loaded slot ${slot} — welcome back to Neon Bay`);
  announce('Playing. Save loaded.');
  return true;
}

function startNewGame() {
  missions.reset();
  police.reset();
  G.cash = PLAYER.startCash;
  G.health = PLAYER.health;
  G.respect = 0;
  G.clockMinutes = GOLDEN_HOUR.hour * 60 + GOLDEN_HOUR.minute;
  G.hurricaneSeconds = HURRICANE.landfallInSeconds;
  G.onFoot = true;
  G.x = PLAYER.startX;
  G.z = PLAYER.startZ;
  G.angle = 0;
  G.speed = 0;
  vehicles.playerCar.upgrades = { engine: 0, armor: 0, nitro: 0 };
  vehicles.playerCar.x = G.x;
  vehicles.playerCar.z = G.z + 6;
  vehicles.playerCar.angle = 0;
  vehicles.playerCar.speed = 0;
  vehicles.playerCar.mesh.position.set(vehicles.playerCar.x, 0, vehicles.playerCar.z);
  combat.select(0);
  combat.closeWheel();
  hud.hideWheel();
  hud.hideGarage();
  G.garageOpen = false;
  refreshBeacon();
  G.screen = 'play';
  hud.hideStart();
  announce('Playing. Neon Bay, golden hour. First job: Dockside Pickup at Pier 9.');
  hud.toast('Mission 1 — Dockside Pickup: follow the gold beacon to Pier 9');
  audio.unlock();
  radio.start();
}

// ---- the fixed-step simulation --------------------------------------------
function stepSim(dt, simInput) {
  G.time += dt;
  const input = simInput ?? liveInput;
  const throttle = input.throttle();
  const steer = input.steer();
  const nitro = input.nitro();

  // Clock and the hurricane countdown only advance while playing.
  if (G.screen === 'play') {
    G.clockMinutes += dt / 20;
    G.hurricaneSeconds = Math.max(0, G.hurricaneSeconds - dt);
  }

  if (G.onFoot) {
    G.angle += steer * 2.6 * dt;
    const move = throttle * PLAYER.walkSpeed;
    G.speed = move;
    const nx = G.x + Math.sin(G.angle) * move * dt;
    const nz = G.z + Math.cos(G.angle) * move * dt;
    const fixed = world.resolveCollision(nx, nz, PLAYER.radius);
    G.x = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, fixed.x));
    G.z = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, fixed.z));
  } else {
    vehicles.drivePlayer(dt, throttle, steer, nitro);
    const car = vehicles.playerCar;
    G.x = car.x;
    G.z = car.z;
    G.angle = car.angle;
    G.speed = car.speed;
  }

  vehicles.stepTraffic(dt);
  people.step(dt, G.x, G.z);
  police.step(dt, G.x, G.z, Math.abs(G.speed), G.time);
  combat.step(dt);
  fx.step(dt);
  fx.pulseBeacon(G.time);

  // Mission arrival pays out and advances the story.
  if (G.screen === 'play') {
    const done = missions.checkArrival(G.x, G.z, (m, next) => {
      G.cash += m.payout;
      G.respect += m.respect;
      saveBest();
      audio.cash();
      hud.toast(`JOB DONE — ${m.name}: +${hud.formatCash(m.payout)} · +${m.respect} REP${next ? ` · Next: ${next.name}` : ' · ALL 10 JOBS COMPLETE'}`);
      announce(`Mission complete: ${m.name}. Earned ${m.payout} dollars.`);
    });
    if (done) refreshBeacon();
  }

  // A ramming NBPD unit costs health (armor softens it).
  if (G.ramCooldown > 0) G.ramCooldown -= dt;
  const ram = police.rammingUnit();
  if (ram && G.ramCooldown <= 0 && G.screen === 'play') {
    G.ramCooldown = 1.2;
    const damage = Math.round(12 * (1 - vehicles.armorReduction()));
    G.health = Math.max(0, G.health - damage);
    audio.thud();
    hud.toast(`NBPD rammed you — -${damage} HP`);
    if (G.health <= 0) endGame();
  }

  // Audio follows the world.
  audio.setEngine(G.onFoot ? 0 : Math.abs(G.speed) / vehicles.topSpeed(), G.onFoot);
  audio.siren(police.stars() > 0);
}

function endGame() {
  G.screen = 'over';
  saveBest();
  const over = document.getElementById('game-over');
  if (over) {
    over.style.display = 'flex';
    const stats = document.getElementById('over-stats');
    if (stats) {
      stats.textContent = `${hud.formatCash(G.cash)} earned · ${missions.progress().done}/10 missions · ${missions.rank().name}`;
    }
  }
  announce(`Busted. ${missions.progress().done} of 10 missions done. Press Enter to try again.`);
}

// ---- actions ----------------------------------------------------------------
const liveInput = createInput(canvas);

function handleActions() {
  const actions = liveInput.takeActions();
  if (actions & ACTION_FIRE) {
    if (G.screen === 'play' && !combat.state.wheelOpen && !G.garageOpen) {
      const hit = combat.fire(G.x, G.z, G.angle, G.time, addWanted);
      audio.gunshot();
      if (hit) hud.toast(`${combat.weapon().key} hit — ${hit.kind} down`);
    }
    return;
  }
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    radio.start();
    if (G.screen === 'title') startNewGame();
    else if (G.screen === 'over') {
      const over = document.getElementById('game-over');
      if (over) over.style.display = 'none';
      startNewGame();
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      const paused = document.getElementById('paused-screen');
      if (paused) paused.style.display = 'none';
    }
  }
  if (actions & ACTION_PAUSE) {
    if (G.screen === 'play') {
      G.screen = 'paused';
      const paused = document.getElementById('paused-screen');
      if (paused) paused.style.display = 'flex';
      announce('Paused.');
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      const paused = document.getElementById('paused-screen');
      if (paused) paused.style.display = 'none';
      announce('Playing.');
    }
  }
  if (G.screen !== 'play') return;
  if (actions & ACTION_WHEEL) {
    const open = combat.toggleWheel();
    if (open) hud.showWheel(combat.state.weaponIndex);
    else hud.hideWheel();
    audio.click();
  }
  if (actions & ACTION_CARJACK) {
    if (G.onFoot) {
      const stolen = vehicles.carjack(G.x, G.z, addWanted);
      if (stolen) {
        G.onFoot = false;
        const car = vehicles.playerCar;
        G.x = car.x;
        G.z = car.z;
        G.angle = car.angle;
        G.speed = 0;
        hud.toast(`Carjacked a ${stolen.color} ride — NBPD notified (+${WANTED.carjack}★)`);
        audio.thud();
        people.scatter(G.x, G.z, 20);
      } else {
        hud.toast('No car in reach — get closer to traffic (E)');
      }
    } else {
      G.onFoot = true;
      vehicles.playerCar.speed = 0;
      G.x = vehicles.playerCar.x + 2.5;
      G.z = vehicles.playerCar.z;
      G.speed = 0;
      hud.toast('You are on foot — E near a car to jack it');
    }
  }
  if (actions & ACTION_RADIO) {
    const st = radio.nextStation();
    hud.toast(`📻 ${radio.label()}`);
    announce(`Radio: ${st.name}.`);
  }
  if (actions & ACTION_PHOTO) {
    const on = photomode.toggle();
    hud.toast(on ? 'PHOTOMODE — HUD hidden, golden-hour grade on' : 'Photomode off');
  }
  if (actions & ACTION_SAVE) quickSave();
  if (actions & ACTION_GARAGE) {
    G.garageOpen = !G.garageOpen;
    if (G.garageOpen) {
      hud.showGarage(G.cash, vehicles.playerCar.upgrades, {
        engine: vehicles.upgradeCost('engine'),
        armor: vehicles.upgradeCost('armor'),
        nitro: vehicles.upgradeCost('nitro'),
      });
    } else hud.hideGarage();
    audio.click();
  }
  if (actions & ACTION_MISSION) {
    const active = missions.active();
    if (active) hud.toast(`NEXT JOB — ${active.name} (${active.district}): ${active.brief}`);
  }
}

// Weapon number keys 1-4 while the wheel is open.
window.addEventListener('keydown', (event) => {
  if (G.screen !== 'play' || !combat.state.wheelOpen) return;
  const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
  if (index >= 0) {
    combat.select(index);
    hud.showWheel(index);
    audio.click();
  }
});

// Click wiring for the DOM panels (start slots, garage buys, wheel picks).
document.getElementById('start-screen')?.addEventListener('click', (event) => {
  const slotBtn = event.target.closest('[data-slot]');
  if (slotBtn) {
    const slot = Number(slotBtn.dataset.slot);
    if (!loadSlot(slot)) startNewGame();
    return;
  }
  if (event.target.closest('#btn-new-game')) startNewGame();
  if (event.target.closest('#btn-continue')) {
    if (!saves.hasAny()) startNewGame();
    else {
      const summaries = saves.summaries();
      const first = summaries.find((s) => !s.empty);
      if (first) loadSlot(first.slot);
    }
  }
});
document.getElementById('garage-panel')?.addEventListener('click', (event) => {
  const buy = event.target.closest('[data-line]');
  if (!buy) return;
  const line = buy.dataset.line;
  const result = vehicles.buyUpgrade(line, G.cash);
  if (result.ok) {
    G.cash = result.cash;
    audio.cash();
    hud.toast(`${GARAGE[line].label} upgraded to tier ${result.tier}`);
    hud.showGarage(G.cash, vehicles.playerCar.upgrades, {
      engine: vehicles.upgradeCost('engine'),
      armor: vehicles.upgradeCost('armor'),
      nitro: vehicles.upgradeCost('nitro'),
    });
  } else {
    audio.thud();
    hud.toast('Not enough cash for that upgrade — run more jobs');
  }
});
document.getElementById('weapon-wheel')?.addEventListener('click', (event) => {
  const item = event.target.closest('.wheel-item');
  if (!item) return;
  const index = Array.from(document.querySelectorAll('.wheel-item')).indexOf(item);
  if (index >= 0) {
    combat.select(index);
    combat.closeWheel();
    hud.hideWheel();
    hud.toast(`${combat.weapon().key} equipped`);
  }
});

// ---- the assembled game object (shared with shots.js) -----------------------
const game = {
  G, world, people, vehicles, police, missions, combat, radio, audio, saves,
  photomode, hud, fx, render, input: liveInput,
  stepSim,
  resetWorld() {
    missions.reset();
    police.reset();
    combat.closeWheel();
    G.garageOpen = false;
    G.cash = PLAYER.startCash;
    G.health = PLAYER.health;
    G.respect = 0;
    G.clockMinutes = GOLDEN_HOUR.hour * 60 + GOLDEN_HOUR.minute;
    G.hurricaneSeconds = HURRICANE.landfallInSeconds;
    G.onFoot = true;
    G.x = PLAYER.startX;
    G.z = PLAYER.startZ;
    G.angle = 0;
    G.speed = 0;
    refreshBeacon();
  },
};

window.__game = game;

// ---- run modes ---------------------------------------------------------------
function runShot(name) {
  preloadPhotos().then(() => {
    const screen = stageShot(name, game);
    G.screen = screen === 'title' ? 'title' : 'play';
    let painted = 0;
    function paint() {
      hud.update(snapshot());
      render.draw({ x: G.x, z: G.z, angle: G.angle, speed: G.speed, onFoot: G.onFoot }, G.time);
      painted += 1;
      if (painted < 3) requestAnimationFrame(paint);
      else {
        window.__shotReady = true;
        window.__shotName = name;
        window.__hudCheck = snapshot();
      }
    }
    requestAnimationFrame(paint);
  });
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  hud.showStart(
    saves.summaries(),
    missions.listAll(),
    vehicles.playerCar.upgrades,
    G.respect,
    missions.rank().name,
    G.best,
  );
  refreshBeacon();
  announce('Neon Bay 3D. Press Enter or click New Game to start.');

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      const paused = document.getElementById('paused-screen');
      if (paused) paused.style.display = 'flex';
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (G.screen === 'play' && !photomode.isActive()) {
      while (accumulator >= STEP) {
        stepSim(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (G.screen === 'title') {
        // Idle city life behind the start screen: traffic and pedestrians move.
        vehicles.stepTraffic(STEP);
        people.step(STEP, G.x, G.z);
        fx.step(STEP);
      }
    }
    hud.update(snapshot());
    render.draw({ x: G.x, z: G.z, angle: G.angle, speed: G.speed, onFoot: G.onFoot }, G.time);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
