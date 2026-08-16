// Revisa una pantalla a un ancho de verdad: mide desbordo horizontal y, si se
// pide, captura.
//
// Existe porque la forma obvia miente. `chrome --headless --window-size=390,844
// --screenshot` **no** maqueta a 390 px: maqueta ancho y recorta la imagen a
// 390. La captura parece un teléfono, no lo es, y lleva a "arreglar" desbordos
// que nunca existieron. Ya pasó dos veces. Lo único que da un viewport real es
// Emulation.setDeviceMetricsOverride por CDP, que es lo que hace esto.
//
// Uso:
//   node scripts/viewport.mjs <url> [ancho] [--shot <archivo.png>]
//
//   node scripts/viewport.mjs http://localhost:3000/resultados/liga-paramo 390
//   node scripts/viewport.mjs http://localhost:3000/ 1440 --shot /tmp/portada.png
//
// Sale con código 1 si algo se sale del ancho, y con 2 si la URL no respondió
// 200 — medir una pantalla de error y darla por buena es peor que no medir.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((path) => existsSync(path));

const args = process.argv.slice(2);
const url = args[0];
const width = Number(args.find((a) => /^\d+$/.test(a)) ?? 390);
const shot = args.includes('--shot') ? args[args.indexOf('--shot') + 1] : null;

if (!url) {
  console.error('Uso: node scripts/viewport.mjs <url> [ancho] [--shot archivo.png]');
  process.exit(2);
}
if (!CHROME) {
  console.error('No encontré Chrome. Edita la lista CHROME en este archivo.');
  process.exit(2);
}

async function targets() {
  return (await fetch(`http://localhost:${PORT}/json/list`)).json();
}

// Reusa el Chrome de depuración si ya está arriba; si no, levanta uno propio.
let chrome = null;
try {
  await targets();
} catch {
  chrome = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'crux-cdp-'))}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      await targets();
      break;
    } catch {
      /* sigue esperando */
    }
  }
}

const page = (await targets()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});

// Esto —y no --window-size— es lo que da un viewport real.
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height: 900,
  deviceScaleFactor: 2,
  mobile: width < 700,
});
await send('Page.enable');
await send('Network.enable');

// El código de estado, y no solo el dibujo. Una pantalla de 404 maqueta
// perfecto: la de Next son dos renglones centrados, así que nunca desborda y
// esto informaba "sin desbordo horizontal" con toda la razón — sobre una
// pantalla que no era la que se creía estar midiendo. Pasó el 2026-08-15 con
// /resultados, /competidor y /juzgar, que no existen sin segmento, y dio por
// auditadas tres pantallas que nadie miró.
let status = null;
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Network.responseReceived' && msg.params.type === 'Document' && status === null) {
    status = msg.params.response.status;
  }
});

await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 4000));

if (status !== null && status !== 200) {
  console.error(`\n${url} respondió ${status}, no 200.`);
  console.error('Lo que se midió es la pantalla de error, no la pantalla.');
  if (status === 404) {
    console.error('¿Falta el segmento? /resultados/<slug>, /competidor/<id>, /juzgar/<slug>.');
  }
  ws.close();
  chrome?.kill();
  process.exit(2);
}

const { result } = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const vw = document.documentElement.clientWidth;
    // Una tabla ancha dentro de su propio contenedor con scroll no es un
    // defecto: es la solución. Sin este filtro la herramienta marca cada
    // celda de esa tabla y se vuelve ruido que nadie vuelve a leer.
    const clipped = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
      }
      return false;
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.width > vw + 1) && !clipped(el)) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 80),
          text: (el.textContent || '').trim().slice(0, 40),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 12) };
  })()`,
});

const { vw, scrollWidth, offenders } = result.value;
console.log(
  `${url} @ ${width}px → ${status ?? '???'} · viewport ${vw}, scrollWidth ${scrollWidth}`,
);
if (offenders.length === 0) {
  console.log('Sin desbordo horizontal.');
} else {
  console.log(`\n${offenders.length} elemento(s) fuera de cuadro:`);
  for (const o of offenders) {
    console.log(`  <${o.tag}> ancho ${o.width}, borde derecho ${o.right}`);
    console.log(`    class="${o.cls}"`);
    console.log(`    "${o.text}"`);
  }
}

if (shot) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(shot, Buffer.from(data, 'base64'));
  console.log(`\nCaptura: ${shot}`);
}

ws.close();
chrome?.kill();
process.exit(offenders.length > 0 ? 1 : 0);
