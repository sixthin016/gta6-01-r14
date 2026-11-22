// Neon Bay 3D r14 — screenshot capture. Serves game/ on a local port, opens
// each ?shot= URL from shots.json in headless Chromium over CDP (Node's
// built-in WebSocket — no Playwright or Puppeteer dependency), waits for
// window.__shotReady, checks the live DOM for non-zero HUD values and zero
// console errors, then saves a 1280x720 JPEG into screenshots/.
// Fails loudly when any shot is missing, too small (<20,000 bytes), has
// console errors, or shows zero HUD values.
//
// Chromium: the Playwright cache build, or $CHROME_BIN when set.
//   node tools/capture.mjs [--port 8123] [--out screenshots]

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const repo = resolve(here);
const gameRoot = join(repo, 'game');
const shotsPath = join(repo, 'shots.json');
const outDir = join(repo, 'screenshots');

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? 8123 : Number(args[portIndex + 1]);
const outIndex = args.indexOf('--out');
const out = outIndex === -1 ? outDir : resolve(args[outIndex + 1]);

const CHROME = process.env.CHROME_BIN
  ?? resolve(process.env.HOME ?? '~', '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const HEADLESS_SHELL = resolve(process.env.HOME ?? '~', '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function serve() {
  return new Promise((resolveListen) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400).end('bad request');
        return;
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(gameRoot, pathname));
      if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const stats = statSync(file);
        if (!stats.isFile()) throw new Error('not a file');
        res.writeHead(200, {
          'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'content-length': stats.size,
          'cache-control': 'no-store',
        });
        createReadStream(file).pipe(res);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolveListen(server));
  });
}

function pickChrome() {
  if (existsSync(CHROME)) return CHROME;
  if (existsSync(HEADLESS_SHELL)) return HEADLESS_SHELL;
  throw new Error(`no Chromium found (tried ${CHROME} and ${HEADLESS_SHELL}); set CHROME_BIN`);
}

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

/** Minimal CDP client over Node's built-in WebSocket. */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  ready() {
    return new Promise((resolveReady, rejectReady) => {
      this.ws.addEventListener('open', resolveReady);
      this.ws.addEventListener('error', rejectReady);
    });
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`page eval failed: ${result.exceptionDetails.text}`);
    return result.result.value;
  }

  consoleErrors() {
    return this.events.filter((e) => {
      if (e.method === 'Runtime.exceptionThrown') return true;
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') return true;
      // Network errors count — except a missing favicon, which is cosmetic
      // (and suppressed by the inline data: favicon in index.html anyway).
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
        return !(e.params.entry.url ?? '').endsWith('/favicon.ico');
      }
      return false;
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    const value = await fn().catch(() => null);
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function captureShot(cdp, shot) {
  const url = `http://127.0.0.1:${port}/${shot.query}`;
  console.log(`  ${shot.name} <- ${url}`);
  await cdp.call('Page.navigate', { url });
  await waitFor(async () => cdp.eval('window.__shotReady === true'), 60000, `__shotReady for ${shot.name}`);
  // Let the last painted frame settle, then verify the live DOM.
  await new Promise((r) => setTimeout(r, 400));
  const hud = await cdp.eval(`(() => {
    const text = (id) => document.getElementById(id)?.textContent ?? '';
    return {
      cash: text('hud-cash'),
      stars: document.querySelectorAll('#hud-stars .star.lit').length,
      clock: text('hud-clock'),
      health: text('hud-health'),
      respect: text('hud-respect'),
      radio: text('hud-radio-text'),
      mission: text('hud-mission'),
      errors: window.__shotErrors ?? [],
      shotName: window.__shotName ?? null,
    };
  })()`);
  const errors = cdp.consoleErrors();
  if (errors.length > 0) {
    throw new Error(`${shot.name}: ${errors.length} console error(s): ${JSON.stringify(errors.slice(0, 3))}`);
  }
  if (hud.errors.length > 0) {
    throw new Error(`${shot.name}: page reported errors: ${hud.errors.join(' | ')}`);
  }
  if (!hud.cash || hud.cash === '$0') throw new Error(`${shot.name}: HUD cash is zero/empty (${hud.cash})`);
  if (!hud.clock || hud.clock === '00:00') throw new Error(`${shot.name}: HUD clock is empty (${hud.clock})`);
  if (!hud.health || hud.health === '0') throw new Error(`${shot.name}: HUD health is zero/empty (${hud.health})`);
  if (!hud.respect) throw new Error(`${shot.name}: HUD respect is empty`);
  console.log(`    HUD ok: cash=${hud.cash} stars=${hud.stars} clock=${hud.clock} health=${hud.health} respect="${hud.respect}" radio="${hud.radio}"`);
  const shotResult = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  const bytes = Buffer.from(shotResult.data, 'base64');
  const dest = join(out, shot.name);
  writeFileSync(dest, bytes);
  const size = statSync(dest).size;
  if (size < 20000) throw new Error(`${shot.name}: JPEG only ${size} bytes (< 20,000) — probably a blank frame`);
  console.log(`    saved ${dest} (${size} bytes)`);
  return { name: shot.name, size, hud };
}

async function main() {
  const shots = JSON.parse(readFileSync(shotsPath, 'utf8'));
  if (!Array.isArray(shots) || shots.length !== 4) {
    throw new Error(`shots.json must list exactly 4 shots, found ${shots.length}`);
  }
  mkdirSync(out, { recursive: true });
  const server = await serve();
  console.log(`serving game/ on http://127.0.0.1:${port}`);
  const chrome = pickChrome();
  console.log(`chromium: ${chrome}`);
  const debugPort = 9333;
  const child = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/nb14-chrome-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const targets = await waitFor(async () => {
      const list = await httpJson(`http://127.0.0.1:${debugPort}/json`);
      return list.find((t) => t.type === 'page') ?? null;
    }, 30000, 'chromium DevTools page target');
    const cdp = new Cdp(targets.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.call('Runtime.enable');
    await cdp.call('Page.enable');
    await cdp.call('Log.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const results = [];
    for (const shot of shots) results.push(await captureShot(cdp, shot));
    cdp.close();
    console.log('capture OK: 4/4 shots, all >20,000 bytes, zero console errors, HUD values non-zero');
    for (const r of results) console.log(`  ${r.name}: ${r.size} bytes`);
  } finally {
    child.kill('SIGTERM');
    server.close();
  }
}

main().catch((err) => {
  console.error(`capture FAILED: ${err.message}`);
  process.exit(1);
});
