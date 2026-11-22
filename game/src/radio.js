// Neon Bay 3D r14 — Radio Neon FM. Three stations, all music synthesised live
// with WebAudio: no audio files, no network. Each station is a looped pattern
// of notes over a bass line, scheduled a bar ahead so it stays in time:
// Neon FM is synthwave arpeggios, Harbor Jazz is swing chords, Sunset Rock is
// a driving power-chord riff. R cycles stations; the HUD widget shows the
// current station, genre and BPM.

import { STATIONS } from './config.js';

const NOTE = {
  // semitone offsets from the station root, per station pattern
  neon: [0, 3, 7, 10, 12, 10, 7, 3],
  jazz: [0, 4, 7, 11, 12, 11, 7, 4],
  rock: [0, 0, 7, 0, 10, 0, 12, 10],
};

export function createRadio() {
  const state = {
    stationIndex: 0,
    playing: false,
    started: false,
    step: 0,
    nextNoteTime: 0,
  };
  let ctx = null;
  let master = null;
  let timer = null;

  function station() {
    return STATIONS[state.stationIndex];
  }

  function ensureContext() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function freq(root, semitones) {
    return root * Math.pow(2, semitones / 12);
  }

  function playNote(when, frequency, duration, type, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  function scheduleStep(stepIndex, when) {
    const st = station();
    const pattern = NOTE[st.name === 'Neon FM' ? 'neon' : st.name === 'Harbor Jazz' ? 'jazz' : 'rock'];
    const beat = 60 / st.bpm / 2; // eighth notes
    const semitone = pattern[stepIndex % pattern.length];
    // Lead arp: bright, on the beat.
    playNote(when, freq(st.root * 4, semitone), beat * 0.9, st.wave, 0.5);
    // Bass: root on the first and fifth eighth, an octave down.
    if (stepIndex % 4 === 0) {
      playNote(when, freq(st.root, 0), beat * 3.2, 'sine', 0.7);
    }
    if (stepIndex % 8 === 6) {
      playNote(when, freq(st.root, 7), beat * 1.6, 'sine', 0.45);
    }
    // Jazz adds a soft chord stab off the beat; rock adds a fifth on the snare.
    if (st.name === 'Harbor Jazz' && stepIndex % 4 === 2) {
      playNote(when, freq(st.root * 2, 4), beat * 0.8, 'triangle', 0.22);
      playNote(when, freq(st.root * 2, 7), beat * 0.8, 'triangle', 0.22);
    }
    if (st.name === 'Sunset Rock' && stepIndex % 4 === 2) {
      playNote(when, freq(st.root * 2, 7), beat * 0.5, 'square', 0.3);
    }
  }

  function tick() {
    if (!ctx || !state.playing) return;
    const beat = 60 / station().bpm / 2;
    while (state.nextNoteTime < ctx.currentTime + 0.25) {
      scheduleStep(state.step, state.nextNoteTime);
      state.nextNoteTime += beat;
      state.step += 1;
    }
  }

  /** Start playback. Must be called from a user gesture at least once. */
  function start() {
    if (!ensureContext()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!state.started) {
      state.started = true;
      state.nextNoteTime = ctx.currentTime + 0.1;
      timer = window.setInterval(tick, 90);
    }
    state.playing = true;
    return true;
  }

  function stop() {
    state.playing = false;
  }

  function nextStation() {
    state.stationIndex = (state.stationIndex + 1) % STATIONS.length;
    state.step = 0;
    return station();
  }

  function setStation(index) {
    state.stationIndex = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
    state.step = 0;
    return station();
  }

  function dispose() {
    if (timer !== null) window.clearInterval(timer);
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
    state.playing = false;
    state.started = false;
  }

  /** One-line label for the HUD widget, e.g. "Neon FM — Synthwave · 112 BPM". */
  function label() {
    const st = station();
    return `${st.name} — ${st.genre} · ${st.bpm} BPM`;
  }

  return { state, station, label, start, stop, nextStation, setStation, dispose };
}
