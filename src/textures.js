import * as THREE from "three";

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * noise2(x * f, y * f);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.26],
    [0.72, 0.26],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.74],
    [0.72, 0.74],
  ],
};

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPip(ctx, x, y, radius, fill, highlight) {
  const grd = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.32,
    radius * 0.1,
    x,
    y,
    radius,
  );
  grd.addColorStop(0, highlight);
  grd.addColorStop(0.55, fill);
  grd.addColorStop(1, fill);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
}

export function createDieFaceTexture(value, tint) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 90, y / 90);
      const i = (y * size + x) * 4;
      const shade = (n - 0.5) * 18;
      const c = hexToRgb(tint.face);
      img.data[i] = clamp(c.r + shade);
      img.data[i + 1] = clamp(c.g + shade * 0.92);
      img.data[i + 2] = clamp(c.b + shade * 0.8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const inset = 28;
  roundRect(ctx, inset, inset, size - inset * 2, size - inset * 2, 48);
  ctx.strokeStyle = tint.edge;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const pipRgb = hexToRgb(tint.pip);
  const highlight =
    pipRgb.r + pipRgb.g + pipRgb.b > 500 ? "#ffffff" : lighten(tint.pip, 46);
  const radius = value === 1 ? 48 : 34;
  for (const [u, v] of PIP_LAYOUT[value]) {
    drawPip(ctx, u * size, v * size, radius, tint.pip, highlight);
  }

  return canvasTexture(canvas);
}

export function createFeltTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 70, y / 70);
      const fiber = noise2(x / 3.2, y / 18);
      const i = (y * size + x) * 4;
      img.data[i] = clamp(18 + n * 22 + fiber * 10);
      img.data[i + 1] = clamp(72 + n * 38 + fiber * 12);
      img.data[i + 2] = clamp(42 + n * 20 + fiber * 8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  return texture;
}

export function createWoodTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = fbm(x / 140, y / 18);
      const ring = Math.sin(x / 28 + grain * 6) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      img.data[i] = clamp(78 + grain * 40 + ring * 28);
      img.data[i + 1] = clamp(48 + grain * 24 + ring * 16);
      img.data[i + 2] = clamp(28 + grain * 12 + ring * 8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  const v = parseInt(n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function lighten(hex, amount) {
  const c = hexToRgb(hex);
  return `rgb(${clamp(c.r + amount)}, ${clamp(c.g + amount)}, ${clamp(c.b + amount)})`;
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}
