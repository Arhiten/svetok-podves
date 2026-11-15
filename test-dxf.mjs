// Проверка генератора DXF вне браузера: импорт модуля, сборка комплекта, разбор результата.
import { buildSheets, toDXF, toSVG, zipSync } from './public/dxf.js';
import { writeFileSync, mkdirSync } from 'fs';

const HOLE = { 4: 4.5, 5: 5.5, 6: 6.6 };
const LUG = { w: 24, h: 28, hole: 9 };

import { computeModel } from './public/model.js';

function params(shelfList) {
  const base = {
    D: 600, H: 40, t: 2, n: 4, gap: 2, rho: 7850, mat: 'Ст3',
    Lp: 80, e: 10, bolt: 5, lugs: true, hang: 550,
    chains: true, plants: false, explode: 0,
    angT: 2, angA: 30, angB: 60, angDrop: 150, angN: 2, angSpan: 100,
    rodD: 6, shT: 3, postD: 5, postH: 50,
    railIns: 8, cornerGap: 12, postOff: 50,
  };
  return computeModel(base, shelfList);
}

const p = params([
  { ang: 45, depth: 200, width: 200, posts: 2 },
  { ang: 135, depth: 200, width: 200, posts: 2 },
  { ang: 225, depth: 200, width: 200, posts: 2 },
  { ang: 315, depth: 200, width: 200, posts: 2 },
]);

console.log('Масса, кг:', p.mTotal.toFixed(2), '| окраска, м²:', p.paint.toFixed(3), '| болтов:', p.bolts);

const sheets = buildSheets(p);
console.log('Листов:', sheets.length);
mkdirSync('out', { recursive: true });
for (const sh of sheets) {
  const bytes = toDXF(sh);
  const txt = Buffer.from(bytes).toString('latin1');
  // проверка структуры R12
  const ok = ['SECTION', 'HEADER', 'TABLES', 'BLOCKS', 'ENTITIES', 'ENDSEC', 'EOF']
    .every(k => txt.includes(k));
  const nEnt = (txt.match(/\n0\r?\n(?!SECTION|ENDSEC|EOF|TABLE|ENDTAB|BLOCK|ENDBLK|LTYPE|LAYER|STYLE)/g) || []).length;
  // слой (код 8) идёт сразу после типа сущности (код 0) — иначе ловим значения полей
  const layers = [...new Set((txt.match(/\n0\r?\n[A-Z]+\r?\n8\r?\n([^\r\n]+)/g) || []).map(s => s.split(/\r?\n/).pop().trim()))];
  console.log(`${sh.code} ${sh.name.padEnd(26)} ${String(bytes.length).padStart(7)} Б  секций:${ok}  сущностей:${nEnt}  слои:${layers.join(',')}`);
  if (!ok) { console.error('  !! нарушена структура DXF'); process.exitCode = 1; }
  writeFileSync(`out/${sh.code}.dxf`, bytes);
  const svg = toSVG(sh, 420, 297);
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) { console.error('  !! битый SVG'); process.exitCode = 1; }
  writeFileSync(`out/${sh.code}.svg`, svg);
}

// ZIP
const files = sheets.map(s => ({ name: `${s.code}.dxf`, data: toDXF(s) }));
const blob = zipSync(files);
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync('out/complect.zip', buf);
console.log('ZIP:', buf.length, 'Б, сигнатура:', buf.subarray(0, 4).toString('hex'));
if (buf.subarray(0, 4).toString('hex') !== '504b0304') { console.error('  !! ZIP неверный'); process.exitCode = 1; }

// Проверка: всё ли внутри листа A3 (420×297), рамка 10..410 / 10..287
console.log('\nГраницы листов A3:');
for (const sh of sheets) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const it of sh.items) {
    const pts = it.t === 'line' ? [[it.x1, it.y1], [it.x2, it.y2]]
      : (it.t === 'circle' || it.t === 'arc') ? [[it.x - it.r, it.y - it.r], [it.x + it.r, it.y + it.r]]
        : it.t === 'solid' ? [[it.x1, it.y1], [it.x2, it.y2], [it.x3, it.y3]]
          : [[it.x, it.y]];
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const ok = minX >= 8 && minY >= 8 && maxX <= 412 && maxY <= 289;
  console.log(`  ${sh.code} ${sh.name.padEnd(26)} X ${minX.toFixed(0)}…${maxX.toFixed(0)}  Y ${minY.toFixed(0)}…${maxY.toFixed(0)}  ${ok ? 'ок' : '!! выходит за лист'}`);
  if (!ok) {
    process.exitCode = 1;
    for (const it of sh.items) {
      const pts = it.t === 'line' ? [[it.x1, it.y1], [it.x2, it.y2]]
        : (it.t === 'circle' || it.t === 'arc') ? [[it.x - it.r, it.y - it.r], [it.x + it.r, it.y + it.r]]
          : it.t === 'solid' ? [[it.x1, it.y1], [it.x2, it.y2], [it.x3, it.y3]]
            : [[it.x, it.y]];
      if (pts.some(([x, y]) => x < 8 || y < 8 || x > 412 || y > 289)) {
        console.log('      →', it.t, it.layer, JSON.stringify(it.s || '').slice(0, 40),
          it.x1 !== undefined ? `(${it.x1.toFixed(0)},${it.y1.toFixed(0)})→(${it.x2.toFixed(0)},${it.y2.toFixed(0)})`
            : `(${it.x?.toFixed(0)},${it.y?.toFixed(0)})`);
      }
    }
  }
}

// Проверка кириллицы: перекодируем «Накладка» в CP1251 вручную
const CP = str => [...str].map(ch => {
  const c = ch.codePointAt(0);
  if (c < 128) return c;
  if (c >= 0x410 && c <= 0x44F) return 0xC0 + (c - 0x410);
  if (c === 0x401) return 0xA8; if (c === 0x451) return 0xB8;
  return 0x3F;
});
const p3 = Buffer.from(toDXF(sheets[2])).toString('latin1');
const hasRu = p3.includes(Buffer.from(CP('Накладка')).toString('latin1'));
console.log('Кириллица в DXF (П3):', hasRu ? 'ок' : 'НЕТ');

// Проверка слоёв: код 8 (имя слоя) перед значением
const layerNames = [...new Set((p3.match(/\r?\n0\r?\n[A-Z]+\r?\n8\r?\n([^\r\n]+)/g) || []).map(s => s.split(/\r?\n/).pop().trim()))];
console.log('Слои в П3:', layerNames.join(', ') || 'НЕТ');

// Проверка кодов групп: код и значение чередуются, каждый на своей строке
const lines = p3.split('\r\n');
if (lines[lines.length - 1] === '') lines.pop();       // хвостовой CRLF
let bad = '';
for (let i = 0; i < lines.length; i += 2) {
  if (!/^-?\d+$/.test(lines[i])) { bad = `поз.${i}: «${lines[i].slice(0, 40)}»`; break; }
}
console.log('Коды групп по парам:', bad ? 'ОШИБКА ' + bad : 'ок',
  `(групп: ${Math.floor(lines.length / 2)})`);
console.log('Завершающий EOF:', lines[lines.length - 1] === 'EOF' ? 'ок' : 'НЕТ — «' + lines[lines.length - 1].slice(0, 40) + '»');
console.log('EXTMIN/EXTMAX без NaN:', /NaN/.test(p3) ? 'ОШИБКА' : 'ок');
console.log('CRLF-разделители:', p3.includes('\r\n') ? 'ок' : 'НЕТ');

