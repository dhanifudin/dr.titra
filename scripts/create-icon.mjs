/**
 * Generates dr.titra app icons and tray status icons.
 * Design: clock face (timer) + medical cross (doctor).
 * Run: node scripts/create-icon.mjs
 * Then: npm run tauri icon src-tauri/icons/source.png  (for production platform icons)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

// ─── PNG encoder (RGBA, no external deps) ────────────────────────────────────

const _crc = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  _crc[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = _crc[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}
function encodePNG(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = y * stride + 1 + x * 4;
      raw[d] = pixels[s]; raw[d+1] = pixels[s+1];
      raw[d+2] = pixels[s+2]; raw[d+3] = pixels[s+3];
    }
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Canvas & drawing primitives ─────────────────────────────────────────────

function makeCanvas(size) {
  return new Uint8ClampedArray(size * size * 4); // transparent
}

function setPixel(buf, size, x, y, [r, g, b, a = 255]) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
}

function fillCircle(buf, size, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size-1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size-1, Math.ceil(cx + r)); x++)
      if ((x - cx)**2 + (y - cy)**2 <= r2) setPixel(buf, size, x, y, color);
}

function drawLine(buf, size, ax, ay, bx, by, w, color) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const hw = w / 2;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw));
  const x1 = Math.min(size-1, Math.ceil(Math.max(ax, bx) + hw));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - hw));
  const y1 = Math.min(size-1, Math.ceil(Math.max(ay, by) + hw));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = ((x - ax)*dx + (y - ay)*dy) / (len * len);
    if (t < 0 || t > 1) continue;
    if (Math.abs((x - ax)*dy - (y - ay)*dx) / len <= hw)
      setPixel(buf, size, x, y, color);
  }
}

function fillRect(buf, size, cx, cy, w, h, color) {
  for (let y = Math.round(cy - h/2); y <= Math.round(cy + h/2); y++)
    for (let x = Math.round(cx - w/2); x <= Math.round(cx + w/2); x++)
      setPixel(buf, size, x, y, color);
}

// ─── Colors: Catppuccin Mocha ─────────────────────────────────────────────────

const BASE  = [30,  30,  46,  255]; // #1e1e2e
const BLUE  = [137, 180, 250, 255]; // #89b4fa
const SURF0 = [49,  50,  68,  255]; // #313244
const TEXT  = [205, 214, 244, 255]; // #cdd6f4
const GREEN = [166, 227, 161, 255]; // #a6e3a1
const GRAY  = [108, 112, 134, 255]; // #6c7086 (overlay0)
const WHITE = [255, 255, 255, 255];

// Degrees clockwise from 12 o'clock → unit vector [dx, dy] in screen coords
function clockDir(deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

// ─── App icon: clock face + medical cross ─────────────────────────────────────

function drawAppIcon(size) {
  const buf = makeCanvas(size);
  const cx = size / 2, cy = size / 2;
  const R = size * 0.46;

  // Bezel ring: fill full circle blue, then overwrite inner with surface color
  fillCircle(buf, size, cx, cy, R, BLUE);
  fillCircle(buf, size, cx, cy, R * 0.87, SURF0);

  // 12 hour marks as short radial lines
  for (let h = 0; h < 12; h++) {
    const [dx, dy] = clockDir(h * 30);
    const markW = Math.max(1.5, size * 0.022);
    drawLine(buf, size,
      cx + dx * R * 0.68, cy + dy * R * 0.68,
      cx + dx * R * 0.82, cy + dy * R * 0.82,
      markW, [TEXT[0], TEXT[1], TEXT[2], 210]
    );
  }

  // Clock hands at 10:10 — classic watch display
  const hourW  = Math.max(2, size * 0.038);
  const minuteW = Math.max(1.5, size * 0.028);

  // Hour hand pointing to 10 (300° clockwise from 12)
  const [hx, hy] = clockDir(300);
  drawLine(buf, size, cx, cy, cx + hx * R * 0.52, cy + hy * R * 0.52, hourW, TEXT);

  // Minute hand pointing to 2 (60° clockwise from 12)
  const [mx, my] = clockDir(60);
  drawLine(buf, size, cx, cy, cx + mx * R * 0.69, cy + my * R * 0.69, minuteW, TEXT);

  // Center cap where hands meet
  fillCircle(buf, size, cx, cy, Math.max(2, size * 0.045), TEXT);

  // Medical "+" cross in bottom-right (only at larger sizes — too small at 32×32)
  if (size >= 64) {
    const xc = cx + R * 0.40, yc = cy + R * 0.40;
    const crossSpan = R * 0.26;
    const crossThick = R * 0.095;
    // Backing circle to separate cross from clock marks
    fillCircle(buf, size, xc, yc, R * 0.185, SURF0);
    // Horizontal bar
    fillRect(buf, size, xc, yc, crossSpan, crossThick, GREEN);
    // Vertical bar
    fillRect(buf, size, xc, yc, crossThick, crossSpan, GREEN);
  }

  return buf;
}

// ─── Tray icon: simple clock silhouette in status color ───────────────────────

function drawTrayIcon(statusColor) {
  const size = 32, buf = makeCanvas(size);
  const cx = 16, cy = 16, R = 13.5;

  // Solid circle in status color
  fillCircle(buf, size, cx, cy, R, statusColor);

  // White clock hands (thicker for legibility at small OS display size)
  const [hx, hy] = clockDir(300);
  drawLine(buf, size, cx, cy, cx + hx * R * 0.55, cy + hy * R * 0.55, 3.5, WHITE);

  const [mx, my] = clockDir(60);
  drawLine(buf, size, cx, cy, cx + mx * R * 0.72, cy + my * R * 0.72, 2.5, WHITE);

  // Center dot
  fillCircle(buf, size, cx, cy, 2.5, WHITE);

  return buf;
}

// ─── Write all icon files ─────────────────────────────────────────────────────

mkdirSync('./src-tauri/icons', { recursive: true });

// App icon at multiple sizes
for (const [name, size] of [
  ['32x32.png',     32],
  ['128x128.png',  128],
  ['128x128@2x.png', 256],
  ['source.png',   512],
]) {
  writeFileSync(`./src-tauri/icons/${name}`, encodePNG(drawAppIcon(size), size));
  console.log(`  ✓ src-tauri/icons/${name}  (${size}×${size})`);
}

// Tray icons — PNG for display reference, raw RGBA for Rust include_bytes!
for (const [name, color] of [['tray-running', GREEN], ['tray-idle', GRAY]]) {
  const pixels = drawTrayIcon(color);
  writeFileSync(`./src-tauri/icons/${name}.png`, encodePNG(pixels, 32));
  // Raw RGBA: used by Rust via include_bytes! + Image::new(data, 32, 32)
  writeFileSync(`./src-tauri/icons/${name}.rgba`, Buffer.from(pixels));
  console.log(`  ✓ src-tauri/icons/${name}.png + .rgba`);
}

// Windows ICO — wraps the 32×32 app icon PNG
const png32 = encodePNG(drawAppIcon(32), 32);
const icoDir = Buffer.alloc(6);
icoDir.writeUInt16LE(1, 2); // type = 1 (ICO)
icoDir.writeUInt16LE(1, 4); // count = 1
const icoEntry = Buffer.alloc(16);
icoEntry[0] = 32; icoEntry[1] = 32;           // width, height
icoEntry.writeUInt16LE(1, 4);                  // planes
icoEntry.writeUInt16LE(32, 6);                 // bit count
icoEntry.writeUInt32LE(png32.length, 8);       // data size
icoEntry.writeUInt32LE(22, 12);               // data offset (6 + 16)
writeFileSync('./src-tauri/icons/icon.ico', Buffer.concat([icoDir, icoEntry, png32]));
console.log('  ✓ src-tauri/icons/icon.ico');

// macOS ICNS — placeholder; run `npm run tauri icon source.png` for proper multi-size ICNS
writeFileSync('./src-tauri/icons/icon.icns', encodePNG(drawAppIcon(128), 128));
console.log('  ✓ src-tauri/icons/icon.icns  (placeholder)');

console.log('\nFor production-quality platform icons, run:');
console.log('  npm run tauri icon src-tauri/icons/source.png\n');
