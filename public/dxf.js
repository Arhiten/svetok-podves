/* ================================================================
   Комплект чертежей «Цветочный подвес» → DXF (R12 / AC1009)
   - примитивы чертежа строятся один раз и выводятся и в DXF, и в SVG
   - кодировка текста CP1251 (ANSI_1251), чтобы кириллица читалась в CAD
   - листы A3 (420×297), первый угол — миллиметры
   ================================================================ */

import { railingLayout } from './model.js';

const CP1251 = (() => {
  const m = new Map();
  for (let i = 0x410; i <= 0x44F; i++) m.set(i, 0xC0 + (i - 0x410)); // А..я
  m.set(0x401, 0xA8); m.set(0x451, 0xB8);   // Ё ё
  m.set(0x00B0, 0xB0); m.set(0x00D8, 0xD8); m.set(0x00B1, 0xB1); m.set(0x00D7, 0xD7);
  m.set(0x00B2, 0xB2); m.set(0x00B3, 0xB3); m.set(0x00B7, 0xB7); m.set(0x00A0, 0xA0);
  m.set(0x2014, 0x97); m.set(0x2013, 0x96); m.set(0x201C, 0x93); m.set(0x201D, 0x94);
  m.set(0x2019, 0x92); m.set(0x2116, 0xB9); m.set(0x00BD, 0xBD);
  return m;
})();

function toCP1251(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 128) out.push(cp);
    else if (CP1251.has(cp)) out.push(CP1251.get(cp));
    else out.push(0x3F);
  }
  return out;
}

export const LAYERS = [
  ['КОНТУР', 7, 'CONTINUOUS'],
  ['ОСЕВАЯ', 1, 'CENTER'],
  ['РАЗМЕРЫ', 3, 'CONTINUOUS'],
  ['ТЕКСТ', 4, 'CONTINUOUS'],
  ['ОТВЕРСТИЯ', 5, 'CONTINUOUS'],
  ['ТАБЛИЦА', 6, 'CONTINUOUS'],
];

/* ---------------- Примитивы ---------------- */
export class Dr {
  constructor() { this.items = []; }
  line(x1, y1, x2, y2, layer = 'КОНТУР') { this.items.push({ t: 'line', x1, y1, x2, y2, layer }); return this; }
  circle(x, y, r, layer = 'КОНТУР') { this.items.push({ t: 'circle', x, y, r, layer }); return this; }
  arc(x, y, r, a1, a2, layer = 'КОНТУР') { this.items.push({ t: 'arc', x, y, r, a1, a2, layer }); return this; }
  solid(x1, y1, x2, y2, x3, y3, layer = 'КОНТУР') {
    this.items.push({ t: 'solid', x1, y1, x2, y2, x3, y3, layer }); return this;
  }
  text(x, y, h, s, layer = 'ТЕКСТ', opt = {}) {
    this.items.push({ t: 'text', x, y, h, s: String(s), layer, ...opt }); return this;
  }
  rect(x, y, w, h, layer = 'КОНТУР') {
    this.line(x, y, x + w, y, layer); this.line(x + w, y, x + w, y + h, layer);
    this.line(x + w, y + h, x, y + h, layer); this.line(x, y + h, x, y, layer);
    return this;
  }
  rectRot(cx, cy, w, h, ang, layer = 'КОНТУР') {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) =>
      [cx + px * c - py * s, cy + px * s + py * c]);
    for (let i = 0; i < 4; i++) this.line(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], layer);
    return this;
  }
  // осевая линия через точку, длина len, угол ang (рад)
  centerLine(x, y, len, ang = 0, layer = 'ОСЕВАЯ') {
    const c = Math.cos(ang), s = Math.sin(ang);
    this.line(x - c * len / 2, y - s * len / 2, x + c * len / 2, y + s * len / 2, layer);
    return this;
  }
  // пересечение двух штриховых линий (знак центра отверстия)
  centerMark(x, y, r, layer = 'ОСЕВАЯ') {
    this.centerLine(x - r * 1.4, y, r * 2.8, 0, layer);
    this.centerLine(x, y - r * 1.4, r * 2.8, Math.PI / 2, layer);
    return this;
  }
  // залитая стрелка, направление (dx,dy)
  arrow(x, y, dx, dy, layer = 'РАЗМЕРЫ', len = 5, w = 1.6) {
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    this.solid(x, y, x - ux * len + px * w, y - uy * len + py * w,
      x - ux * len - px * w, y - uy * len - py * w, layer);
    return this;
  }
  // линейный размер: точки (x1,y1),(x2,y2), линия размера на уровне dimY
  dimH(x1, y1, x2, y2, dimY, label, opt = {}) {
    const h = opt.h || 3.2, L = 'РАЗМЕРЫ';
    const d = opt.side ?? (dimY >= y1 ? 1 : -1);
    if (opt.ext !== false) {
      this.line(x1, y1, x1, dimY + 2 * d, L);
      this.line(x2, y2, x2, dimY + 2 * d, L);
    }
    this.line(x1, dimY, x2, dimY, L);
    this.arrow(x1, dimY, -1, 0, L);
    this.arrow(x2, dimY, 1, 0, L);
    this.text((x1 + x2) / 2, dimY + 1.5 * d, h, label, L, { align: 'c', valign: d > 0 ? 'b' : 't' });
    return this;
  }
  dimV(x1, y1, x2, y2, dimX, label, opt = {}) {
    const h = opt.h || 3.2, L = 'РАЗМЕРЫ';
    const d = opt.side ?? (dimX >= x1 ? 1 : -1);
    if (opt.ext !== false) {
      this.line(x1, y1, dimX + 2 * d, y1, L);
      this.line(x2, y2, dimX + 2 * d, y2, L);
    }
    this.line(dimX, y1, dimX, y2, L);
    this.arrow(dimX, y1, 0, -1, L);
    this.arrow(dimX, y2, 0, 1, L);
    this.text(dimX + 1.5 * d, (y1 + y2) / 2, h, label, L,
      { align: d > 0 ? 'l' : 'r', valign: 'm', rot: -90 });
    return this;
  }
  // диаметр: окружность + размерная линия под углом ang
  dimDia(cx, cy, r, angDeg, label, opt = {}) {
    const h = opt.h || 3.4, L = 'РАЗМЕРЫ';
    const a = angDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const e = opt.ext ?? 8;
    this.line(cx - c * (r + e), cy - s * (r + e), cx + c * (r + e), cy + s * (r + e), L);
    this.arrow(cx - c * r, cy - s * r, c, s, L);
    this.arrow(cx + c * r, cy + s * r, -c, -s, L);
    this.text(cx + c * (r + e + 6), cy + s * (r + e + 6), h, label, L,
      { align: Math.abs(c) > 0.5 ? 'l' : 'c', valign: 'm' });
    return this;
  }
  // радиальный/угловой размер
  dimRad(cx, cy, r, angDeg, label, opt = {}) {
    const h = opt.h || 3.2, L = 'РАЗМЕРЫ';
    const a = angDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const e = opt.ext ?? 10;
    this.line(cx, cy, cx + c * (r + e), cy + s * (r + e), L);
    this.arrow(cx + c * r, cy + s * r, -c, -s, L);
    this.text(cx + c * (r + e + 3), cy + s * (r + e + 3), h, label, L, { align: 'l', valign: 'm' });
    return this;
  }
}

/* ---------------- Экспорт в DXF ---------------- */
export function toDXF(dr, opts = {}) {
  const b = [];
  const s = str => { for (const ch of String(str)) b.push(...toCP1251(ch)); };
  const nl = () => { b.push(13, 10); };                  // CRLF — разделитель групп DXF
  const n = v => { s(String(Math.round(v * 1e6) / 1e6)); nl(); };

  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const bb = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (const it of dr.items) {
    if (it.t === 'line') { bb(it.x1, it.y1); bb(it.x2, it.y2); }
    else if (it.t === 'circle') { bb(it.x - it.r, it.y - it.r); bb(it.x + it.r, it.y + it.r); }
    else if (it.t === 'arc') { bb(it.x - it.r, it.y - it.r); bb(it.x + it.r, it.y + it.r); }
    else if (it.t === 'solid') { bb(it.x1, it.y1); bb(it.x2, it.y2); bb(it.x3, it.y3); }
    else bb(it.x, it.y);
  }

  const put = (code, val) => { n(code); s(val); nl(); };
  const putN = (code, val) => { n(code); n(val); };

  put(0, 'SECTION'); put(2, 'HEADER');
  put(9, '$ACADVER'); put(1, 'AC1009');
  put(9, '$DWGCODEPAGE'); put(1, 'ANSI_1251');
  put(9, '$INSBASE'); putN(10, 0); putN(20, 0); putN(30, 0);
  put(9, '$EXTMIN'); putN(10, minX - 5); putN(20, minY - 5); putN(30, 0);
  put(9, '$EXTMAX'); putN(10, maxX + 5); putN(20, maxY + 5); putN(30, 0);
  put(9, '$LIMMIN'); putN(10, 0); putN(20, 0);
  put(9, '$LIMMAX'); putN(10, 420); putN(20, 297);
  put(0, 'ENDSEC');

  put(0, 'SECTION'); put(2, 'TABLES');
  put(0, 'TABLE'); put(2, 'LTYPE'); put(70, 2);
  put(0, 'LTYPE'); put(2, 'CONTINUOUS'); put(70, 0); put(3, 'Solid line'); put(72, 65); put(73, 0); putN(40, 0);
  put(0, 'LTYPE'); put(2, 'CENTER'); put(70, 0); put(3, 'Center ____ _ ____');
  put(72, 65); put(73, 2); putN(40, 31.25); putN(49, 12.5); put(74, 0); putN(49, -6.25); put(74, 0);
  put(0, 'ENDTAB');
  put(0, 'TABLE'); put(2, 'LAYER'); put(70, LAYERS.length);
  for (const [name, color, lt] of LAYERS) {
    put(0, 'LAYER'); put(2, name); put(70, 0); put(62, color); put(6, lt);
  }
  put(0, 'ENDTAB');
  put(0, 'TABLE'); put(2, 'STYLE'); put(70, 1);
  put(0, 'STYLE'); put(2, 'STANDARD'); put(70, 0); putN(40, 0); putN(41, 1); putN(50, 0); put(71, 0);
  putN(42, 2.5); put(3, 'txt'); put(4, '');
  put(0, 'ENDTAB');
  put(0, 'ENDSEC');

  put(0, 'SECTION'); put(2, 'BLOCKS');
  for (const nm of ['*Model_Space', '*Paper_Space']) {
    put(0, 'BLOCK'); put(8, '0'); put(2, nm); put(70, 0);
    putN(10, 0); putN(20, 0); putN(30, 0); put(3, nm); put(1, '');
    put(0, 'ENDBLK'); put(8, '0');
  }
  put(0, 'ENDSEC');

  put(0, 'SECTION'); put(2, 'ENTITIES');
  for (const it of dr.items) {
    if (it.t === 'line') {
      put(0, 'LINE'); put(8, it.layer);
      putN(10, it.x1); putN(20, it.y1); putN(30, 0);
      putN(11, it.x2); putN(21, it.y2); putN(31, 0);
    } else if (it.t === 'circle') {
      put(0, 'CIRCLE'); put(8, it.layer);
      putN(10, it.x); putN(20, it.y); putN(30, 0); putN(40, it.r);
    } else if (it.t === 'arc') {
      put(0, 'ARC'); put(8, it.layer);
      putN(10, it.x); putN(20, it.y); putN(30, 0); putN(40, it.r);
      putN(50, it.a1); putN(51, it.a2);
    } else if (it.t === 'solid') {
      put(0, 'SOLID'); put(8, it.layer);
      putN(10, it.x1); putN(20, it.y1); putN(30, 0);
      putN(11, it.x2); putN(21, it.y2); putN(31, 0);
      putN(12, it.x3); putN(22, it.y3); putN(32, 0);
      putN(13, it.x3); putN(23, it.y3); putN(33, 0);
    } else if (it.t === 'text') {
      put(0, 'TEXT'); put(8, it.layer);
      putN(10, it.x); putN(20, it.y); putN(30, 0);
      putN(40, it.h); put(1, it.s);
      if (it.rot) putN(50, it.rot);
      const hj = it.align === 'c' ? 1 : it.align === 'r' ? 2 : 0;
      const vj = it.valign === 'm' ? 2 : it.valign === 't' ? 3 : it.valign === 'b' ? 1 : 0;
      if (hj || vj) { put(72, hj); put(73, vj); putN(11, it.x); putN(21, it.y); putN(31, 0); }
    }
  }
  put(0, 'ENDSEC');
  put(0, 'EOF');
  return new Uint8Array(b);
}

/* ---------------- Экспорт в SVG (предпросмотр) ---------------- */
const SVG_COLOR = {
  'КОНТУР': '#111', 'ОСЕВАЯ': '#c0392b', 'РАЗМЕРЫ': '#1e7d32',
  'ТЕКСТ': '#1b6fb0', 'ОТВЕРСТИЯ': '#8e44ad', 'ТАБЛИЦА': '#555',
};
export function toSVG(dr, W = 420, H = 297, pad = 2) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const bb = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const it of dr.items) {
    if (it.t === 'line') { bb(it.x1, it.y1); bb(it.x2, it.y2); }
    else if (it.t === 'circle') { bb(it.x - it.r, it.y - it.r); bb(it.x + it.r, it.y + it.r); }
    else if (it.t === 'arc') { bb(it.x - it.r, it.y - it.r); bb(it.x + it.r, it.y + it.r); }
    else if (it.t === 'solid') { bb(it.x1, it.y1); bb(it.x2, it.y2); bb(it.x3, it.y3); }
    else bb(it.x, it.y);
  }
  const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
  const k = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = pad + (W - pad * 2 - w * k) / 2 - minX * k;
  const oy = H - pad - (H - pad * 2 - h * k) / 2 + minY * k;
  const X = x => (x * k + ox).toFixed(2);
  const Y = y => (oy - y * k).toFixed(2);
  const R = r => (r * k).toFixed(2);

  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">`;
  g += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (const it of dr.items) {
    const col = SVG_COLOR[it.layer] || '#111';
    const dash = it.layer === 'ОСЕВАЯ' ? ' stroke-dasharray="10 3 2 3"' : '';
    const sw = it.layer === 'КОНТУР' ? 0.6 : 0.4;
    if (it.t === 'line') g += `<line x1="${X(it.x1)}" y1="${Y(it.y1)}" x2="${X(it.x2)}" y2="${Y(it.y2)}" stroke="${col}" stroke-width="${sw}"${dash}/>`;
    else if (it.t === 'circle') g += `<circle cx="${X(it.x)}" cy="${Y(it.y)}" r="${R(it.r)}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    else if (it.t === 'arc') {
      const a1 = it.a1 * Math.PI / 180, a2 = it.a2 * Math.PI / 180;
      const p1 = [it.x + it.r * Math.cos(a1), it.y + it.r * Math.sin(a1)];
      const p2 = [it.x + it.r * Math.cos(a2), it.y + it.r * Math.sin(a2)];
      const large = Math.abs(it.a2 - it.a1) > 180 ? 1 : 0;
      g += `<path d="M${X(p1[0])} ${Y(p1[1])} A${R(it.r)} ${R(it.r)} 0 ${large} 0 ${X(p2[0])} ${Y(p2[1])}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    }
    else if (it.t === 'solid') g += `<polygon points="${X(it.x1)},${Y(it.y1)} ${X(it.x2)},${Y(it.y2)} ${X(it.x3)},${Y(it.y3)}" fill="${col}"/>`;
    else if (it.t === 'text') {
      const anchor = it.align === 'c' ? 'middle' : it.align === 'r' ? 'end' : 'start';
      const bl = it.valign === 'm' ? 'middle' : it.valign === 't' ? 'text-before-edge' : 'auto';
      const rot = it.rot ? ` transform="rotate(${-it.rot} ${X(it.x)} ${Y(it.y)})"` : '';
      g += `<text x="${X(it.x)}" y="${Y(it.y)}" font-size="${(it.h * k).toFixed(2)}" fill="${col}" text-anchor="${anchor}" dominant-baseline="${bl}"${rot}>${esc(it.s)}</text>`;
    }
  }
  return g + '</svg>';
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------------- Рамка и штамп ---------------- */
export function sheetFrame(dr, meta) {
  const W = 420, H = 297;
  dr.rect(10, 10, W - 20, H - 20, 'КОНТУР');
  dr.rect(12, 12, W - 24, H - 24, 'КОНТУР');
  // штамп 180×56 в правом нижнем углу
  const x0 = 230, y0 = 10, w = 180, h = 56;
  dr.rect(x0, y0, w, h, 'ТАБЛИЦА');
  dr.line(x0, y0 + 20, x0 + w, y0 + 20, 'ТАБЛИЦА');
  dr.line(x0 + 92, y0 + 20, x0 + 92, y0 + h, 'ТАБЛИЦА');
  dr.line(x0 + 138, y0 + 20, x0 + 138, y0 + h, 'ТАБЛИЦА');
  dr.line(x0, y0 + 44, x0 + 92, y0 + 44, 'ТАБЛИЦА');
  // строки служебных данных
  dr.text(x0 + 94, y0 + 52, 2.2, 'Обозначение', 'ТЕКСТ');
  dr.text(x0 + 140, y0 + 52, 2.2, 'Шифра', 'ТЕКСТ');
  dr.text(x0 + 140, y0 + 40, 3.2, meta.code, 'ТЕКСТ');
  dr.text(x0 + 94, y0 + 38, 3.2, 'Масса, кг', 'ТЕКСТ');
  dr.text(x0 + 94, y0 + 26, 3.2, 'Масштаб', 'ТЕКСТ');
  dr.text(x0 + 140, y0 + 26, 3.2, meta.scale, 'ТЕКСТ');
  dr.text(x0 + 94, y0 + 14, 3.2, 'Лист', 'ТЕКСТ');
  dr.text(x0 + 112, y0 + 14, 3.2, 'Листов', 'ТЕКСТ');
  dr.text(x0 + 126, y0 + 14, 3.2, '1', 'ТЕКСТ');
  dr.text(x0 + 144, y0 + 14, 3.2, String(meta.sheets), 'ТЕКСТ');
  // подписи
  const roles = ['Разраб.', 'Пров.', 'Т.контр.', 'Н.контр.', 'Утв.'];
  roles.forEach((r, i) => {
    const x = x0 + 3 + i * 35.4;
    dr.text(x, y0 + 8, 2.2, r, 'ТЕКСТ');
    dr.line(x, y0 + 12, x + 26, y0 + 12, 'ТАБЛИЦА');
  });
  // наименование
  const words = String(meta.name).split(' ');
  let line = '', ly = y0 + h - 6;
  const lines = [];
  for (const w2 of words) {
    if ((line + ' ' + w2).length > 18) { lines.push(line); line = w2; }
    else line = line ? line + ' ' + w2 : w2;
  }
  lines.push(line);
  lines.slice(-3).forEach((L, i, arr) => {
    dr.text(x0 + 4, ly - (arr.length - 1 - i) * 5, 3.4, L, 'ТЕКСТ');
  });
  return dr;
}

export function techBlock(dr, x, y, lines, w = 210) {
  dr.text(x, y, 3.6, 'Технические требования', 'ТЕКСТ');
  dr.line(x, y - 2, x + w, y - 2, 'ТАБЛИЦА');
  lines.forEach((L, i) => {
    const yy = y - 8 - i * 5;
    if (i === 0) dr.text(x, yy, 3, '1. ' + L, 'ТЕКСТ');
    else dr.text(x + 3, yy, 3, L, 'ТЕКСТ');
  });
  return dr;
}

/* ---------------- Комплект чертежей ---------------- */
const D2R = Math.PI / 180;
const LUG_W = 24, LUG_H = 28, LUG_HOLE = 9;   // проушина на накладке
const n4 = 4;                                 // отверстий на накладке
let S_COUNT = 7;                              // листов в комплекте (обновляется в buildSheets)


export function buildSheets(p) {
  const S = [];
  S_COUNT = 7;
  S.push(sheetAssembly(p));
  S.push(sheetSegment(p));
  S.push(sheetNakladka(p));
  S.push(sheetUgolok(p));
  S.push(sheetPolochka(p));
  S.push(sheetOgradenie(p));
  S.push(sheetVedomost(p));
  return S;
}

/* --- Лист 1: сборка --- */
function sheetAssembly(p) {
  const dr = new Dr();
  const k = 0.22, cx = 112, cy = 178;                 // М 1:4,5
  const Ro = p.Ro * k, Ri = p.Ri * k;
  const toPaper = a => -a;                            // угол 3D → угол на бумаге

  // ---- план
  dr.centerLine(cx, cy, Ro * 2 + 16, 0);
  dr.centerLine(cx, cy, Ro * 2 + 16, Math.PI / 2);
  for (let i = 0; i < p.n; i++) {
    const c = i * p.pitch + p.pitch / 2;
    // углы на бумаге: разворот на −c (вид сверху, 3D-угол → бумажный)
    const pa0 = -(c + p.segAng / 2) / D2R, pa1 = -(c - p.segAng / 2) / D2R;
    dr.arc(cx, cy, Ro, pa0, pa1, 'КОНТУР');
    dr.arc(cx, cy, Ri, pa1, pa0, 'КОНТУР');
    dr.line(cx + Ro * Math.cos(pa0 * D2R), cy + Ro * Math.sin(pa0 * D2R),
      cx + Ri * Math.cos(pa0 * D2R), cy + Ri * Math.sin(pa0 * D2R), 'КОНТУР');
    dr.line(cx + Ro * Math.cos(pa1 * D2R), cy + Ro * Math.sin(pa1 * D2R),
      cx + Ri * Math.cos(pa1 * D2R), cy + Ri * Math.sin(pa1 * D2R), 'КОНТУР');
    // номер сегмента — внутри кольца
    const a = toPaper(c) / D2R;
    const nr = Ri - 11;
    dr.circle(cx + nr * Math.cos(a * D2R), cy + nr * Math.sin(a * D2R), 5.5, 'ТЕКСТ');
    dr.text(cx + nr * Math.cos(a * D2R), cy + nr * Math.sin(a * D2R) + 1.4, 4, String(i + 1), 'ТЕКСТ', { align: 'c' });
  }
  // накладки (стыки)
  for (let j = 0; j < p.n; j++) {
    const aj = toPaper(j * p.pitch) / D2R;
    const half = (p.Lp / 2 / p.Ri) / D2R;
    dr.arc(cx, cy, Ri - 2.5, aj - half, aj + half, 'КОНТУР');
    dr.arc(cx, cy, Ri - 5, aj - half, aj + half, 'КОНТУР');
  }
  // стойки уголков + полочки
  for (const sh of p.shelves) {
    const a = toPaper(sh.a);
    const rr = Ro + p.angT * k / 2;
    for (const dz of sh.bracketZ) {
      const ox = cx + Math.cos(a) * rr - Math.sin(a) * dz * k;
      const oy = cy + Math.sin(a) * rr + Math.cos(a) * dz * k;
      dr.rectRot(ox, oy, p.angT * k, p.angA * k, a, 'КОНТУР');
      // горизонтальная полка уголка — наружу
      const hx = ox + Math.cos(a) * (p.angB * k / 2);
      const hy = oy + Math.sin(a) * (p.angB * k / 2);
      dr.rectRot(hx, hy, p.angB * k, p.angT * k, a, 'КОНТУР');
    }
    // полочка
    const scx = cx + Math.cos(a) * (Ro + p.angT * k + sh.depth * k / 2);
    const scy = cy + Math.sin(a) * (Ro + p.angT * k + sh.depth * k / 2);
    dr.rectRot(scx, scy, sh.depth * k, sh.width * k, a, 'КОНТУР');
    // 4 прутка ограждения — на осях сторон осевого квадрата
    const lay = railingLayout(sh);
    const lx = x => (x - sh.depth / 2) * k, ly = z => -z * k;
    for (const rl of lay.rails) {
      const ax = rl.dir === 'z' ? lx(rl.at) : lx(rl.a);
      const ay = rl.dir === 'z' ? ly(rl.a) : ly(rl.at);
      const bx = rl.dir === 'z' ? lx(rl.at) : lx(rl.b);
      const by = rl.dir === 'z' ? ly(rl.b) : ly(rl.at);
      const rx = Ro + p.angT * k;
      dr.line(cx + Math.cos(a) * rx - Math.sin(a) * ax, cy + Math.sin(a) * rx + Math.cos(a) * ay,
              cx + Math.cos(a) * rx - Math.sin(a) * bx, cy + Math.sin(a) * rx + Math.cos(a) * by, 'КОНТУР');
    }
    // номер полочки — снаружи, на радиусе края полки
    const lr = Ro + p.angT * k + sh.depth * k + 9;
    const nx = cx + lr * Math.cos(a), ny = cy + lr * Math.sin(a);
    dr.circle(nx, ny, 5.5, 'ТЕКСТ');
    dr.text(nx, ny + 1.4, 4, String(p.shelves.indexOf(sh) + 1), 'ТЕКСТ', { align: 'c' });
  }
  dr.dimDia(cx, cy, Ro, 45, 'Ø' + p.D);
  dr.text(cx, cy - Ro - 16, 3.4, `Кольцо Ø${p.D}×${p.H} мм, ${p.n} сегм., зазор ${p.gap} мм`, 'ТЕКСТ', { align: 'c' });
  dr.text(cx, cy - Ro - 22, 3.4, 'накладки — концентрические дуги на стыках', 'ТЕКСТ', { align: 'c' });

  // ---- вид спереди (схематично, 1:4)
  const fy = 92, fx = 108, hw = Ro;
  dr.rect(fx - hw, fy, hw * 2, p.H * k, 'КОНТУР');
  dr.centerLine(fx, fy + p.H * k / 2, hw * 2 + 20, 0);
  // стойка снаружи + полочка наружу
  const sh0 = p.shelves[0];
  const drop = p.angDrop * k, shd = sh0.depth * k, shT = p.shT * k;
  const legX = fx + hw;                 // наружная поверхность кольца
  for (const dz of sh0.bracketZ) {
    dr.rect(legX + dz * k, fy - drop, p.angT * k, drop, 'КОНТУР');
    dr.rect(legX + dz * k, fy - drop - p.angT * k, p.angB * k, p.angT * k, 'КОНТУР');
  }
  dr.rect(legX + p.angT * k, fy - drop - p.angT * k - shT, shd, shT, 'КОНТУР');
  // ограждение: столбики и пруток (вид с торца полочки)
  {
    const lay0 = railingLayout(sh0);
    const baseY = fy - drop - p.angT * k - shT;
    for (const pt of lay0.posts) {
      const px = legX + p.angT * k + pt.x * k;
      dr.circle(px, baseY - p.postH * k / 2, p.postD / 2 * k, 'КОНТУР');
    }
    const railY = baseY - p.railH * k;
    for (const ax of [sh0.ins, sh0.depth - sh0.ins]) {
      dr.circle(legX + p.angT * k + ax * k, railY, p.rodD / 2 * k, 'КОНТУР');
    }
  }
  dr.dimH(fx - hw, fy, fx + hw, fy, fy + p.H * k + 12, 'Ø' + p.D);
  dr.dimV(fx - hw - 12, fy, fx - hw - 12, fy + p.H * k, fx - hw - 12, p.H + '', { side: -1 });
  dr.dimV(legX, fy, legX, fy - drop, legX + 30, p.angDrop + '', { side: 1 });
  dr.dimH(legX + p.angT * k, fy - drop - p.angT * k - shT, legX + p.angT * k + shd, fy - drop - p.angT * k - shT, fy - drop - p.angT * k - shT - 10, sh0.depth + '');
  dr.text(fx - hw, fy - drop - 30, 3.4, `Вид спереди: стойка ${p.angDrop} мм снаружи, полочка ${sh0.depth}×${sh0.width} мм`, 'ТЕКСТ');

  // ---- техтребования
  techBlock(dr, 232, 252, [
    `Изделие: цветочный подвес. Кольцо сборное, ${p.n} сегм.`,
    `Кольцо: полоса ${p.t}×${p.H} мм, ${p.mat}, вальцовка по R${p.Ro} (наружн.).`,
    `Развёртка сегмента ${p.L.toFixed(1)} мм, угол ${(p.segAng / D2R).toFixed(2)}°.`,
    `Проверять шаблоном: хорда ${p.chord.toFixed(1)}, стрела ${p.sag.toFixed(1)} мм.`,
    `Стыки: накладка ${p.t}×${p.H}×${p.Lp} мм изнутри, ${p.n * 4} шт М${p.bolt}.`,
    `Уголок ${p.angT}×${p.angA}, стойка ${p.angDrop} мм снаружи кольца.`,
    `Полочка ${p.shT} мм, ${p.shelves.length} шт, размеры по ведомости.`,
    `Ограждение: пруток Ø${p.rodD}, столбики Ø${p.postD}×${p.postH} мм.`,
    `Неуказанные отклонения ±0,5 мм. Покрытие RAL 9005.`,
  ], 175);

  sheetFrame(dr, { code: 'П1', name: 'Цветочный подвес. Сборка', scale: '1:4', sheets: S_COUNT, mass: p.mTotal.toFixed(2) });
  return { code: 'П1', name: 'Сборка', items: dr.items };
}

/* --- Лист 2: сегмент кольца --- */
function sheetSegment(p) {
  const dr = new Dr();
  const k = 0.5, x0 = 55, y0 = 200;
  const w = p.L * k, h = p.H * k;
  dr.rect(x0, y0, w, h, 'КОНТУР');
  dr.centerLine(x0 + w / 2, y0 + h / 2, w + 20, 0);
  const hr = p.dHole / 2 * k;
  const hpos = [...p.holes.map(d => x0 + d * k), ...p.holes.map(d => x0 + (p.L - d) * k)];
  hpos.forEach(x => {
    dr.circle(x, y0 + h / 2, hr, 'ОТВЕРСТИЯ');
    dr.centerMark(x, y0 + h / 2, hr, 'ОСЕВАЯ');
  });
  dr.dimH(x0, y0, x0 + w, y0, y0 - 12, p.L.toFixed(1));
  dr.dimV(x0 + w, y0, x0 + w, y0 + h, x0 + w + 14, p.H + '');
  const dd = (a, b) => (b - a).toFixed(0);
  dr.dimH(x0, y0, hpos[0], y0, y0 - 22, dd(x0, hpos[0]));
  dr.dimH(hpos[0], y0, hpos[1], y0, y0 - 22, dd(hpos[0], hpos[1]));
  dr.dimH(hpos[1], y0, hpos[2], y0, y0 - 22, dd(hpos[1], hpos[2]));
  dr.dimH(hpos[2], y0, hpos[3], y0, y0 - 22, dd(hpos[2], hpos[3]));
  dr.dimH(hpos[3], y0, x0 + w, y0, y0 - 22, dd(hpos[3], x0 + w));
  dr.dimRad(hpos[0], y0 + h / 2, hr, 90, 'Ø' + p.dHole, { ext: 12 });
  dr.text(x0, y0 + h + 10, 3.6, 'Поз. 1 — Сегмент кольца (4 шт.)', 'ТЕКСТ');
  dr.text(x0, y0 + h + 16, 3, 'Развёртка по средней линии Ø' + (p.Rm * 2).toFixed(0) + ' мм', 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Сегмент кольца, ${p.n} шт.`,
    `Материал: ${p.mat}, полоса ${p.t}×${p.H} мм.`,
    `Развёртка ${p.L.toFixed(1)} мм, угол вальцовки ${(p.segAng / D2R).toFixed(2)}°.`,
    `Вальцевать по R${p.Ro} (наружн.), R${p.Ri} (внутр.).`,
    `Контроль: хорда ${p.chord.toFixed(1)} мм, стрела ${p.sag.toFixed(1)} мм.`,
    `${p.n * 4} отв. Ø${p.dHole} на оси полосы, H/2 = ${p.H / 2}.`,
    `Сверлить в сборе с накладкой.`,
    `Покрытие: порошок RAL 9005, толщина 60–80 мкм.`,
  ], 175);
  sheetFrame(dr, { code: 'П2', name: 'Сегмент кольца', scale: '1:2', sheets: S_COUNT, mass: (p.mSeg * p.n).toFixed(2) });
  return { code: 'П2', name: 'Сегмент кольца', items: dr.items };
}

/* --- Лист 3: накладка --- */
function sheetNakladka(p) {
  const dr = new Dr();
  const k = 1, x0 = 70, y0 = 190;
  const w = p.Lp * k, h = p.H * k;
  const lug = p.lugs;
  const lw = lug ? LUG_W / 2 : 0, lh = lug ? LUG_H : 0;
  // корпус
  dr.rect(x0, y0, w, h, 'КОНТУР');
  if (lug) {
    const mx = x0 + w / 2, top = y0 + lh - lw;
    dr.line(x0, y0, x0, y0 + lh - lw, 'КОНТУР');
    dr.line(x0 + w, y0, x0 + w, y0 + lh - lw, 'КОНТУР');
    // вырез под проушину: рисуем дугу по верхнему краю
    dr.arc(mx, top, lw, 0, 180, 'КОНТУР');
    dr.line(x0, y0 + lh - lw, mx - lw, y0 + lh - lw, 'КОНТУР');
    dr.line(x0 + w, y0 + lh - lw, mx + lw, y0 + lh - lw, 'КОНТУР');
    dr.circle(mx, top, LUG_HOLE / 2, 'ОТВЕРСТИЯ');
    dr.centerMark(mx, top, LUG_HOLE / 2, 'ОСЕВАЯ');
    dr.dimRad(mx, top, LUG_HOLE / 2, 90, 'Ø' + LUG_HOLE, { ext: 14 });
    dr.dimV(x0, y0 + lh, x0, y0, x0 - 12, lh + '', { side: -1 });
    dr.text(mx, y0 + lh - lw + 6, 3, 'R' + lw, 'ТЕКСТ', { align: 'c' });
  }
  // отверстия
  const hr = p.dHole / 2, mid = x0 + w / 2, phy = y0 + h / 2, g2 = p.gap / 2;
  const hx = [...p.holes.map(d => mid - g2 - d), ...p.holes.map(d => mid + g2 + d)];
  hx.forEach(x => { dr.circle(x, phy, hr, 'ОТВЕРСТИЯ'); dr.centerMark(x, phy, hr, 'ОСЕВАЯ'); });
  dr.centerLine(mid, phy, w + 16, 0);
  dr.dimH(x0, y0, x0 + w, y0, y0 - 14, p.Lp + '');
  dr.dimV(x0 + w, y0, x0 + w, y0 + h, x0 + w + 14, p.H + '');
  dr.dimRad(hx[1], phy, hr, 90, 'Ø' + p.dHole, { ext: 14 });
  dr.dimH(hx[1], phy, hx[2], phy, y0 - 26, (p.holes[0] * 2 + p.gap).toFixed(0));
  dr.text(x0, y0 + h + 10, 3.6, 'Поз. 2 — Накладка (4 шт.)', 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Накладка стыка, ${p.n} шт.`,
    `Материал: ${p.mat}, полоса ${p.t}×${p.H} мм.`,
    `Длина ${p.Lp} мм, вальцевать по R${p.Ri} мм (внутр. сторона к кольцу).`,
    `${n4} отв. Ø${p.dHole} (по 2 с каждой стороны оси).`,
    `Проушина ${LUG_W}×${LUG_H} мм, отв. Ø${LUG_HOLE} — точка подвеса.`,
    `Отверстия сверлить совместно с сегментом.`,
    `Покрытие RAL 9005.`,
  ], 175);
  sheetFrame(dr, { code: 'П3', name: 'Накладка стыка', scale: '1:1', sheets: S_COUNT, mass: (p.mPlate * p.n).toFixed(2) });
  return { code: 'П3', name: 'Накладка', items: dr.items };
}

/* --- Лист 4: уголок --- */
function sheetUgolok(p) {
  const dr = new Dr();
  const k = 1, x0 = 60, y0 = 120;
  const t = p.angT * k, Drop = p.angDrop * k, B = p.angB * k;
  const len = (p.angDrop + p.angB - p.angT) * k;      // длина развёртки полосы
  const bend = (p.angDrop - p.angT) * k;             // до линии сгиба

  // ---- развёртка полосы с линией сгиба
  dr.rect(x0, y0, len, t, 'КОНТУР');
  dr.centerLine(x0 + bend, y0 - 6, 12, Math.PI / 2, 'ОСЕВАЯ');
  dr.dimH(x0, y0, x0 + bend, y0, y0 - 16, bend.toFixed(0));
  dr.dimH(x0 + bend, y0, x0 + len, y0, y0 - 16, (len - bend).toFixed(0));
  dr.dimH(x0, y0, x0 + len, y0, y0 - 28, len.toFixed(0));
  dr.dimV(x0 - 14, y0, x0 - 14, y0 + t, x0 - 14, p.angT + '', { side: -1 });
  dr.text(x0, y0 + t + 14, 3.6, 'Поз. 3 — Уголок Г (перевёрнутая), ' + (p.shelves.length * p.angN) + ' шт.', 'ТЕКСТ');
  dr.text(x0, y0 + t + 21, 3, 'Развёртка полосы; штрихпунктир — линия сгиба (внутренний R)', 'ТЕКСТ');

  // ---- схема сгиба: стойка вниз от линии сгиба + горизонтальная полка наружу
  const bx = 60, by = 190, bs = 1;
  dr.text(bx, by + 22, 3.6, 'Схема сгиба (вид с торца полки)', 'ТЕКСТ');
  const legTop = by, legBot = by - p.angDrop * bs;          // стойка идёт вниз
  dr.rect(bx + 4 * bs, legBot, t * bs, p.angDrop * bs, 'КОНТУР');
  dr.rect(bx + 4 * bs + t * bs, legBot - t * bs, p.angB * bs, t * bs, 'КОНТУР');
  dr.centerLine(bx - 6, legTop, 90, 0, 'ОСЕВАЯ');           // линия сгиба
  dr.dimV(bx + 4 * bs, legTop, bx + 4 * bs, legBot, bx, p.angDrop + '', { side: -1 });
  dr.dimH(bx + 4 * bs + t * bs, legBot - t * bs, bx + 4 * bs + t * bs + p.angB * bs, legBot - t * bs, legBot - 16, p.angB + '');
  dr.text(bx + 4 * bs + t * bs + p.angB * bs + 6, legBot - t * bs + 1, 3, 'наружу', 'ТЕКСТ');

  // ---- сечение полки (поперёк)
  const sx = 250, sy = 200, sk = 2.2;
  dr.text(sx - 30, sy + 40, 3.6, 'Сечение полки (М 2:1)', 'ТЕКСТ');
  const t2 = p.angT * sk, A2 = p.angA * sk;
  dr.rect(sx, sy, A2, t2, 'КОНТУР');
  dr.dimH(sx, sy, sx + A2, sy, sy - 14, p.angA + '');
  dr.dimV(sx + A2, sy, sx + A2, sy + t2, sx + A2 + 14, p.angT + '');
  dr.text(sx, sy + t2 + 10, 3, 'Ширина полок × толщина полосы', 'ТЕКСТ');
  dr.text(sx, sy + t2 + 16, 3, `Стойка: ${p.angDrop} мм, горизонтальная полка: ${p.angB} мм`, 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Уголок Г (перевёрнутая), ${p.shelves.length * p.angN} шт.`,
    `Материал: ${p.mat}, полоса ${p.angT} мм.`,
    `Развёртка ${len.toFixed(0)}×${p.angT} мм, сгиб по линии ${bend.toFixed(0)} мм.`,
    `Гнуть по внутреннему R${(p.angT * 1.5).toFixed(1)} мм, полки ${p.angA} мм.`,
    `Стойка ${p.angDrop} мм вниз, горизонтальная полка ${p.angB} мм наружу.`,
    `Стойка крепится к кольцу ${p.angN * 2}×М${p.bolt} сквозь полосу.`,
    `Полочка крепится к горизонтальной полке 2×М${p.bolt} на уголок.`,
    `Острые кромки притупить R0,5. Покрытие RAL 9005.`,
  ], 175);
  sheetFrame(dr, { code: 'П4', name: 'Уголок', scale: '1:1', sheets: S_COUNT, mass: (p.mBracket * p.shelves.length * p.angN).toFixed(2) });
  return { code: 'П4', name: 'Уголок', items: dr.items };
}

/* --- Лист 5: полочка --- */
function sheetPolochka(p) {
  const dr = new Dr();
  const sh = p.shelves[0];
  const k = 0.5;
  const x0 = 45, y0 = 165, w = sh.depth * k, h = sh.width * k;
  const lay = railingLayout(sh);
  const brZ = sh.bracketZ;

  // план: пластина + 4 прутка + столбики + отверстия под пистоны
  dr.rect(x0, y0, w, h, 'КОНТУР');
  const PX = x => x0 + x * k, PY = z => y0 + (sh.width / 2 - z) * k;
  for (const rl of lay.rails) {
    const ax = rl.dir === 'z' ? PX(rl.at) : PX(rl.a);
    const ay = rl.dir === 'z' ? PY(rl.a) : PY(rl.at);
    const bx = rl.dir === 'z' ? PX(rl.at) : PX(rl.b);
    const by = rl.dir === 'z' ? PY(rl.b) : PY(rl.at);
    dr.line(ax, ay, bx, by, 'КОНТУР');
  }
  for (const pt of lay.posts) {
    dr.circle(PX(pt.x), PY(pt.z), p.postD / 2 * k, 'ОТВЕРСТИЯ');
  }
  const hr = p.dHole / 2 * k;
  for (const ps of sh.boltPts) {
    dr.circle(PX(ps.x), PY(ps.z), hr, 'ОТВЕРСТИЯ');
    dr.centerMark(PX(ps.x), PY(ps.z), hr, 'ОСЕВАЯ');
  }
  dr.dimH(x0, y0, x0 + w, y0, y0 - 14, sh.depth + '');
  dr.dimV(x0 + w, y0, x0 + w, y0 + h, x0 + w + 14, sh.width + '');
  // отступ прутков от кромки
  dr.dimH(x0, y0 + h, PX(sh.ins), y0 + h, y0 + h + 10, sh.ins + '');
  // расстояние между осями уголков
  if (brZ.length > 1) {
    dr.dimV(PX(sh.boltX), PY(brZ[0]), PX(sh.boltX), PY(brZ[brZ.length - 1]), PX(sh.boltX) + 12,
      (brZ[brZ.length - 1] - brZ[0]).toFixed(0), { side: 1 });
  }

  // развёртка (только контур и отверстия)
  const x1 = 190, y1 = 165;
  dr.rect(x1, y1, w, h, 'КОНТУР');
  for (const ps of sh.boltPts) {
    const bx = x1 + ps.x * k, by = y1 + (sh.width / 2 - ps.z) * k;
    dr.circle(bx, by, hr, 'ОТВЕРСТИЯ');
    dr.centerMark(bx, by, hr, 'ОСЕВАЯ');
  }
  dr.dimH(x1, y1, x1 + w, y1, y1 - 14, sh.depth + '');
  dr.dimV(x1 + w, y1, x1 + w, y1 + h, x1 + w + 14, sh.width + '');
  dr.text(x0, y0 + h + 12, 3.6, 'Поз. 4 — Полочка (' + p.shelves.length + ' шт.), М 1:2', 'ТЕКСТ');
  dr.text(x0, y0 + h + 18, 3, 'Слева — план с ограждением, справа — развёртка (отв. насквозь)', 'ТЕКСТ');

  // таблица отверстий
  const ty = 96;
  dr.text(x0, ty, 3.2, 'Координаты отверстий от края (мм):', 'ТЕКСТ');
  dr.text(x0, ty - 6, 3, `X = ${sh.boltX.toFixed(0)} мм от кромки со стороны кольца; Y = ${brZ.map(z => z.toFixed(0)).join(' и ')} мм (${brZ.length} шт.)`, 'ТЕКСТ');
  dr.text(x0, ty - 12, 3, `Ø${p.dHole} под М${p.bolt}, ${brZ.length} отв. на полочку (по одному на уголок)`, 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Полочка плоская, ${p.shelves.length} шт.`,
    `Материал: ${p.mat}, лист ${p.shT} мм.`,
    `Размеры — по ведомости (лист П7), мм:`,
    ...p.shelves.map((q, i) => `  №${i + 1}: ${q.depth}×${q.width}, угол ${q.ang.toFixed(0)}°, столбиков/стор. ${q.posts}.`),
    `Ограждение — пруток Ø${p.rodD}, столбики Ø${p.postD} (лист П6).`,
    `Кромки притупить. Покрытие RAL 9005.`,
  ], 175);
  sheetFrame(dr, { code: 'П5', name: 'Полочка', scale: '1:2', sheets: S_COUNT, mass: (p.shelves[0].mShelf * p.shelves.length).toFixed(2) });
  return { code: 'П5', name: 'Полочка', items: dr.items };
}


/* --- Лист 6: ограждение --- */
function sheetOgradenie(p) {
  const dr = new Dr();
  const sh = p.shelves[0];
  // развёртка прутка: столбики отдельными отрезками + 2 контура, всё в пределах листа
  const x0 = 24, y0 = 232, maxW = 196;                 // рабочая ширина сверху
  const k = Math.min(maxW / Math.max(sh.rodLen, 1), 0.16);
  const len = sh.rodLen * k;
  dr.text(x0, y0 + 14, 3.6, 'Поз. 5 — Ограждение (' + p.shelves.length + ' шт.), пруток Ø' + p.rodD, 'ТЕКСТ');
  dr.text(x0, y0 + 8, 3, `Развёртка: столбики ${sh.postsTotal} шт по ${p.postH} мм + прутки 2×${sh.railLenZ} и 2×${sh.railLenX} мм`, 'ТЕКСТ');
  dr.line(x0, y0, x0 + len, y0, 'КОНТУР');
  dr.line(x0, y0 + 4, x0 + len, y0 + 4, 'КОНТУР');
  dr.line(x0, y0, x0, y0 + 4, 'КОНТУР');
  dr.line(x0 + len, y0, x0 + len, y0 + 4, 'КОНТУР');
  dr.dimH(x0, y0, x0 + len, y0, y0 + 14, (sh.rodLen / 1000).toFixed(2) + ' м');
  dr.text(x0, y0 - 4, 2.8, `М ${(1 / k).toFixed(1)}:1`, 'ТЕКСТ');

  // схема ограждения в плане: пластина, прутки, столбики
  const lay = railingLayout(sh);
  const cx = 250, cy = 150, kk = Math.min(110 / sh.depth, 110 / sh.width);
  const dw = sh.depth * kk, dh = sh.width * kk;
  dr.rect(cx - dw / 2, cy - dh / 2, dw, dh, 'КОНТУР');
  const PX = x => cx - dw / 2 + x * kk, PY = z => cy + (sh.width / 2 - z) * kk;
  for (const rl of lay.rails) {
    const ax = rl.dir === 'z' ? PX(rl.at) : PX(rl.a);
    const ay = rl.dir === 'z' ? PY(rl.a) : PY(rl.at);
    const bx = rl.dir === 'z' ? PX(rl.at) : PX(rl.b);
    const by = rl.dir === 'z' ? PY(rl.b) : PY(rl.at);
    dr.line(ax, ay, bx, by, 'КОНТУР');
  }
  for (const pt of lay.posts) {
    dr.circle(PX(pt.x), PY(pt.z), p.postD / 2 * kk, 'ОТВЕРСТИЯ');
  }
  dr.text(cx - dw / 2, cy + dh / 2 + 14, 3.2, 'Схема ограждения в плане (прутки и столбики)', 'ТЕКСТ');
  dr.text(cx - dw / 2, cy + dh / 2 + 8, 2.8, `Пруток Ø${p.rodD} — 4 шт: 2×${sh.railLenZ} мм и 2×${sh.railLenX} мм`, 'ТЕКСТ');

  // таблица раскроя
  const tx = 24, ty = 150, rows = [
    ['Наименование', 'Кол.', 'Длина, мм'],
    ['Столбик Ø' + p.postD + '×' + p.postH, String(sh.postsTotal), p.postH + ''],
    ['Пруток Ø' + p.rodD + ' (вдоль ширины)', '2', sh.railLenZ.toFixed(0)],
    ['Пруток Ø' + p.rodD + ' (вдоль глубины)', '2', sh.railLenX.toFixed(0)],
    ['Итого на полочку', '—', sh.rodLen.toFixed(0)],
  ];
  const cw = [96, 24, 42];
  dr.rect(tx, ty - 12, cw[0] + cw[1] + cw[2], 5 + rows.length * 7, 'ТАБЛИЦА');
  rows.forEach((r, i) => {
    const yy = ty - 7 - i * 7;
    if (i) dr.line(tx, yy + 3.5, tx + cw[0] + cw[1] + cw[2], yy + 3.5, 'ТАБЛИЦА');
    dr.text(tx + 2, yy, 3, r[0], 'ТЕКСТ');
    dr.text(tx + cw[0] + 2, yy, 3, r[1], 'ТЕКСТ');
    dr.text(tx + cw[0] + cw[1] + 2, yy, 3, r[2], 'ТЕКСТ');
  });
  dr.text(tx, ty + 8, 3.2, 'Раскрой на одну полочку', 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Ограждение полочки, ${p.shelves.length} шт.`,
    `Пруток круглый Ø${p.rodD} мм, ${p.mat}.`,
    `Столбики Ø${p.postD}×${p.postH} мм, ${sh.postsTotal} шт — приварить к полочке.`,
    `Прутки: 2 шт по ${sh.railLenZ} мм и 2 шт по ${sh.railLenX} мм — на осях сторон квадрата ${sh.axisD}×${sh.axisW} мм.`,
    `Пруток лежит на столбиках, прихватывается в 2 точках по длине.`,
    `Длина прутка на полочку: ${(sh.rodLen / 1000).toFixed(2)} м.`,
    `Сварка — по ГОСТ Р 52916-2008, катет 3 мм.`,
    `Швы зачистить, покрытие RAL 9005.`,
  ], 175);
  sheetFrame(dr, { code: 'П6', name: 'Ограждение', scale: '1:2', sheets: S_COUNT, mass: (sh.mRod * p.shelves.length).toFixed(2) });
  return { code: 'П6', name: 'Ограждение', items: dr.items };
}

/* --- Лист 7: ведомость полочек + спецификация --- */
function sheetVedomost(p) {
  const dr = new Dr();
  const x0 = 30, y0 = 262;
  dr.text(x0, y0, 4, 'Ведомость полочек', 'ТЕКСТ');
  const cols = [16, 30, 30, 30, 28, 40, 30];
  const rows = [['№', 'Угол, °', 'Глубина', 'Ширина', 'Столб./стор.', 'Пруток, м', 'Масса, кг']];
  p.shelves.forEach((q, i) => {
    rows.push([String(i + 1), q.ang.toFixed(0), String(q.depth), String(q.width),
      String(q.posts), (q.rodLen / 1000).toFixed(2), q.mTotal.toFixed(2)]);
  });
  const tx = x0, ty = y0 - 10, rh = 8;
  const tw = cols.reduce((a, b) => a + b, 0);
  dr.rect(tx, ty - rh * rows.length, tw, rh * rows.length, 'ТАБЛИЦА');
  rows.forEach((r, i) => {
    const yy = ty - rh * (i + 1) + 2.5;
    let cx0 = tx;
    r.forEach((c, j) => {
      dr.text(cx0 + 2, yy, 3.2, c, 'ТЕКСТ');
      cx0 += cols[j];
    });
    if (i) dr.line(tx, ty - rh * i, tx + tw, ty - rh * i, 'ТАБЛИЦА');
  });
  cols.slice(0, -1).forEach((w, j) => {
    let cx0 = tx; for (let i = 0; i < j; i++) cx0 += cols[i];
    dr.line(cx0, ty - rh * rows.length, cx0, ty, 'ТАБЛИЦА');
  });

  // спецификация изделия
  const sy = 180;
  dr.text(x0, sy, 4, 'Спецификация изделия', 'ТЕКСТ');
  const spec = [
    ['1', `Сегмент кольца, полоса ${p.t}×${p.H}, L=${p.L.toFixed(1)}`, p.n, (p.mSeg * p.n).toFixed(2)],
    ['2', `Накладка, ${p.t}×${p.H}×${p.Lp}`, p.n, (p.mPlate * p.n).toFixed(2)],
    ['3', `Уголок ${p.angT}×${p.angA}, стойка ${p.angDrop}`, p.shelves.length * p.angN, (p.mBracket * p.shelves.length * p.angN).toFixed(2)],
    ['4', `Полочка, ${p.shT} мм, размеры по ведомости`, p.shelves.length, (p.shelves.reduce((a, q) => a + q.mShelf, 0)).toFixed(2)],
    ['5', `Пруток ограждения Ø${p.rodD}`, p.shelves.length, (p.shelves.reduce((a, q) => a + q.mRod, 0)).toFixed(2)],
    ['6', `Винт М${p.bolt}×${2 * p.t + 8} DIN 7985`, p.bolts, '—'],
    ['7', `Гайка М${p.bolt} DIN 985`, p.bolts, '—'],
    ['8', `Шайба ${p.bolt} DIN 125`, p.bolts * 2, '—'],
  ];
  if (p.lugs) spec.push(['9', `Цепь подвеса, ${fmtInt(chainLenSafe(p))} мм`, p.n, '—'],
    ['10', 'Кольцо-сборник Ø40 + крюк', 1, '—']);
  const scols = [14, 150, 26, 30];
  const stw = scols.reduce((a, b) => a + b, 0);
  dr.rect(x0, sy - 10 - 8 * (spec.length + 1), stw, 8 * (spec.length + 1), 'ТАБЛИЦА');
  const srow = ['Поз.', 'Наименование', 'Кол.', 'Масса, кг'];
  srow.forEach((c, j) => {
    let cx0 = x0; for (let i = 0; i < j; i++) cx0 += scols[i];
    dr.text(cx0 + 2, sy - 15, 3.2, c, 'ТЕКСТ');
  });
  dr.line(x0, sy - 18, x0 + stw, sy - 18, 'ТАБЛИЦА');
  spec.forEach((r, i) => {
    const yy = sy - 26 - i * 8;
    let cx0 = x0;
    r.forEach((c, j) => { dr.text(cx0 + 2, yy, 3.2, c, 'ТЕКСТ'); cx0 += scols[j]; });
    dr.line(x0, yy + 2.5, x0 + stw, yy + 2.5, 'ТАБЛИЦА');
  });
  dr.text(x0, sy - 26 - spec.length * 8 - 8, 3.4, `Итого без цепей: ${p.mTotal.toFixed(2)} кг`, 'ТЕКСТ');

  techBlock(dr, 232, 252, [
    `Все размеры — в миллиметрах.`,
    `Материал: ${p.mat}, ГОСТ 103-2016.`,
    `Покрытие: порошковая окраска RAL 9005.`,
    `Сварка: ГОСТ Р 52916-2008.`,
    `Неуказанные предельные отклонения ±0,5 мм.`,
    `Количество полочек и их размеры — по ведомости.`,
  ], 175);
  sheetFrame(dr, { code: 'П7', name: 'Ведомость и спецификация', scale: '1:1', sheets: S_COUNT, mass: p.mTotal.toFixed(2) });
  return { code: 'П7', name: 'Ведомость / спецификация', items: dr.items };
}

const fmtInt = v => Math.round(v).toString();
const chainLenSafe = p => Math.hypot(p.Rp - 20, p.hang - 28);

/* ---------------- ZIP ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function zipSync(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new Uint8Array(30 + name.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, name.length, true);
    dv.setUint16(28, 0, true);
    lh.set(name, 30);
    parts.push(lh, data);

    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    ch.set(name, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  let cdSize = 0; for (const c of central) cdSize += c.length;
  const eo = new Uint8Array(22);
  const ev = new DataView(eo.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, eo], { type: 'application/zip' });
}
