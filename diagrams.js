/* Схемы в формате SVG. Все подписи проверены по тексту уроков. */
const COL = {
  ecto: "#6fae93", ectoDark: "#3f7a62", meso: "#f2df9a", endo: "#e3a771", endoDark: "#b0703c",
  cav: "#d6ebf4", line: "#2b4a40", text: "#1f2d28", muted: "#5b6b65", water: "#eef6f8",
};

function svgWrap(vb, inner, label) {
  return `<svg class="diagram" viewBox="${vb}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
function tx(x, y, s, o = {}) {
  const a = o.anchor || "start", w = o.weight || 600, sz = o.size || 16, c = o.color || COL.text;
  const lines = String(s).split("\n");
  return `<text x="${x}" y="${y}" text-anchor="${a}" font-size="${sz}" font-weight="${w}" fill="${c}" font-family="inherit">` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : sz * 1.15}">${l}</tspan>`).join("") + `</text>`;
}
function leader(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL.line}" stroke-width="1.6"/><circle cx="${x2}" cy="${y2}" r="3.2" fill="${COL.line}"/>`;
}
function marker(n, x, y) {
  return `<g class="mk"><circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${COL.line}" stroke-width="2.2"/>${tx(x, y + 5.5, n, { anchor: "middle", size: 16, weight: 700 })}</g>`;
}

/* ---------- Гидра: профиль тела и слои ---------- */
const HY_PROFILE = [[120, 20], [134, 32], [170, 42], [220, 45], [270, 42], [315, 34], [345, 19], [368, 13], [380, 20], [392, 22]];
function hyW(y) {
  const P = HY_PROFILE;
  if (y <= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++) {
    const [y0, w0] = P[i], [y1, w1] = P[i + 1];
    if (y >= y0 && y <= y1) { const t = (y - y0) / (y1 - y0); const k = (1 - Math.cos(Math.PI * t)) / 2; return w0 + (w1 - w0) * k; }
  }
  return P[P.length - 1][1];
}
function hyLayer(d, cx = 200, top = 120, bottom = 392) {
  const left = [], right = [];
  const y0 = top + d * 0.5, y1 = bottom - d;
  for (let y = y0; y <= y1; y += 2) {
    const w = hyW(y) - d;
    if (w < 1.5) break;
    left.push([cx - w, y]); right.push([cx + w, y]);
  }
  if (!left.length) return "";
  const pts = left.concat(right.reverse());
  return "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + " Z";
}
function hyTentacles(cx = 200) {
  const T = [
    "M186,128 C168,96 150,70 112,40", "M190,124 C184,90 176,58 168,22", "M182,134 C150,124 110,118 62,96",
  ];
  let s = "";
  for (const d of T) {
    const m = d.replace(/(\d+(\.\d+)?),(\d+(\.\d+)?)/g, (_, x, __, y) => `${2 * cx - parseFloat(x)},${y}`);
    for (const p of [d, m]) {
      s += `<path d="${p}" fill="none" stroke="${COL.ecto}" stroke-width="11" stroke-linecap="round"/>`;
      s += `<path d="${p}" fill="none" stroke="${COL.endo}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
  }
  return s;
}
function hydraBody(section) {
  let s = hyTentacles();
  if (section) {
    s += `<path d="${hyLayer(0)}" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`;
    s += `<path d="${hyLayer(8)}" fill="${COL.meso}"/>`;
    s += `<path d="${hyLayer(11)}" fill="${COL.endo}"/>`;
    s += `<path d="${hyLayer(21)}" fill="${COL.cav}"/>`;
    // рот: проход из полости наружу
    s += `<rect x="194" y="112" width="12" height="34" rx="4" fill="${COL.cav}"/>`;
  } else {
    s += `<path d="${hyLayer(0)}" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`;
    s += `<ellipse cx="200" cy="121" rx="9" ry="4" fill="${COL.ectoDark}"/>`;
  }
  return s;
}

function dHydraOuter(labelMode) {
  let s = `<rect x="0" y="0" width="400" height="430" rx="14" fill="${COL.water}"/>`;
  s += `<rect x="150" y="392" width="100" height="10" rx="3" fill="#b9a68a"/>`;
  s += hydraBody(false);
  const L = [
    { n: 1, name: "щупальца", p: [124, 50], t: [20, 30] },
    { n: 2, name: "рот", p: [200, 118], t: [200, 76] },
    { n: 3, name: "тело", p: [238, 230], t: [300, 235] },
    { n: 4, name: "подошва", p: [210, 388], t: [290, 410] },
    { n: 0, name: "стебелёк", p: [208, 360], t: [290, 362] },
  ];
  for (const l of L) {
    if (labelMode && l.n === 0) continue;
    if (labelMode) { s += leader(l.t[0] + (l.t[0] < 200 && l.n !== 2 ? 30 : 0), l.t[1] - (l.n === 2 ? -14 : 0), l.p[0], l.p[1]); s += marker(l.n, l.t[0] + (l.n === 1 ? 16 : 0), l.t[1]); }
    else {
      if (l.n === 2) { s += leader(200, 84, 200, 116); s += tx(200, 74, "рот", { anchor: "middle", size: 17 }); }
      else if (l.n === 1) { s += leader(70, 38, 124, 50); s += tx(14, 34, "щупальца", { size: 17 }); }
      else { s += leader(l.t[0] - 6, l.t[1] - 6, l.p[0], l.p[1]); s += tx(l.t[0], l.t[1], l.name, { size: 17 }); }
    }
  }
  s += tx(20, 418, "внизу — подводный предмет", { size: 13, weight: 500, color: COL.muted });
  return svgWrap("0 0 400 430", s, "Внешнее строение гидры");
}

function dHydraSection(labelMode) {
  let s = `<rect x="0" y="0" width="400" height="430" rx="14" fill="${COL.water}"/>`;
  s += hydraBody(true);
  const L = [
    { n: 1, name: "эктодерма", p: [243, 215], t: [300, 200] },
    { n: 0, name: "мезоглея", p: [235, 252], t: [300, 248] },
    { n: 2, name: "энтодерма", p: [229, 290], t: [300, 296] },
    { n: 3, name: "кишечная\nполость", p: [186, 235], t: [14, 228] },
    { n: 4, name: "рот", p: [200, 118], t: [200, 76] },
  ];
  for (const l of L) {
    if (labelMode) {
      if (l.n === 0) continue;
      if (l.n === 4) { s += leader(200, 90, 200, 116); s += marker(4, 200, 76); }
      else if (l.n === 3) { s += leader(70, 235, 186, 235); s += marker(3, 56, 235); }
      else { s += leader(l.t[0] - 18, l.t[1] - 5, l.p[0], l.p[1]); s += marker(l.n, l.t[0], l.t[1] - 5); }
    } else {
      if (l.n === 4) { s += leader(200, 84, 200, 116); s += tx(200, 74, "рот", { anchor: "middle", size: 17 }); }
      else if (l.n === 3) { s += leader(96, 232, 186, 235); s += tx(l.t[0], l.t[1], l.name, { size: 16 }); }
      else { s += leader(l.t[0] - 6, l.t[1] - 6, l.p[0], l.p[1]); s += tx(l.t[0], l.t[1], l.name, { size: 16 }); }
    }
  }
  if (!labelMode) {
    s += tx(300, 370, "подошва", { size: 15, weight: 500, color: COL.muted });
    s += leader(294, 365, 214, 388);
  }
  if (!labelMode) s += legend(18, 400);
  return svgWrap("0 0 400 430", s, "Продольный разрез гидры: эктодерма, мезоглея, энтодерма, кишечная полость");
}
function legend(x, y) {
  const it = [[COL.ecto, "эктодерма"], [COL.meso, "мезоглея"], [COL.endo, "энтодерма"], [COL.cav, "полость"]];
  let s = "", cx = x;
  for (const [c, n] of it) { s += `<rect x="${cx}" y="${y}" width="16" height="16" rx="3" fill="${c}" stroke="${COL.line}" stroke-width="0.8"/>` + tx(cx + 21, y + 13, n, { size: 13, weight: 500 }); cx += 94; }
  return s;
}

/* ---------- Клетки стенки тела гидры ---------- */
function dCells() {
  let s = `<rect x="0" y="0" width="420" height="360" rx="14" fill="#fff"/>`;
  s += `<rect x="10" y="10" width="250" height="34" fill="${COL.water}"/>` + tx(16, 32, "вода", { size: 13, weight: 500, color: COL.muted });
  // эктодерма
  const ex = [10, 60, 110, 160, 210];
  ex.forEach((x, i) => { s += `<rect x="${x}" y="44" width="50" height="70" fill="${i === 1 ? "#cfe8dc" : COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`; });
  // мускульные волоконца у основания кожно-мускульных клеток
  [10, 110, 160, 210].forEach(x => { s += `<line x1="${x + 4}" y1="109" x2="${x + 46}" y2="109" stroke="#8a3b2a" stroke-width="3" stroke-linecap="round"/>`; });
  // стрекательная клетка
  s += `<ellipse cx="85" cy="80" rx="12" ry="20" fill="#fff" stroke="${COL.line}" stroke-width="1.6"/>`;
  s += `<path d="M85,66 q6,4 0,8 q-6,4 0,8 q6,4 0,8 q-6,4 0,8" fill="none" stroke="#7a3b8f" stroke-width="1.8"/>`;
  s += `<line x1="92" y1="46" x2="98" y2="28" stroke="${COL.line}" stroke-width="2"/>`;
  // нервная клетка (звёздчатая)
  s += `<g stroke="#3d4fa0" stroke-width="2" fill="none"><path d="M185,100 l-22,-12 M185,100 l20,-14 M185,100 l-14,12 M185,100 l24,8"/></g><circle cx="185" cy="100" r="6" fill="#3d4fa0"/>`;
  // мезоглея
  s += `<rect x="10" y="114" width="250" height="14" fill="${COL.meso}" stroke="#c9b46a" stroke-width="1"/>`;
  // энтодерма
  const en = [10, 72.5, 135, 197.5];
  en.forEach((x, i) => {
    s += `<rect x="${x}" y="128" width="62.5" height="80" fill="${COL.endo}" stroke="${COL.endoDark}" stroke-width="1.5"/>`;
    if (i % 2 === 1) { for (let k = 0; k < 6; k++) s += `<circle cx="${x + 14 + (k % 3) * 16}" cy="${188 + Math.floor(k / 3) * 10}" r="3.4" fill="#7a4a1f"/>`; }
    else { s += `<path d="M${x + 31},208 q6,12 -2,20 q-8,8 2,18" fill="none" stroke="${COL.endoDark}" stroke-width="2"/><path d="M${x + 6},208 q8,14 18,0" fill="${COL.endo}" stroke="${COL.endoDark}" stroke-width="1.5"/>`; }
  });
  s += `<rect x="10" y="208" width="250" height="70" fill="${COL.cav}"/>` + tx(135, 270, "кишечная полость", { anchor: "middle", size: 14, weight: 600 });
  s += `<circle cx="190" cy="240" r="7" fill="#a98450"/>`;
  // подписи справа
  const lab = [
    ["кожно-мускульная", 236, 70, 66], ["стрекательная", 98, 30, 26], ["нервная", 200, 96, 104],
    ["мезоглея", 255, 121, 136], ["пищеварительная", 40, 165, 172], ["железистая", 110, 194, 206], ["кишечная полость", 250, 250, 252],
  ];
  // подписи вынесены вправо, линии к клеткам
  const targets = [[236, 70], [98, 30], [205, 96], [255, 121], [45, 160], [115, 195], [250, 250]];
  const ys = [62, 30, 96, 124, 162, 200, 252];
  const names = ["кожно-мускульная", "стрекательная", "нервная", "мезоглея", "пищеварительная", "железистая", "кишечная полость"];
  for (let i = 0; i < names.length; i++) {
    if (i === 6) continue;
    s += `<line x1="${targets[i][0]}" y1="${targets[i][1]}" x2="274" y2="${ys[i] - 5}" stroke="${COL.line}" stroke-width="1.3"/>`;
    s += `<circle cx="${targets[i][0]}" cy="${targets[i][1]}" r="3" fill="${COL.line}"/>`;
    s += tx(278, ys[i], names[i], { size: 14, weight: 600 });
  }
  const leg = ["Сверху — эктодерма, снизу — энтодерма.", "Коричневая линия — мускульные волоконца.", "Точки — капли пищеварительного сока."];
  leg.forEach((t, i) => { s += tx(14, 304 + i * 20, t, { size: 14, weight: 500, color: COL.muted }); });
  return svgWrap("0 0 420 360", s, "Клетки стенки тела гидры: эктодерма, мезоглея, энтодерма");
}

/* ---------- Стрекательная клетка ---------- */
function dSting(labelMode) {
  let s = `<rect x="0" y="0" width="400" height="290" rx="14" fill="#fff"/>`;
  // покой
  s += `<ellipse cx="100" cy="150" rx="55" ry="75" fill="#cfe8dc" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  s += `<ellipse cx="100" cy="140" rx="26" ry="44" fill="#fff" stroke="${COL.line}" stroke-width="2"/>`;
  s += `<path d="M100,104 q14,8 0,16 q-14,8 0,16 q14,8 0,16 q-14,8 0,16 q14,8 0,10" fill="none" stroke="#7a3b8f" stroke-width="2.4"/>`;
  s += `<line x1="118" y1="82" x2="132" y2="40" stroke="${COL.line}" stroke-width="2.6"/>`;
  s += tx(100, 248, "до касания", { anchor: "middle", size: 15 });
  // после
  s += `<ellipse cx="290" cy="150" rx="55" ry="75" fill="#cfe8dc" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  s += `<ellipse cx="290" cy="150" rx="26" ry="44" fill="#fff" stroke="${COL.line}" stroke-width="2"/>`;
  s += `<path d="M290,106 C292,70 300,50 330,20 C350,4 372,10 388,4" fill="none" stroke="#7a3b8f" stroke-width="2.4"/>`;
  s += tx(290, 248, "после касания:\nнить выброшена", { anchor: "middle", size: 14 });
  if (labelMode) {
    s += leader(40, 40, 130, 46) + marker(1, 26, 40);
    s += leader(30, 150, 74, 150) + marker(2, 18, 150);
    s += leader(170, 120, 104, 130) + marker(3, 184, 116);
  } else {
    s += leader(150, 30, 130, 46) + tx(150, 26, "чувствительный волосок", { size: 14 });
    s += leader(14, 186, 76, 160) + tx(4, 204, "капсула", { size: 14 });
    s += leader(170, 128, 106, 130) + tx(160, 120, "нить", { size: 14 });
  }
  return svgWrap("0 0 400 290", s, "Стрекательная клетка до и после касания");
}

/* ---------- Лучевая симметрия ---------- */
function dSymmetry() {
  let s = `<rect x="0" y="0" width="420" height="270" rx="14" fill="#fff"/>`;
  // вид сверху: кишечнополостное
  const cx = 105, cy = 125;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    s += `<line x1="${cx + Math.cos(a) * 36}" y1="${cy + Math.sin(a) * 36}" x2="${cx + Math.cos(a) * 78}" y2="${cy + Math.sin(a) * 78}" stroke="${COL.ecto}" stroke-width="11" stroke-linecap="round"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="40" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="7" fill="${COL.ectoDark}"/>`;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    s += `<line x1="${cx - Math.cos(a) * 95}" y1="${cy - Math.sin(a) * 95}" x2="${cx + Math.cos(a) * 95}" y2="${cy + Math.sin(a) * 95}" stroke="#c0392b" stroke-width="2" stroke-dasharray="6 5"/>`;
  }
  s += tx(cx, 240, "лучевая симметрия", { anchor: "middle", size: 15, weight: 700 });
  s += tx(cx, 258, "вид сверху: много плоскостей", { anchor: "middle", size: 13, weight: 500, color: COL.muted });
  // двусторонняя: жук
  const bx = 310;
  s += `<ellipse cx="${bx}" cy="140" rx="34" ry="52" fill="#c9b8e6" stroke="#5b4a8a" stroke-width="2"/>`;
  s += `<circle cx="${bx}" cy="76" r="18" fill="#c9b8e6" stroke="#5b4a8a" stroke-width="2"/>`;
  for (const y of [110, 140, 170]) { s += `<line x1="${bx - 34}" y1="${y}" x2="${bx - 64}" y2="${y + 14}" stroke="#5b4a8a" stroke-width="3"/><line x1="${bx + 34}" y1="${y}" x2="${bx + 64}" y2="${y + 14}" stroke="#5b4a8a" stroke-width="3"/>`; }
  s += `<line x1="${bx}" y1="40" x2="${bx}" y2="210" stroke="#c0392b" stroke-width="2" stroke-dasharray="6 5"/>`;
  s += tx(bx, 240, "двусторонняя", { anchor: "middle", size: 15, weight: 700 });
  s += tx(bx, 258, "одна плоскость (жук)", { anchor: "middle", size: 13, weight: 500, color: COL.muted });
  return svgWrap("0 0 420 270", s, "Лучевая и двусторонняя симметрия");
}

/* ---------- Срез тела: два слоя ---------- */
function dLayers(labelMode) {
  let s = `<rect x="0" y="0" width="400" height="280" rx="14" fill="${COL.water}"/>`;
  const cx = 140, cy = 140;
  s += `<circle cx="${cx}" cy="${cy}" r="112" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="86" fill="${COL.meso}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="78" fill="${COL.endo}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="50" fill="${COL.cav}"/>`;
  const L = [["эктодерма", [cx + 100, cy - 50], 300, 60], ["мезоглея", [cx + 81, cy - 18], 300, 115], ["энтодерма", [cx + 64, cy + 20], 300, 170], ["кишечная\nполость", [cx + 20, cy + 30], 300, 220]];
  L.forEach(([n, p, x, y], i) => {
    s += `<line x1="${p[0]}" y1="${p[1]}" x2="${labelMode ? x - 14 : x - 6}" y2="${y - 5}" stroke="${COL.line}" stroke-width="1.6"/><circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${COL.line}"/>`;
    s += labelMode ? marker(i + 1, x, y - 5) : tx(x, y, n, { size: 16 });
  });
  return svgWrap("0 0 400 280", s, "Поперечный срез тела кишечнополостного");
}

/* ---------- Полип и медуза ---------- */
function dPolypMedusa() {
  let s = `<rect x="0" y="0" width="420" height="300" rx="14" fill="${COL.water}"/>`;
  // полип
  s += `<rect x="40" y="262" width="120" height="10" rx="3" fill="#b9a68a"/>`;
  s += `<path d="M80,262 C70,200 72,150 78,110 L122,110 C128,150 130,200 120,262 Z" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  s += `<path d="M90,250 C84,200 86,150 90,120 L110,120 C114,150 116,200 110,250 Z" fill="${COL.cav}"/>`;
  for (const [x2, y2] of [[50, 50], [80, 40], [120, 40], [150, 50]]) s += `<path d="M${x2 < 100 ? 86 : 114},112 Q${(x2 + 100) / 2},70 ${x2},${y2}" fill="none" stroke="${COL.ecto}" stroke-width="8" stroke-linecap="round"/>`;
  s += leader(150, 96, 106, 112) + tx(152, 94, "рот", { size: 14 });
  s += leader(30, 238, 82, 258) + tx(8, 232, "подошва", { size: 14 });
  s += tx(100, 290, "ПОЛИП — прикреплён, рот вверх", { anchor: "middle", size: 13, weight: 700 });
  // медуза
  s += `<path d="M230,120 C230,50 380,50 380,120 Z" fill="#cfe1f2" stroke="#4a6f95" stroke-width="2"/>`;
  s += `<path d="M300,120 L300,150 L310,150 L310,120" fill="#cfe1f2" stroke="#4a6f95" stroke-width="2"/>`;
  for (const x of [236, 262, 348, 374]) s += `<path d="M${x},120 q-8,30 4,60 q10,26 -2,50" fill="none" stroke="#4a6f95" stroke-width="3" stroke-linecap="round"/>`;
  s += leader(340, 172, 306, 150) + tx(330, 190, "рот", { size: 14 });
  s += leader(300, 38, 300, 64) + tx(270, 30, "зонтик", { size: 14 });
  s += tx(305, 290, "МЕДУЗА — плавает, рот вниз", { anchor: "middle", size: 13, weight: 700 });
  s += tx(240, 250, "щупальца", { size: 13, weight: 500, color: COL.muted });
  return svgWrap("0 0 420 300", s, "Полип и медуза");
}

/* ---------- Простой мешок с одним отверстием ---------- */
function dPolypSimple() {
  let s = `<rect x="0" y="0" width="400" height="260" rx="14" fill="${COL.water}"/>`;
  s += `<path d="M150,240 C130,180 130,120 150,80 L250,80 C270,120 270,180 250,240 Z" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  s += `<path d="M172,224 C158,180 158,124 176,96 L224,96 C242,124 242,180 228,224 Z" fill="${COL.cav}"/>`;
  s += `<rect x="190" y="74" width="20" height="30" fill="${COL.cav}"/>`;
  for (const [x2, y2] of [[100, 30], [160, 18], [240, 18], [300, 30]]) s += `<path d="M${x2 < 200 ? 170 : 230},82 Q${(x2 + 200) / 2},40 ${x2},${y2}" fill="none" stroke="${COL.ecto}" stroke-width="8" stroke-linecap="round"/>`;
  s += leader(300, 70, 210, 82) + tx(304, 72, "рот", { size: 15 });
  s += leader(300, 160, 215, 160) + tx(304, 156, "кишечная", { size: 15 }) + tx(304, 174, "полость", { size: 15 });
  s += leader(80, 70, 120, 50) + tx(14, 88, "щупальца", { size: 15 });
  s += tx(200, 254, "тело — мешок с одним отверстием", { anchor: "middle", size: 13, weight: 500, color: COL.muted });
  return svgWrap("0 0 400 260", s, "Тело кишечнополостного — мешок с одним отверстием");
}

/* ---------- Сетчатая нервная система ---------- */
function dNet() {
  let s = `<rect x="0" y="0" width="400" height="230" rx="14" fill="#fff"/>`;
  s += `<path d="M120,215 C95,160 95,90 120,40 L280,40 C305,90 305,160 280,215 Z" fill="#e6f2ec" stroke="${COL.ectoDark}" stroke-width="2"/>`;
  const pts = [[150, 70], [200, 60], [250, 72], [135, 115], [185, 105], [235, 112], [270, 130], [150, 160], [205, 155], [255, 175], [180, 195], [230, 205]];
  const links = [[0, 1], [1, 2], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 4], [4, 5], [5, 6], [3, 7], [4, 8], [5, 8], [6, 9], [7, 8], [8, 9], [7, 10], [8, 10], [8, 11], [9, 11], [10, 11]];
  for (const [a, b] of links) s += `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="#3d4fa0" stroke-width="2"/>`;
  for (const p of pts) s += `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#3d4fa0"/>`;
  s += tx(310, 80, "нервные", { size: 14 }) + tx(310, 97, "клетки", { size: 14 });
  s += leader(306, 86, 256, 74);
  s += tx(310, 160, "отростки", { size: 14 }) + tx(310, 177, "соединены", { size: 14 }) + tx(310, 194, "в сеть", { size: 14 });
  s += leader(306, 168, 262, 152);
  s += tx(16, 120, "центра", { size: 13, weight: 500, color: COL.muted }) + tx(16, 136, "(мозга)", { size: 13, weight: 500, color: COL.muted }) + tx(16, 152, "нет", { size: 13, weight: 500, color: COL.muted });
  return svgWrap("0 0 400 230", s, "Диффузная, или сетчатая, нервная система");
}

/* ---------- Ткани ---------- */
function dTissues() {
  const cell = (inner, title, sub) => `<figure class="tile">${svgWrap("0 0 160 110", `<rect width="160" height="110" rx="10" fill="#fff"/>${inner}`, title)}<figcaption><b>${title}</b><span>${sub}</span></figcaption></figure>`;
  let ep = ""; for (let i = 0; i < 6; i++) ep += `<rect x="${10 + i * 23.5}" y="30" width="23.5" height="50" fill="#f3c6b5" stroke="#9a5a45" stroke-width="1.5"/><circle cx="${21.75 + i * 23.5}" cy="55" r="4.5" fill="#9a5a45"/>`;
  let cn = `<path d="M10,30 C50,20 90,45 150,28 M10,60 C60,50 100,75 150,58 M10,88 C50,80 110,98 150,86" stroke="#c7a76b" stroke-width="2" fill="none"/>`;
  for (const [x, y] of [[30, 45], [100, 38], [70, 75], [130, 80]]) cn += `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="#e9c98f" stroke="#8a6a35" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="2.5" fill="#8a6a35"/>`;
  let ms = ""; for (let i = 0; i < 4; i++) ms += `<path d="M12,${24 + i * 20} Q80,${16 + i * 20} 148,${24 + i * 20} Q80,${34 + i * 20} 12,${24 + i * 20} Z" fill="#e7a1a1" stroke="#9a3f3f" stroke-width="1.5"/><circle cx="80" cy="${25 + i * 20}" r="2.6" fill="#9a3f3f"/>`;
  let nv = `<g stroke="#3d4fa0" stroke-width="2.4" fill="none"><path d="M60,55 L20,30 M60,55 L25,80 M60,55 L48,20 M60,55 L150,60"/></g><circle cx="60" cy="55" r="11" fill="#7d8ad1" stroke="#3d4fa0" stroke-width="2"/>`;
  nv += `<circle cx="95" cy="40" r="6" fill="#cfd5f0" stroke="#7d8ad1"/><circle cx="110" cy="80" r="6" fill="#cfd5f0" stroke="#7d8ad1"/><circle cx="30" cy="96" r="5" fill="#cfd5f0" stroke="#7d8ad1"/>`;
  nv += `<text x="60" y="104" font-size="10" text-anchor="middle" fill="${COL.muted}">нейрон</text><text x="128" y="100" font-size="10" text-anchor="middle" fill="${COL.muted}">глия</text>`;
  return `<div class="tiles">${cell(ep, "Покровная", "клетки вплотную")}${cell(cn, "Соединительная", "много межклеточного вещества")}${cell(ms, "Мышечная", "длинные сокращающиеся клетки")}${cell(nv, "Нервная", "нейроны и глиальные клетки")}</div>`;
}

/* ---------- Почкование ---------- */
function miniHydra(x, stage) {
  const T = (bx, by, dir) => `<path d="M${bx},${by} q${dir * 10},-20 ${dir * 22},-30" fill="none" stroke="${COL.ecto}" stroke-width="5" stroke-linecap="round"/>`;
  let s = "";
  s += `<path d="M${x - 14},40 C${x - 22},80 ${x - 20},130 ${x - 6},170 L${x + 6},170 C${x + 20},130 ${x + 22},80 ${x + 14},40 Z" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`;
  s += T(x - 10, 42, -1) + T(x - 2, 40, -0.3) + T(x + 2, 40, 0.3) + T(x + 10, 42, 1);
  if (stage === 1) s += `<ellipse cx="${x + 22}" cy="110" rx="7" ry="9" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`;
  if (stage === 2) s += `<ellipse cx="${x + 28}" cy="104" rx="14" ry="11" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`;
  if (stage === 3) { s += `<path d="M${x + 16},112 L${x + 44},92 L${x + 50},100 L${x + 20},120 Z" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/>`; s += `<path d="M${x + 47},94 q6,-10 14,-14 M${x + 49},98 q10,-4 16,-2" fill="none" stroke="${COL.ecto}" stroke-width="3.5" stroke-linecap="round"/>`; }
  s += `<rect x="${x - 26}" y="170" width="52" height="6" rx="2" fill="#b9a68a"/>`;
  return s;
}
function dBudding() {
  let s = `<rect x="0" y="0" width="440" height="250" rx="14" fill="${COL.water}"/>`;
  const xs = [55, 160, 265];
  s += miniHydra(xs[0], 1) + miniHydra(xs[1], 2) + miniHydra(xs[2], 3);
  // отделившаяся
  s += `<path d="M380,120 C376,140 377,158 384,172 L392,172 C399,158 400,140 396,120 Z" fill="${COL.ecto}" stroke="${COL.ectoDark}" stroke-width="1.5"/><path d="M382,122 q-6,-12 -14,-16 M394,122 q6,-12 14,-16" fill="none" stroke="${COL.ecto}" stroke-width="3.5" stroke-linecap="round"/>`;
  s += `<path d="M330,90 C334,80 345,80 350,90" fill="none" stroke="${COL.muted}" stroke-width="1"/>`;
  s += `<rect x="360" y="172" width="52" height="6" rx="2" fill="#b9a68a"/>`;
  const cap = ["1. бугорок —\nпочка", "2. почка\nрастёт", "3. щупальца\nи рот", "4. гидра\nотделилась"];
  [55, 160, 265, 388].forEach((x, i) => { s += tx(x, 200, cap[i], { anchor: "middle", size: 17 }); });
  return svgWrap("0 0 440 250", s, "Этапы почкования гидры");
}

/* ---------- HTML-схемы-цепочки ---------- */
function chainHTML(items, cls = "") { return `<div class="chain ${cls}">${items.map((t, i) => `<div class="chain-step"><span class="chain-n">${i + 1}</span>${t}</div>`).join('<div class="chain-arrow" aria-hidden="true">→</div>')}</div>`; }

const DIAGRAMS = {
  chain: () => chainHTML(["Клетка", "Ткань", "Орган", "Система органов", "Организм"]),
  tissues: dTissues,
  polypSimple: dPolypSimple,
  symmetry: dSymmetry,
  layers: () => dLayers(false),
  layersLabel: () => dLayers(true),
  netNerve: dNet,
  polypMedusa: dPolypMedusa,
  hydraOuter: () => dHydraOuter(false),
  hydraOuterLabel: () => dHydraOuter(true),
  hydraSection: () => dHydraSection(false),
  hydraSectionLabel: () => dHydraSection(true),
  cells: dCells,
  stingCell: () => dSting(false),
  stingLabel: () => dSting(true),
  digestion: () => chainHTML(["Железистые клетки выделяют сок в кишечную полость", "Полостное пищеварение: пища переваривается частично", "Пищеварительные клетки захватывают частицы", "Внутриклеточное пищеварение", "Остатки — в полость и наружу через рот"], "vertical"),
  reflex: () => chainHTML(["Восприятие раздражения: гидры коснулись", "Передача возбуждения по нервным клеткам", "Ответная реакция: гидра сжимается в комочек"], "vertical"),
  budding: dBudding,
};
