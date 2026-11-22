// Neon Bay 3D r14 — kit entrypoint. Runs the game headlessly, produces a
// dossier with 4 screenshots and a source outline. Succeeds with:
//   MAKEFUN_OUTPUT_DIR=/tmp/nb14-output node main.ts
// The game itself is game/ (plain static files, Three.js vendored, no network
// request at runtime); this file only copies it into the output directory and
// hands it in with the vendored make.fun library.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
// buildDossier returns the dossier.json bytes (Uint8Array).
const dossierBytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierBytes);

// A short human-readable summary of what was handed in, for the build log.
const parsed = JSON.parse(new TextDecoder().decode(dossierBytes));
const images = parsed.images ?? [];
const gameBlock = (parsed.text ?? '').split('\n').slice(0, 12).join(' | ');
console.log(`Neon Bay 3D r14 — dossier written to ${join(out, 'dossier.json')} (${dossierBytes.length} bytes)`);
console.log(`screenshots: ${images.length} (${images.map((s) => s.name).join(', ')})`);
console.log(`game block: ${gameBlock}`);
