// โหมดฝึกรูปประโยค (Sentence Patterns): จำโครงประโยคครั้งเดียว แล้วเปลี่ยนแค่คำในช่อง {x}
// เรียน 1 รูปประโยค = 4 ขั้น: สังเกต → สลับคำ → เปลี่ยนรูป → เห็นไทยแล้วพูด แล้วให้คะแนนเพื่อเข้ารอบทบทวน (SRS)
// ใช้ helper จาก app.js ผ่าน ctx เหมือน picture.js

const UI_KEY = "english-lessons:pat-ui";

let C = null;
let data = null; // { tabs, cats, patterns }
let ui = { tab: "daily", cat: null, level: "all" };

const esc = s => C.esc(s);
const icon = (...a) => C.icon(...a);
const CARD = "rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800";
const LEVEL_CLS = {
  A1: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30",
  A2: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  B1: "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30",
};
const STEP_NAMES = ["สังเกต", "สลับคำ", "เปลี่ยนรูป", "พูด"];

// ไอคอนเส้นแบบเดียวกับแถบเมนูของแอปแชท
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-full w-full">${d}</svg>`;
const TAB_ICON = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/>'),
  bag: svg('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  plane: svg('<path d="M10.5 13.5 3 11l1.5-1.5 7.5 1L16.5 6a2.1 2.1 0 0 1 3 3L15 13.5l1 7.5L14.5 22 12 14.5"/>'),
  chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
  briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'),
};

// ---------- data / state ----------
async function loadData() {
  if (data) return;
  const res = await fetch("data/patterns.json");
  if (!res.ok) throw new Error(`โหลดรูปประโยคไม่สำเร็จ (${res.status})`);
  data = await res.json();
}

function loadUi() {
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY)) }; } catch { /* ข้าม */ }
  if (!data.tabs.some(t => t.id === ui.tab)) ui.tab = data.tabs[0].id;
  if (!catsOf(ui.tab).some(c => c.id === ui.cat)) ui.cat = catsOf(ui.tab)[0].id;
}
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ข้าม */ } }

const catsOf = tab => data.cats.filter(c => c.tab === tab);
const cards = () => (C.store.patterns ??= {});
const today = () => C.daily().date;
const isDue = p => { const c = cards()[p.id]; return c && c.due <= today(); };
const dueList = () => data.patterns.filter(isDue);
// ดาว: 1 = เรียนแล้ว, 2 = รอบทบทวน 3 วันขึ้นไป, 3 = จำได้ดี (14 วันขึ้นไป)
function stars(p) {
  const c = cards()[p.id];
  if (!c) return 0;
  return c.interval >= 14 ? 3 : c.interval >= 3 ? 2 : 1;
}
const starHtml = n => `<span class="tracking-tight text-amber-400">${"★".repeat(n)}<span class="text-zinc-300 dark:text-zinc-600">${"★".repeat(3 - n)}</span></span>`;

// ---------- sentence helpers ----------
const fill = (frame, slot) => frame.replace("{x}", slot.en);
const fillTh = (th, slot) => th.replace("{x}", slot.th);
const SLOT_CLS = "rounded-lg bg-emerald-100 px-1.5 font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
const BLANK = `<span class="mx-0.5 inline-block min-w-14 rounded-lg border-2 border-dashed border-emerald-400 align-middle">&nbsp;</span>`;

// แสดงโครงประโยค โดยช่อง {x} เป็นคำที่ไฮไลต์สีเขียว (หรือช่องว่าง) ส่วนคำอื่นแตะดูความหมายได้
function frameHtml(frame, slot) {
  const [a, b] = frame.split("{x}");
  const mid = slot ? `<span class="${SLOT_CLS}">${C.tapWords(slot.en)}</span>` : BLANK;
  return C.tapWords(a) + mid + C.tapWords(b);
}
const thHtml = th => esc(th).replace("{x}", `<span class="text-emerald-600 dark:text-emerald-400">…</span>`);

// แยกประโยคเป็นบัตรคำ: merge = รวมคำในช่องเป็นบัตรเดียว (ง่ายกว่า ใช้ตอนเริ่มฝึก)
function tokens(frame, slot, merge) {
  const end = frame.match(/[.?!]+$/)?.[0] || "";
  const out = [];
  for (const t of frame.slice(0, frame.length - end.length).split(/\s+/).filter(Boolean)) {
    if (!t.includes("{x}")) { out.push(t); continue; }
    const [pre, post] = t.split("{x}");
    const words = merge ? [slot.en] : slot.en.split(/\s+/);
    words[0] = pre + words[0];
    words[words.length - 1] += post;
    out.push(...words);
  }
  return { toks: out, end };
}
// บัตรใบแรกเป็นตัวพิมพ์เล็ก (ยกเว้น I) เพื่อไม่ให้ตัวพิมพ์ใหญ่บอกใบ้ว่าคำไหนขึ้นต้น
const tileText = (t, i) => (i === 0 && !/^I(\b|')/.test(t) && !/^[A-Z]{2}/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

// ---------- speech ----------
const CONTRACTIONS = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is",
  "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "let's": "let us",
  "i'd": "i would", "i'll": "i will", "i've": "i have", "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "can't": "can not", "cannot": "can not", "won't": "will not", "isn't": "is not", "aren't": "are not",
  "wasn't": "was not", "wouldn't": "would not", "you'll": "you will", "we'll": "we will", "ok": "okay",
};
const normWords = s => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' -]/g, " ").split(/\s+/).filter(Boolean)
  .flatMap(w => (CONTRACTIONS[w] || w.replace(/'/g, "")).split(" "));

function wordDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
// ยอมให้ผิดได้เล็กน้อย เพราะระบบแปลงเสียงอาจฟังคำสั้นๆ ผิด
export function speechMatches(heard, target) {
  const a = normWords(heard), b = normWords(target);
  return wordDistance(a, b) <= Math.max(1, Math.floor(b.length / 5));
}

let rec = null;
function stopMic() { try { rec?.abort(); } catch { /* ข้าม */ } rec = null; }

function listenOnce({ onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  window.speechSynthesis?.cancel();
  stopMic();
  rec = new SR();
  rec.lang = C.store.settings.accent || "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = e => onResult([...e.results[0]].map(a => a.transcript));
  rec.onerror = e => onError(e.error);
  rec.onend = () => { rec = null; onEnd(); };
  try { rec.start(); } catch { onError("start"); }
}

// ---------- list page ----------
export async function openPatterns(ctx) {
  C = ctx;
  C.unlockAudio();
  try { await loadData(); } catch (e) { C.app.innerHTML = `<p class="py-10 text-center text-rose-600">${esc(e.message)}</p>`; return; }
  loadUi();
  renderList();
}

function renderList() {
  stopMic();
  const tab = data.tabs.find(t => t.id === ui.tab);
  const cats = catsOf(ui.tab);
  const inTab = data.patterns.filter(p => cats.some(c => c.id === p.cat));
  const learnedInTab = inTab.filter(p => cards()[p.id]).length;
  const list = data.patterns.filter(p => p.cat === ui.cat && (ui.level === "all" || p.level === ui.level));
  const due = dueList();
  const chip = (attr, val, cur, label) => `<button ${attr}="${val}" class="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${val === cur
    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white"
    : "bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"}">${label}</button>`;

  C.app.innerHTML = `
    <header class="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-zinc-50/85 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md dark:bg-zinc-950/85">
      <button data-act="home" aria-label="กลับหน้าแรก" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
      <div class="min-w-0 flex-1">
        <div class="font-semibold">Sentence Patterns</div>
        <div class="truncate text-xs text-zinc-500">รูปประโยคที่ใช้บ่อย เปลี่ยนแค่คำในช่อง</div>
      </div>
      <button data-act="review" ${due.length ? "" : "disabled"} class="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/20 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800">
        ${icon("repeat", "h-4 w-4")} ทบทวน${due.length ? ` ${due.length}` : ""}</button>
    </header>

    <main class="grid gap-4 pb-40 pt-2">
      <section class="animate-pop rounded-[24px] bg-gradient-to-br from-purple-600 to-indigo-700 p-5 text-white shadow-xl shadow-purple-600/20">
        <div class="flex items-center gap-3">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 p-2.5">${TAB_ICON[tab.icon]}</span>
          <div class="min-w-0 flex-1"><div class="text-lg font-bold">${esc(tab.en)}</div><div class="text-sm text-white/75">${esc(tab.th)}</div></div>
          <div class="text-right"><div class="text-2xl font-bold tabular-nums">${learnedInTab}<span class="text-base font-medium text-white/60">/${inTab.length}</span></div><div class="text-xs text-white/70">เรียนแล้ว</div></div>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div class="h-full rounded-full bg-white" style="width:${(100 * learnedInTab) / Math.max(1, inTab.length)}%"></div></div>
      </section>

      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        ${cats.map(c => chip("data-cat", c.id, ui.cat, esc(c.th))).join("")}
      </div>
      <div class="flex gap-2">
        ${[["all", "ทุกระดับ"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"]].map(([v, l]) => chip("data-level", v, ui.level, l)).join("")}
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        ${list.length ? list.map(p => {
          const st = stars(p);
          return `<button data-pat="${p.id}" class="${CARD} !p-4 flex flex-col gap-2 text-left transition hover:ring-purple-300">
            <div class="flex items-center gap-2 text-xs">
              <span class="rounded-full px-2 py-0.5 font-semibold ring-1 ${LEVEL_CLS[p.level]}">${p.level}</span>
              ${isDue(p) ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">ถึงรอบทบทวน</span>` : ""}
              <span class="ml-auto text-base">${starHtml(st)}</span>
            </div>
            <div class="text-lg font-semibold leading-snug">${esc(p.frame).replace("{x}", BLANK)}</div>
            <div class="text-sm text-zinc-500">${thHtml(p.th)}</div>
          </button>`;
        }).join("") : `<p class="py-8 text-center text-zinc-500 md:col-span-2">ไม่มีรูปประโยคระดับนี้ในหมวดนี้</p>`}
      </div>
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div class="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[30px] bg-white/85 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.14)] ring-1 ring-zinc-200/80 backdrop-blur-xl dark:bg-zinc-900/85 dark:ring-zinc-800">
        ${data.tabs.map(t => `<button data-tab="${t.id}" class="flex flex-col items-center gap-0.5 rounded-[24px] px-1 py-2 text-[11px] leading-tight transition ${t.id === ui.tab
          ? "bg-zinc-200/80 font-semibold text-zinc-900 dark:bg-zinc-700 dark:text-white"
          : "font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"}">
          <span class="h-6 w-6">${TAB_ICON[t.icon]}</span><span class="max-w-full truncate">${esc(t.en.split(" ")[0])}</span></button>`).join("")}
      </div>
    </nav>`;

  C.app.querySelector('[data-act="home"]').onclick = () => C.renderHome();
  const rv = C.app.querySelector('[data-act="review"]');
  rv.onclick = () => { const q = dueList(); if (q.length) startPractice(q[0], "review", q.slice(1)); };
  C.app.querySelectorAll("[data-tab]").forEach(b => (b.onclick = () => {
    ui.tab = b.dataset.tab; ui.cat = catsOf(ui.tab)[0].id; saveUi(); renderList(); window.scrollTo({ top: 0 });
  }));
  C.app.querySelectorAll("[data-cat]").forEach(b => (b.onclick = () => { ui.cat = b.dataset.cat; saveUi(); renderList(); }));
  C.app.querySelectorAll("[data-level]").forEach(b => (b.onclick = () => { ui.level = b.dataset.level; saveUi(); renderList(); }));
  C.app.querySelectorAll("[data-pat]").forEach(b => (b.onclick = () => startPractice(data.patterns.find(p => p.id === b.dataset.pat), "learn", [])));
  C.app.querySelector(`[data-cat="${ui.cat}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}

// ---------- practice ----------
let S = null; // สถานะการฝึกรูปประโยคที่เปิดอยู่

// สร้างลำดับงาน: เรียนครั้งแรก 4 ขั้นเต็ม / ทบทวนใช้คำเติมช่องใหม่ แล้วสลับคำ + เปลี่ยนรูป + พูด
function buildTasks(p, mode) {
  const order = C.shuffle(p.slots);
  let k = mode === "learn" ? 3 : 0;
  const nextSlot = () => order[k++ % order.length];
  const variant = i => p.variants[i % p.variants.length];
  if (mode === "review") {
    return [
      { type: "build", step: 1, slot: nextSlot() },
      { type: "transform", step: 2, slot: nextSlot(), variant: C.shuffle(p.variants)[0] },
      { type: "speak", step: 3, slot: nextSlot() },
      { type: "rate" },
    ];
  }
  return [
    { type: "observe", step: 0, examples: order.slice(0, 3) },
    { type: "choose", step: 1, slot: nextSlot() },
    { type: "choose", step: 1, slot: nextSlot() },
    { type: "build", step: 1, slot: nextSlot(), merge: true },
    { type: "build", step: 1, slot: nextSlot() },
    { type: "transform", step: 2, slot: nextSlot(), variant: variant(0) },
    { type: "transform", step: 2, slot: nextSlot(), variant: variant(1) },
    { type: "speak", step: 3, slot: nextSlot() },
    { type: "speak", step: 3, slot: nextSlot() },
    { type: "rate" },
  ];
}

function startPractice(p, mode, queue) {
  S = { p, mode, queue, tasks: buildTasks(p, mode), i: 0, right: 0, total: 0 };
  window.scrollTo({ top: 0 });
  showTask();
}

function shell(body) {
  const t = S.tasks[S.i];
  const graded = S.tasks.filter(x => x.type !== "observe" && x.type !== "rate").length;
  const pct = Math.round((100 * S.i) / (S.tasks.length - 1));
  const step = t.step ?? 4;
  C.app.innerHTML = `
    <div class="sticky top-0 z-20 -mx-4 bg-zinc-50/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] shadow-[0_8px_16px_-14px_rgba(0,0,0,.3)] backdrop-blur-md dark:bg-zinc-950/95">
      <div class="flex items-center gap-3">
        <button data-act="back" aria-label="กลับ" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
        <div class="flex-1">
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold">${S.mode === "review" ? "ทบทวนรูปประโยค" : "ฝึกรูปประโยค"}</span>
            <span class="shrink-0 tabular-nums text-zinc-500">${S.mode === "review" && S.queue.length ? `เหลือ ${S.queue.length} · ` : ""}ถูก ${S.right}/${graded}</span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all" style="width:${pct}%"></div></div>
        </div>
      </div>
      <ol class="mt-3 flex items-center justify-center gap-1 text-[11px]">${STEP_NAMES.map((n, i) => `
        <li class="flex items-center gap-1">${i ? `<span class="h-px w-3 bg-zinc-300 dark:bg-zinc-700"></span>` : ""}
          <span class="rounded-full px-2 py-0.5 font-medium ${i < step ? "text-emerald-600 dark:text-emerald-400" : i === step ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-400"}">${i + 1} ${n}</span></li>`).join("")}</ol>
      <div class="mt-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div class="flex items-center gap-2"><span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEVEL_CLS[S.p.level]}">${S.p.level}</span>
          <span class="text-base font-semibold">${esc(S.p.frame).replace("{x}", BLANK)}</span></div>
        <div class="mt-0.5 text-xs text-zinc-500">${thHtml(S.p.th)}</div>
      </div>
    </div>
    <main class="grid gap-4 pb-12 pt-4">${body}</main>`;
  C.app.querySelector('[data-act="back"]').onclick = () => { window.speechSynthesis?.cancel(); stopMic(); S = null; renderList(); };
  bindSay(C.app);
}

function bindSay(root) {
  root.querySelectorAll("[data-say]").forEach(b => (b.onclick = e => { e.stopPropagation(); C.speak(b.dataset.say); }));
  root.querySelectorAll("[data-say-slow]").forEach(b => (b.onclick = e => { e.stopPropagation(); C.speak(b.dataset.saySlow, null, 0.55); }));
}

function speakAll(list, i = 0) {
  if (i >= list.length || !S) return;
  C.speak(list[i], () => setTimeout(() => speakAll(list, i + 1), 300));
}

function nextTask() { S.i++; window.scrollTo({ top: 0 }); showTask(); }

function showTask() {
  const t = S.tasks[S.i];
  ({ observe, choose, build, transform, speak: speakTask, rate })[t.type](t);
}

// ช่องผลลัพธ์หลังตอบ: ประโยคเต็ม + เสียง + ปุ่มไปต่อ
function resultBlock(ok, sentence, th, slot, frame) {
  return `<div class="animate-pop rounded-2xl px-4 py-3 ${ok ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-rose-50 dark:bg-rose-500/10"}">
      <div class="text-sm font-semibold ${ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}">${ok ? "ถูกต้อง! ฟังแล้วพูดตาม" : "ยังไม่ถูก ประโยคที่ถูกคือ"}</div>
      <div class="mt-1 flex items-start gap-3"><p class="flex-1 text-xl leading-relaxed">${frameHtml(frame, slot)}</p>${C.sayBtn(sentence)}</div>
      <p class="text-sm text-zinc-500">${esc(th)}</p>
    </div>
    ${C.button('data-act="next"', `ต่อไป ${icon("arrow", "ml-2 h-5 w-5")}`)}`;
}

function grade(ok) { S.total++; if (ok) S.right++; }

// ขั้น 1: ฟังและสังเกต — เห็นว่าส่วนไหนคงที่ ส่วนไหนเปลี่ยนได้
function observe(t) {
  const p = S.p;
  shell(`
    <section class="${CARD}">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">ใช้เมื่อไร</div>
      <p class="mt-1 text-lg">${esc(p.use)}</p>
      ${p.note ? `<p class="mt-3 flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">${icon("bulb", "h-5 w-5 shrink-0")}<span>${esc(p.note)}</span></p>` : ""}
    </section>
    <section class="${CARD}">
      <div class="flex items-center justify-between">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">ฟังตัวอย่าง · สังเกตคำสีเขียวที่เปลี่ยนไป</div>
        <button data-act="play-all" class="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">${icon("speaker", "h-4 w-4")} ฟังทั้งหมด</button>
      </div>
      <div class="mt-3 grid gap-3">${t.examples.map(s => `
        <div class="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-800/60">
          <span class="text-2xl">${s.emoji}</span>
          <div class="min-w-0 flex-1"><p class="text-lg leading-snug">${frameHtml(p.frame, s)}</p><p class="mt-0.5 text-sm text-zinc-500">${esc(fillTh(p.th, s))}</p></div>
          ${C.sayBtn(fill(p.frame, s))}
        </div>`).join("")}</div>
      <p class="mt-3 text-sm text-zinc-500">คำอื่นที่ใส่ในช่องได้: ${p.slots.filter(s => !t.examples.includes(s)).map(s => `<span class="whitespace-nowrap">${s.emoji} ${esc(s.en)}</span>`).join(" · ")}</p>
    </section>
    ${C.button('data-act="next"', `เริ่มฝึก ${icon("arrow", "ml-2 h-5 w-5")}`)}`);
  const all = t.examples.map(s => fill(p.frame, s));
  C.app.querySelector('[data-act="play-all"]').onclick = () => speakAll(all);
  C.app.querySelector('[data-act="next"]').onclick = nextTask;
  speakAll(all);
}

// ขั้น 2 (ก): เลือกคำใส่ช่องจากคำใบ้ภาษาไทย
function choose(t) {
  const p = S.p, s = t.slot;
  const opts = C.shuffle([s, ...C.shuffle(p.slots.filter(x => x !== s)).slice(0, 3)]);
  shell(`
    <section class="${CARD} text-center">
      <div class="text-5xl">${s.emoji}</div>
      <p class="mt-2 text-lg font-semibold text-purple-700 dark:text-purple-300">${esc(s.th)}</p>
      <p class="mt-1 text-sm text-zinc-500">เลือกคำภาษาอังกฤษที่ใส่ในช่อง</p>
      <p id="sent" class="mt-4 text-xl leading-relaxed">${frameHtml(p.frame, null)}</p>
    </section>
    <div id="opts" class="grid gap-2.5 sm:grid-cols-2">${opts.map((o, i) => `
      <button data-opt="${i}" class="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-lg font-medium ring-1 ring-zinc-200 transition hover:ring-purple-300 dark:bg-zinc-900 dark:ring-zinc-700">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">${i + 1}</span>${esc(o.en)}</button>`).join("")}</div>
    <div id="res" class="grid gap-3"></div>`);
  C.app.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => {
    const ok = opts[Number(b.dataset.opt)] === s;
    grade(ok);
    C.app.querySelectorAll("[data-opt]").forEach(x => {
      x.disabled = true;
      const mine = opts[Number(x.dataset.opt)];
      if (mine === s) x.classList.add("!ring-2", "!ring-emerald-500", "bg-emerald-50", "dark:bg-emerald-500/10");
      else if (x === b) x.classList.add("!ring-2", "!ring-rose-500", "bg-rose-50", "dark:bg-rose-500/10");
      else x.classList.add("opacity-40");
    });
    const sentence = fill(p.frame, s);
    C.app.querySelector("#sent").innerHTML = frameHtml(p.frame, s);
    const res = C.app.querySelector("#res");
    res.innerHTML = resultBlock(ok, sentence, fillTh(p.th, s), s, p.frame);
    bindSay(res);
    res.querySelector('[data-act="next"]').onclick = nextTask;
    C.speak(sentence);
  }));
}

// แป้นบัตรคำสำหรับเรียงประโยค: แตะบัตรเพื่อวาง แตะบัตรที่วางแล้วเพื่อเอาออก
function tileBoard(root, toks, end, onDone) {
  const tiles = toks.map(tileText);
  let order = C.shuffle(tiles.map((_, i) => i));
  if (order.every((v, i) => v === i) && order.length > 1) order = order.reverse();
  let picked = [];
  root.innerHTML = `
    <div data-ans class="flex min-h-[60px] flex-wrap content-start items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-3 dark:border-zinc-700"></div>
    <p data-msg class="hidden"></p>
    <div data-pool class="flex flex-wrap justify-center gap-2"></div>
    <div class="grid grid-cols-[auto_1fr] gap-3">
      <button type="button" data-clear class="rounded-2xl px-5 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700">ล้าง</button>
      ${C.button("data-check disabled", "ตรวจประโยค")}
    </div>`;
  const ans = root.querySelector("[data-ans]"), pool = root.querySelector("[data-pool]"), check = root.querySelector("[data-check]");
  const tile = "rounded-xl px-3.5 py-2 text-lg font-medium shadow-sm ring-1 transition active:scale-95";
  let tries = 0;
  const draw = () => {
    ans.innerHTML = picked.length
      ? picked.map((ti, k) => `<button data-k="${k}" class="${tile} bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30">${esc(tiles[ti])}</button>`).join("") +
        (picked.length === tiles.length && end ? `<span class="text-lg">${esc(end)}</span>` : "")
      : `<span class="px-1 text-sm text-zinc-400">แตะบัตรคำด้านล่างตามลำดับ</span>`;
    pool.innerHTML = order.map(ti => `<button data-t="${ti}" class="${tile} bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 ${picked.includes(ti) ? "pointer-events-none opacity-0" : ""}">${esc(tiles[ti])}</button>`).join("");
    check.disabled = picked.length !== tiles.length;
    pool.querySelectorAll("[data-t]").forEach(b => (b.onclick = () => { picked.push(Number(b.dataset.t)); draw(); }));
    ans.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => { picked.splice(Number(b.dataset.k), 1); draw(); }));
  };
  draw();
  root.querySelector("[data-clear]").onclick = () => { picked = []; draw(); };
  check.onclick = () => {
    const ok = picked.map(i => tiles[i]).join(" ").toLowerCase() === toks.join(" ").toLowerCase();
    if (ok) return onDone(tries === 0);
    tries++;
    const msg = root.querySelector("[data-msg]");
    msg.className = "rounded-2xl bg-rose-50 px-4 py-3 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200";
    msg.innerHTML = `ยังไม่ถูก ประโยคที่ถูกคือ<br><b>${esc(toks.join(" ") + end)}</b><br><span class="text-sm">ลองเรียงใหม่อีกครั้ง</span>`;
    C.speak(toks.join(" ") + end);
    picked = [];
    draw();
  };
}

// ขั้น 2 (ข): สร้างประโยคเต็มด้วยคำใหม่ (รอบแรกคำในช่องรวมเป็นบัตรเดียว)
function build(t) {
  const p = S.p, s = t.slot;
  const { toks, end } = tokens(p.frame, s, t.merge);
  shell(`
    <section class="${CARD}">
      <div class="flex items-center gap-4">
        <span class="text-5xl">${s.emoji}</span>
        <div class="min-w-0"><p class="text-sm text-zinc-500">สร้างประโยคด้วยคำว่า</p>
          <p class="text-xl font-semibold"><span class="${SLOT_CLS}">${esc(s.en)}</span></p>
          <p class="text-sm text-zinc-500">${esc(s.th)}</p></div>
      </div>
      <div id="board" class="mt-4 grid gap-3"></div>
    </section>
    <div id="res" class="grid gap-3"></div>`);
  tileBoard(C.app.querySelector("#board"), toks, end, firstTry => done(firstTry, p.frame, p.th, s));
}

function done(ok, frame, th, slot) {
  grade(ok);
  const sentence = fill(frame, slot);
  C.app.querySelector("#board")?.closest("section")?.remove();
  const res = C.app.querySelector("#res");
  res.innerHTML = resultBlock(true, sentence, fillTh(th, slot), slot, frame) + (ok ? "" : `<p class="text-center text-sm text-zinc-500">ครั้งแรกยังไม่ถูก ข้อนี้จึงยังไม่นับคะแนน</p>`);
  bindSay(res);
  res.querySelector('[data-act="next"]').onclick = nextTask;
  C.speak(sentence);
}

// ขั้น 3: เปลี่ยนรูปประโยค (คำถาม / ปฏิเสธ / อดีต ฯลฯ)
function transform(t) {
  const p = S.p, s = t.slot, v = t.variant;
  const base = fill(p.frame, s);
  const { toks, end } = tokens(v.frame, s, true);
  shell(`
    <section class="${CARD}">
      <p class="text-sm text-zinc-500">ประโยคตั้งต้น</p>
      <div class="mt-1 flex items-start gap-3"><p class="flex-1 text-xl leading-relaxed">${frameHtml(p.frame, s)}</p>${C.sayBtn(base)}</div>
      <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white">${icon("repeat", "h-4 w-4")} ${esc(v.label)}</p>
      <p class="mt-2 text-sm text-zinc-500">ความหมาย: ${esc(fillTh(v.th, s))}</p>
      <div id="board" class="mt-4 grid gap-3"></div>
    </section>
    <div id="res" class="grid gap-3"></div>`);
  C.speak(base);
  tileBoard(C.app.querySelector("#board"), toks, end, firstTry => done(firstTry, v.frame, v.th, s));
}

// ขั้น 4: เห็นประโยคไทย → พูดเป็นภาษาอังกฤษ (ไมค์) หรือใช้บัตรคำช่วย
function speakTask(t) {
  const p = S.p, s = t.slot;
  const target = fill(p.frame, s);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  shell(`
    <section class="${CARD} text-center">
      <div class="text-5xl">${s.emoji}</div>
      <p class="mt-2 text-sm text-zinc-500">พูดประโยคนี้เป็นภาษาอังกฤษ</p>
      <p class="mt-1 text-2xl font-semibold text-purple-700 dark:text-purple-300">${esc(fillTh(p.th, s))}</p>
      <div id="speak-area" class="mt-5 grid gap-3">
        ${SR ? `<button data-act="mic" class="mx-auto inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-rose-600/25 transition active:scale-95"><span>🎙️</span><span data-lab>กดแล้วพูด</span></button>
          <p data-status class="text-sm text-zinc-500">พูดให้ครบทั้งประโยค แล้วระบบจะตรวจให้</p>` : `<p class="text-sm text-zinc-500">เบราว์เซอร์นี้แปลงเสียงไม่ได้ ใช้บัตรคำแทน</p>`}
        <div class="flex flex-wrap justify-center gap-2">
          <button data-act="tiles" class="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">🧩 ใช้บัตรคำช่วย</button>
          <button data-act="reveal" class="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">ดูเฉลย</button>
        </div>
      </div>
      <div id="board" class="mt-4 grid gap-3 text-left"></div>
    </section>
    <div id="res" class="grid gap-3"></div>`);
  const area = C.app.querySelector("#speak-area");
  let usedHelp = false;
  // ok = นับคะแนน / shown = แสดงว่าตอบถูก (เรียงบัตรคำได้ถูกแต่ไม่นับคะแนนเพราะใช้ตัวช่วย)
  const finish = (ok, heard, shown = ok) => {
    stopMic();
    grade(ok);
    area.remove();
    C.app.querySelector("#board").innerHTML = "";
    const res = C.app.querySelector("#res");
    res.innerHTML = (heard ? `<p class="text-center text-sm text-zinc-500">ระบบได้ยินว่า: “${esc(heard)}”</p>` : "") +
      resultBlock(shown, target, fillTh(p.th, s), s, p.frame) +
      (shown && !ok ? `<p class="text-center text-sm text-zinc-500">ใช้ตัวช่วยแล้ว ข้อนี้จึงยังไม่นับคะแนน รอบหน้าลองพูดเองดูนะ</p>` : "");
    bindSay(res);
    res.querySelector('[data-act="next"]').onclick = nextTask;
    C.speak(target);
  };
  const mic = C.app.querySelector('[data-act="mic"]');
  if (mic) mic.onclick = () => {
    const lab = mic.querySelector("[data-lab]"), status = C.app.querySelector("[data-status]");
    if (rec) { stopMic(); lab.textContent = "กดแล้วพูด"; return; }
    lab.textContent = "กำลังฟัง… (แตะเพื่อหยุด)";
    mic.classList.add("animate-pulse");
    let got = false;
    listenOnce({
      onResult: alts => {
        got = true;
        const ok = alts.some(a => speechMatches(a, target));
        if (ok) finish(!usedHelp, alts.find(a => speechMatches(a, target)));
        else { status.innerHTML = `ได้ยินว่า “${esc(alts[0])}” ยังไม่ตรง ลองพูดอีกครั้ง หรือใช้บัตรคำช่วย`; usedHelp = true; }
      },
      onError: err => {
        status.textContent = err === "not-allowed" || err === "service-not-allowed"
          ? "ไม่ได้รับอนุญาตให้ใช้ไมค์ (iPhone: ตั้งค่า > Safari > ไมโครโฟน และเปิด Siri & Dictation)"
          : err === "no-speech" ? "ไม่ได้ยินเสียง ลองพูดอีกครั้ง" : `ไมค์มีปัญหา (${err}) ลองใหม่ หรือใช้บัตรคำ`;
      },
      onEnd: () => { if (!got && document.body.contains(mic)) { lab.textContent = "กดแล้วพูด"; mic.classList.remove("animate-pulse"); } else if (document.body.contains(mic)) { lab.textContent = "กดแล้วพูดอีกครั้ง"; mic.classList.remove("animate-pulse"); } },
    });
  };
  C.app.querySelector('[data-act="tiles"]').onclick = () => {
    usedHelp = true;
    stopMic();
    area.remove();
    const { toks, end } = tokens(p.frame, s, false);
    tileBoard(C.app.querySelector("#board"), toks, end, () => finish(false, null, true));
  };
  C.app.querySelector('[data-act="reveal"]').onclick = () => finish(false);
}

// จบ 1 รูปประโยค: ให้คะแนนตัวเองเพื่อกำหนดรอบทบทวน
function rate() {
  const p = S.p;
  const graded = S.tasks.filter(x => x.type !== "observe" && x.type !== "rate").length;
  const card = cards()[p.id];
  const days = { hard: 1, easy: C.srs.nextEasyInterval(card?.interval ?? 0) };
  const sub = t => `<span class="block text-xs font-medium opacity-80">${t}</span>`;
  shell(`
    <section class="${CARD} text-center">
      <div class="text-5xl">${S.right === graded ? "🏆" : "🎯"}</div>
      <p class="mt-3 text-xl font-bold">${S.mode === "review" ? "ทบทวนเสร็จแล้ว" : "ฝึกครบ 4 ขั้นแล้ว"} · ถูก ${S.right}/${graded}</p>
      <p class="mt-1 text-zinc-500">ลองแต่งประโยคของตัวเองด้วยรูปประโยคนี้ แล้วพูดออกเสียงดูสักประโยค</p>
    </section>
    <p class="text-center text-sm text-zinc-500">ใช้รูปประโยคนี้ได้คล่องแค่ไหน?</p>
    <div class="grid grid-cols-3 gap-2.5">
      ${C.button('data-rate="again"', `<span>Again${sub("ทวนพรุ่งนี้อีก")}</span>`, "again", "1")}
      ${C.button('data-rate="hard"', `<span>Hard${sub(`อีก ${days.hard} วัน`)}</span>`, "hard", "2")}
      ${C.button('data-rate="easy"', `<span>Easy${sub(`อีก ${days.easy} วัน`)}</span>`, "easy", "3")}
    </div>`);
  C.app.querySelectorAll("[data-rate]").forEach(b => (b.onclick = () => {
    let c = C.srs.rate(card, b.dataset.rate, today());
    // Again ในโหมดนี้ให้กลับมาพรุ่งนี้ (ไม่วนซ้ำวันเดียวกัน เพราะเพิ่งฝึกครบแล้ว)
    if (b.dataset.rate === "again") c = { ...c, due: C.srs.addDays(today(), 1), interval: 0 };
    cards()[p.id] = c;
    C.save();
    afterRate();
  }));
}

function afterRate() {
  if (S.mode === "review" && S.queue.length) {
    const [next, ...rest] = S.queue;
    return startPractice(next, "review", rest);
  }
  const p = S.p;
  const sameCat = data.patterns.filter(x => x.cat === p.cat);
  const nextNew = sameCat.find(x => !cards()[x.id]);
  shell(`
    <section class="${CARD} text-center">
      <div class="text-5xl">🎉</div>
      <p class="mt-3 text-xl font-bold">${S.mode === "review" ? "ทบทวนครบทุกรูปประโยคของวันนี้แล้ว" : "บันทึกแล้ว"}</p>
      <p class="mt-1 text-zinc-500">${S.mode === "review" ? "รูปประโยคจะกลับมาให้ทบทวนตามรอบ" : "รูปประโยคนี้จะกลับมาให้ทบทวนตามรอบ"}</p>
    </section>
    ${nextNew && S.mode === "learn" ? C.button('data-act="next-new"', `รูปประโยคถัดไป: ${esc(nextNew.frame).replace("{x}", "…")}`) : ""}
    ${C.button('data-act="to-list"', "กลับหน้ารวม", "ghost")}`);
  C.app.querySelector('[data-act="next-new"]')?.addEventListener("click", () => startPractice(nextNew, "learn", []));
  C.app.querySelector('[data-act="to-list"]').onclick = () => { S = null; renderList(); };
}
