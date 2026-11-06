/**
 * Tiny PNG generator for demo photos.
 *
 * The app only accepts images that came from its own upload endpoint, so seeded findings need real files
 * sitting in `data/uploads/`. Rather than ship binary fixtures we draw them: a coloured "before/after"
 * placeholder with a caption, encoded as a bare RGB PNG. No dependencies, a few KB each.
 */
import { deflateSync } from 'node:zlib';

const W = 480;
const H = 320;

type RGB = [number, number, number];

// ---------- 5x7 bitmap font (one byte per column, bit 0 = top row) ----------
const FONT: Record<string, number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x3f, 0x40, 0x38, 0x40, 0x3f],
  X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
};

class Canvas {
  readonly px = Buffer.alloc(W * H * 3);

  set(x: number, y: number, [r, g, b]: RGB) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.px[i] = r;
    this.px[i + 1] = g;
    this.px[i + 2] = b;
  }

  rect(x0: number, y0: number, w: number, h: number, color: RGB) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, color);
  }

  /** Vertical gradient with faint diagonal banding, so the placeholder reads as a photo rather than a flat swatch. */
  background(top: RGB, bottom: RGB) {
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      const base = top.map((c, i) => c + (bottom[i]! - c) * t) as RGB;
      for (let x = 0; x < W; x++) {
        const band = ((x + y) % 56 < 28 ? 6 : -6) + ((x * 7 + y * 13) % 11) - 5;
        this.set(x, y, base.map((c) => Math.max(0, Math.min(255, Math.round(c + band)))) as RGB);
      }
    }
  }

  text(x0: number, y0: number, s: string, scale: number, color: RGB) {
    let x = x0;
    for (const ch of s.toUpperCase()) {
      const cols = FONT[ch] ?? FONT['?']!;
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 7; r++) {
          if (cols[c]! & (1 << r)) this.rect(x + c * scale, y0 + r * scale, scale, scale, color);
        }
      }
      x += 6 * scale;
    }
  }

  textWidth(s: string, scale: number) {
    return s.length * 6 * scale - scale;
  }
}

// ---------- PNG container ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(c: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  // raw scanlines, each prefixed with filter type 0
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    c.px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PALETTE = {
  before: { top: [122, 72, 54] as RGB, bottom: [66, 42, 36] as RGB, accent: [226, 128, 74] as RGB, label: 'HIEN TRANG' },
  after: { top: [58, 104, 82] as RGB, bottom: [34, 60, 50] as RGB, accent: [96, 205, 140] as RGB, label: 'SAU XU LY' },
};

/** Draws a before/after placeholder photo. `caption` is stripped to the ASCII the bitmap font can draw. */
export function renderDemoPhoto(kind: 'before' | 'after', caption: string): Buffer {
  const p = PALETTE[kind];
  const c = new Canvas();
  c.background(p.top, p.bottom);

  // accent frame
  c.rect(0, 0, W, 6, p.accent);
  c.rect(0, H - 6, W, 6, p.accent);

  const title = p.label;
  c.text(Math.round((W - c.textWidth(title, 5)) / 2), 96, title, 5, [255, 255, 255]);

  const sub = asciiFold(caption).slice(0, 30);
  c.rect(0, 196, W, 36, [0, 0, 0]);
  c.text(Math.round((W - c.textWidth(sub, 2)) / 2), 207, sub, 2, p.accent);

  c.text(16, H - 30, 'DEMO - ANH MINH HOA', 1, [220, 220, 220]);
  return encodePng(c);
}

/** Vietnamese text -> the ASCII subset the 5x7 font can draw. */
export function asciiFold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 .:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
