// Script to generate placeholder PNG icons for Nokka app
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(w, h, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const rowLen = w * 3;
  const raw = Buffer.alloc(h * (rowLen + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowLen + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const o = y * (rowLen + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// Nokka brand: dark #0f0f12 background with #c8f060 accent
// We'll make a 2-color icon: dark bg with accent center square
function makeIcon(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const rowLen = size * 3;
  const raw = Buffer.alloc(size * (rowLen + 1));

  // Draw: dark bg, accent rounded square in center
  const pad = Math.floor(size * 0.2);
  const [bgR, bgG, bgB] = [0x0f, 0x0f, 0x12]; // #0f0f12
  const [acR, acG, acB] = [0xc8, 0xf0, 0x60]; // #c8f060

  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (rowLen + 1) + 1 + x * 3;
      const inCenter = x >= pad && x < size - pad && y >= pad && y < size - pad;
      if (inCenter) { raw[o] = acR; raw[o + 1] = acG; raw[o + 2] = acB; }
      else { raw[o] = bgR; raw[o + 1] = bgG; raw[o + 2] = bgB; }
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, '../assets/images');
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon.png'), makeIcon(1024));
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), makeIcon(1024));
fs.writeFileSync(path.join(dir, 'splash.png'), makePNG(1284, 2778, 0x0f, 0x0f, 0x12));
fs.writeFileSync(path.join(dir, 'favicon.png'), makeIcon(48));

console.log('Icons generated in assets/images/');
