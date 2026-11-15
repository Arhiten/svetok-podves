/* ================================================================
   Расчётная модель «Цветочный подвес» — общая для приложения и
   генератора чертежей, чтобы расчёт и чертежи не расходились.

   Полочка с ограждением принята по «цветочный подвес.dwg»
   (вид «А» — план 200×200, вид «Б» — фронтальный):

     • пластина полочки 200×200×2 мм;
     • 4 прутка ограждения Ø6 по 160 мм — на осях квадрата 184×184
       (отступ 8 мм от кромки; до угла 12 мм — прутки не доходят);
     • 8 столбиков Ø5×50 мм — по 2 на сторону, ±50 мм от середины
       стороны; пруток лежит сверху столбиков (ось на Ø/2 выше);
     • 2 пистона Ø5×3 мм под пластиной — оси крепления к горизонтальным
       полкам уголков, уголки разнесены на 100 мм, болт по одному на
       уголок (через пистон);
     • один горизонтальный уровень прутка.
   ================================================================ */

export const HOLE = { 4: 4.5, 5: 5.6, 6: 6.6 };
export const LUG = { w: 24, h: 28, hole: 9 };

/* Параметры изделия + расчёт */
export function computeModel(base, shelves) {
  const p = { ...base };
  p.Ro = p.D / 2; p.Ri = p.Ro - p.t; p.Rm = p.Ro - p.t / 2;
  p.dHole = HOLE[p.bolt];
  p.Cm = Math.PI * 2 * p.Rm;
  p.L = (p.Cm - p.n * p.gap) / p.n;
  p.segAng = p.L / p.Rm;
  p.pitch = 2 * Math.PI / p.n;
  p.chord = 2 * p.Ro * Math.sin(p.segAng / 2);
  p.sag = p.Ro * (1 - Math.cos(p.segAng / 2));
  p.half = (p.Lp - p.gap) / 2;
  p.holes = [p.e, p.half - p.e];
  p.Rp = p.Ri - p.t / 2;
  const kg = mm3 => mm3 * p.rho * 1e-9;

  p.mSeg = kg(p.L * p.H * p.t);
  const lugArea = p.lugs
    ? (LUG.w * (LUG.h - LUG.w / 2) + Math.PI * (LUG.w / 2) ** 2 / 2 - Math.PI * (LUG.hole / 2) ** 2)
    : 0;
  p.mPlate = kg((p.Lp * p.H - 4 * Math.PI * (p.dHole / 2) ** 2 + lugArea) * p.t);
  p.mRing = p.n * (p.mSeg + p.mPlate);

  // уголок (Г, перевёрнутая): стойка вниз + горизонтальная полка
  p.angArea = (p.angDrop + p.angB - p.angT) * p.angT;
  p.mBracket = kg(p.angArea * p.angA);

  // ось прутка над верхней плоскостью полочки: пруток лежит на столбиках
  p.railH = p.postH + p.rodD / 2;

  p.shelves = shelves.map(s => {
    const o = { ...s };
    o.ins = p.railIns;                                   // отступ осей прутков от кромки
    o.axisD = o.depth - 2 * o.ins;                      // сторона осевого квадрата по глубине
    o.axisW = o.width - 2 * o.ins;                      // по ширине (тангенциально)
    o.gapCorner = p.cornerGap;                          // зазор прутка до угла
    o.railLenX = Math.max(0, o.axisD - 2 * o.gapCorner); // прутки, идущие по глубине
    o.railLenZ = Math.max(0, o.axisW - 2 * o.gapCorner); // прутки, идущие по ширине
    o.perim = 2 * (o.railLenX + o.railLenZ);            // суммарная длина 4 прутков
    o.postSide = Math.max(0, Math.round(o.posts));      // столбиков на сторону
    o.postsTotal = o.postSide * 4;
    o.postOff = Math.max(0, Math.min(p.postOff, o.axisD / 2 - 10, o.axisW / 2 - 10));
    o.bracketZ = bracketOffsets(p, o);                  // оси уголков поперёк полочки
    o.boltX = p.angT + p.angB / 2;                     // ось болта полочки от кольца
    // точки крепления полочки к горизонтальным полкам уголков (по одному болту на уголок)
    o.boltPts = o.bracketZ.map(dz => ({ x: o.boltX, z: dz }));
    // подкладки Ø5×3 под пластиной — усиление под сварку столбиков
    o.pads = railingLayout(o).posts.map(q => ({ x: q.x, z: q.z }));
    o.rodLen = o.postsTotal * p.postH + o.perim;        // столбики + прутки
    o.brackets = p.angN;
    o.mBracket = p.mBracket * p.angN;
    o.mShelf = kg(o.depth * o.width * p.shT);
    o.mPost = kg(o.postsTotal * p.postH * Math.PI * p.postD ** 2 / 4);
    o.mRail = kg(o.perim * Math.PI * p.rodD ** 2 / 4);
    o.mRod = o.mPost + o.mRail;
    o.mTotal = o.mBracket + o.mShelf + o.mRod;
    o.a = o.ang * Math.PI / 180;
    return o;
  });
  p.mTotal = p.mRing + p.shelves.reduce((a, s) => a + s.mTotal, 0);
  // болты: стыки кольца (4 на стык) + уголки к кольцу (2 на уголок) + полочка (1 на уголок)
  p.bolts = p.n * 4 + p.shelves.length * p.angN * 3;
  // окраска: кольцо (2 стороны + 2 кромки) + полочки (2 стороны + 4 кромки) + уголки
  p.paintRing = (2 * p.Cm * p.H + 2 * p.Cm * p.t) / 1e6;
  p.paintSh = p.shelves.reduce((a, s) =>
    a + (2 * s.depth * s.width + 2 * (s.depth + s.width) * p.shT) / 1e6, 0);
  p.angPerim = p.angDrop + p.angB + 2 * p.angT;          // периметр профиля Г, мм
  p.paintAng = p.shelves.length * p.angN * p.angPerim * p.angA * 2 / 1e6;
  p.paint = p.paintRing + p.paintSh + p.paintAng;
  return p;
}

/* Оси уголков поперёк полочки (мм от середины).
   По DWG уголки стоят под боковыми прутками, т.е. на расстоянии
   ins от кромки: ±(width/2 − ins). */
export function bracketOffsets(p, sh) {
  const nBr = Math.max(1, p.angN);
  if (nBr === 1) return [0];
  const lim = Math.max(0, sh.width / 2 - sh.ins);
  const st = Math.min(p.angSpan, lim * 2);
  const out = [];
  for (let i = 0; i < nBr; i++) out.push(-st * (nBr - 1) / 2 + i * st);
  return out;
}

/* Схема ограждения в системе координат полочки:
   x — от кромки со стороны кольца (0…depth, наружу),
   z — поперёк (−width/2…+width/2).
   Возвращает оси прутков и позиции столбиков. */
export function railingLayout(o) {
  const x0 = o.ins, x1 = o.depth - o.ins;                     // радиальные оси прутков
  const z0 = -(o.width / 2 - o.ins), z1 = o.width / 2 - o.ins; // тангенциальные оси
  const rails = [
    { dir: 'z', at: x0, a: z0, b: z1, len: o.railLenZ },   // вдоль ширины
    { dir: 'z', at: x1, a: z0, b: z1, len: o.railLenZ },
    { dir: 'x', at: z0, a: x0, b: x1, len: o.railLenX },   // вдоль глубины
    { dir: 'x', at: z1, a: x0, b: x1, len: o.railLenX },
  ];
  const posts = [];
  for (const r of rails) {
    const mid = (r.a + r.b) / 2;
    const half = Math.max(0, (r.b - r.a) / 2 - 10);
    const off = Math.min(o.postOff, half);
    for (let i = 0; i < o.postSide; i++) {
      const t = o.postSide === 1 ? 0 : (2 * i / (o.postSide - 1) - 1);
      const d = mid + t * off;
      posts.push(r.dir === 'z' ? { x: r.at, z: d } : { x: d, z: r.at });
    }
  }
  return { x0, x1, z0, z1, rails, posts };
}
