// Neon Bay 3D r14 — the HUD. All on-screen UI is DOM, not canvas text, so it
// stays crisp in screenshots and readable in the live DOM while capturing:
// cash, wanted stars, clock, health, respect rank, radio widget, mission
// tracker, minimap (2D canvas), NBPD dispatch board, toasts, the start screen
// (3 save slots + all 10 missions + garage summary), the weapon wheel and the
// garage panel. Text is only rewritten when it changes.

import { CITY, DISTRICTS, GARAGE, WEAPONS } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function formatCash(cash) {
  return `$${Math.floor(cash).toLocaleString('en-US')}`;
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function createHud() {
  const els = {
    hud: $('hud'), cash: $('hud-cash'), stars: $('hud-stars'), clock: $('hud-clock'),
    health: $('hud-health'), healthBar: $('hud-health-bar'), respect: $('hud-respect'),
    radio: $('hud-radio-text'), mission: $('hud-mission'), missionDist: $('hud-mission-dist'),
    district: $('hud-district'), hurricane: $('hud-hurricane'), speed: $('hud-speed'),
    minimap: $('minimap'), dispatch: $('dispatch-board'), dispatchUnits: $('dispatch-units'),
    dispatchBlocks: $('dispatch-blocks'), dispatchHalo: $('dispatch-halo'),
    toast: $('toast'), start: $('start-screen'), wheel: $('weapon-wheel'),
    garage: $('garage-panel'), photoBanner: $('photo-banner'),
  };
  const cache = new Map();
  function setText(el, key, value) {
    if (!el) return;
    if (cache.get(key) !== value) {
      cache.set(key, value);
      el.textContent = value;
    }
  }
  function setHtml(el, key, value) {
    if (!el) return;
    if (cache.get(key) !== value) {
      cache.set(key, value);
      el.innerHTML = value;
    }
  }

  function starsHtml(wanted) {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      out += `<span class="star ${i < wanted ? 'lit' : ''}">★</span>`;
    }
    return out;
  }

  function drawMinimap(snap) {
    const canvas = els.minimap;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const scale = size / (CITY.half * 2 + 40);
    const toMap = (x, z) => [(x + CITY.half + 20) * scale, (z + CITY.half + 20) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10, 8, 24, 0.9)';
    ctx.fillRect(0, 0, size, size);
    for (const d of DISTRICTS) {
      const [x0, y0] = toMap(d.x0, d.z0);
      const [x1, y1] = toMap(d.x1, d.z1);
      ctx.fillStyle = d.color + '33';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // Roads
    ctx.strokeStyle = 'rgba(232, 201, 106, 0.55)';
    ctx.lineWidth = 1.5;
    for (const r of [-180, -90, 0, 90, 180]) {
      const [x] = toMap(r, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      const [, y] = toMap(0, r);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    // Mission beacon
    if (snap.beacon) {
      const [bx, by] = toMap(snap.beacon.x, snap.beacon.z);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // Police units and HALO-1
    ctx.fillStyle = '#4a8ae8';
    for (const u of snap.policeUnits ?? []) {
      const [ux, uy] = toMap(u.x, u.z);
      ctx.beginPath(); ctx.arc(ux, uy, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (snap.heli) {
      const [hx, hy] = toMap(snap.heli.x, snap.heli.z);
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to heading. Canvas y is down, so the arrow points
    // up the screen when the player faces -z (north on the map).
    const [px, py] = toMap(snap.playerX, snap.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-snap.playerAngle + Math.PI);
    ctx.fillStyle = '#ff5ea8';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Per-frame HUD refresh from a snapshot object (see main.js). */
  function update(snap) {
    setText(els.cash, 'cash', formatCash(snap.cash));
    setHtml(els.stars, 'stars', starsHtml(snap.wanted));
    setText(els.clock, 'clock', formatClock(snap.clockMinutes));
    setText(els.health, 'health', `${Math.ceil(snap.health)}`);
    if (els.healthBar) els.healthBar.style.width = `${Math.max(0, Math.min(100, snap.health))}%`;
    setText(els.respect, 'respect', `${snap.rank} · ${snap.respect} REP`);
    setText(els.radio, 'radio', snap.radioLabel);
    setText(els.mission, 'mission', snap.missionName ?? '—');
    setText(els.missionDist, 'missionDist', snap.missionDist === Infinity ? '' : `${Math.round(snap.missionDist)}m`);
    setText(els.district, 'district', snap.district);
    setText(els.hurricane, 'hurricane', `🌪 ${snap.hurricaneName} LANDFALL ${formatCountdown(snap.hurricaneSeconds)}`);
    setText(els.speed, 'speed', snap.inCar ? `${Math.round(Math.abs(snap.speed) * 3.6)} km/h` : 'ON FOOT');
    // Dispatch board: visible whenever the player has any heat, or in chase shots.
    if (els.dispatch) {
      els.dispatch.style.display = snap.wanted > 0 || snap.forceDispatch ? 'block' : 'none';
      setText(els.dispatchUnits, 'dunits', snap.dispatchUnits.map((u) => `${u.name} ${u.status} ${u.dist}m`).join('  ·  ') || 'NO UNITS DEPLOYED');
      setText(els.dispatchBlocks, 'dblocks', snap.dispatchBlocks.length > 0 ? `ROADBLOCKS: ${snap.dispatchBlocks.join(', ')}` : 'ROADBLOCKS: NONE');
      setText(els.dispatchHalo, 'dhalo', snap.dispatchHalo);
    }
    drawMinimap(snap);
  }

  let toastTimer = null;
  function toast(message, ms = 3600) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.style.opacity = '1';
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.style.opacity = '0';
    }, ms);
  }

  /** The start screen: title, 3 save slots, all 10 missions, respect + garage. */
  function showStart(summaries, missionsList, garageState, respect, rankName, best) {
    if (!els.start) return;
    els.start.style.display = 'flex';
    const slots = $('save-slots');
    if (slots) {
      slots.innerHTML = summaries.map((s) => {
        if (s.empty) {
          return `<button class="save-slot empty" data-slot="${s.slot}">
            <span class="slot-num">SLOT ${s.slot}</span><span class="slot-info">Empty slot — new game</span></button>`;
        }
        const when = s.savedAt ? new Date(s.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `<button class="save-slot" data-slot="${s.slot}">
          <span class="slot-num">SLOT ${s.slot} · ${when}</span>
          <span class="slot-info">${formatCash(s.cash)} · ${s.missionsDone}/10 missions · ${s.rank} · ${s.district}</span></button>`;
      }).join('');
    }
    const list = $('start-missions');
    if (list) {
      list.innerHTML = missionsList.map((m) => `<li class="${m.done ? 'done' : ''}">
        <span class="m-num">${String(m.id).padStart(2, '0')}</span>
        <span class="m-name">${m.name}</span>
        <span class="m-district">${m.district}</span>
        <span class="m-pay">${formatCash(m.payout)}</span>
        <span class="m-done">${m.done ? '✓ DONE' : ''}</span></li>`).join('');
    }
    const stats = $('start-stats');
    if (stats) {
      const garageText = ['engine', 'armor', 'nitro'].map((line) => {
        const tier = garageState[line];
        const label = GARAGE[line].label;
        return `${label} ${'●'.repeat(tier)}${'○'.repeat(3 - tier)}`;
      }).join('  ·  ');
      stats.innerHTML = `<span>RESPECT: <b>${rankName}</b> (${respect} REP)</span>
        <span>GARAGE: ${garageText}</span>
        <span>BEST: ${formatCash(best)}</span>`;
    }
    if (els.hud) els.hud.style.display = 'none';
  }

  function hideStart() {
    if (!els.start) return;
    els.start.style.display = 'none';
    if (els.hud) els.hud.style.display = 'block';
  }

  /** The weapon wheel overlay: four weapons, current one highlighted. */
  function showWheel(weaponIndex) {
    if (!els.wheel) return;
    els.wheel.style.display = 'flex';
    els.wheel.innerHTML = `<div class="wheel-title">WEAPON WHEEL — Q to close · 1-4 to select</div>` +
      WEAPONS.map((w, i) => `<div class="wheel-item ${i === weaponIndex ? 'active' : ''}">
        <span class="w-key">${i + 1}</span><span class="w-name">${w.key}</span>
        <span class="w-stat">DMG ${w.damage} · ${Math.round(1 / w.rate)}/s · ${w.range}m</span></div>`).join('');
  }

  function hideWheel() {
    if (!els.wheel) return;
    els.wheel.style.display = 'none';
  }

  /** The garage panel: three upgrade lines, prices or MAXED. */
  function showGarage(cash, upgrades, costs) {
    if (!els.garage) return;
    els.garage.style.display = 'block';
    els.garage.innerHTML = `<div class="garage-title">NEON BAY GARAGE — ${formatCash(cash)}</div>
      <div class="garage-sub">Click a tier to buy it. G to close. Engine = top speed · Armor = damage taken · Nitro = Shift boost.</div>` +
      ['engine', 'armor', 'nitro'].map((line) => {
        const tier = upgrades[line];
        const cost = costs[line];
        const label = GARAGE[line].label;
        const dots = '●'.repeat(tier) + '○'.repeat(3 - tier);
        const action = cost === null
          ? '<span class="g-max">MAXED</span>'
          : `<button class="g-buy" data-line="${line}">BUY ${formatCash(cost)}</button>`;
        return `<div class="garage-row"><span class="g-label">${label}</span>
          <span class="g-dots">${dots}</span>${action}</div>`;
      }).join('');
  }

  function hideGarage() {
    if (!els.garage) return;
    els.garage.style.display = 'none';
  }

  return { els, update, toast, showStart, hideStart, showWheel, hideWheel, showGarage, hideGarage, formatCash, formatClock, formatCountdown };
}
