import * as THREE from 'three';

// A flat mesh backed by a canvas texture. `draw(ctx, w, h)` paints it; call
// `panel.redraw(fn)` only when the content changes (canvas uploads are costly on Quest).
export function makePanel(width, height, { pxPerM = 1100, transparent = true, draw } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(32, Math.round(width * pxPerM));
  canvas.height = Math.max(32, Math.round(height * pxPerM));
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent, depthWrite: !transparent, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.userData.panel = true;
  mesh.redraw = (fn) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fn(ctx, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  if (draw) mesh.redraw(draw);
  return mesh;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wraps `text` into lines that fit maxWidth; returns the y after the last line.
export function wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'left') {
  ctx.textAlign = align;
  const paragraphs = String(text).split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        line = word;
      } else line = test;
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

export const FONT = (px, weight = 600) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

// Sets ctx.font to the largest size <= px that fits `text` in maxWidth.
export function fitFont(ctx, text, maxWidth, px, weight = 800) {
  let size = px;
  ctx.font = FONT(size, weight);
  while (size > 6 && ctx.measureText(text).width > maxWidth) { size *= 0.92; ctx.font = FONT(size, weight); }
  return size;
}

// Number of lines wrapText would produce (no drawing).
export function countLines(ctx, text, maxWidth) {
  let n = 0;
  for (const para of String(text).split('\n')) {
    let line = '';
    n++;
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { n++; line = word; } else line = test;
    }
  }
  return n;
}
