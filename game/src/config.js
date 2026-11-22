// Neon Bay 3D r14 — every tuning number, name and list in one place.
// The city is one road loop, 480 x 480 units, five named districts. Golden
// hour is frozen at 17:42 while Hurricane Solana closes in on the bay.

export const TITLE =
  'NEON BAY 3D: open-world crime at golden hour — 10 story missions, NBPD dispatch with roadblocks and HALO-1 air support, weapon wheel, carjacking, garage upgrades, respect ranks, saves, radio';

export const STEP = 1 / 60;
export const CITY = {
  half: 240, // city spans -240 .. 240 on x and z; the bay is past z = +240
  roadSpacing: 90, // avenues and streets every 90 units
  roadWidth: 14,
  beachZ: 135, // south of this line the ground turns to sand
  waterZ: 246, // the bay itself
  blockCenters: [-135, -45, 45, 135],
};

export const GOLDEN_HOUR = { hour: 17, minute: 42 };
export const HURRICANE = {
  name: 'Hurricane Solana',
  // seconds until landfall when a fresh game starts
  landfallInSeconds: 6 * 3600 + 18 * 60 + 42,
  vault: 250000, // the Harbor Reserve vault the story is about
};

export const DISTRICTS = [
  { name: 'Coral Beach', color: '#ff9e5e', x0: -240, z0: 135, x1: 240, z1: 240, blurb: 'Sand, surf and smugglers' },
  { name: 'Mercado District', color: '#ffd166', x0: -240, z0: -135, x1: -45, z1: 135, blurb: 'Markets, alleys, old money' },
  { name: 'Neon Row', color: '#ff5ea8', x0: -45, z0: -135, x1: 45, z1: 135, blurb: 'Bars, clubs and bright lights' },
  { name: 'Harbor Docks', color: '#5ec8ff', x0: 45, z0: -135, x1: 240, z1: 135, blurb: 'Cranes, containers, the vault' },
  { name: 'Sunset Hills', color: '#b78bff', x0: -240, z0: -240, x1: 240, z1: -135, blurb: 'Mansions above the bay' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[2];
}

// The story: ten named jobs, each with a district, a cash payout and respect.
// The arc is the $250,000 Harbor Reserve vault, hit before the hurricane lands.
export const MISSIONS = [
  { id: 1, name: 'Dockside Pickup', district: 'Harbor Docks', payout: 2500, respect: 60, x: 150, z: 20, brief: 'Collect the package from Pier 9. No questions, no witnesses.' },
  { id: 2, name: 'Mercado Shootout', district: 'Mercado District', payout: 4000, respect: 100, x: -150, z: -40, brief: 'The Mercado crew shorted us. Settle it in the alley behind the stalls.' },
  { id: 3, name: 'The Palms Job', district: 'Neon Row', payout: 5500, respect: 140, x: 10, z: 60, brief: 'Lift the safe from the back room of Palms Bar while the band plays.' },
  { id: 4, name: 'Sunset Hills Getaway', district: 'Sunset Hills', payout: 6500, respect: 160, x: -60, z: -180, brief: 'Drive the buyer up the hill and lose the tail before the gate.' },
  { id: 5, name: 'Harbor Vault Heist', district: 'Harbor Docks', payout: 25000, respect: 400, x: 190, z: -80, brief: 'The Harbor Reserve vault. $250,000 inside. One shot before the storm.' },
  { id: 6, name: 'Coral Beach Drop', district: 'Coral Beach', payout: 3200, respect: 80, x: -120, z: 190, brief: 'Meet the boat at the lifeguard tower. Cash changes hands at dusk.' },
  { id: 7, name: 'Neon Row Rumble', district: 'Neon Row', payout: 7000, respect: 180, x: -20, z: -70, brief: 'Three rival crews, one block. Own the Row tonight.' },
  { id: 8, name: 'Highway Escape', district: 'Sunset Hills', payout: 8500, respect: 220, x: 120, z: -190, brief: 'NBPD has the ridge road sealed. Punch through the roadblock.' },
  { id: 9, name: 'Tiki Lounge Takedown', district: 'Mercado District', payout: 9500, respect: 240, x: -190, z: 90, brief: 'The fixer who sold us out drinks at the Tiki Lounge. End it.' },
  { id: 10, name: 'The Hurricane Run', district: 'Harbor Docks', payout: 15000, respect: 500, x: 60, z: 120, brief: 'Last job before landfall: move the vault money out of the city.' },
];

export const WEAPONS = [
  { key: 'Pistol', damage: 25, rate: 0.35, range: 55, spread: 0.02, pellets: 1, color: '#c8ccd4', ammo: Infinity },
  { key: 'SMG', damage: 12, rate: 0.09, range: 48, spread: 0.06, pellets: 1, color: '#ffd166', ammo: Infinity },
  { key: 'Shotgun', damage: 9, rate: 0.8, range: 30, spread: 0.14, pellets: 6, color: '#ff5e5e', ammo: Infinity },
  { key: 'Rifle', damage: 45, rate: 0.18, range: 90, spread: 0.008, pellets: 1, color: '#5eff8a', ammo: Infinity },
];

export const RANKS = [
  { name: 'Nobody', min: 0 },
  { name: 'Small Timer', min: 150 },
  { name: 'Street Hustler', min: 400 },
  { name: 'Made Man', min: 800 },
  { name: 'Kingpin', min: 1500 },
  { name: 'Neon Legend', min: 2500 },
];

export function rankFor(respect) {
  let rank = RANKS[0];
  for (const r of RANKS) if (respect >= r.min) rank = r;
  return rank;
}

// Garage: three upgrade lines, three tiers each. Costs in dollars.
export const GARAGE = {
  engine: { label: 'Engine', costs: [1500, 4000, 9000], speeds: [26, 32, 40] },
  armor: { label: 'Armor', costs: [1200, 3500, 8000], reduction: [0.15, 0.3, 0.5] },
  nitro: { label: 'Nitro', costs: [1800, 4500, 10000], boost: [1.35, 1.6, 1.9] },
};

export const STATIONS = [
  { name: 'Neon FM', genre: 'Synthwave', bpm: 112, root: 55, wave: 'sawtooth', color: '#ff5ea8' },
  { name: 'Harbor Jazz', genre: 'Late-night jazz', bpm: 88, root: 65.41, wave: 'triangle', color: '#ffd166' },
  { name: 'Sunset Rock', genre: 'Driving rock', bpm: 138, root: 82.41, wave: 'square', color: '#ff6b4a' },
];

export const PLAYER = {
  walkSpeed: 7,
  radius: 0.9,
  health: 100,
  carRadius: 1.6,
  baseTopSpeed: 26,
  accel: 22,
  brake: 34,
  steer: 1.9,
  startCash: 850,
  startX: 0,
  startZ: 40,
};

export const POLICE = {
  maxUnits: 6,
  chaseSpeed: 30,
  roadblockAt: 3, // wanted stars that trigger roadblocks
  heliAt: 4, // wanted stars that bring HALO-1
  heliHeight: 42,
  heliOrbit: 26,
};

export const TRAFFIC_COUNT = 18;
export const PED_COUNT = 34;

// How fast the wanted level decays when the player stays clean, and how much
// heat each crime adds. Carjacking and shooting are what the NBPD answers.
export const WANTED = {
  decayPerSecond: 0.045,
  carjack: 1,
  shootPed: 1,
  shootCop: 2,
  kill: 1,
  max: 5,
};

// Camera rig: chase distance/height for driving and for walking.
export const CAMERA = {
  driveDistance: 15,
  driveHeight: 8.5,
  walkDistance: 9,
  walkHeight: 5.5,
  lookAhead: 7,
};

export const PALETTE = {
  sky: '#2b1a56',
  fog: '#e8804a',
  ground: '#2e2a3c',
  road: '#3d3949',
  roadLine: '#e8c96a',
  sand: '#d9a05b',
  water: '#1d4e6b',
  building: '#3a3550',
  neonPink: '#ff5ea8',
  neonCyan: '#4ae3ff',
  neonGold: '#ffd166',
  text: '#f4f1ea',
  muted: '#a89ec4',
  panel: 'rgba(16, 12, 32, 0.82)',
  danger: '#ff4a4a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const SAVE_PREFIX = 'neonbay.save.';
export const SAVE_SLOTS = 3;
export const BEST_KEY = 'neonbay.best';
