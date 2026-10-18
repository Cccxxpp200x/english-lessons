// หน้าจอและลำดับการเรียน: Warm-up → Core Review → New Intake → Sentences → Wrap-up (+ รอบฝึกซ้ำคำของวันนี้)
// หลักการ: ฟังก่อนเห็นตัวสะกด และเห็นคำแปลไทยหลังจากพยายามตอบแล้วเท่านั้น
import * as srs from "./srs.js?v=6";
import { openPictures } from "./picture.js?v=10";

const KEY = "english-lessons:v2";
const app = document.getElementById("app");

let words = [];
let byId = {};
let store = { cards: {}, daily: null, settings: { newPerDay: 5, sentencesPerDay: 5, accent: "en-US" } };
let session = null;

const PHASES = {
  warm: { th: "อุ่นเครื่อง", en: "Warm-up", dot: "bg-amber-400" },
  review: { th: "ทบทวน", en: "Core Review", dot: "bg-purple-500" },
  new: { th: "คำใหม่", en: "New Intake", dot: "bg-teal-500" },
  sentence: { th: "ประโยค", en: "Sentences", dot: "bg-sky-400" },
  wrap: { th: "เก็บตก", en: "Wrap-up", dot: "bg-rose-500" },
  practice: { th: "ฝึกซ้ำ", en: "Practice", dot: "bg-indigo-400" },
};

// ขั้นตอนของคำหนึ่งคำ แสดงเป็นแถบด้านบนการ์ด
const STEPS = {
  intro: ["ฟัง", "เลือก", "รู้จักคำ", "เติมคำ"],
  recall: ["นึก", "เฉลย", "เติมคำ"],
  warm: ["นึก", "เฉลย"],
  sentence: ["เรียงประโยค", "พูดตาม"],
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

// ทำให้ทุกคำในประโยคแตะได้ เพื่อเปิดป๊อปอัปฟังเสียงและดูความหมาย
const TAP = "cursor-pointer rounded underline decoration-zinc-300 decoration-dotted underline-offset-[6px] transition hover:bg-sky-100 active:bg-sky-200 dark:decoration-zinc-600 dark:hover:bg-sky-500/20";
function tapWords(text) {
  let out = "", last = 0;
  for (const m of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)) {
    out += esc(text.slice(last, m.index)) + `<span data-w="${esc(m[0])}" class="${TAP}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

// เน้นคำเป้าหมาย (ไม่ให้แตะดูความหมาย เพราะเป็นคำที่กำลังฝึก) ส่วนคำอื่นแตะได้
function hl(text, target) {
  const m = text.match(wordRe(target));
  if (!m) return tapWords(text);
  return tapWords(text.slice(0, m.index)) +
    `<mark class="rounded bg-purple-100 px-1 font-semibold text-purple-800 dark:bg-purple-500/20 dark:text-purple-200">${esc(m[0])}</mark>` +
    tapWords(text.slice(m.index + m[0].length));
}
const BLANK = `<span class="mx-1 inline-block min-w-24 border-b-[3px] border-dashed border-purple-400 align-baseline">&nbsp;</span>`;
const tapBlank = s => s.split("___").map(tapWords).join(BLANK);

// ---------- ป๊อปอัปคำศัพท์ ----------
let byWord = {};
const IRREGULAR = {
  done: "do", went: "go", gone: "go", "i'm": "I", "i'll": "I", "i'd": "I", "i've": "I", better: "good", best: "good", worse: "bad", worst: "bad",
  children: "child", men: "man", women: "woman", feet: "foot", teeth: "tooth", mice: "mouse",
  saw: "see", seen: "see", made: "make", took: "take", taken: "take", got: "get", came: "come",
  said: "say", knew: "know", known: "know", thought: "think", told: "tell", gave: "give", given: "give",
  found: "find", left: "leave", felt: "feel", brought: "bring", bought: "buy", began: "begin", begun: "begin",
  kept: "keep", held: "hold", wrote: "write", written: "write", stood: "stand", heard: "hear", meant: "mean",
  met: "meet", ran: "run", paid: "pay", sat: "sit", spoke: "speak", spoken: "speak", led: "lead",
  grew: "grow", grown: "grow", lost: "lose", fell: "fall", fallen: "fall", sent: "send", built: "build",
  understood: "understand", drew: "draw", drawn: "draw", broke: "break", broken: "break", spent: "spend",
  rose: "rise", drove: "drive", driven: "drive", ate: "eat", eaten: "eat", slept: "sleep", taught: "teach",
  caught: "catch", fought: "fight", sold: "sell", won: "win", wore: "wear", worn: "wear", chose: "choose",
  chosen: "choose", forgot: "forget", forgotten: "forget", flew: "fly", flown: "fly", swam: "swim",
  sang: "sing", sung: "sing", threw: "throw", thrown: "throw", hid: "hide", woke: "wake", stole: "steal",
  hung: "hang", fed: "feed", shot: "shoot", lit: "light", dug: "dig", bit: "bite", shook: "shake",
};

// หาคำในคลังจากรูปที่ผันแล้ว เช่น asked → ask, cities → city, went → go
function lookup(raw) {
  const w = raw.toLowerCase().replace(/’/g, "'");
  const tries = [];
  const add = s => { if (s && s.length > 1 || s === "i" || s === "a") tries.push(s, IRREGULAR[s]); };
  add(w);
  if (w.endsWith("n't")) add(w.slice(0, -3));
  if (w.includes("'")) add(w.split("'")[0]);
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("ing")) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); }
  const stem = w.replace(/(ed|ing|er|est)$/, "");
  if (stem !== w && /(.)\1$/.test(stem)) add(stem.slice(0, -1)); // stopped → stop, bigger → big
  if (w.endsWith("ier") || w.endsWith("iest")) add(w.replace(/i(er|est)$/, "y"));
  if (w.endsWith("er")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("est")) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  if (w.endsWith("ly")) add(w.slice(0, -2));
  for (const t of tries) if (t && byWord[t.toLowerCase()]) return byWord[t.toLowerCase()];
  return null;
}

function closeWordPopup() { document.getElementById("word-pop")?.remove(); }

function showWordPopup(raw) {
  closeWordPopup();
  const e = lookup(raw);
  const derived = e && e.word.toLowerCase() !== raw.toLowerCase().replace(/’/g, "'");
  const el = document.createElement("div");
  el.id = "word-pop";
  el.className = "fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-3 backdrop-blur-[2px] md:items-center";
  el.innerHTML = `
    <div role="dialog" aria-label="${esc(raw)}" class="animate-pop w-full max-w-md rounded-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div class="flex items-start gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span class="text-3xl font-bold tracking-tight">${esc(raw)}</span>
            ${e ? `<span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">${esc(e.pos)}</span>` : ""}
          </div>
          ${e && !derived ? `<div class="mt-1 text-zinc-500">${esc(e.ipa)}</div>` : ""}
          ${derived
            ? `<div class="mt-1 text-sm text-zinc-500">รูปเดิมของคำ: <button data-pop-say="${esc(e.word)}" class="font-semibold text-sky-700 underline decoration-dotted underline-offset-4 dark:text-sky-300">${esc(e.word)}</button> ${esc(e.ipa)}</div>` : ""}
        </div>
        <button data-pop-say="${esc(raw)}" aria-label="ฟังเสียง" class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-purple-50 text-purple-600 ring-1 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20">${icon("speaker", "h-6 w-6")}</button>
      </div>
      <div class="mt-4 text-xl font-semibold text-purple-700 dark:text-purple-300">${e ? esc(e.meaning) : "คำนี้ยังไม่มีในคลัง 3,000 คำ"}</div>
      ${e?.collocation ? `<div class="mt-3 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Collocation</div>
        <div class="mt-0.5 text-lg">${esc(e.collocation)}</div>
        <div class="text-sm text-zinc-500">${esc(e.collocationTh)}</div></div>` : ""}
      <button data-pop-close class="mt-4 w-full rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">ปิด</button>
    </div>`;
  document.body.append(el);
  el.onclick = ev => {
    const say = ev.target.closest("[data-pop-say]");
    if (say) return speak(say.dataset.popSay);
    if (ev.target === el || ev.target.closest("[data-pop-close]")) closeWordPopup();
  };
  speak(raw);
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-w]");
  if (t && app.contains(t)) showWordPopup(t.dataset.w);
});

// ---------- speech ----------
let voices = [];
function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// iPhone: เล่นไฟล์เสียงเงียบหนึ่งครั้งตอนแตะจอครั้งแรก เพื่อปลดล็อกเสียงของเว็บ
// (ช่วยให้เสียงออกแม้เปิดโหมดเงียบไว้ในบางรุ่น)
const SILENT_WAV = "data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const a = new Audio(SILENT_WAV);
    a.setAttribute("playsinline", "");
    a.play().catch(() => {});
  } catch { /* ข้าม */ }
  window.speechSynthesis?.resume?.();
}
document.addEventListener("pointerdown", unlockAudio, { capture: true });
document.addEventListener("keydown", unlockAudio, { capture: true });

let currentUtterance = null; // เก็บอ้างอิงไว้ ไม่ให้ Safari เก็บกวาดทิ้งกลางคัน
let speechWorked = false;

function speak(text, onDone, rate = 0.9) {
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    app.querySelectorAll("[data-ping]").forEach(el => el.remove());
    onDone && onDone();
  };
  const synth = window.speechSynthesis;
  if (!synth) return done();
  if (synth.speaking || synth.pending) synth.cancel(); // เรียก cancel ตอนว่างอยู่ทำให้เสียงหายในบางเบราว์เซอร์
  synth.resume?.();
  if (!voices.length) loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = store.settings.accent;
  u.rate = rate;
  u.volume = 1;
  const v = voices.find(v => v.lang.replace("_", "-") === u.lang) || voices.find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  u.onstart = () => { speechWorked = true; };
  u.onend = done;
  u.onerror = done;
  setTimeout(done, 2500 + (text.length * 80) / rate); // กันกรณีเบราว์เซอร์ไม่ส่ง onend
  currentUtterance = u;
  synth.speak(u);
}

// ---------- icons ----------
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">${d}</svg>`;
const ICON = {
  speaker: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  bulb: svg('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>'),
  slow: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  flip: svg('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
};
const icon = (name, cls = "h-5 w-5") => `<span class="inline-block ${cls}">${ICON[name]}</span>`;

// ---------- UI pieces ----------
const BTN = {
  primary: "bg-purple-600 text-white shadow-sm shadow-purple-600/25 hover:bg-purple-700",
  again: "bg-rose-500 text-white hover:bg-rose-600",
  hard: "bg-amber-400 text-zinc-900 hover:bg-amber-300",
  easy: "bg-teal-500 text-white hover:bg-teal-600",
  ghost: "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-purple-300 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800",
};

function button(attrs, label, variant = "primary", key = "") {
  const hint = key ? `<kbd class="ml-2 hidden rounded border border-current px-1.5 text-[11px] font-normal opacity-60 md:inline">${key.split(" ")[0]}</kbd>` : "";
  return `<button ${attrs} ${key ? `data-key="${key}"` : ""} class="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 py-3.5 text-base font-semibold transition active:scale-[.98] disabled:opacity-40 ${BTN[variant]}">${label}${hint}</button>`;
}

const CARD = "rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 md:p-8 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800";
const card = (inner, extra = "") => `<section class="animate-pop ${CARD} ${extra}">${inner}</section>`;

function sayBtn(text, size = "sm") {
  if (size === "lg") {
    return `<button data-say="${esc(text)}" aria-label="ฟังอีกครั้ง" class="relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-600/30 transition hover:scale-105 active:scale-95">
      <span data-ping class="absolute inset-0 animate-ping rounded-full bg-purple-400/40"></span>${icon("speaker", "relative h-11 w-11")}</button>`;
  }
  const dim = size === "md" ? "h-12 w-12" : "h-9 w-9";
  const ico = size === "md" ? "h-6 w-6" : "h-4 w-4";
  return `<button data-say="${esc(text)}" aria-label="ฟังเสียง" class="grid ${dim} shrink-0 place-items-center rounded-full bg-purple-50 text-purple-600 ring-1 ring-purple-100 transition hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20">${icon("speaker", ico)}</button>`;
}

const slowBtn = text =>
  `<button data-say-slow="${esc(text)}" class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">${icon("slow", "h-4 w-4")} ฟังช้าๆ</button>`;

function steps(list, active) {
  return `<ol id="steps" class="flex items-center justify-center gap-1.5 text-xs">${list.map((s, i) => `
    <li class="flex items-center gap-1.5">
      ${i ? `<span class="h-px w-3 bg-zinc-300 sm:w-5 dark:bg-zinc-700"></span>` : ""}
      <span class="flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${i < active
        ? "text-teal-600 dark:text-teal-400"
        : i === active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-400"}">
        ${i < active ? icon("check", "h-3.5 w-3.5") : `<span class="tabular-nums">${i + 1}</span>`}${s}</span>
    </li>`).join("")}</ol>`;
}

function chip(ok, text) {
  return `<div class="animate-pop mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${ok
    ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30"
    : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"}">
    ${icon(ok ? "check" : "x", "h-4 w-4")} ${text}</div>`;
}

const leechBadge = w => isLeech(w)
  ? `<div class="mb-4 text-center"><div class="text-6xl">${w.emoji}</div>
      <span class="mt-2 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">คำที่ลืมบ่อย · มีภาพช่วยจำ</span></div>`
  : "";

const sentencesLeft = () => session?.practice
  ? session.sentTarget
  : Math.max(0, (store.settings.sentencesPerDay ?? 5) - (daily().sentences || 0));

// คำที่เรียนไปแล้ววันนี้ (ใช้ในรอบฝึกซ้ำ)
const todayIds = () => { const d = daily(); return [...new Set([...d.newIds, ...d.done])].filter(id => byId[id]); };

// จำนวนงานที่เหลือ: คำ (นับไม่ซ้ำ) + ประโยค
function remaining() {
  const isSentence = t => t && (t.kind === "sentence" || t.kind === "sentence-start");
  const ids = new Set([...session.tasks.filter(t => !isSentence(t)).map(t => t.id), ...(session.practice ? [] : daily().wrap)]);
  const cur = session.current;
  if (cur && !session.currentDone && !isSentence(cur)) ids.add(cur.id);
  let n = ids.size + session.tasks.filter(t => t.kind === "sentence").length;
  if (cur?.kind === "sentence" && !session.currentDone) n++;
  if (session.tasks.some(t => t.kind === "sentence-start")) n += sentencesLeft();
  return n;
}

// โครงหน้าระหว่างเรียน: แถบหัว + เนื้อหา + แถบปุ่มด้านล่าง (บนมือถือปุ่มอยู่ใกล้นิ้วโป้ง บนจอใหญ่อยู่ใต้การ์ด)
function shell({ stepsHtml = "", body = "", actions = "" }) {
  const ph = PHASES[session.current.phase];
  const left = remaining();
  const pct = Math.round((100 * session.completed) / Math.max(1, session.completed + left));
  app.innerHTML = `
    <header class="sticky top-0 z-20 -mx-4 bg-zinc-50/85 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md dark:bg-zinc-950/85">
      <div class="flex items-center gap-3">
        <button data-act="close" aria-label="ปิด" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
        <div class="flex-1">
          <div class="flex items-center justify-between text-sm">
            <span class="inline-flex items-center gap-2 font-semibold"><span class="h-2.5 w-2.5 rounded-full ${ph.dot}"></span>${ph.th}<span class="font-normal text-zinc-400">${ph.en}</span></span>
            <span class="tabular-nums text-zinc-500">เหลือ ${left}</span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-teal-400 transition-all duration-500" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    </header>
    <main class="flex flex-1 flex-col pt-3 md:justify-center md:pb-10">
      <div class="grid gap-4">${stepsHtml}${body}</div>
      ${actions ? `<div class="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-zinc-50 from-70% to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 md:static md:mx-0 md:mt-5 md:bg-none md:p-0 dark:from-zinc-950">${actions}</div>` : ""}
    </main>`;
  on("close", () => { window.speechSynthesis?.cancel(); session = null; renderHome(); });
  app.querySelectorAll("[data-say]").forEach(b => (b.onclick = () => speak(b.dataset.say)));
  app.querySelectorAll("[data-say-slow]").forEach(b => (b.onclick = () => speak(b.dataset.saySlow, null, 0.55)));
}

// การ์ดเฉลยเต็ม: ตัวสะกด คำอ่าน ความหมายไทย collocation และประโยคตัวอย่าง
// ใช้ประโยคง่าย เพื่อไม่ให้ซ้ำกับประโยคใน Micro-Quiz ที่จะตามมา
function example(label, en, target, th, accent) {
  return `<div class="flex items-start gap-3 rounded-2xl border-l-4 ${accent} bg-zinc-50 p-4 dark:bg-zinc-800/50">
    <div class="min-w-0 flex-1">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">${label}</div>
      <div class="mt-1 text-lg leading-snug">${hl(en, target)}</div>
      <div class="mt-0.5 text-sm text-zinc-500">${esc(th)}</div>
    </div>
    ${sayBtn(en)}
  </div>`;
}

function wordCard(w) {
  return card(`
    ${leechBadge(w)}
    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 class="text-4xl font-bold tracking-tight md:text-5xl">${esc(w.word)}</h2>
          <span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">${esc(w.pos)}</span>
        </div>
        <div class="mt-1.5 text-lg text-zinc-500">${esc(w.ipa)}</div>
      </div>
      ${sayBtn(w.word, "md")}
    </div>
    <div class="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">ความหมาย</div>
      <div class="mt-1 text-2xl font-semibold text-purple-700 dark:text-purple-300">${esc(w.meaning)}</div>
    </div>
    <div class="mt-5 grid gap-3">
      ${example("Collocation", w.collocation, w.word, w.collocationTh, "border-purple-400")}
      ${example("ตัวอย่าง", filled(w.simple, w), w.answer, w.simpleTh, "border-teal-400")}
    </div>`);
}

// แฟลชการ์ดคำใหม่: ด้านหน้าเป็นภาษาอังกฤษล้วน (คำ คำอ่าน วลี ประโยค) พลิกด้านหลังจึงเห็นความหมายไทย
function flashCard(w) {
  const face = "grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden";
  const enLine = (label, en, target, accent) => `
    <div class="flex items-start gap-3 rounded-2xl border-l-4 ${accent} bg-zinc-50 p-4 dark:bg-zinc-800/50">
      <div class="min-w-0 flex-1">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">${label}</div>
        <div class="mt-1 text-lg leading-snug">${hl(en, target)}</div>
      </div>
      ${sayBtn(en)}
    </div>`;
  const flipHint = text => `<div class="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-400">${icon("flip", "h-4 w-4")} ${text}</div>`;
  const ex = filled(w.simple, w);
  return `<div class="animate-pop" style="perspective:1400px">
    <div id="flip" class="grid cursor-pointer select-none transition-transform duration-500" style="transform-style:preserve-3d;-webkit-transform-style:preserve-3d">
      <section class="${CARD}" style="${face}">
        ${leechBadge(w)}
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 class="text-4xl font-bold tracking-tight md:text-5xl">${esc(w.word)}</h2>
              <span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">${esc(w.pos)}</span>
            </div>
            <div class="mt-1.5 text-lg text-zinc-500">${esc(w.ipa)}</div>
          </div>
          ${sayBtn(w.word, "md")}
        </div>
        <div class="mt-5 grid gap-3">
          ${enLine("Collocation", w.collocation, w.word, "border-purple-400")}
          ${enLine("ตัวอย่าง", ex, w.answer, "border-teal-400")}
        </div>
        <p class="mt-4 text-center text-sm text-zinc-500">ลองเดาความหมายจากประโยคก่อน · แตะคำอื่นเพื่อดูความหมาย</p>
        ${flipHint("แตะการ์ดเพื่อพลิกดูความหมาย")}
      </section>
      <section class="${CARD}" style="${face};transform:rotateY(180deg);pointer-events:none">
        <div class="flex items-center justify-between gap-3">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">ความหมายของ <span class="normal-case text-zinc-600 dark:text-zinc-300">${esc(w.word)}</span></div>
          ${sayBtn(w.word)}
        </div>
        <div class="mt-2 text-3xl font-bold text-purple-700 md:text-4xl dark:text-purple-300">${esc(w.meaning)}</div>
        <div class="mt-5 grid gap-3">
          ${example("Collocation", w.collocation, w.word, w.collocationTh, "border-purple-400")}
          ${example("ตัวอย่าง", ex, w.answer, w.simpleTh, "border-teal-400")}
        </div>
        ${flipHint("แตะเพื่อพลิกกลับ")}
      </section>
    </div>
  </div>`;
}

// โจทย์แบบฟัง: เล่นเสียงอย่างเดียว ไม่มีตัวสะกดและคำแปล
function promptListen(w, text) {
  return card(`
    ${leechBadge(w)}
    <div class="py-4 text-center">
      ${sayBtn(w.word, "lg")}
      <p class="mt-6 text-xl font-semibold">${text}</p>
      <div class="mt-3 flex justify-center">${slowBtn(w.word)}</div>
    </div>`);
}

// โจทย์แบบไทย: ความหมายไทย + collocation ที่ซ่อนคำไว้ (ยังไม่เห็นตัวสะกด)
function promptThai(w) {
  return card(`
    ${leechBadge(w)}
    <div class="py-2 text-center">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">นึกคำภาษาอังกฤษ แล้วพูดออกเสียง</div>
      <div class="mt-3 text-3xl font-bold text-purple-700 md:text-4xl dark:text-purple-300">${esc(w.meaning)}</div>
      <div class="mx-auto mt-6 w-fit rounded-2xl bg-zinc-50 px-5 py-3 dark:bg-zinc-800/60">
        <div class="text-xl md:text-2xl">${esc(w.collocation).replace(wordRe(esc(w.word)), BLANK)}</div>
        <div class="mt-1 text-sm text-zinc-500">${esc(w.collocationTh)}</div>
      </div>
    </div>`);
}

const listening = `<div class="flex items-center justify-center gap-3 py-3 text-zinc-500">
  <span class="grid h-11 w-11 animate-pulse place-items-center rounded-full bg-purple-600 text-white">${icon("speaker", "h-5 w-5")}</span> ฟังเสียงก่อน…</div>`;

// สลับรูปแบบโจทย์ทบทวน: ฟังแล้วนึกความหมาย ↔ เห็นไทยแล้วนึกคำอังกฤษ
function nextMode() {
  session.flip = !session.flip;
  return session.flip ? "listen" : "thai";
}

// ---------- state changes ----------
function fail(id) {
  if (session.practice) { // รอบฝึกซ้ำ: ไม่แตะรอบทบทวน แค่วนคำนี้กลับมาท้ายคิว
    session.tasks.push({ phase: "practice", id, kind: "recall" });
    session.fails++;
    session.currentDone = true;
    return;
  }
  const d = daily();
  store.cards[id] = srs.rate(store.cards[id], "again", d.date);
  d.wrap = d.wrap.filter(x => x !== id).concat(id);
  session.fails++;
  session.currentDone = true;
  save();
}

function complete(id, phase) {
  if (session.practice) { session.completed++; session.currentDone = true; return; }
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
  unlockAudio(); // การกดปุ่มเริ่มเรียนนับเป็นการแตะของผู้ใช้ ใช้ปลดล็อกเสียง
  const d = daily();
  const plan = srs.buildSession(words.map(w => w.id), store.cards, d, store.settings.newPerDay, d.date);
  const tasks = [
    ...plan.warm.map(id => ({ phase: "warm", id, kind: "warm" })),
    ...plan.review.map(id => ({ phase: "review", id, kind: "recall" })),
    ...plan.fresh.map(id => ({ phase: "new", id, kind: "intro" })),
  ];
  // ช่วงประโยคสร้างตอนถึงคิว เพื่อให้ใช้คำใหม่ที่เพิ่งเรียนวันนี้ได้ด้วย
  if (sentencesLeft() > 0) tasks.push({ phase: "sentence", id: "sentence-start", kind: "sentence-start" });
  session = { tasks, current: null, currentDone: false, completed: 0, learned: 0, fails: 0, cleared: 0, sentences: 0, flip: false, sflip: false };
  next();
}

// ฝึกซ้ำคำของวันนี้อีกรอบ: ไม่เปลี่ยนรอบทบทวนและไม่นับเป็นสถิติประจำวัน
function startPractice() {
  unlockAudio();
  const tasks = shuffle(todayIds()).map(id => ({ phase: "practice", id, kind: "recall" }));
  tasks.push({ phase: "sentence", id: "sentence-start", kind: "sentence-start" });
  session = { tasks, current: null, currentDone: false, completed: 0, learned: 0, fails: 0, cleared: 0, sentences: 0, flip: false, sflip: false,
    practice: true, sentTarget: store.settings.sentencesPerDay ?? 5 };
  next();
}

function next() {
  const d = daily();
  const t = session.tasks.shift() || (!session.practice && d.wrap.length ? { phase: "wrap", id: d.wrap[0], kind: "recall" } : null);
  if (!t) return finish();
  if (t.kind === "sentence-start") {
    session.tasks.unshift(...buildSentenceTasks(sentencesLeft()));
    if (session.practice) session.sentTarget = 0;
    return next();
  }
  if (!session.practice && t.phase !== "warm" && !d.warmDone) { d.warmDone = true; save(); }
  if (!session.current || session.current.id !== t.id) session.currentDone = false;
  session.current = t;
  if (t.kind === "sentence") return showSentence(t);
  const view = { warm: showWarm, recall: showRecall, intro: showIntro, cloze: showCloze }[t.kind];
  view(byId[t.id], t.phase);
}

// เปิดเฉลย: ถ้าโจทย์เป็นแบบไทย ให้เล่นเสียงก่อนแล้วค่อยเห็นตัวสะกด
function reveal(w, mode, stepsHtml, prompt, show) {
  if (mode === "listen") { show(); speak(w.word); return; }
  shell({ stepsHtml, body: prompt, actions: listening });
  speak(w.word, show);
}

// Warm-up: ทวนเร็วๆ ว่ายังจำคำของเมื่อวานได้ไหม
function showWarm(w, phase) {
  const mode = nextMode();
  const prompt = mode === "listen" ? promptListen(w, "ฟังแล้วนึกความหมายเป็นภาษาไทย") : promptThai(w);
  shell({ stepsHtml: steps(STEPS.warm, 0), body: prompt, actions: button('data-act="reveal"', "เฉลย", "primary", "Space Enter") });
  if (mode === "listen") speak(w.word);
  on("reveal", () => reveal(w, mode, steps(STEPS.warm, 0), prompt, () => {
    shell({
      stepsHtml: steps(STEPS.warm, 1),
      body: wordCard(w),
      actions: `<div class="grid grid-cols-2 gap-3">
        ${button('data-act="forgot"', "จำไม่ได้", "again", "1")}
        ${button('data-act="knew"', "จำได้", "easy", "2")}
      </div>`,
    });
    on("forgot", () => { fail(w.id); next(); });
    on("knew", () => { complete(w.id, phase); next(); });
  }));
}

// Level 2 · Recall: นึกคำ → เฉลย → ให้คะแนนตัวเอง → Micro-Quiz
function showRecall(w, phase) {
  const mode = nextMode();
  const prompt = mode === "listen" ? promptListen(w, "ฟังแล้วนึกความหมายเป็นภาษาไทย") : promptThai(w);
  shell({ stepsHtml: steps(STEPS.recall, 0), body: prompt, actions: button('data-act="reveal"', "เฉลย", "primary", "Space Enter") });
  if (mode === "listen") speak(w.word);
  on("reveal", () => reveal(w, mode, steps(STEPS.recall, 0), prompt, () => {
    if (phase === "practice") {
      shell({
        stepsHtml: steps(STEPS.recall, 1),
        body: wordCard(w),
        actions: `<div class="grid grid-cols-2 gap-3">
          ${button('data-act="forgot"', "จำไม่ได้", "again", "1")}
          ${button('data-act="knew"', "จำได้", "easy", "2")}
        </div>`,
      });
      on("forgot", () => { fail(w.id); next(); });
      on("knew", () => { session.tasks.unshift({ phase, id: w.id, kind: "cloze" }); next(); });
      return;
    }
    const c = store.cards[w.id];
    const days = phase === "wrap" ? null : { hard: 1, easy: srs.nextEasyInterval(c?.interval ?? 0) };
    const sub = t => `<span class="block text-xs font-medium opacity-80">${t}</span>`;
    shell({
      stepsHtml: steps(STEPS.recall, 1),
      body: wordCard(w),
      actions: `<p class="mb-2 text-center text-sm text-zinc-500">นึกออกง่ายแค่ไหน?</p>
        <div class="grid grid-cols-3 gap-2.5">
          ${button('data-act="again"', `<span>Again${sub("ทวนอีกรอบ")}</span>`, "again", "1")}
          ${button('data-act="hard"', `<span>Hard${sub(days ? `อีก ${days.hard} วัน` : "ยาก")}</span>`, "hard", "2")}
          ${button('data-act="easy"', `<span>Easy${sub(days ? `อีก ${days.easy} วัน` : "ง่าย")}</span>`, "easy", "3")}
        </div>`,
    });
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

// Level 1 · Recognition (คำใหม่): ฟังเสียง → เลือกคำที่ได้ยิน → ค่อยเห็นความหมาย
function showIntro(w, phase) {
  const d = daily();
  if (!d.newIds.includes(w.id)) { d.newIds.push(w.id); save(); }
  shell({
    stepsHtml: steps(STEPS.intro, 0),
    body: promptListen(w, "ฟังให้ดี แล้วเลือกคำที่ได้ยิน"),
    actions: `<div id="opts" class="grid gap-3 sm:grid-cols-2"><p class="col-span-full py-4 text-center text-sm text-zinc-500">ฟังให้จบก่อน แล้วตัวเลือกจะขึ้นมา…</p></div>`,
  });

  speak(w.word, () => {
    const box = app.querySelector("#opts");
    if (!box) return; // ผู้ใช้ปิดหน้าไปแล้ว
    app.querySelector("#steps").outerHTML = steps(STEPS.intro, 1);
    const opts = pickOptions(w, "word");
    box.innerHTML = opts.map((o, i) => `
      <button data-opt="${esc(o)}" data-key="${i + 1}" class="animate-pop flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-lg font-semibold ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-purple-300 dark:bg-zinc-900 dark:ring-zinc-800">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800">${i + 1}</span>
        <span class="flex-1">${esc(o)}</span>
      </button>`).join("");
    box.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => {
      const ok = b.dataset.opt === w.word;
      box.querySelectorAll("[data-opt]").forEach(x => {
        x.disabled = true;
        if (x.dataset.opt === w.word) x.className += " !ring-2 !ring-teal-500 bg-teal-50 dark:bg-teal-500/10";
        else if (x === b) x.className += " !ring-2 !ring-rose-500 bg-rose-50 dark:bg-rose-500/10";
        else x.className += " opacity-50";
      });
      if (ok) session.tasks.unshift({ phase, id: w.id, kind: "cloze" });
      else fail(w.id);
      setTimeout(() => {
        const nextBtn = button('data-act="next"', ok ? `ไปเติมคำในประโยค ${icon("arrow", "ml-2 h-5 w-5")}` : "ต่อไป", "primary", "Enter Space");
        shell({
          stepsHtml: steps(STEPS.intro, 2),
          body: chip(ok, ok ? "ถูกต้อง! มารู้จักคำนี้กัน" : `ยังไม่ถูก คำที่ได้ยินคือ “${esc(w.word)}” จะกลับมาทวนตอนท้าย`) + flashCard(w),
          actions: `<div id="flip-actions">${button('data-act="flip"', `${icon("flip", "mr-2 h-5 w-5")} พลิกดูความหมาย`, "primary", "Enter Space")}</div>`,
        });
        speak(w.word);
        // ต้องพลิกดูความหมายก่อน จึงจะไปขั้นต่อไปได้ (พลิกกลับไปมาได้)
        const flipEl = app.querySelector("#flip");
        let back = false, seen = false;
        const flip = () => {
          back = !back;
          flipEl.style.transform = back ? "rotateY(180deg)" : "";
          flipEl.children[0].style.pointerEvents = back ? "none" : "";
          flipEl.children[1].style.pointerEvents = back ? "" : "none";
          if (back && !seen) {
            seen = true;
            app.querySelector("#flip-actions").innerHTML = nextBtn;
            on("next", next);
          }
        };
        flipEl.onclick = e => { if (!e.target.closest("[data-say],[data-w]")) flip(); };
        on("flip", flip);
      }, 650);
    }));
  });
}

// Level 3 · Production (Micro-Quiz): เติมคำในประโยค คำแปลไทยซ่อนไว้เป็นคำใบ้
function showCloze(w, phase) {
  const s = sentenceOf(w);
  const list = phase === "new" ? STEPS.intro : STEPS.recall;
  shell({
    stepsHtml: steps(list, list.length - 1),
    body: card(`
      ${leechBadge(w)}
      <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Micro-Quiz · เติมคำให้ประโยคสมบูรณ์</div>
      <p class="mt-3 text-2xl leading-relaxed md:text-3xl md:leading-relaxed">${tapBlank(s.en)}</p>
      <button data-act="hint" class="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">${icon("bulb", "h-4 w-4")} ดูคำแปล (คำใบ้)</button>
      <p id="hint" class="mt-3 hidden text-zinc-500">${esc(s.th)}</p>`),
    actions: `<form id="quiz" class="grid gap-3">
      <input id="ans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        placeholder="พิมพ์คำที่หายไป" class="w-full rounded-2xl bg-white px-5 py-3.5 text-lg ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:ring-zinc-700">
      <div class="grid grid-cols-[1fr_auto] gap-3">
        ${button('type="submit"', "ตรวจคำตอบ")}
        <button type="button" data-act="choices" class="rounded-2xl px-4 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 hover:text-purple-600 hover:ring-purple-300 dark:ring-zinc-800">ขอตัวเลือก</button>
      </div>
    </form>`,
  });

  on("hint", e => {
    app.querySelector("#hint").classList.remove("hidden");
    e.currentTarget.remove();
  });

  const check = value => {
    const ok = norm(value) === norm(w.answer);
    if (ok) {
      if (phase === "new") { store.cards[w.id] = srs.rate(store.cards[w.id], "hard", daily().date); }
      complete(w.id, phase);
    } else {
      fail(w.id);
    }
    const full = filled(s.en, w);
    shell({
      stepsHtml: steps(list, list.length),
      body: chip(ok, ok ? "ถูกต้อง! ผ่านคำนี้สำหรับวันนี้แล้ว" : `คำตอบคือ “${esc(w.answer)}” ${phase === "practice" ? "จะวนกลับมาอีกครั้งท้ายรอบ" : "จะกลับมาทวนในช่วงเก็บตก"}`) +
        card(`
          <div class="flex items-start gap-4">
            <p class="flex-1 text-2xl leading-relaxed md:text-3xl md:leading-relaxed">${hl(full, w.answer)}</p>
            ${sayBtn(full, "md")}
          </div>
          <p class="mt-3 border-t border-zinc-100 pt-3 text-zinc-500 dark:border-zinc-800">${esc(s.th)}</p>`),
      actions: button('data-act="next"', `ต่อไป ${icon("arrow", "ml-2 h-5 w-5")}`, "primary", "Enter Space"),
    });
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
    form.innerHTML = `<div class="grid gap-3 sm:grid-cols-2">${pickOptions(w, "answer")
      .map((o, i) => button(`type="button" data-opt="${esc(o)}"`, esc(o), "ghost", String(i + 1))).join("")}</div>`;
    form.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => check(b.dataset.opt)));
  });
}

// ---------- ฝึกโครงสร้างประโยค ----------
// เลือกประโยคจากคำที่เรียนแล้ว เน้นคำที่ผ่านวันนี้ก่อน แล้วสุ่มจากคำที่เคยเรียน
function buildSentenceTasks(n) {
  const d = daily();
  const known = Object.keys(store.cards).filter(id => byId[id]);
  const ids = [...new Set([...shuffle(d.done.filter(id => byId[id])), ...shuffle(known)])];
  const out = [];
  for (const id of ids) {
    if (out.length >= n) break;
    const w = byId[id];
    for (const [en, th] of [[filled(w.cloze, w), w.clozeTh], [filled(w.simple, w), w.simpleTh]]) {
      if (srs.usableSentence(en)) { out.push({ phase: "sentence", kind: "sentence", id: `s:${id}`, wid: id, en, th }); break; }
    }
  }
  return out;
}

// สลับบัตรคำ โดยไม่ให้ออกมาเรียงถูกอยู่แล้ว
function shuffleTiles(tiles) {
  let order = tiles.map((_, i) => i);
  for (let k = 0; k < 10; k++) {
    order = shuffle(order);
    if (order.some((v, i) => tiles[v] !== tiles[i])) break;
  }
  return order;
}

const tileCls = "rounded-xl px-3.5 py-2 text-lg font-medium shadow-sm ring-1 transition active:scale-95";

// แบบ A: เห็นคำแปลไทย → เรียงคำเป็นประโยคอังกฤษ / แบบ B: ฟังเสียง → เรียงคำตามที่ได้ยิน
function showSentence(t) {
  session.sflip = !session.sflip;
  const mode = session.sflip ? "build" : "listen";
  const w = byId[t.wid];
  const { toks, tiles, end } = srs.tokenizeSentence(t.en);
  const order = shuffleTiles(tiles); // ลำดับบัตรคำในกองด้านล่าง (เก็บเป็นตำแหน่งใน tiles)
  let picked = []; // ตำแหน่งใน order ที่ผู้เรียนแตะแล้ว ตามลำดับ

  const prompt = mode === "build"
    ? `<div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">เรียงคำให้เป็นประโยคภาษาอังกฤษ</div>
       <p class="mt-3 text-2xl font-semibold leading-snug text-sky-700 md:text-3xl dark:text-sky-300">${esc(t.th)}</p>`
    : `<div class="text-center">
         ${sayBtn(t.en, "lg")}
         <p class="mt-5 text-lg font-semibold">ฟังแล้วเรียงคำตามที่ได้ยิน</p>
         <div class="mt-3 flex flex-wrap justify-center gap-2">${slowBtn(t.en)}
           <button data-act="hint" class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">${icon("bulb", "h-4 w-4")} ดูคำแปล</button>
         </div>
         <p id="hint" class="mt-3 hidden text-zinc-500">${esc(t.th)}</p>
       </div>`;

  shell({
    stepsHtml: steps(STEPS.sentence, 0),
    body: card(`${prompt}
      <div id="answer" class="mt-6 flex min-h-[64px] flex-wrap content-start items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-3 transition dark:border-zinc-700"></div>
      <p id="sent-msg" class="mt-3 hidden"></p>`),
    actions: `<div id="pool" class="mb-4 flex flex-wrap justify-center gap-2"></div>
      <div class="grid grid-cols-[auto_1fr] gap-3">
        <button type="button" data-act="clear" class="rounded-2xl px-5 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 hover:text-sky-600 hover:ring-sky-300 dark:ring-zinc-800">ล้าง</button>
        ${button('data-act="check-sentence" disabled', "ตรวจประโยค", "primary", "Enter")}
      </div>`,
  });
  if (mode === "listen") speak(t.en);
  on("hint", e => { app.querySelector("#hint").classList.remove("hidden"); e.currentTarget.remove(); });

  const answer = app.querySelector("#answer");
  const pool = app.querySelector("#pool");
  const checkBtn = app.querySelector('[data-act="check-sentence"]');

  function update() {
    answer.innerHTML = picked.length
      ? picked.map((p, i) => `<button data-picked="${i}" class="${tileCls} bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30">${esc(tiles[order[p]])}</button>`).join("") +
        (picked.length === tiles.length && end ? `<span class="text-lg font-medium">${esc(end)}</span>` : "")
      : `<span class="px-1 text-sm text-zinc-400">แตะคำด้านล่างตามลำดับ</span>`;
    pool.innerHTML = order.map((ti, p) => `<button data-pool="${p}" class="${tileCls} bg-white ring-zinc-200 hover:ring-sky-400 dark:bg-zinc-900 dark:ring-zinc-700 ${picked.includes(p) ? "pointer-events-none opacity-0" : ""}">${esc(tiles[ti])}</button>`).join("");
    checkBtn.disabled = picked.length !== tiles.length;
    pool.querySelectorAll("[data-pool]").forEach(b => (b.onclick = () => { picked.push(Number(b.dataset.pool)); update(); }));
    answer.querySelectorAll("[data-picked]").forEach(b => (b.onclick = () => { picked.splice(Number(b.dataset.picked), 1); update(); }));
  }
  update();
  on("clear", () => { picked = []; update(); });

  on("check-sentence", () => {
    if (picked.length !== tiles.length) return;
    const chosen = picked.map(p => tiles[order[p]]);
    if (!srs.isCorrectOrder(chosen, toks)) {
      const msg = app.querySelector("#sent-msg");
      answer.classList.replace("border-zinc-200", "border-rose-400");
      msg.className = "mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200";
      msg.innerHTML = `ยังไม่ถูก ประโยคที่ถูกคือ<br><b>${esc(t.en)}</b><br><span class="text-sm">ลองเรียงใหม่อีกครั้ง</span>`;
      picked = [];
      update();
      speak(t.en);
      return;
    }
    // เรียงถูกแล้ว → ฟังและพูดตาม (shadowing) เพื่อฝึกพูดทั้งประโยค
    shell({
      stepsHtml: steps(STEPS.sentence, 1),
      body: chip(true, "ถูกต้อง! ฟังแล้วพูดตามออกเสียง") + card(`
        <div class="flex items-start gap-4">
          <p class="flex-1 text-2xl leading-relaxed md:text-3xl md:leading-relaxed">${hl(t.en, w.answer)}</p>
          ${sayBtn(t.en, "md")}
        </div>
        <p class="mt-3 border-t border-zinc-100 pt-3 text-zinc-500 dark:border-zinc-800">${esc(t.th)}</p>
        <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">${slowBtn(t.en)}<span>พูดตามให้ทันเสียง 1–2 รอบ</span></div>`),
      actions: button('data-act="next"', `พูดตามแล้ว ไปต่อ ${icon("arrow", "ml-2 h-5 w-5")}`, "primary", "Enter Space"),
    });
    speak(t.en);
    on("next", () => {
      const d = daily();
      if (!session.practice) d.sentences = (d.sentences || 0) + 1;
      session.sentences++;
      session.completed++;
      session.currentDone = true;
      save();
      next();
    });
  });
}

function finish() {
  const d = daily();
  const s = session;
  if (!s.practice) { d.warmDone = true; save(); }
  session = null;
  const stat = (n, label, color) => `<div class="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/60">
    <div class="text-3xl font-bold tabular-nums ${color}">${n}</div><div class="mt-1 text-sm text-zinc-500">${label}</div></div>`;
  app.innerHTML = `
    <main class="flex flex-1 flex-col justify-center py-10">
      ${card(`
        <div class="text-center">
          <div class="text-6xl">🎉</div>
          <h1 class="mt-4 text-2xl font-bold">${s.practice ? "ฝึกซ้ำครบแล้ว" : "จบการเรียนวันนี้แล้ว"}</h1>
          <p class="mt-2 text-zinc-500">${s.practice ? "รอบฝึกซ้ำไม่เปลี่ยนรอบทบทวน ฝึกเพิ่มได้เรื่อยๆ" : "คำที่ผิดวันนี้ทวนจนถูกครบแล้ว พรุ่งนี้มีรอบทบทวนรออยู่"}</p>
        </div>
        <div class="mt-6 grid grid-cols-2 gap-3 ${s.practice ? "sm:grid-cols-3" : "sm:grid-cols-4"}">
          ${stat(s.completed - s.sentences, "คำที่ผ่าน", "text-purple-600 dark:text-purple-300")}
          ${s.practice ? stat(s.fails, "ตอบผิด", "text-rose-500") : stat(s.learned, "คำใหม่", "text-teal-600 dark:text-teal-300")}
          ${stat(s.sentences, "ประโยค", "text-sky-600 dark:text-sky-300")}
          ${s.practice ? "" : stat(s.cleared, "เก็บตกสำเร็จ", "text-rose-500")}
        </div>
        <div class="mt-6">${button('data-act="home"', "กลับหน้าแรก")}</div>`)}
    </main>`;
  on("home", renderHome);
}

// ---------- Picture Talk ----------
function addWord(e) {
  if (byId[e.id]) return;
  words.push(e);
  byId[e.id] = e;
  byWord[e.word.toLowerCase()] ??= e;
}
let verbSet = null, nounSet = null;
const pictureCtx = {
  app, esc, icon, card, button, speak, sayBtn, hl, tapWords, srs, shuffle, daily, save, renderHome, unlockAudio, showWordPopup, addWord,
  get store() { return store; },
  get byId() { return byId; },
  get byWord() { return byWord; },
  verbs: () => (verbSet ??= new Set(words.filter(w => w.pos === "verb").map(w => w.word.toLowerCase()))),
  nouns: () => (nounSet ??= new Set(words.filter(w => w.pos === "noun").map(w => w.word.toLowerCase()))),
};

// ---------- home ----------
function renderHome() {
  const d = daily();
  const plan = srs.buildSession(words.map(w => w.id), store.cards, d, store.settings.newPerDay, d.date);
  const wordsToday = plan.warm.length + plan.review.length + plan.fresh.length + plan.wrap.length;
  const cards = Object.values(store.cards);
  const sentToday = Math.min(sentencesLeft(), cards.length + plan.fresh.length);
  const total = wordsToday + sentToday;
  const learned = cards.length;
  const leeches = cards.filter(c => c.leech).length;
  const tomorrow = cards.filter(c => c.due === srs.addDays(d.date, 1)).length;
  const pct = words.length ? (100 * learned) / words.length : 0;
  const dateEn = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const practiceN = todayIds().length;
  const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
  const seg = (attr, val, cur, label) =>
    `<button ${attr}="${val}" class="flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${String(val) === String(cur)
      ? "bg-white text-purple-700 shadow-sm dark:bg-zinc-700 dark:text-white"
      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}">${label}</button>`;
  const phaseRow = (key, n) => `
    <li class="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-2.5">
      <span class="flex items-center gap-2.5"><span class="h-2.5 w-2.5 rounded-full ${PHASES[key].dot} ring-2 ring-white/40"></span>${PHASES[key].en}</span>
      <span class="text-lg font-bold tabular-nums">${n}</span>
    </li>`;
  const practiceBtn = practiceN ? `
    <button data-act="practice" class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-3.5 font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25 active:scale-[.98]">
      ${icon("repeat", "h-5 w-5")} Practice today's ${plural(practiceN, "word")} again
    </button>
    <p class="mt-2 text-center text-xs text-white/60">Extra practice doesn't change your review schedule.</p>` : "";

  app.innerHTML = `
    <header class="flex items-center gap-3 pt-[max(24px,env(safe-area-inset-top))]">
      <div class="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-purple-600/30">A</div>
      <div>
        <h1 class="text-xl font-bold leading-tight">Active Recall English</h1>
        <p class="text-sm text-zinc-500">Listen first · Recall first · Then check</p>
      </div>
    </header>
    <main class="grid gap-4 py-6">
      <section class="animate-pop overflow-hidden rounded-[28px] bg-gradient-to-br from-purple-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl shadow-purple-600/25 md:p-8">
        <p class="text-sm text-white/70">${esc(dateEn)}</p>
        <h2 class="mt-1 text-2xl font-bold">${total ? `Today: ${plural(wordsToday, "word")} · ${plural(sentToday, "sentence")}` : "All done for today 🎉"}</h2>
        <ul class="mt-5 grid gap-2">
          ${phaseRow("warm", plan.warm.length)}${phaseRow("review", plan.review.length)}
          ${phaseRow("new", plan.fresh.length)}${phaseRow("sentence", sentToday)}${phaseRow("wrap", plan.wrap.length)}
        </ul>
        <button data-act="start" ${total ? "" : "disabled"} class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-lg font-bold text-purple-700 shadow-lg transition hover:bg-purple-50 active:scale-[.98] disabled:opacity-60">
          ${total ? `${practiceN ? "Continue" : "Start"} today's lesson ${icon("arrow", "h-5 w-5")}` : `Tomorrow: ${plural(tomorrow, "word")} to review`}
        </button>
        ${practiceBtn}
      </section>

      <button data-act="pictures" class="animate-pop group flex items-center gap-4 rounded-[28px] bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 transition hover:ring-purple-300 dark:bg-zinc-900 dark:ring-zinc-800">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-rose-400 text-2xl shadow-lg shadow-rose-400/30">🖼️</span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-bold">Picture Talk</span>
          <span class="block text-sm text-zinc-500">Describe a random photo: words in the picture, sentence starters, 3 practice levels, and speaking with your mic.</span>
        </span>
        <span class="text-purple-600 transition group-hover:translate-x-1">${icon("arrow", "h-6 w-6")}</span>
      </button>

      <section class="grid gap-4 md:grid-cols-2">
        ${card(`
          <div class="flex items-baseline justify-between">
            <h3 class="font-semibold">Vocabulary</h3>
            <span class="text-sm text-zinc-500">${pct < 1 && learned ? "<1" : Math.round(pct)}%</span>
          </div>
          <div class="mt-3 text-3xl font-bold tabular-nums">${learned}<span class="text-lg font-medium text-zinc-400"> / ${words.length.toLocaleString("en-US")} words</span></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-teal-400" style="width:${Math.max(pct, learned ? 1 : 0)}%"></div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><div class="text-zinc-500">Due tomorrow</div><div class="text-xl font-bold tabular-nums">${tomorrow}</div></div>
            <div class="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><div class="text-zinc-500">Tricky words</div><div class="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">${leeches}</div></div>
          </div>`, "!p-6")}
        ${card(`
          <h3 class="font-semibold">Settings</h3>
          <div class="mt-4 text-sm text-zinc-500">New words per day</div>
          <div class="mt-2 flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">${[5, 10, 20].map(n => seg("data-new", n, store.settings.newPerDay, `${n} words`)).join("")}</div>
          <p class="mt-1.5 text-xs text-zinc-500">More new words today means more reviews in the days ahead.</p>
          <div class="mt-4 text-sm text-zinc-500">Sentences per day</div>
          <div class="mt-2 flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">${[5, 10, 20].map(n => seg("data-sent", n, store.settings.sentencesPerDay ?? 5, `${n} sentences`)).join("")}</div>
          <div class="mt-4 text-sm text-zinc-500">Voice accent</div>
          <div class="mt-2 flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">${seg("data-accent", "en-US", store.settings.accent, "American (US)")}${seg("data-accent", "en-GB", store.settings.accent, "British (UK)")}</div>
          <button data-act="test-sound" class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-700 ring-1 ring-purple-100 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20">${icon("speaker", "h-4 w-4")} Test sound</button>
          <p id="sound-status" class="mt-2 text-xs text-zinc-500">${window.speechSynthesis
            ? (IS_IOS ? "iPhone: if you hear nothing, turn off Silent Mode (side switch), turn the volume up, then test again." : "")
            : "This browser can't read text aloud. Please open the site in Safari or Chrome."}</p>`, "!p-6")}
      </section>

      <details class="group rounded-[28px] bg-white p-6 ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
        <summary class="flex cursor-pointer list-none items-center justify-between font-semibold">How it works <span class="text-zinc-400 transition group-open:rotate-180">⌄</span></summary>
        <ol class="mt-4 grid gap-3 text-zinc-600 dark:text-zinc-400">
          <li><b class="text-zinc-900 dark:text-zinc-100">Warm-up</b> A quick check of yesterday's words.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">Core Review</b> Two styles take turns: hear the word and recall its meaning, or see the Thai and recall the English. Rate yourself Again / Hard / Easy, then fill in a sentence.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">New Intake</b> Listen, pick the word you heard, then study a flashcard: English on the front, Thai meaning on the back. Finish by filling in a sentence.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">Sentences</b> Build sentences from words you know: read the Thai and order the tiles, or listen and order what you hear. Then repeat the sentence out loud.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">Wrap-up</b> Words you missed today come back until you get them all right.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">Picture Talk</b> Describe a random photo in 3 steps: overview, details and positions, then what you guess about the scene. Tap the dots to learn words and add them to your review queue.</li>
          <li><b class="text-zinc-900 dark:text-zinc-100">Tip</b> Tap any underlined word in a sentence to hear it and see its meaning.</li>
        </ol>
        <button data-act="reset" class="mt-5 text-sm text-rose-600 underline">Reset all progress</button>
      </details>
    </main>`;

  on("start", startSession);
  on("practice", startPractice);
  on("pictures", () => openPictures(pictureCtx));
  on("reset", () => {
    if (confirm("Reset all progress? This can't be undone.")) { store.cards = {}; store.daily = null; store.custom = {}; save(); renderHome(); }
  });
  app.querySelectorAll("[data-new]").forEach(b => (b.onclick = () => { store.settings.newPerDay = Number(b.dataset.new); save(); renderHome(); }));
  app.querySelectorAll("[data-sent]").forEach(b => (b.onclick = () => { store.settings.sentencesPerDay = Number(b.dataset.sent); save(); renderHome(); }));
  on("test-sound", () => {
    unlockAudio();
    const status = app.querySelector("#sound-status");
    speechWorked = false;
    speak("Hello! Let's learn English.");
    setTimeout(() => {
      if (!status) return;
      status.textContent = speechWorked
        ? (IS_IOS ? "Sound played. If you still can't hear it, turn off Silent Mode with the side switch and turn the volume up." : "Sound played. If you can't hear it, check your device volume.")
        : "The browser didn't play the sound. Refresh the page and test again. (iPhone: Settings > Accessibility > Spoken Content > Voices — make sure an English voice is installed.)";
    }, 1500);
  });
  app.querySelectorAll("[data-accent]").forEach(b => (b.onclick = () => { store.settings.accent = b.dataset.accent; save(); renderHome(); speak("Hello"); }));
}

// คีย์ลัดบนคอมพิวเตอร์: Space/Enter = เฉลย/ต่อไป, 1-4 = ปุ่มคำตอบ
document.addEventListener("keydown", e => {
  if (document.getElementById("word-pop")) { if (["Escape", "Enter", " "].includes(e.key)) { e.preventDefault(); closeWordPopup(); } return; }
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
    const getJSON = async path => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`โหลด ${path} ไม่สำเร็จ (${res.status})`);
      return res.json();
    };
    // คำศัพท์แยกเป็นชุดๆ ตามลำดับใน index.json (คำที่อยู่ชุดแรกจะได้เรียนก่อน)
    const { files } = await getJSON("data/words/index.json");
    const lists = await Promise.all(files.map(f => getJSON(`data/words/${f}`)));
    const seen = new Set();
    words = lists
      .flatMap(l => l.words)
      .filter(w => !seen.has(w.id) && seen.add(w.id))
      .map(w => ({ ...w, answer: w.answer || w.word }));
    byId = Object.fromEntries(words.map(w => [w.id, w]));
    for (const w of words) byWord[w.word.toLowerCase()] ??= w;
    // คำที่เพิ่มจากโหมดอธิบายภาพ (ไม่อยู่ในคลัง 3,000 คำ)
    Object.values(store.custom || {}).forEach(addWord);
    // คำพื้นฐานที่ไม่ได้อยู่ในบทเรียน ใช้กับป๊อปอัปแตะดูความหมายเท่านั้น (โหลดไม่ได้ก็ใช้งานต่อได้)
    getJSON("data/extra-words.json")
      .then(x => x.words.forEach(w => (byWord[w.word.toLowerCase()] ??= w)))
      .catch(() => {});
    renderHome();
  } catch (err) {
    app.innerHTML = `<p class="py-10 text-center text-rose-600">${esc(err.message)}</p>`;
  }
}

boot();
