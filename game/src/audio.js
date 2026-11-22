// Neon Bay 3D r14 — sound effects. Everything is synthesised with WebAudio:
// a low engine hum that follows speed, a two-tone NBPD siren, gunshots,
// cash-register cha-ching on mission payout, and UI clicks. No audio files.
// The engine and siren are persistent oscillators; one-shots are built per
// call and released immediately, so the module never leaks nodes.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture at least once; afterwards SFX just work. */
  function unlock() {
    if (!ensure()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    return true;
  }

  /** Engine hum follows speed 0..1; silent when on foot. */
  function setEngine(speed01, onFoot) {
    if (!ctx || !engineOsc) return;
    const target = onFoot ? 0 : 0.02 + speed01 * 0.09;
    engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + speed01 * 96, ctx.currentTime, 0.08);
  }

  function siren(on) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 740;
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, ctx.currentTime, 0.2);
      let high = true;
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.setTargetAtTime(high ? 740 : 540, ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && sirenOsc) {
      window.clearInterval(sirenTimer);
      sirenTimer = null;
      const osc = sirenOsc;
      const gain = sirenGain;
      sirenOsc = null;
      sirenGain = null;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      window.setTimeout(() => {
        try { osc.stop(); } catch { /* already stopped */ }
      }, 400);
    }
  }

  function blip(frequency, duration, type, volume) {
    if (!ensure() || muted) return;
    const when = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function gunshot() {
    if (!ensure() || muted) return;
    const when = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(when);
  }

  function cash() {
    blip(1320, 0.12, 'sine', 0.3);
    window.setTimeout(() => blip(1760, 0.2, 'sine', 0.3), 90);
  }

  /** A short descending buzz for taking damage or failing a purchase. */
  function thud() {
    blip(140, 0.18, 'sawtooth', 0.35);
    window.setTimeout(() => blip(90, 0.22, 'sawtooth', 0.3), 70);
  }

  function click() {
    blip(660, 0.05, 'square', 0.12);
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = value ? 0 : 0.5;
  }

  function dispose() {
    if (sirenTimer !== null) window.clearInterval(sirenTimer);
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
  }

  return { unlock, setEngine, siren, gunshot, cash, thud, click, setMuted, dispose };
}
