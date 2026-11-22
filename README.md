# NEON BAY 3D: open-world crime at golden hour — 10 story missions, NBPD dispatch with roadblocks and HALO-1 air support, weapon wheel, carjacking, garage upgrades, respect ranks, saves, radio

[![make.fun](https://make.fun/bounty/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun entry](https://make.fun/bounty/gta6-01/entry/sixthin016/gta6-01-r14/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun leaderboard](https://make.fun/bounty/gta6-01/leaderboard/badge.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in Three.js, set in **Neon Bay** at golden hour — 17:42, the sun low over the bay, Hurricane Solana six hours from landfall, and a $250,000 Harbor Reserve vault waiting to be hit. Drive the road loop through five named districts, run ten story jobs, stay ahead of the NBPD, and get out rich before the storm.

## The city

Neon Bay is one road loop with five named districts, each with its own look:

| District | What is there |
| --- | --- |
| **Coral Beach** | Sand, boardwalk, palm billboards, the bay itself |
| **Mercado District** | Markets, alleys, the Tiki Lounge |
| **Neon Row** | Art-deco shopfronts (Palms Bar, Tiki Lounge, Sunset Cocktails, Gelato), neon signs |
| **Harbor Docks** | Cranes, containers, Pier 9, the vault |
| **Sunset Hills** | Mansions and the ridge road above the bay |

The sky is a generated golden-hour photograph (`game/assets/sky.jpg`) and the Neon Row storefronts wear a generated art-deco facade strip (`game/assets/facades.jpg`) — both drawn procedurally in-session by `tools/gen_assets.py`, no stock photos.

## Systems

- **10 story missions** — named jobs with payouts and respect, from *Dockside Pickup* to *Harbor Vault Heist* to *The Hurricane Run*. A golden beacon marks the objective; finishing a job pays cash and respect and advances the story. The full list is on the start screen and in `game/src/config.js`.
- **NBPD dispatch** — a dynamic wanted system, 0–5 stars. Crimes raise it; staying clean lowers it. At 3+ stars NBPD sets roadblocks; at 4+ the **HALO-1** helicopter hunts you with a visible searchlight cone. The dispatch board lists every unit, roadblock and HALO-1 status.
- **Weapon wheel (Q)** — Pistol, SMG, Shotgun and Rifle, each with distinct damage, rate, range and spread. Click to fire; 1–4 to pick while the wheel is open.
- **Carjacking (E)** — walk up to any traffic car and take it. The NBPD notices (+1★).
- **Traffic and pedestrians** — 18 traffic cars driving the road loop, 34 pedestrians on the sidewalks and the beach. They scatter when shots go off.
- **Garage upgrades (G)** — three lines, three tiers each: Engine (top speed), Armor (damage taken), Nitro (Shift boost). Bought with mission cash.
- **Respect ranks** — Nobody → Small Timer → Street Hustler → Made Man → Kingpin → Neon Legend, earned from jobs, shown in the HUD.
- **Saves (C)** — Save Anywhere, 3 slots in localStorage, listed with summaries on the start screen.
- **Radio Neon FM (R)** — 3 stations (Neon FM synthwave, Harbor Jazz, Sunset Rock), all music synthesised live with WebAudio. No audio files.
- **Photomode (P)** — freezes the action, hides the HUD, applies a golden-hour grade for staged shots.
- **HUD + minimap** — cash, wanted stars, clock at 17:42, health, respect, mission tracker, hurricane countdown, and a live minimap with districts, police units, HALO-1 and the mission beacon.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Desktop Chrome, keyboard + mouse. No build step, no network request at runtime — Three.js r160 is vendored under `game/vendor/`. The game boots with zero JavaScript console errors; `?shot=cover|carjack|start|chase` (with `&seed=1`) stages one of the four screenshot scenes instead of the title screen.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| E | Carjack (near a car) / step out |
| Q | Weapon wheel (1–4 to pick) |
| Click | Fire |
| R | Next radio station |
| G | Garage |
| C | Quick save |
| M | Next job brief |
| Shift | Nitro boost |
| P | Photomode |
| Esc | Pause |

## Screenshots

Captured from the real game with `node tools/capture.mjs` (headless Chromium, CDP):

1. `1-cover.jpg` — driving up Neon Row at golden hour: traffic, pedestrians, HUD, minimap, wanted stars, Radio Neon FM.
2. `2-carjack.jpg` — on foot in Neon Row: weapon wheel open, photo facades behind, wanted stars up.
3. `3-start.jpg` — start screen: 3 save slots, all 10 missions, respect rank, garage summary.
4. `4-chase.jpg` — five-star pursuit: NBPD roadblock, HALO-1 with searchlight, dispatch board live.

## Files

```
main.ts            kit entrypoint — builds dossier.json + copies game/ and screenshots/
serve.ts           static server for local play
shots.json         the 4 staged shots (?shot=cover|carjack|start|chase)
game/index.html    page + all DOM UI (HUD, start screen, wheel, garage)
game/src/          the game, ES modules
  config.js        tuning, districts, 10 missions, weapons, ranks, garage, radio
  main.js          boot, fixed-step loop, screens, saves wiring
  world.js         city: roads, districts, buildings, bay, sky dome, collision
  render.js        Three.js renderer + chase camera + on-foot figure
  shots.js         the 4 staged screenshot scenes
  missions.js      story jobs, beacon, payouts, respect
  police.js        NBPD dispatch, roadblocks, HALO-1 + searchlight
  vehicles.js      player car, traffic, carjacking, garage upgrades
  combat.js        weapon wheel + 4 weapons, hitscan
  people.js        pedestrians
  radio.js         Radio Neon FM, 3 WebAudio-synth stations
  audio.js         synth SFX: engine, siren, gunshots, cash
  saves.js         3 localStorage slots
  photomode.js     HUD hide + golden-hour grade
  hud.js           DOM HUD, minimap, dispatch board, start screen, wheel, garage
  textures.js      photo assets + procedural canvas textures
  fx.js            particles, mission beacon, searchlight cone
  rng.js / random.js  seeded randomness
  input.js         keyboard + pointer, one-shot action flags
game/vendor/three.module.min.js   Three.js r160 (vendored)
game/assets/sky.jpg, facades.jpg  generated in-session (tools/gen_assets.py)
tools/capture.mjs  headless-Chromium screenshot capture + HUD/console checks
tools/gen_assets.py  generates sky.jpg + facades.jpg with PIL
```

## Verify

```sh
# syntax-check every game script
for f in game/src/*.js tools/capture.mjs; do node --check "$f"; done
# build the dossier (4 screenshots + source outline)
MAKEFUN_OUTPUT_DIR=/tmp/nb14-output node main.ts
# re-capture the 4 screenshots
node tools/capture.mjs
```

## License

MIT — see `LICENSE`.
