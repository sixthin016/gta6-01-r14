// Neon Bay 3D r14 — keyboard and pointer input. Held keys steer and drive;
// one-shot presses (weapon wheel, carjack, radio, photomode, save, garage,
// pause, confirm) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_WHEEL = 4;
export const ACTION_CARJACK = 8;
export const ACTION_RADIO = 16;
export const ACTION_PHOTO = 32;
export const ACTION_SAVE = 64;
export const ACTION_GARAGE = 128;
export const ACTION_FIRE = 256;
export const ACTION_NITRO = 512;
export const ACTION_MISSION = 1024;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['Escape']); // Escape pauses; F is photomode (see below)
const WHEEL = new Set(['KeyQ']);
const CARJACK = new Set(['KeyE']);
const RADIO = new Set(['KeyR']);
const PHOTO = new Set(['KeyF', 'KeyP']); // F or P = photomode
const SAVE = new Set(['KeyC']); // C = quick save (S is reverse while driving)
const GARAGE = new Set(['KeyG']);
const NITRO = new Set(['ShiftLeft', 'ShiftRight']);
const MISSION = new Set(['KeyM', 'Tab']);

export function createInput(canvas) {
  let forward = false;
  let back = false;
  let left = false;
  let right = false;
  let nitro = false;
  let actions = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  function onKeyDown(event) {
    if (FORWARD.has(event.code)) forward = true;
    else if (BACK.has(event.code)) back = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (NITRO.has(event.code)) nitro = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (WHEEL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_WHEEL;
    } else if (CARJACK.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CARJACK;
    } else if (RADIO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RADIO;
    } else if (PHOTO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PHOTO;
    } else if (SAVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SAVE;
    } else if (GARAGE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GARAGE;
    } else if (MISSION.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION;
    } else return;
    // Space scrolls the page and Tab moves focus: both must stay in the game.
    if (event.code === 'Space' || event.code === 'Tab') event.preventDefault();
  }

  function onKeyUp(event) {
    if (FORWARD.has(event.code)) forward = false;
    else if (BACK.has(event.code)) back = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (NITRO.has(event.code)) nitro = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    forward = back = left = right = nitro = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    actions |= ACTION_FIRE;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  });

  return {
    /** -1/0/1 throttle: forward, none, reverse/brake. */
    throttle() {
      return (forward ? 1 : 0) - (back ? 1 : 0);
    },
    /** -1/0/1 steering: left, none, right. */
    steer() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    nitro() {
      return nitro;
    },
    pointer() {
      return { down: pointerDown, x: pointerX, y: pointerY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queue an action from code (used by the shot stager and HUD buttons). */
    queue(action) {
      actions |= action;
    },
  };
}
