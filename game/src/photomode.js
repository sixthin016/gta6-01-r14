// Neon Bay 3D r14 — photomode. P (or F) freezes the simulation, hides every
// HUD element, and grades the canvas with a golden-hour filter so a staged
// shot looks like a sunset postcard. Press P/F again (or Escape) to resume.
// The capture script drives this module through the shot stager instead of
// keys, so screenshots get the same treatment.

export function createPhotomode(canvas, hudRoot) {
  const state = { active: false };

  function apply() {
    canvas.style.filter = state.active
      ? 'sepia(0.28) saturate(1.35) contrast(1.06) brightness(1.04)'
      : '';
    if (hudRoot) hudRoot.style.visibility = state.active ? 'hidden' : '';
    const banner = document.getElementById('photo-banner');
    if (banner) banner.style.display = state.active ? 'block' : 'none';
  }

  function toggle() {
    state.active = !state.active;
    apply();
    return state.active;
  }

  function set(value) {
    state.active = Boolean(value);
    apply();
    return state.active;
  }

  function isActive() {
    return state.active;
  }

  /** Expose the filter string so the shot stager can confirm it applied. */
  function filter() {
    return canvas.style.filter || '(none)';
  }

  return { state, toggle, set, isActive, filter };
}
