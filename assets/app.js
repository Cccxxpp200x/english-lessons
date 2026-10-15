// หน้าจอและลำดับการเรียน: Warm-up → Core Review → New Intake → Wrap-up
import * as srs from "./srs.js";

const KEY = "english-lessons:v2";
const app = document.getElementById("app");

let words = [];
let byId = {};
let store = { cards: {}, daily: null, settings: { newPerDay: 5, accent: "en-US" } };
let session = null;

const PHASES = {
  warm: { th: "อุ่นเครื่อง", en: "Warm-up" },
  review: { th: "ทบทวน", en: "Core Review" },
  new: { th: "คำใหม่", en: "New Intake" },
  wrap: { th: "เก็บตก", en: "Wrap-up" },
};

// ---------- storage ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) store = { ...store, ...s, settings: { ...store.settings, ...s.settings } };
  } catch { /* ไม่มีข้อมูลหรือเบราว์เซอร์ไม่อนุญาต */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ข้าม */ }
}

function daily() {
  const today = srs.dateKey();
  if (!store.daily || store.daily.date !== today) store.daily = srs.emptyDaily(today);
  return store.daily;
}

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wordRe = w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
const norm = s => s.toLowerCase().replace(/[.,!?'"]/g, "").replace(/\s+/g, " ").trim();
const on = (act, fn) => app.querySelectorAll(`[data-act="${act}"]`).forEach(el => (el.onclick = fn));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ตัวเลือก 4 ข้อ โดยเลือกคำชนิดเดียวกันมาเป็นตัวหลอกก่อน
function pickOptions(w, field) {
  const pool = [
    ...shuffle(words.filter(x => x.id !== w.id && x.pos === w.pos)),
    ...shuffle(words.filter(x => x.id !== w.id && x.pos !== w.pos)),
  ];
  const seen = new Set([w[field].toLowerCase()]);
  const opts = [w[field]];
  for (const x of pool) {
    if (opts.length === 4) break;
    if (!seen.has(x[field].toLowerCase())) { seen.add(x[field].toLowerCase()); opts.push(x[field]); }
  }
  return shuffle(opts);
}

const isLeech = w => !!store.cards[w.id]?.leech;
const sentenceOf = w => (isLeech(w) ? { en: w.simple, th: w.simpleTh } : { en: w.cloze, th: w.clozeTh });
const filled = (s, w) => s.replace("___", w.answer);
const hl = (text, target) => esc(text).replace(wordRe(esc(target)), m => `<span class="font-semibold text-purple-600 dark:text-purple-400">${m}</span>`);
const BLANK = `<span class="inline-block min-w-20 border-b-2 border-purple-500 align-baseline">&nbsp;</span>`;

// ---------- speech ----------
let voices = [];
function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }

function speak(text, onDone) {
  let finished = false;
  const done = () => { if (!finished) { finished = true; onDone && onDone(); } };
  if (!window.speechSynthesis) return done();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = store.settings.accent;
  u.rate = 0.9;
  const v = voices.find(v => v.lang.replace("_", "-") === u.lang) || voices.find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  u.onend = done;
  u.onerror = done;
  setTimeout(done, 2500 + text.length * 80); // กันกรณีเบราว์เซอร์ไม่ส่ง onend
  speechSynthesis.speak(u);
}

// ---------- UI pieces ----------
const BTN = {
  primary: "bg-purple-600 text-white hover:bg-purple-700",
  again: "bg-rose-600 text-white hover:bg-rose-700",
  hard: "bg-amber-400 text-zinc-950 hover:bg-amber-300",
  easy: "bg-teal-500 text-zinc-950 hover:bg-teal-400",
  ghost: "bg-white text-zinc-900 ring-1 ring-zinc-200 hover:ring-purple-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800",
};

function button(attrs, label, variant = "primary", key = "") {
  const hint = key ? `<kbd class="ml-2 hidden text-xs opacity-60 md:inline">${key.split(" ")[0]}</kbd>` : "";
  return `<button ${attrs} ${key ? `data-key="${key}"` : ""} class="min-h-12 rounded-2xl px-4 py-3 text-base font-medium transition active:scale-[.98] disabled:opacity-40 ${BTN[variant]}">${label}${hint}</button>`;
}

const panel = "rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800";

function remaining() {
  const ids = new Set([...session.tasks.map(t => t.id), ...daily().wrap]);
  if (session.current && !session.currentDone) ids.add(session.current.id);
  return ids.size;
}

function shell(inner) {
  const ph = PHASES[session.current.phase];
  const left = remaining();
  const pct = Math.round((100 * session.completed) / Math.max(1, session.completed + left));
  app.innerHTML = `
    <header class="sticky top-0 z-10 -mx-4 bg-zinc-100/90 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur dark:bg-zinc-950/90">
      <div class="flex items-center gap-3">
        <button data-act="close" aria-label="ปิด" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-200 text-lg dark:bg-zinc-800">✕</button>
        <div class="flex-1">
          <div class="flex justify-between text-sm">
            <span class="font-medium">${ph.th} <span class="text-zinc-500">· ${ph.en}</span></span>
            <span class="text-zinc-500">เหลือ ${left} คำ</span>
          </div>
          <div class="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div class="h-full bg-purple-600 transition-all" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    </header>
    <main class="flex flex-1 flex-col gap-4 py-4">${inner}</main>`;
  on("close", () => { window.speechSynthesis?.cancel(); session = null; renderHome(); });
  app.querySelectorAll("[data-say]").forEach(b => (b.onclick = () => speak(b.dataset.say)));
}

// หน้าคำถาม: ความหมายไทย + collocation (ซ่อนตัวสะกดภาษาอังกฤษ)
function promptHTML(w, { masked = false } = {}) {
  const leech = isLeech(w);
  return `
    <div class="${panel} text-center">
      ${leech ? `<div class="text-6xl">${w.emoji}</div>
        <span class="mt-2 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">คำที่ลืมบ่อย · มีภาพช่วยจำ</span>` : ""}
      <div class="mt-2 text-2xl font-semibold text-purple-600 md:text-3xl dark:text-purple-400">${esc(w.meaning)}</div>
      ${masked ? `<div class="mt-5 text-xl md:text-2xl">${esc(w.collocation).replace(wordRe(esc(w.word)), BLANK)}</div>` : ""}
      <div class="mt-2 text-zinc-500">${esc(w.collocationTh)}</div>
    </div>`;
}

// การ์ดเฉลยเต็ม (แสดงหลังจากพยายามนึกแล้วเท่านั้น)
// ใช้ประโยคง่าย เพื่อไม่ให้ซ้ำกับประโยคใน Micro-Quiz ที่จะตามมา
function cardHTML(w) {
  const s = { en: w.simple, th: w.simpleTh };
  return `
    <div class="${panel}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-3xl font-semibold md:text-4xl">${esc(w.word)}</div>
          <button data-say="${esc(w.word)}" class="mt-1 inline-flex items-center gap-2 text-zinc-500 hover:text-purple-600">🔊 <span>${esc(w.ipa)}</span></button>
        </div>
        <span class="text-sm text-teal-600 dark:text-teal-400">${esc(w.pos)}</span>
      </div>
      <div class="mt-3 text-lg text-purple-600 dark:text-purple-400">${esc(w.meaning)}</div>
      <div class="mt-4 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
        <div class="text-xs uppercase tracking-wide text-zinc-500">Collocation</div>
        <button data-say="${esc(w.collocation)}" class="text-left text-lg">${hl(w.collocation, w.word)}</button>
        <div class="text-sm text-zinc-500">${esc(w.collocationTh)}</div>
      </div>
      <div class="mt-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
        <button data-say="${esc(filled(s.en, w))}" class="text-left italic">${hl(filled(s.en, w), w.answer)}</button>
        <div class="text-sm text-zinc-500">${esc(s.th)}</div>
      </div>
    </div>`;
}

const listening = `<div class="mt-auto flex items-center justify-center gap-3 py-4 text-zinc-500">
  <span class="grid h-12 w-12 animate-pulse place-items-center rounded-full bg-purple-600 text-xl text-white">🔊</span> ฟังเสียงก่อน…</div>`;

// Ear-first: เล่นเสียงก่อน แล้วค่อยเปิดตัวสะกด
function revealThen(w, before, after) {
  shell(before + listening);
  speak(w.word, after);
}

// ---------- state changes ----------
function fail(id) {
  const d = daily();
  store.cards[id] = srs.rate(store.cards[id], "again", d.date);
  d.wrap = d.wrap.filter(x => x !== id).concat(id);
  session.fails++;
  session.currentDone = true;
  save();
}

function complete(id, phase) {
  const d = daily();
  if (!d.done.includes(id)) d.done.push(id);
  if (phase === "wrap") {
    d.wrap = d.wrap.filter(x => x !== id);
    store.cards[id] = srs.graduate(store.cards[id], d.date);
    session.cleared++;
  }
  if (phase === "new") session.learned++;
  session.completed++;
  session.currentDone = true;
  save();
}

// ---------- session flow ----------
function startSession() {
  if (window.speechSynthesis) { // ปลดล็อกเสียงบน iOS ด้วยการกดของผู้ใช้
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
  const d = daily();
  const plan = srs.buildSession(words.map(w => w.id), store.cards, d, store.settings.newPerDay, d.date);
  const tasks = [
    ...plan.warm.map(id => ({ phase: "warm", id, kind: "warm" })),
    ...plan.review.map(id => ({ phase: "review", id, kind: "recall" })),
    ...plan.fresh.map(id => ({ phase: "new", id, kind: "intro" })),
  ];
  session = { tasks, current: null, currentDone: false, completed: 0, learned: 0, fails: 0, cleared: 0 };
  next();
}

function next() {
  const d = daily();
  const t = session.tasks.shift() || (d.wrap.length ? { phase: "wrap", id: d.wrap[0], kind: "recall" } : null);
  if (!t) return finish();
  if (t.phase !== "warm" && !d.warmDone) { d.warmDone = true; save(); }
  if (!session.current || session.current.id !== t.id) session.currentDone = false;
  session.current = t;
  const view = { warm: showWarm, recall: showRecall, intro: showIntro, cloze: showCloze }[t.kind];
  view(byId[t.id], t.phase);
}

// Warm-up: ทวนเร็วๆ ว่ายังจำคำของเมื่อวานได้ไหม
function showWarm(w, phase) {
  const prompt = `<p class="text-sm text-zinc-500">นึกคำภาษาอังกฤษจากความหมายนี้ในใจ</p>${promptHTML(w)}`;
  shell(`${prompt}<div class="mt-auto grid">${button('data-act="reveal"', "เฉลย", "primary", "Space Enter")}</div>`);
  on("reveal", () => revealThen(w, prompt, () => {
    shell(`${cardHTML(w)}
      <div class="mt-auto grid grid-cols-2 gap-3">
        ${button('data-act="forgot"', "จำไม่ได้", "again", "1")}
        ${button('data-act="knew"', "จำได้", "easy", "2")}
      </div>`);
    on("forgot", () => { fail(w.id); next(); });
    on("knew", () => { complete(w.id, phase); next(); });
  }));
}

// Level 2 · Recall: ความหมาย + collocation → นึกและพูดในใจ → เฉลย → ให้คะแนนตัวเอง
function showRecall(w, phase) {
  const prompt = `<p class="text-sm text-zinc-500">นึกคำที่หายไป แล้วลองพูดออกเสียง ก่อนกดเฉลย</p>${promptHTML(w, { masked: true })}`;
  shell(`${prompt}<div class="mt-auto grid">${button('data-act="reveal"', "เฉลย (Reveal Answer)", "primary", "Space Enter")}</div>`);
  on("reveal", () => revealThen(w, prompt, () => {
    const c = store.cards[w.id];
    const days = phase === "wrap" ? null : { hard: 1, easy: srs.nextEasyInterval(c?.interval ?? 0) };
    const sub = t => `<span class="block text-xs font-normal opacity-80">${t}</span>`;
    shell(`${cardHTML(w)}
      <div class="mt-auto grid grid-cols-3 gap-3">
        ${button('data-act="again"', `Again${sub("ทวนอีกรอบ")}`, "again", "1")}
        ${button('data-act="hard"', `Hard${sub(days ? `${days.hard} วัน` : "ยาก")}`, "hard", "2")}
        ${button('data-act="easy"', `Easy${sub(days ? `${days.easy} วัน` : "ง่าย")}`, "easy", "3")}
      </div>`);
    on("again", () => { fail(w.id); next(); });
    const pass = rating => () => {
      if (phase !== "wrap") { store.cards[w.id] = srs.rate(c, rating, daily().date); save(); }
      session.tasks.unshift({ phase, id: w.id, kind: "cloze" }); // ต้องผ่าน Micro-Quiz ก่อนนับว่าเสร็จ
      next();
    };
    on("hard", pass("hard"));
    on("easy", pass("easy"));
  }));
}

// Level 1 · Recognition (คำใหม่): ฟังเสียง + ความหมาย → เลือกคำที่ถูกจาก 4 ตัวเลือก
function showIntro(w, phase) {
  const d = daily();
  if (!d.newIds.includes(w.id)) { d.newIds.push(w.id); save(); }
  shell(`
    <p class="text-sm text-zinc-500">คำใหม่ · ฟังเสียง แล้วเลือกคำที่ตรงกับความหมาย</p>
    <div class="${panel} text-center">
      <button data-say="${esc(w.word)}" aria-label="ฟังอีกครั้ง" class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-purple-600 text-3xl text-white shadow-lg active:scale-95">🔊</button>
      <div class="mt-4 text-2xl font-semibold text-purple-600 md:text-3xl dark:text-purple-400">${esc(w.meaning)}</div>
      <div class="mt-2 text-zinc-500">${esc(w.collocationTh)}</div>
    </div>
    <div id="opts" class="mt-auto grid gap-3"><p class="py-4 text-center text-zinc-500">ฟังให้จบก่อน แล้วตัวเลือกจะขึ้นมา…</p></div>`);

  speak(w.word, () => {
    const box = app.querySelector("#opts");
    if (!box) return; // ผู้ใช้ปิดหน้าไปแล้ว
    const opts = pickOptions(w, "word");
    box.className = "mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2";
    box.innerHTML = opts.map((o, i) => button(`data-opt="${esc(o)}"`, esc(o), "ghost", String(i + 1))).join("");
    box.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => {
      const ok = b.dataset.opt === w.word;
      if (ok) session.tasks.unshift({ phase, id: w.id, kind: "cloze" });
      else fail(w.id);
      shell(`
        ${banner(ok, ok ? "ถูกต้อง! จำคำนี้ไว้ แล้วไปเติมคำในประโยค" : `ยังไม่ถูก คำที่ถูกคือ “${esc(w.word)}” จะกลับมาให้ทวนอีกครั้งตอนท้าย`)}
        ${cardHTML(w)}
        <div class="mt-auto grid">${button('data-act="next"', ok ? "ไปทำ Micro-Quiz" : "ต่อไป", "primary", "Enter Space")}</div>`);
      speak(w.word);
      on("next", next);
    }));
  });
}

function banner(ok, text) {
  return `<div class="rounded-2xl px-4 py-3 font-medium ${ok
    ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200"
    : "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"}">${ok ? "✓" : "✗"} ${text}</div>`;
}

// Level 3 · Production (Micro-Quiz): เติมคำในประโยค
function showCloze(w, phase) {
  const s = sentenceOf(w);
  shell(`
    <p class="text-sm text-zinc-500">Micro-Quiz · เติมคำให้ประโยคสมบูรณ์</p>
    <div class="${panel}">
      ${isLeech(w) ? `<div class="mb-3 text-center text-5xl">${w.emoji}</div>` : ""}
      <p class="text-xl leading-relaxed md:text-2xl">${esc(s.en).replace("___", BLANK)}</p>
      <p class="mt-2 text-zinc-500">${esc(s.th)}</p>
    </div>
    <form id="quiz" class="mt-auto grid gap-3">
      <input id="ans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        placeholder="พิมพ์คำที่หายไป" class="rounded-2xl bg-white px-4 py-3 text-lg ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:ring-zinc-700">
      ${button('type="submit"', "ตรวจคำตอบ")}
      ${button('type="button" data-act="choices"', "ไม่แน่ใจ ขอดูตัวเลือก", "ghost")}
    </form>`);

  const check = value => {
    const ok = norm(value) === norm(w.answer);
    if (ok) {
      if (phase === "new") { store.cards[w.id] = srs.rate(store.cards[w.id], "hard", daily().date); }
      complete(w.id, phase);
    } else {
      fail(w.id);
    }
    const full = filled(s.en, w);
    shell(`
      ${banner(ok, ok ? "ถูกต้อง! ผ่านคำนี้สำหรับวันนี้แล้ว" : `คำตอบคือ “${esc(w.answer)}” จะกลับมาทวนอีกครั้งในช่วงเก็บตก`)}
      <div class="${panel}">
        <button data-say="${esc(full)}" class="text-left text-xl leading-relaxed md:text-2xl">${hl(full, w.answer)} <span class="text-base">🔊</span></button>
        <p class="mt-2 text-zinc-500">${esc(s.th)}</p>
      </div>
      <div class="mt-auto grid">${button('data-act="next"', "ต่อไป", "primary", "Enter Space")}</div>`);
    speak(full);
    on("next", next);
  };

  const input = app.querySelector("#ans");
  if (matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
  app.querySelector("#quiz").onsubmit = e => {
    e.preventDefault();
    if (input.value.trim()) check(input.value);
  };
  on("choices", () => {
    const form = app.querySelector("#quiz");
    form.innerHTML = `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${pickOptions(w, "answer")
      .map((o, i) => button(`type="button" data-opt="${esc(o)}"`, esc(o), "ghost", String(i + 1))).join("")}</div>`;
    form.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => check(b.dataset.opt)));
  });
}

function finish() {
  const d = daily();
  d.warmDone = true;
  save();
  const s = session;
  session = null;
  app.innerHTML = `
    <main class="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div class="text-6xl">🎉</div>
      <h1 class="text-2xl font-semibold">จบการเรียนวันนี้แล้ว</h1>
      <div class="grid w-full grid-cols-3 gap-3">
        ${tile(s.completed, "คำที่ผ่าน")}${tile(s.learned, "คำใหม่")}${tile(s.cleared, "เก็บตกสำเร็จ")}
      </div>
      <p class="text-zinc-500">คำที่ผิดวันนี้ถูกทวนจนถูกครบ 100% แล้ว พรุ่งนี้จะมีรอบทบทวนรออยู่</p>
      ${button('data-act="home"', "กลับหน้าแรก")}
    </main>`;
  on("home", renderHome);
}

function tile(n, label) {
  return `<div class="${panel} !p-4 text-center"><div class="text-3xl font-semibold">${n}</div><div class="text-sm text-zinc-500">${label}</div></div>`;
}

// ---------- home ----------
function renderHome() {
  const d = daily();
  const plan = srs.buildSession(words.map(w => w.id), store.cards, d, store.settings.newPerDay, d.date);
  const total = plan.warm.length + plan.review.length + plan.fresh.length + plan.wrap.length;
  const cards = Object.values(store.cards);
  const learned = cards.length;
  const leeches = cards.filter(c => c.leech).length;
  const seg = (attr, val, cur, label) =>
    `<button ${attr}="${val}" class="flex-1 rounded-xl px-3 py-2 text-sm ${val === cur ? "bg-purple-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}">${label}</button>`;

  app.innerHTML = `
    <header class="pt-[max(24px,env(safe-area-inset-top))]">
      <h1 class="text-3xl font-semibold">Active Recall English</h1>
      <p class="mt-1 text-zinc-500">นึกก่อน ค่อยดูเฉลย · ทบทวนตามรอบความจำ</p>
    </header>
    <main class="flex flex-1 flex-col gap-4 py-6">
      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${tile(plan.warm.length, "อุ่นเครื่อง")}${tile(plan.review.length, "ถึงรอบทบทวน")}
        ${tile(plan.fresh.length, "คำใหม่วันนี้")}${tile(plan.wrap.length, "ค้างเก็บตก")}
      </section>
      ${button(`data-act="start" ${total ? "" : "disabled"}`, total ? "เริ่มเรียนวันนี้" : "วันนี้ครบแล้ว กลับมาใหม่พรุ่งนี้")}
      <section class="${panel} grid gap-4">
        <div class="flex justify-between"><span>เรียนไปแล้ว</span><span class="font-semibold">${learned} / ${words.length} คำ</span></div>
        <div class="flex justify-between"><span>คำที่ลืมบ่อย (Leech)</span><span class="font-semibold">${leeches}</span></div>
        <div>
          <div class="mb-2 text-sm text-zinc-500">คำใหม่ต่อวัน</div>
          <div class="flex gap-2">${[5, 6, 7].map(n => seg("data-new", n, store.settings.newPerDay, `${n} คำ`)).join("")}</div>
        </div>
        <div>
          <div class="mb-2 text-sm text-zinc-500">สำเนียงเสียงอ่าน</div>
          <div class="flex gap-2">${seg("data-accent", "en-US", store.settings.accent, "🇺🇸 US")}${seg("data-accent", "en-GB", store.settings.accent, "🇬🇧 UK")}</div>
        </div>
      </section>
      <details class="${panel}">
        <summary class="cursor-pointer font-medium">เรียนอย่างไร</summary>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-zinc-600 dark:text-zinc-400">
          <li><b>อุ่นเครื่อง</b> ทวนคำของเมื่อวานสั้นๆ</li>
          <li><b>ทบทวน</b> เห็นความหมาย + collocation ที่ซ่อนคำไว้ นึกและพูดในใจ แล้วกดเฉลย ให้คะแนน Again / Hard / Easy จากนั้นเติมคำในประโยค</li>
          <li><b>คำใหม่</b> ฟังเสียงก่อน แล้วเลือกคำที่ถูกจาก 4 ตัวเลือก จากนั้นเติมคำในประโยค</li>
          <li><b>เก็บตก</b> คำที่ผิดหรือกด Again วันนี้ จะวนกลับมาจนถูกครบทุกคำ</li>
        </ol>
        <button data-act="reset" class="mt-4 text-sm text-rose-600 underline">ล้างความคืบหน้าทั้งหมด</button>
      </details>
    </main>`;

  on("start", startSession);
  on("reset", () => {
    if (confirm("ล้างความคืบหน้าทั้งหมด? ย้อนกลับไม่ได้")) { store.cards = {}; store.daily = null; save(); renderHome(); }
  });
  app.querySelectorAll("[data-new]").forEach(b => (b.onclick = () => { store.settings.newPerDay = Number(b.dataset.new); save(); renderHome(); }));
  app.querySelectorAll("[data-accent]").forEach(b => (b.onclick = () => { store.settings.accent = b.dataset.accent; save(); renderHome(); speak("Hello"); }));
}

// คีย์ลัดบนคอมพิวเตอร์: Space/Enter = เฉลย/ต่อไป, 1-4 = ปุ่มคำตอบ
document.addEventListener("keydown", e => {
  if (!session || e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key === " " ? "Space" : e.key;
  const el = app.querySelector(`[data-key~="${CSS.escape(key)}"]`);
  if (el && !el.disabled) { e.preventDefault(); el.click(); }
});

// ---------- boot ----------
async function boot() {
  load();
  loadVoices();
  window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
  try {
    const res = await fetch("data/words.json");
    if (!res.ok) throw new Error(`โหลดคำศัพท์ไม่สำเร็จ (${res.status})`);
    words = (await res.json()).words.map(w => ({ ...w, answer: w.answer || w.word }));
    byId = Object.fromEntries(words.map(w => [w.id, w]));
    renderHome();
  } catch (err) {
    app.innerHTML = `<p class="py-10 text-center text-rose-600">${esc(err.message)}</p>`;
  }
}

boot();
