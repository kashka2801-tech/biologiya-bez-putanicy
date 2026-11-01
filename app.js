/* «Биология без путаницы» — логика приложения. Всё работает в браузере, прогресс хранится в localStorage. */
(function () {
  "use strict";
  const KEY = "bbp_progress_v1";
  const AUTO = ["choice", "match", "order", "classify", "fix", "label"];

  /* ---------- Хранилище ---------- */
  function blank() { return { v: 1, seen: {}, c: {}, q: {}, checks: {}, last: null, lessonDone: {}, board: {}, tests: [], test: null }; }
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
  let storageOk = true;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { storageOk = false; } }

  /* ---------- Справочные карты ---------- */
  const QMAP = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const CT = { c_organsys: "Система органов", c_chain: "Цепочка: клетка → ткань → орган → система → организм", c_nerve: "Нервная ткань", c_neuron: "Нейроны", c_glia: "Глиальные клетки",
    c_repro: "Половая система", c_nervsys: "Нервная система", c_layers: "Два слоя клеток: эктодерма и энтодерма", c_meso: "Мезоглея", c_classes: "Три класса кишечнополостных", c_colony: "Одиночные и колониальные" };
  const CS = {}; // тема -> где объяснена
  LESSONS.forEach((l, li) => l.screens.forEach((s, si) => s.concepts.forEach(c => { if (!CS[c]) CS[c] = { lid: l.id, li, si, title: CT[c] || s.title }; })));
  const ALL_CONCEPTS = Object.keys(CS);
  const TERM_WHERE = {};
  LESSONS.forEach((l, li) => l.screens.forEach((s, si) => (s.terms || []).forEach(t => { if (!TERM_WHERE[t]) TERM_WHERE[t] = { lid: l.id, li, si }; })));
  const lessonById = id => LESSONS.find(l => l.id === id);
  const totalScreens = LESSONS.reduce((a, l) => a + l.screens.length, 0);

  /* ---------- Утилиты ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
    return e;
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function shuffledIdx(n) { let r; let tries = 0; do { r = shuffle([...Array(n).keys()]); tries++; } while (n > 1 && tries < 10 && r.every((v, i) => v === i)); return r; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  /* ---------- Состояние тем ---------- */
  function conceptSeen(cid) { const w = CS[cid]; if (!w) return false; const sc = lessonById(w.lid).screens.filter(s => s.concepts.includes(cid)); return sc.some(s => S.seen[s.id]); }
  function record(q, res) {
    const c = S.c[q.concept] || (S.c[q.concept] = { own: [], hint: 0, wrong: 0, lastWrong: 0, lastQ: null });
    const now = Date.now();
    if (res === "own") c.own.push({ id: q.id, t: now });
    else if (res === "hint") c.hint++;
    else { c.wrong++; c.lastWrong = now; }
    c.lastQ = q.id;
    S.q[q.id] = { res, t: now };
    save();
  }
  function cStatus(cid) {
    const c = S.c[cid];
    if (!c) return conceptSeen(cid) ? "read" : "new";
    const ownAfter = c.own.filter(o => o.t > (c.lastWrong || 0));
    if (c.lastWrong && !ownAfter.length) return "repeat";
    const distinct = new Set(ownAfter.map(o => o.id)).size;
    // «Усвоено» — два разных верных ответа без подсказки, хотя бы один из них проверен автоматически
    if (distinct >= 2 && ownAfter.some(o => QMAP[o.id] && AUTO.includes(QMAP[o.id].type))) return "mastered";
    if (distinct >= 1) return "own";
    if (c.hint > 0) return "hint";
    return conceptSeen(cid) ? "read" : "new";
  }
  const ST_LABEL = { new: "Не начато", read: "Прочитано", hint: "Отвечено с подсказкой", repeat: "Есть ошибка — повторить", own: "Вспомнила сама один раз", mastered: "Усвоено" };

  function pickVariant(cid, exclude = []) {
    const c = S.c[cid] || {};
    let pool = QUESTIONS.filter(q => q.concept === cid && AUTO.includes(q.type) && !exclude.includes(q.id));
    if (!pool.length) return null;
    const notLast = pool.filter(q => q.id !== c.lastQ);
    if (notLast.length) pool = notLast;
    pool.sort((a, b) => ((S.q[a.id] || {}).t || 0) - ((S.q[b.id] || {}).t || 0));
    const oldest = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
    return shuffle(oldest)[0];
  }
  function weight(cid) { const s = cStatus(cid); return { repeat: 6, hint: 3, read: 2, own: 1.5, mastered: 0.5, new: 0 }[s]; }
  function weightedPick(cids, n) {
    const out = []; const pool = cids.slice();
    while (out.length < n && pool.length) {
      const tot = pool.reduce((a, c) => a + weight(c), 0); if (tot <= 0) break;
      let r = Math.random() * tot, i = 0;
      for (; i < pool.length; i++) { r -= weight(pool[i]); if (r <= 0) break; }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }

  /* ---------- Текст правильного ответа ---------- */
  function correctText(q) {
    switch (q.type) {
      case "choice": return q.options[q.answer];
      case "match": return q.pairs.map(p => `${p[0]} — ${p[1]}`).join("; ");
      case "label": return q.marks.map(m => `${m.n} — ${m.answer}`).join("; ");
      case "order": return q.items.map((t, i) => `${i + 1}) ${t}`).join(" ");
      case "classify": return q.cats.map((c, ci) => `${c}: ${q.items.filter(it => it[1] === ci).map(it => it[0]).join(", ")}`).join(". ");
      case "fix": { const p = q.parts.slice(); p[q.wrong] = q.fixes[q.fixAnswer]; return p.join(" "); }
    }
    return "";
  }

  /* ---------- Виджет задания ---------- */
  function QWidget(q, opt) {
    const mode = opt.mode || "practice"; // practice | test
    const box = el("div", { class: "q card-q", "data-qid": q.id });
    let hinted = false, done = false;
    box.append(el("p", { class: "q-text" }, q.q));
    if (q.diagram && DIAGRAMS[q.diagram]) box.append(el("div", { class: "diagram-box", html: DIAGRAMS[q.diagram]() }));
    const area = el("div", { class: "q-area" });
    box.append(area);
    const fb = el("div", { class: "feedback", "aria-live": "polite" });
    const actions = el("div", { class: "q-actions" });
    let api = null;

    if (q.type === "recall") return RecallWidget(q, opt);
    if (q.type === "explain") return ExplainWidget(q, opt);

    if (q.type === "choice") api = choiceUI(q, area);
    else if (q.type === "match" || q.type === "label") api = matchUI(q, area);
    else if (q.type === "order") api = orderUI(q, area);
    else if (q.type === "classify") api = classifyUI(q, area);
    else if (q.type === "fix") api = fixUI(q, area);

    const hintBox = el("div", { class: "hint-box", hidden: true });
    if (mode === "practice" && q.hint) {
      const hb = el("button", { class: "btn ghost small", type: "button", onclick: () => { hinted = true; hintBox.hidden = false; hintBox.textContent = "Подсказка: " + q.hint; hb.disabled = true; } }, "Подсказка");
      actions.append(hb);
    }
    const checkBtn = el("button", { class: "btn primary", type: "button" }, mode === "test" ? "Ответить" : "Проверить");
    actions.prepend(checkBtn);
    const warn = el("p", { class: "warn", hidden: true });
    checkBtn.addEventListener("click", () => {
      if (done) return;
      const r = api.grade();
      if (!r.complete) { warn.hidden = false; warn.textContent = r.msg || "Сначала ответь на все части задания."; return; }
      warn.hidden = true; done = true; api.lock(); checkBtn.disabled = true;
      actions.querySelectorAll("button").forEach(b => b.disabled = true);
      const res = r.ok ? (hinted ? "hint" : "own") : "wrong";
      record(q, res);
      if (mode === "practice") {
        api.mark && api.mark();
        fb.className = "feedback " + (r.ok ? "ok" : "bad");
        fb.innerHTML = "";
        if (r.ok) {
          fb.append(el("p", { class: "fb-title" }, hinted ? "Верно (с подсказкой)." : "Верно."), el("p", {}, q.explain));
        } else {
          fb.append(el("p", { class: "fb-title" }, "Пока не так — это нормально, разберёмся."));
          if (r.why) fb.append(el("p", {}, el("b", {}, "Что перепутано: "), r.why));
          fb.append(el("p", {}, el("b", {}, "Правильно: "), correctText(q)));
          fb.append(el("p", {}, q.explain));
          fb.append(el("p", { class: "muted" }, "Похожий вопрос в другой формулировке появится позже — в закреплении урока и в разделе «Повторить ошибки»."));
        }
      }
      opt.onAnswer && opt.onAnswer({ ok: r.ok, res, given: api.given ? api.given() : "" });
    });
    box.append(hintBox, warn, actions, fb);
    return box;
  }

  function choiceUI(q, area) {
    const order = shuffledIdx(q.options.length);
    let sel = null; const btns = [];
    const list = el("div", { class: "options", role: "radiogroup" });
    order.forEach(oi => {
      const b = el("button", { class: "opt", type: "button", role: "radio", "aria-checked": "false", onclick: () => { if (b.disabled) return; sel = oi; btns.forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); }); } }, q.options[oi]);
      b.dataset.oi = oi; btns.push(b); list.append(b);
    });
    area.append(list);
    return {
      grade: () => sel === null ? { complete: false, msg: "Выбери один вариант." } : { complete: true, ok: sel === q.answer, why: (q.why || {})[sel] },
      lock: () => btns.forEach(b => b.disabled = true),
      mark: () => btns.forEach(b => { const oi = +b.dataset.oi; if (oi === q.answer) b.classList.add("right"); else if (oi === sel) b.classList.add("wrong"); }),
      given: () => sel === null ? "" : q.options[sel],
    };
  }

  function matchUI(q, area) {
    const isLabel = q.type === "label";
    const lefts = isLabel ? q.marks.map(m => "Номер " + m.n) : q.pairs.map(p => p[0]);
    const rightsText = isLabel ? q.options : q.pairs.map(p => p[1]);
    const correct = isLabel ? q.marks.map(m => q.options.indexOf(m.answer)) : q.pairs.map((_, i) => i);
    const ropt = shuffledIdx(rightsText.length);
    const assign = lefts.map(() => null);
    let active = 0, locked = false;
    const rows = el("div", { class: "match-rows" });
    const panel = el("div", { class: "match-panel" });
    area.append(el("p", { class: "muted small" }, isLabel ? "Нажми на номер, потом выбери подпись." : "Нажми на строку слева, потом выбери подходящий ответ."), rows, panel);
    function draw() {
      rows.innerHTML = ""; panel.innerHTML = "";
      lefts.forEach((L, i) => {
        const r = el("button", { class: "match-row" + (i === active && !locked ? " active" : ""), type: "button", disabled: locked, onclick: () => { active = i; draw(); } },
          el("span", { class: "m-left" }, L),
          el("span", { class: "m-right" + (assign[i] === null ? " empty" : "") }, assign[i] === null ? "выбери…" : rightsText[assign[i]]));
        r.dataset.i = i; rows.append(r);
      });
      if (locked) return;
      panel.append(el("p", { class: "panel-title" }, "Для «" + lefts[active] + "»:"));
      const g = el("div", { class: "options" });
      ropt.forEach(ri => {
        const used = assign.includes(ri) && assign[active] !== ri;
        g.append(el("button", { class: "opt" + (assign[active] === ri ? " sel" : "") + (used ? " used" : ""), type: "button", onclick: () => {
          const prev = assign.indexOf(ri); if (prev >= 0 && prev !== active && !isLabel) assign[prev] = null;
          if (isLabel && prev >= 0 && prev !== active) assign[prev] = null;
          assign[active] = ri;
          const next = assign.findIndex(a => a === null); if (next >= 0) active = next; draw();
        } }, rightsText[ri]));
      });
      panel.append(g);
    }
    draw();
    return {
      grade: () => assign.includes(null) ? { complete: false, msg: "Заполни все строки." } : { complete: true, ok: assign.every((a, i) => a === correct[i]),
        why: assign.map((a, i) => a !== correct[i] ? `«${lefts[i]}» — это не «${rightsText[a]}».` : null).filter(Boolean).join(" ") },
      lock: () => { locked = true; draw(); },
      mark: () => rows.querySelectorAll(".match-row").forEach(r => { const i = +r.dataset.i; r.classList.add(assign[i] === correct[i] ? "right" : "wrong"); }),
      given: () => lefts.map((L, i) => `${L} — ${assign[i] === null ? "?" : rightsText[assign[i]]}`).join("; "),
    };
  }

  function orderUI(q, area) {
    let pool = shuffledIdx(q.items.length), ans = [], locked = false;
    const out = el("ol", { class: "order-ans" }), pl = el("div", { class: "options" });
    const reset = el("button", { class: "btn ghost small", type: "button", onclick: () => { if (locked) return; pool = pool.concat(ans); ans = []; draw(); } }, "Начать заново");
    area.append(el("p", { class: "muted small" }, "Нажимай на шаги по порядку: первый, второй… Чтобы убрать шаг, нажми на него в списке."),
      el("p", { class: "panel-title" }, "Твой порядок:"), out, el("p", { class: "panel-title" }, "Шаги:"), pl, reset);
    function draw() {
      out.innerHTML = ""; pl.innerHTML = "";
      if (!ans.length) out.append(el("li", { class: "empty-li" }, "пока пусто"));
      ans.forEach((ii, k) => { const li = el("li", {}, el("button", { class: "order-item", type: "button", disabled: locked, onclick: () => { ans.splice(k, 1); pool.push(ii); draw(); } }, q.items[ii])); li.dataset.ii = ii; li.dataset.k = k; out.append(li); });
      pool.forEach((ii, k) => pl.append(el("button", { class: "opt", type: "button", disabled: locked, onclick: () => { pool.splice(k, 1); ans.push(ii); draw(); } }, q.items[ii])));
      if (!pool.length && !locked) pl.append(el("p", { class: "muted small" }, "Все шаги расставлены. Нажми «Проверить»."));
    }
    draw();
    return {
      grade: () => pool.length ? { complete: false, msg: "Расставь все шаги." } : { complete: true, ok: ans.every((v, i) => v === i),
        why: (() => { const k = ans.findIndex((v, i) => v !== i); return k >= 0 ? `На месте ${k + 1} должен быть шаг «${q.items[k]}».` : ""; })() },
      lock: () => { locked = true; reset.disabled = true; draw(); },
      mark: () => out.querySelectorAll("li").forEach(li => { if (li.dataset.ii == null) return; li.classList.add(+li.dataset.ii === +li.dataset.k ? "right" : "wrong"); }),
      given: () => ans.map((ii, k) => `${k + 1}) ${q.items[ii]}`).join(" "),
    };
  }

  function classifyUI(q, area) {
    const order = shuffledIdx(q.items.length); const sel = q.items.map(() => null); let locked = false;
    const wrap = el("div", { class: "classify" });
    area.append(el("p", { class: "muted small" }, "Для каждой строки выбери вариант."), wrap);
    function draw() {
      wrap.innerHTML = "";
      order.forEach(ii => {
        const row = el("div", { class: "cl-row" }); row.dataset.ii = ii;
        row.append(el("p", { class: "cl-text" }, q.items[ii][0]));
        const g = el("div", { class: "cl-btns" });
        q.cats.forEach((c, ci) => g.append(el("button", { class: "chip" + (sel[ii] === ci ? " sel" : ""), type: "button", disabled: locked, "aria-pressed": sel[ii] === ci ? "true" : "false", onclick: () => { sel[ii] = ci; draw(); } }, c)));
        row.append(g); wrap.append(row);
      });
    }
    draw();
    return {
      grade: () => sel.includes(null) ? { complete: false, msg: "Выбери вариант для каждой строки." } : { complete: true, ok: sel.every((s, i) => s === q.items[i][1]),
        why: q.items.map((it, i) => sel[i] !== it[1] ? `«${it[0]}» — это «${q.cats[it[1]]}», а не «${q.cats[sel[i]]}».` : null).filter(Boolean).join(" ") },
      lock: () => { locked = true; draw(); },
      mark: () => wrap.querySelectorAll(".cl-row").forEach(r => { const ii = +r.dataset.ii; r.classList.add(sel[ii] === q.items[ii][1] ? "right" : "wrong"); }),
      given: () => q.items.map((it, i) => `${it[0]} — ${sel[i] === null ? "?" : q.cats[sel[i]]}`).join("; "),
    };
  }

  function fixUI(q, area) {
    let part = null, fix = null, locked = false; const fixOrder = shuffledIdx(q.fixes.length);
    const sent = el("div", { class: "fix-sent" }), fixes = el("div", { class: "fix-opts" });
    area.append(el("p", { class: "muted small" }, "Шаг 1: нажми на часть предложения, где ошибка. Шаг 2: выбери, как исправить."), sent, fixes);
    function draw() {
      sent.innerHTML = ""; fixes.innerHTML = "";
      q.parts.forEach((p, i) => { const b = el("button", { class: "fix-part" + (part === i ? " sel" : ""), type: "button", disabled: locked, onclick: () => { part = i; fix = null; draw(); } }, p); b.dataset.i = i; sent.append(b); });
      if (part !== null) {
        fixes.append(el("p", { class: "panel-title" }, "Как правильно вместо «" + q.parts[part] + "»?"));
        const g = el("div", { class: "options" });
        fixOrder.forEach(fi => g.append(el("button", { class: "opt" + (fix === fi ? " sel" : ""), type: "button", disabled: locked, onclick: () => { fix = fi; draw(); } }, q.fixes[fi])));
        fixes.append(g);
      }
    }
    draw();
    return {
      grade: () => (part === null || fix === null) ? { complete: false, msg: "Выбери часть с ошибкой и вариант исправления." } : { complete: true, ok: part === q.wrong && fix === q.fixAnswer,
        why: part !== q.wrong ? `Ошибка в другой части: «${q.parts[q.wrong]}».` : `Ошибку нашла верно, но исправление другое: «${q.fixes[q.fixAnswer]}».` },
      lock: () => { locked = true; draw(); },
      mark: () => sent.querySelectorAll(".fix-part").forEach(b => { if (+b.dataset.i === q.wrong) b.classList.add("right"); else if (+b.dataset.i === part) b.classList.add("wrong"); }),
      given: () => part === null ? "" : `ошибка: «${q.parts[part]}» → «${fix === null ? "?" : q.fixes[fix]}»`,
    };
  }

  function RecallWidget(q, opt) {
    const box = el("div", { class: "q card-q recall" });
    let hinted = false;
    box.append(el("p", { class: "tag" }, "Вспомни без подсказки"), el("p", { class: "q-text" }, q.q));
    const ta = el("textarea", { rows: 4, placeholder: "Можно записать ответ здесь или сказать вслух. Это необязательно." });
    const hintBox = el("div", { class: "hint-box", hidden: true });
    const reveal = el("div", { class: "reveal", hidden: true });
    const hb = el("button", { class: "btn ghost small", type: "button", onclick: () => { hinted = true; hintBox.hidden = false; hintBox.textContent = "Подсказка: " + q.hint; hb.disabled = true; } }, "Подсказка");
    const show = el("button", { class: "btn primary", type: "button", onclick: () => {
      show.disabled = true; hb.disabled = true; reveal.hidden = false;
    } }, "Показать ответ");
    const rate = (res, label) => el("button", { class: "btn " + (res === "own" ? "primary" : "ghost"), type: "button", onclick: (e) => {
      const final = res === "own" && hinted ? "hint" : res;
      record(q, final); reveal.querySelectorAll(".rate button").forEach(b => b.disabled = true);
      e.target.classList.add("chosen");
      reveal.append(el("p", { class: "muted" }, final === "own" ? "Отлично. Отмечено: вспомнила сама." : final === "hint" ? "Отмечено: с подсказкой или частично. Тема вернётся в повторении." : "Отмечено: не вспомнила. Тема вернётся в повторении — это нормально."));
      opt.onAnswer && opt.onAnswer({ ok: final !== "wrong", res: final });
    } }, label);
    reveal.append(el("p", { class: "fb-title" }, "Ответ:"), el("p", {}, q.answer),
      el("p", { class: "fb-title" }, "Ключевые мысли:"), el("ul", {}, q.points.map(p => el("li", {}, p))),
      el("p", { class: "panel-title" }, "Честно: как получилось?"),
      el("div", { class: "rate" }, rate("own", "Вспомнила сама"), rate("hint", "Вспомнила частично"), rate("wrong", "Не вспомнила")));
    box.append(ta, el("div", { class: "q-actions" }, show, q.hint ? hb : null), hintBox, reveal);
    return box;
  }

  function ExplainWidget(q, opt) {
    const box = el("div", { class: "q card-q explain" });
    box.append(el("p", { class: "tag" }, "Объясни своими словами"), el("p", { class: "q-text" }, q.q));
    const ta = el("textarea", { rows: 5, placeholder: "Напиши 3–5 предложений или расскажи вслух. Автоматической оценки нет — ты сверишь ответ сама." });
    const check = el("div", { class: "reveal", hidden: true });
    const btn = el("button", { class: "btn primary", type: "button", onclick: () => { btn.disabled = true; check.hidden = false; } }, "Сверить с ключевыми мыслями");
    const boxes = q.points.map(p => el("input", { type: "checkbox" }));
    const sampleBox = el("div", { class: "sample", hidden: true }, el("p", { class: "fb-title" }, "Образец:"), el("p", {}, q.sample));
    const done = el("button", { class: "btn primary", type: "button", onclick: () => {
      const n = boxes.filter(b => b.checked).length;
      const res = n === boxes.length ? "own" : n >= Math.ceil(boxes.length / 2) ? "hint" : "wrong";
      record(q, res); done.disabled = true; boxes.forEach(b => b.disabled = true);
      check.append(el("p", { class: "muted" }, res === "own" ? "Все ключевые мысли на месте. Отлично." : `Отмечено мыслей: ${n} из ${boxes.length}. Перечитай образец и попробуй рассказать ещё раз вслух.`));
      sampleBox.hidden = false;
      opt.onAnswer && opt.onAnswer({ ok: res !== "wrong", res });
    } }, "Готово");
    check.append(el("p", { class: "panel-title" }, "Отметь мысли, которые есть в твоём ответе:"),
      el("div", { class: "checklist" }, q.points.map((p, i) => el("label", { class: "check-row" }, boxes[i], el("span", {}, p)))),
      el("button", { class: "btn ghost small", type: "button", onclick: () => { sampleBox.hidden = false; } }, "Показать образец"), sampleBox, done);
    box.append(ta, el("div", { class: "q-actions" }, btn), check);
    return box;
  }

  /* ---------- Общие элементы страницы ---------- */
  const app = () => $("#app");
  function topbar(title, back = "#/") {
    return el("div", { class: "topbar" }, el("a", { class: "back", href: back }, "← Меню"), el("span", { class: "topbar-title" }, title));
  }
  function termCard(tid) {
    const t = TERMS[tid];
    return el("div", { class: "term" }, el("p", { class: "term-name" }, t.name),
      el("p", {}, el("b", {}, "Что значит: "), t.meaning), el("p", {}, el("b", {}, "Роль в теме: "), t.role),
      el("p", { class: "term-board" }, el("b", {}, "У доски: "), t.board));
  }

  /* ---------- Главный экран ---------- */
  function currentPos() {
    if (S.last && lessonById(S.last.lid)) {
      const l = lessonById(S.last.lid);
      if (!S.lessonDone[l.id] || S.last.idx < l.screens.length) return S.last;
    }
    const next = LESSONS.find(l => !S.lessonDone[l.id]);
    if (next) { const idx = next.screens.findIndex(s => !S.seen[s.id]); return { lid: next.id, idx: idx < 0 ? next.screens.length : idx }; }
    return null;
  }
  function renderHome() {
    const root = app(); root.innerHTML = "";
    const seenN = Object.keys(S.seen).filter(k => LESSONS.some(l => l.screens.some(s => s.id === k))).length;
    const st = ALL_CONCEPTS.map(cStatus);
    const ownN = st.filter(s => s === "own" || s === "mastered").length, mastN = st.filter(s => s === "mastered").length;
    const repeatN = st.filter(s => s === "repeat").length;
    const pos = currentPos();
    const started = seenN > 0;
    const hero = el("section", { class: "hero" });
    hero.append(el("h1", {}, "Биология без путаницы"), el("p", { class: "sub" }, "§ 5. Подцарство Многоклеточные. Тип Кишечнополостные"));
    if (pos) {
      const l = lessonById(pos.lid); const li = LESSONS.indexOf(l);
      hero.append(el("p", { class: "now" }, el("span", { class: "muted" }, started ? "Сейчас: " : "Первая тема: "), `Урок ${li + 1} из ${LESSONS.length}. ${l.title}`,
        el("br"), el("span", { class: "muted small" }, pos.idx < l.screens.length ? `Экран ${pos.idx + 1} из ${l.screens.length}` : "Осталось закрепление урока")));
      hero.append(el("a", { class: "btn huge", href: `#/lesson/${l.id}/${pos.idx}` }, started ? "Продолжить" : "Начать"));
    } else {
      hero.append(el("p", { class: "now" }, "Все уроки пройдены. Теперь — повторение, ответ у доски и проверочная."));
      hero.append(el("a", { class: "btn huge", href: "#/review" }, "Повторить"));
    }
    const pct = Math.round(seenN / totalScreens * 100);
    hero.append(el("div", { class: "progress-block" },
      el("div", { class: "bar", role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Прочитано" }, el("span", { style: `width:${pct}%` })),
      el("p", { class: "small" }, `Прочитано экранов: ${seenN} из ${totalScreens}. Вспомнила сама: ${ownN} тем из ${ALL_CONCEPTS.length}. Усвоено: ${mastN}.`)));
    root.append(hero);

    const menu = el("nav", { class: "menu", "aria-label": "Разделы" });
    const item = (href, title, sub, badge) => el("a", { class: "menu-item", href }, el("span", { class: "mi-title" }, title, badge ? el("span", { class: "badge" }, badge) : null), el("span", { class: "mi-sub" }, sub));
    menu.append(
      item("#/review", "Повторить ошибки", repeatN ? `Темы с ошибками: ${repeatN}` : "Ошибок пока нет — можно общее повторение", repeatN || null),
      item("#/board", "У доски", "Подготовка устного ответа"),
      item("#/test", "Проверочная", S.test ? "Продолжить начатую" : "Смешанная проверка без подсказок"),
      item("#/dict", "Словарь", "Все термины с объяснениями"),
      item("#/summary", "Краткий конспект", "Главное по каждому уроку"),
    );
    root.append(menu);

    const lessons = el("section", { class: "lessons" }, el("h2", {}, "Уроки"));
    LESSONS.forEach((l, i) => {
      const seen = l.screens.filter(s => S.seen[s.id]).length;
      const cids = [...new Set(l.screens.flatMap(s => s.concepts))];
      const cst = cids.map(cStatus);
      const own = cst.filter(s => s === "own" || s === "mastered").length, mast = cst.filter(s => s === "mastered").length, rep = cst.filter(s => s === "repeat").length;
      let state = seen === 0 ? "не начат" : S.lessonDone[l.id] ? "пройден" : `прочитано ${seen} из ${l.screens.length}`;
      const startIdx = S.lessonDone[l.id] ? 0 : Math.max(0, l.screens.findIndex(s => !S.seen[s.id]));
      lessons.append(el("a", { class: "lesson-row" + (S.lessonDone[l.id] ? " done" : ""), href: `#/lesson/${l.id}/${startIdx < 0 ? 0 : startIdx}` },
        el("span", { class: "lr-n" }, i + 1),
        el("span", { class: "lr-body" }, el("span", { class: "lr-title" }, l.title), el("span", { class: "lr-sub" }, l.short),
          el("span", { class: "lr-state" }, state + (seen ? ` · вспомнила сама ${own}/${cids.length} · усвоено ${mast}` : "") + (rep ? ` · ошибки: ${rep}` : "")))));
    });
    root.append(lessons);
    root.append(el("section", { class: "legend-help" }, el("h2", {}, "Что значат отметки"),
      el("ul", {}, el("li", {}, el("b", {}, "Прочитано"), " — ты открыла объяснение."), el("li", {}, el("b", {}, "С подсказкой"), " — ответ верный, но с подсказкой или частично."),
        el("li", {}, el("b", {}, "Вспомнила сама"), " — верно без подсказки."), el("li", {}, el("b", {}, "Усвоено"), " — сама и верно на два разных вопроса по теме, без ошибки после этого."))));
    root.append(el("section", { class: "foot" },
      el("p", { class: "small muted" }, "Материал: § 5 учебника С. В. Суматохина, Д. И. Трайтака «Биология. Животные. 7 класс». Полного текста нового издания в открытом доступе нет, поэтому факты сверены с учебником 7 класса той же авторской линии (Пасечник, Суматохин) — главы о тканях, кишечнополостных и гидре. Тема о медузах следующего параграфа не включена."),
      !storageOk ? el("p", { class: "warn" }, "Браузер не даёт сохранять прогресс (например, в режиме инкогнито).") : null,
      el("button", { class: "btn ghost small danger", type: "button", onclick: confirmReset }, "Сбросить прогресс")));
  }
  function confirmReset() {
    const ov = el("div", { class: "overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "rt" });
    const close = () => ov.remove();
    ov.append(el("div", { class: "dialog" }, el("h2", { id: "rt" }, "Сбросить весь прогресс?"),
      el("p", {}, "Удалятся прочитанные экраны, ответы, ошибки и результаты проверочных. Это нельзя отменить."),
      el("div", { class: "q-actions" }, el("button", { class: "btn danger-fill", type: "button", onclick: () => { S = blank(); save(); close(); go("#/"); } }, "Да, сбросить"),
        el("button", { class: "btn ghost", type: "button", onclick: close }, "Отмена"))));
    document.body.append(ov); ov.querySelector(".btn.ghost").focus();
  }

  /* ---------- Урок ---------- */
  function renderLesson(lid, idx) {
    const l = lessonById(lid); if (!l) return go("#/");
    const li = LESSONS.indexOf(l);
    idx = Math.max(0, Math.min(idx, l.screens.length + 1));
    S.last = { lid, idx: Math.min(idx, l.screens.length) }; save();
    const root = app(); root.innerHTML = "";
    root.append(topbar(`Урок ${li + 1}. ${l.title}`));
    const dots = el("div", { class: "dots", "aria-label": `Экран ${Math.min(idx + 1, l.screens.length)} из ${l.screens.length}` });
    l.screens.forEach((s, i) => dots.append(el("a", { class: "dot" + (i === idx ? " cur" : "") + (S.seen[s.id] ? " seen" : ""), href: `#/lesson/${lid}/${i}`, "aria-label": `Экран ${i + 1}` })));
    dots.append(el("span", { class: "dot-label" }, idx < l.screens.length ? `Экран ${idx + 1} из ${l.screens.length}` : "Закрепление"));
    root.append(dots);
    if (idx >= l.screens.length) return renderLessonPractice(l, li, root, idx > l.screens.length);
    const s = l.screens[idx];
    S.seen[s.id] = true; save();
    const card = el("article", { class: "screen" });
    card.append(el("h2", {}, s.title));
    const tx = el("div", { class: "explain-text" }, s.text.map(t => el("p", {}, t)));
    card.append(tx);
    const simple = el("div", { class: "simple", hidden: true }, el("p", { class: "tag" }, "Проще"), s.simple.map(t => el("p", {}, t)),
      s.simpleIsAnalogy ? el("p", { class: "muted small" }, "«Как детали одного механизма» — это сравнение, а не точное описание.") : null);
    const sb = el("button", { class: "btn soft", type: "button", "aria-expanded": "false", onclick: () => { simple.hidden = !simple.hidden; sb.textContent = simple.hidden ? "Объясни проще" : "Скрыть простое объяснение"; sb.setAttribute("aria-expanded", String(!simple.hidden)); } }, "Объясни проще");
    card.append(sb, simple);
    if (s.analogy) card.append(el("div", { class: "analogy" }, el("p", { class: "tag" }, "Сравнение из жизни"), el("p", {}, s.analogy.replace(/^Сравнение из жизни:\s*/, ""))));
    if (s.note) card.append(el("div", { class: "note" }, el("p", {}, s.note)));
    if (s.diagram && DIAGRAMS[s.diagram]) card.append(el("div", { class: "diagram-box", html: DIAGRAMS[s.diagram]() }));
    if (s.terms && s.terms.length) card.append(el("div", { class: "terms" }, el("h3", {}, s.terms.length > 1 ? "Новые термины" : "Новый термин"), s.terms.map(termCard)));
    const nav = el("div", { class: "lesson-nav" });
    const next = el("a", { class: "btn primary big", href: `#/lesson/${lid}/${idx + 1}` }, idx + 1 < l.screens.length ? "Дальше" : "К закреплению урока");
    const prev = idx > 0 ? el("a", { class: "btn ghost big", href: `#/lesson/${lid}/${idx - 1}` }, "Назад") : el("a", { class: "btn ghost big", href: "#/" }, "В меню");
    const lockNote = el("p", { class: "muted small" }, "Ответь на вопрос, чтобы перейти дальше.");
    const setNext = (on) => { next.classList.toggle("disabled", !on); next.setAttribute("aria-disabled", on ? "false" : "true"); lockNote.hidden = on; };
    next.addEventListener("click", (e) => { if (next.classList.contains("disabled")) { e.preventDefault(); lockNote.classList.add("pulse"); setTimeout(() => lockNote.classList.remove("pulse"), 600); } });
    const q = QMAP[s.check];
    card.append(el("div", { class: "check" }, el("h3", {}, "Проверь понимание"), QWidget(q, { mode: "practice", onAnswer: () => { S.checks[s.id] = true; save(); setNext(true); } })));
    setNext(!!S.checks[s.id]);
    nav.append(prev, next);
    card.append(lockNote, nav);
    root.append(card);
  }

  function buildLessonPractice(l, li) {
    const ids = [];
    const cids = [...new Set(l.screens.flatMap(s => s.concepts))];
    const checkIds = l.screens.map(s => s.check);
    // 1) похожие вопросы по темам с ошибками/подсказками этого урока
    cids.filter(c => ["repeat", "hint"].includes(cStatus(c))).forEach(c => { const v = pickVariant(c, checkIds.concat(ids)); if (v) ids.push(v.id); });
    // 2) ещё пара тем урока в другой формулировке
    const rest = shuffle(cids.filter(c => !ids.some(id => QMAP[id].concept === c)));
    for (const c of rest) { if (ids.length >= 3) break; const v = pickVariant(c, checkIds.concat(ids)); if (v) ids.push(v.id); }
    // 3) вспомнить и объяснить
    ids.push(l.practice.recall, l.practice.explain);
    // 4) вопросы из предыдущих уроков (чаще — темы с ошибками)
    const prevC = ALL_CONCEPTS.filter(c => CS[c].li < li && conceptSeen(c));
    weightedPick(prevC, 2).forEach(c => { const v = pickVariant(c, ids); if (v) ids.push(v.id); });
    return ids.slice(0, 9);
  }
  let practiceCache = {};
  function renderLessonPractice(l, li, root, finished) {
    if (finished) return renderLessonDone(l, li, root);
    const key = l.id;
    if (!practiceCache[key]) practiceCache[key] = buildLessonPractice(l, li);
    const ids = practiceCache[key];
    const card = el("article", { class: "screen" });
    card.append(el("h2", {}, "Закрепление урока"), el("p", { class: "muted" }, "Несколько вопросов в новой формулировке, одно «вспомни» и одно «объясни». В конце — вопросы из прошлых уроков."));
    root.append(card);
    runSequence(card, ids, { mode: "practice", onFinish: () => { S.lessonDone[l.id] = true; delete practiceCache[key]; save(); go(`#/lesson/${l.id}/${l.screens.length + 1}`); }, finishLabel: "Завершить урок" });
  }
  function renderLessonDone(l, li, root) {
    const card = el("article", { class: "screen" });
    const cids = [...new Set(l.screens.flatMap(s => s.concepts))];
    card.append(el("h2", {}, `Урок ${li + 1} пройден`), el("p", {}, "Вот что важно запомнить:"), el("ul", { class: "summary-list" }, l.summary.map(t => el("li", {}, t))));
    const stl = el("ul", { class: "status-list" });
    cids.forEach(c => { const st = cStatus(c); stl.append(el("li", { class: "st-" + st }, el("span", {}, CS[c].title), el("span", { class: "st-chip" }, ST_LABEL[st]))); });
    card.append(el("h3", {}, "Состояние тем"), stl, el("p", { class: "muted small" }, "Тема становится «усвоенной», когда ты сама верно ответишь на два разных вопроса по ней. Такие вопросы будут в повторении и проверочной."));
    const nextL = LESSONS[li + 1];
    card.append(el("div", { class: "lesson-nav" }, nextL ? el("a", { class: "btn primary big", href: `#/lesson/${nextL.id}/0` }, "Следующий урок") : el("a", { class: "btn primary big", href: "#/test" }, "К проверочной"),
      el("a", { class: "btn ghost big", href: "#/" }, "В меню")));
    root.append(card);
  }

  /* Последовательность заданий с обратной связью */
  function runSequence(container, ids, opt) {
    let i = 0; let ok = 0;
    const holder = el("div", { class: "seq" }); container.append(holder);
    function step() {
      holder.innerHTML = "";
      if (i >= ids.length) { opt.onFinish && opt.onFinish(ok); return; }
      const q = QMAP[ids[i]];
      const w = CS[q.concept];
      holder.append(el("p", { class: "seq-count" }, `Задание ${i + 1} из ${ids.length}`, el("span", { class: "muted small" }, ` · тема: ${w.title}`)));
      const nextBtn = el("button", { class: "btn primary big", type: "button", hidden: true, onclick: () => { i++; step(); window.scrollTo({ top: container.offsetTop - 10 }); } }, i + 1 < ids.length ? "Дальше" : (opt.finishLabel || "Готово"));
      holder.append(QWidget(q, { mode: "practice", onAnswer: (r) => { if (r.ok) ok++; nextBtn.hidden = false; } }));
      holder.append(el("div", { class: "lesson-nav" }, nextBtn, el("a", { class: "btn ghost", href: `#/lesson/${w.lid}/${w.si}` }, "Посмотреть объяснение")));
    }
    step();
  }

  /* ---------- Повторить ошибки ---------- */
  function renderReview() {
    const root = app(); root.innerHTML = ""; root.append(topbar("Повторить ошибки"));
    const card = el("article", { class: "screen" }); root.append(card);
    const rep = ALL_CONCEPTS.filter(c => cStatus(c) === "repeat").sort((a, b) => (S.c[b].wrong - S.c[a].wrong));
    const hint = ALL_CONCEPTS.filter(c => cStatus(c) === "hint");
    if (!Object.keys(S.seen).length) {
      card.append(el("h2", {}, "Повторять пока нечего"), el("p", {}, "Сначала пройди хотя бы один экран урока — тогда здесь появятся вопросы."), el("a", { class: "btn primary big", href: "#/" }, "К урокам"));
      return;
    }
    const start = (cids, title) => {
      card.innerHTML = ""; card.append(el("h2", {}, title));
      const ids = []; cids.forEach(c => { const v = pickVariant(c, ids); if (v) ids.push(v.id); });
      runSequence(card, ids, { mode: "practice", finishLabel: "Закончить", onFinish: (ok) => {
        card.innerHTML = ""; card.append(el("h2", {}, "Повторение закончено"), el("p", {}, `Верно: ${ok} из ${ids.length}.`));
        const still = cids.filter(c => cStatus(c) === "repeat");
        if (still.length) card.append(el("p", {}, "Ещё нужно вернуться к темам:"), el("ul", {}, still.map(c => el("li", {}, el("a", { href: `#/lesson/${CS[c].lid}/${CS[c].si}` }, CS[c].title)))));
        card.append(el("div", { class: "lesson-nav" }, el("button", { class: "btn primary big", type: "button", onclick: renderReview }, "Ещё раз"), el("a", { class: "btn ghost big", href: "#/" }, "В меню")));
      } });
    };
    if (rep.length || hint.length) {
      const list = rep.concat(hint).slice(0, 8);
      card.append(el("h2", {}, "Повторим то, что вызвало трудности"),
        el("p", {}, "Вопросы будут в другой формулировке. Сначала — темы с ошибками, потом — ответы с подсказкой."),
        el("ul", { class: "status-list" }, list.map(c => el("li", { class: "st-" + cStatus(c) }, el("span", {}, CS[c].title), el("span", { class: "st-chip" }, ST_LABEL[cStatus(c)])))),
        el("button", { class: "btn primary big", type: "button", onclick: () => start(list, "Повторение ошибок") }, "Начать повторение"));
    } else {
      card.append(el("h2", {}, "Ошибок для повтора нет"), el("p", {}, "Можно сделать общее повторение по прочитанным темам. Чаще будут попадаться темы, которые ещё не усвоены."));
    }
    const seenC = ALL_CONCEPTS.filter(conceptSeen);
    card.append(el("button", { class: "btn soft big", type: "button", onclick: () => start(weightedPick(seenC, Math.min(8, seenC.length)), "Общее повторение") }, "Общее повторение"));
  }

  /* ---------- У доски ---------- */
  function renderBoardList() {
    const root = app(); root.innerHTML = ""; root.append(topbar("У доски"));
    const card = el("article", { class: "screen" });
    card.append(el("h2", {}, "Подготовка к устному ответу"),
      el("p", {}, "Выбери тему. Сначала увидишь только вопрос. Ответь вслух, как у доски, связным рассказом. Потом нажми «Я ответила» и сверься с планом и образцом."),
      el("p", { class: "muted small" }, "Микрофон не нужен. Таймера нет."));
    const list = el("div", { class: "board-list" });
    BOARD.forEach((b, i) => {
      const r = S.board[b.id]; const l = lessonById(b.lesson);
      const st = r ? (r.checked === r.total ? "готово" : `отмечено ${r.checked} из ${r.total}`) : "ещё не отвечала";
      list.append(el("a", { class: "lesson-row", href: `#/board/${b.id}` }, el("span", { class: "lr-n" }, i + 1), el("span", { class: "lr-body" }, el("span", { class: "lr-title" }, b.q), el("span", { class: "lr-state" }, `Урок ${LESSONS.indexOf(l) + 1} · ${st}`))));
    });
    const rnd = el("button", { class: "btn primary big", type: "button", onclick: () => { const b = BOARD[Math.floor(Math.random() * BOARD.length)]; go(`#/board/${b.id}`); } }, "Случайный вопрос");
    card.append(rnd, list); root.append(card);
  }
  function renderBoard(id) {
    const b = BOARD.find(x => x.id === id); if (!b) return go("#/board");
    const root = app(); root.innerHTML = ""; root.append(topbar("У доски", "#/"));
    const l = lessonById(b.lesson); const li = LESSONS.indexOf(l);
    const card = el("article", { class: "screen" });
    card.append(el("p", { class: "tag" }, "Вопрос для ответа у доски"), el("h2", { class: "board-q" }, b.q),
      el("p", { class: "muted" }, "Подумай минуту и расскажи ответ вслух. Говори связно: «Сначала… Затем… Поэтому…»."));
    if (!S.seen[l.screens[0].id]) card.append(el("div", { class: "note" }, el("p", {}, `Эта тема из урока ${li + 1}, который ты ещё не открывала. `, el("a", { href: `#/lesson/${l.id}/0` }, "Открыть урок"))));
    const planHint = el("div", { class: "hint-box", hidden: true }, el("p", { class: "fb-title" }, "План ответа:"), el("ol", {}, b.plan.map(p => el("li", {}, p))));
    let usedPlan = false;
    const ph = el("button", { class: "btn ghost", type: "button", onclick: () => { usedPlan = true; planHint.hidden = false; ph.disabled = true; } }, "Нужен план (подсказка)");
    const reveal = el("div", { class: "reveal", hidden: true });
    const answered = el("button", { class: "btn primary big", type: "button", onclick: () => { answered.disabled = true; ph.disabled = true; reveal.hidden = false; planHint.hidden = true; reveal.scrollIntoView({ behavior: "smooth", block: "start" }); } }, "Я ответила");
    const boxes = b.points.map(() => el("input", { type: "checkbox" }));
    const result = el("div");
    reveal.append(el("h3", {}, "План ответа"), el("ol", {}, b.plan.map(p => el("li", {}, p))),
      el("h3", {}, "Образец ответа"), el("p", { class: "sample-text" }, b.sample),
      el("h3", {}, "Проверь себя: что было в твоём ответе?"),
      el("div", { class: "checklist" }, b.points.map((p, i) => el("label", { class: "check-row" }, boxes[i], el("span", {}, p)))),
      el("button", { class: "btn primary", type: "button", onclick: (e) => {
        const n = boxes.filter(x => x.checked).length;
        S.board[b.id] = { checked: n, total: boxes.length, plan: usedPlan, t: Date.now() }; save();
        e.target.disabled = true;
        result.innerHTML = "";
        result.append(el("div", { class: "feedback " + (n === boxes.length ? "ok" : "bad") },
          el("p", { class: "fb-title" }, n === boxes.length ? (usedPlan ? "Все мысли на месте (с планом). Попробуй в следующий раз без плана." : "Все основные мысли на месте. Готово к ответу.") : `Отмечено ${n} из ${boxes.length}.`),
          n < boxes.length ? el("p", {}, "Прочитай образец ещё раз вслух, а потом расскажи без него. Пропущенные мысли можно повторить в уроке.") : null));
        result.append(el("div", { class: "lesson-nav" }, el("a", { class: "btn soft", href: `#/lesson/${l.id}/0` }, `Урок ${li + 1}: объяснение`),
          el("button", { class: "btn ghost", type: "button", onclick: () => renderBoard(b.id) }, "Ответить ещё раз")));
      } }, "Сохранить самопроверку"), result);
    const nextIdx = (BOARD.indexOf(b) + 1) % BOARD.length;
    card.append(el("div", { class: "q-actions" }, answered, ph), planHint, reveal,
      el("div", { class: "lesson-nav" }, el("a", { class: "btn ghost", href: "#/board" }, "Все вопросы"), el("a", { class: "btn ghost", href: `#/board/${BOARD[nextIdx].id}` }, "Следующий вопрос")));
    root.append(card);
  }

  /* ---------- Проверочная ---------- */
  function buildTest() {
    const seenC = ALL_CONCEPTS.filter(conceptSeen);
    const byL = {}; seenC.forEach(c => (byL[CS[c].lid] = byL[CS[c].lid] || []).push(c));
    const lids = Object.keys(byL); const chosen = [];
    const target = Math.min(14, seenC.length);
    Object.values(byL).forEach(a => shuffle(a));
    let k = 0;
    while (chosen.length < target) { const a = byL[lids[k % lids.length]]; if (a.length) chosen.push(a.pop()); k++; if (k > 500) break; }
    const ids = []; chosen.forEach(c => { const v = pickVariant(c, ids); if (v) ids.push(v.id); });
    return shuffle(ids);
  }
  function renderTest() {
    const root = app(); root.innerHTML = ""; root.append(topbar("Проверочная"));
    const card = el("article", { class: "screen" }); root.append(card);
    const seenC = ALL_CONCEPTS.filter(conceptSeen);
    if (S.test && S.test.idx >= S.test.ids.length) return renderTestResult(card);
    if (!S.test) {
      card.append(el("h2", {}, "Смешанная проверочная"));
      if (seenC.length < 4) {
        card.append(el("p", {}, "В проверочную попадают только темы, которые ты уже прочитала. Пока их слишком мало."), el("a", { class: "btn primary big", href: "#/" }, "Продолжить уроки"));
        return;
      }
      const lessonsIn = [...new Set(seenC.map(c => CS[c].li + 1))].sort((a, b) => a - b);
      card.append(el("p", {}, `Вопросы из уроков: ${lessonsIn.join(", ")}. Правильные ответы покажем только в конце. Подсказок нет, таймера нет.`));
      if (lessonsIn.length < LESSONS.length) card.append(el("p", { class: "muted small" }, "Темы из уроков, которые ты ещё не читала, в проверочную не попадут."));
      if (S.tests.length) card.append(el("p", { class: "muted small" }, "Прошлые результаты: " + S.tests.slice(-5).map(t => `${t.score}/${t.total}`).join(", ")));
      card.append(el("button", { class: "btn primary big", type: "button", onclick: () => { S.test = { ids: buildTest(), idx: 0, ans: [] }; save(); renderTest(); } }, "Начать проверочную"));
      return;
    }
    const T = S.test; const q = QMAP[T.ids[T.idx]];
    card.append(el("p", { class: "seq-count" }, `Вопрос ${T.idx + 1} из ${T.ids.length}`), el("div", { class: "bar thin" }, el("span", { style: `width:${Math.round(T.idx / T.ids.length * 100)}%` })));
    card.append(QWidget(q, { mode: "test", onAnswer: (r) => { T.ans[T.idx] = { ok: r.ok, given: r.given }; T.idx++; save(); setTimeout(renderTest, 250); window.scrollTo({ top: 0 }); } }));
    card.append(el("div", { class: "lesson-nav" }, el("button", { class: "btn ghost small", type: "button", onclick: () => { if (confirm("Прервать проверочную? Ответы не сохранятся в результатах.")) { S.test = null; save(); renderTest(); } } }, "Прервать")));
  }
  function renderTestResult(card) {
    const T = S.test; const score = T.ans.filter(a => a && a.ok).length;
    if (!T.saved) { S.tests.push({ score, total: T.ids.length, t: Date.now() }); T.saved = true; save(); }
    card.append(el("h2", {}, "Результат проверочной"), el("p", { class: "score" }, `${score} из ${T.ids.length}`));
    const wrong = T.ids.map((id, i) => ({ q: QMAP[id], a: T.ans[i] })).filter(x => !x.a || !x.a.ok);
    if (!wrong.length) card.append(el("p", {}, "Без ошибок. Отличная работа. Для закрепления попробуй ответить у доски."));
    else {
      const topics = [...new Set(wrong.map(x => x.q.concept))];
      card.append(el("h3", {}, "Темы, которые нужно повторить"), el("ul", { class: "topic-list" }, topics.map(c => el("li", {}, el("span", {}, `Урок ${CS[c].li + 1}: ${CS[c].title}`), el("a", { class: "btn soft small", href: `#/lesson/${CS[c].lid}/${CS[c].si}` }, "К объяснению")))));
      card.append(el("h3", {}, "Разбор ошибок"));
      wrong.forEach(x => {
        const why = x.q.type === "choice" ? (x.q.why || {})[x.q.options.indexOf(x.a && x.a.given)] : null;
        card.append(el("div", { class: "review-item" }, el("p", { class: "q-text" }, x.q.q),
          el("p", {}, el("b", {}, "Твой ответ: "), (x.a && x.a.given) || "—"),
          why ? el("p", {}, el("b", {}, "Что перепутано: "), why) : null,
          el("p", {}, el("b", {}, "Правильно: "), correctText(x.q)), el("p", { class: "muted" }, x.q.explain),
          el("a", { class: "btn soft small", href: `#/lesson/${CS[x.q.concept].lid}/${CS[x.q.concept].si}` }, "К объяснению")));
      });
    }
    card.append(el("div", { class: "lesson-nav" },
      wrong.length ? el("a", { class: "btn primary big", href: "#/review" }, "Повторить ошибки") : null,
      el("button", { class: "btn ghost big", type: "button", onclick: () => { S.test = null; save(); renderTest(); } }, "Новая проверочная"),
      el("a", { class: "btn ghost big", href: "#/" }, "В меню")));
  }

  /* ---------- Словарь ---------- */
  function renderDict() {
    const root = app(); root.innerHTML = ""; root.append(topbar("Словарь"));
    const card = el("article", { class: "screen" });
    const input = el("input", { type: "search", class: "search", placeholder: "Найти термин…", "aria-label": "Найти термин" });
    const list = el("div", { class: "dict" });
    const order = Object.keys(TERMS).sort((a, b) => { const A = TERM_WHERE[a] || { li: 99, si: 99 }, B = TERM_WHERE[b] || { li: 99, si: 99 }; return A.li - B.li || A.si - B.si; });
    function draw() {
      const f = input.value.trim().toLowerCase(); list.innerHTML = ""; let lastL = -1; let n = 0;
      order.forEach(tid => {
        const t = TERMS[tid]; if (f && !(t.name + " " + t.meaning).toLowerCase().includes(f)) return;
        const w = TERM_WHERE[tid]; n++;
        if (!f && w && w.li !== lastL) { lastL = w.li; list.append(el("h3", { class: "dict-h" }, `Урок ${w.li + 1}. ${LESSONS[w.li].title}`)); }
        const c = termCard(tid); if (w) c.append(el("a", { class: "btn soft small", href: `#/lesson/${w.lid}/${w.si}` }, "Открыть объяснение"));
        list.append(c);
      });
      if (!n) list.append(el("p", { class: "muted" }, "Ничего не найдено. Попробуй другое слово."));
    }
    input.addEventListener("input", draw);
    card.append(el("h2", {}, "Словарь терминов"), input, list); draw(); root.append(card);
  }

  /* ---------- Конспект ---------- */
  function renderSummary() {
    const root = app(); root.innerHTML = ""; root.append(topbar("Краткий конспект"));
    const card = el("article", { class: "screen" });
    card.append(el("h2", {}, "Краткий конспект § 5"));
    LESSONS.forEach((l, i) => card.append(el("section", { class: "sum-sec" }, el("h3", {}, `${i + 1}. ${l.title}`), el("ul", { class: "summary-list" }, l.summary.map(t => el("li", {}, t))),
      el("a", { class: "btn soft small", href: `#/lesson/${l.id}/0` }, "Открыть урок"))));
    root.append(card);
  }

  /* ---------- Маршрутизация ---------- */
  function render() {
    const h = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    document.querySelectorAll(".overlay").forEach(o => o.remove());
    if (h[0] === "lesson") renderLesson(h[1], parseInt(h[2] || "0", 10) || 0);
    else if (h[0] === "review") renderReview();
    else if (h[0] === "board") h[1] ? renderBoard(h[1]) : renderBoardList();
    else if (h[0] === "test") renderTest();
    else if (h[0] === "dict") renderDict();
    else if (h[0] === "summary") renderSummary();
    else renderHome();
    window.scrollTo(0, 0);
    const h2 = app().querySelector("h1, h2"); if (h2) { h2.setAttribute("tabindex", "-1"); }
  }
  window.addEventListener("hashchange", render);
  render();
})();
