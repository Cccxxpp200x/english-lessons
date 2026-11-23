// บทสนทนาจำลอง (Conversations): ฟังบทสนทนาเต็ม แล้วเล่นบทบาทเป็นผู้พูด B ด้วยไมค์
// แอปพูดบท A ให้ฟัง ผู้เรียนพูดบท B (เห็นคำแปลไทย + คำใบ้) ระบบแสดงคำที่พูดแบบสดแล้วตรวจให้

import { micWidget, stopListening } from "./speech.js?v=18";

let C = null;
let data = null;
let filter = "all";
let R = null; // สถานะการเล่นบทบาท

const esc = s => C.esc(s);
const icon = (...a) => C.icon(...a);
const CARD = "rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800";
const LEVEL_CLS = {
  A1: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30",
  A2: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  B1: "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30",
};
const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2 };

const progress = () => (C.store.dialogs ??= {});
const done = d => progress()[d.id]?.times || 0;

async function loadData() {
  if (data) return;
  const res = await fetch("data/dialogues.json");
  if (!res.ok) throw new Error(`โหลดบทสนทนาไม่สำเร็จ (${res.status})`);
  data = await res.json();
}

// บทสนทนาที่แนะนำ: ยังไม่เคยฝึก เรียงจากง่ายไปยาก ถ้าฝึกครบแล้วเลือกบทที่ฝึกนานที่สุด
function nextDialog() {
  const fresh = [...data.dialogs].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]).find(d => !done(d));
  if (fresh) return fresh;
  return [...data.dialogs].sort((a, b) => (progress()[a.id].last || "").localeCompare(progress()[b.id].last || ""))[0];
}

export async function openDialogs(ctx, opts = {}) {
  C = ctx;
  C.unlockAudio();
  try { await loadData(); } catch (e) { C.app.innerHTML = `<p class="py-10 text-center text-rose-600">${esc(e.message)}</p>`; return; }
  if (opts.daily) return startDialog(nextDialog(), true);
  renderList();
}

// ---------- list ----------
function renderList() {
  stop();
  const chip = (val, label) => `<button data-f="${val}" class="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${val === filter
    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white"
    : "bg-white text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"}">${label}</button>`;
  const list = data.dialogs.filter(d => filter === "all" || d.cat === filter);
  const practiced = data.dialogs.filter(done).length;
  C.app.innerHTML = `
    <header class="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-zinc-50/85 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md dark:bg-zinc-950/85">
      <button data-act="home" aria-label="กลับหน้าแรก" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
      <div class="min-w-0 flex-1"><div class="font-semibold">Conversations</div><div class="truncate text-xs text-zinc-500">บทสนทนาในชีวิตประจำวัน · ฝึกแล้ว ${practiced}/${data.dialogs.length}</div></div>
      <button data-act="suggest" class="rounded-full bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/20">▶ บทแนะนำ</button>
    </header>
    <main class="grid gap-3 pb-10 pt-2">
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        ${chip("all", "ทั้งหมด")}${data.cats.map(c => chip(c.id, `${c.emoji} ${esc(c.th)}`)).join("")}
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        ${list.map(d => `
          <button data-d="${d.id}" class="${CARD} !p-4 flex items-start gap-3 text-left transition hover:ring-purple-300">
            <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800">${d.emoji}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2"><span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEVEL_CLS[d.level]}">${d.level}</span>
                ${done(d) ? `<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ ฝึกแล้ว ${done(d)} ครั้ง</span>` : ""}</span>
              <span class="mt-1 block font-semibold">${esc(d.en)}</span>
              <span class="block text-sm text-zinc-500">${esc(d.th)} · ${esc(d.scene)}</span>
            </span>
          </button>`).join("")}
      </div>
    </main>`;
  C.app.querySelector('[data-act="home"]').onclick = () => C.renderHome();
  C.app.querySelector('[data-act="suggest"]').onclick = () => startDialog(nextDialog(), false);
  C.app.querySelectorAll("[data-f]").forEach(b => (b.onclick = () => { filter = b.dataset.f; renderList(); }));
  C.app.querySelectorAll("[data-d]").forEach(b => (b.onclick = () => startDialog(data.dialogs.find(d => d.id === b.dataset.d), false)));
}

// ---------- practice ----------
function stop() { stopListening(true); window.speechSynthesis?.cancel(); }

function bubble(line, opts = {}) {
  const me = line.who === "B";
  return `<div class="animate-pop flex ${me ? "justify-end" : "justify-start"}">
    <div class="max-w-[85%] rounded-[20px] px-4 py-2.5 ${me ? "rounded-br-md bg-purple-600 text-white" : "rounded-bl-md bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"}">
      <div class="flex items-start gap-2">
        <p class="flex-1 text-[17px] leading-snug">${me ? esc(line.en) : C.tapWords(line.en)}</p>
        <button data-say="${esc(line.en)}" aria-label="ฟัง" class="mt-0.5 shrink-0 ${me ? "text-white/80" : "text-purple-600 dark:text-purple-300"}">${icon("speaker", "h-4 w-4")}</button>
      </div>
      <p data-th class="${opts.hideTh ? "hidden" : ""} mt-0.5 text-sm ${me ? "text-white/75" : "text-zinc-500"}">${esc(line.th)}</p>
      ${opts.note ? `<p class="mt-1 text-xs ${me ? "text-white/80" : "text-zinc-500"}">${opts.note}</p>` : ""}
    </div></div>`;
}

function bindSay(root) {
  root.querySelectorAll("[data-say]").forEach(b => (b.onclick = e => { e.stopPropagation(); C.speak(b.dataset.say); }));
}

function header(d, sub) {
  return `
    <div class="sticky top-0 z-20 -mx-4 bg-zinc-50/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] shadow-[0_8px_16px_-14px_rgba(0,0,0,.3)] backdrop-blur-md dark:bg-zinc-950/95">
      <div class="flex items-center gap-3">
        <button data-act="back" aria-label="กลับ" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
        <span class="text-2xl">${d.emoji}</span>
        <div class="min-w-0 flex-1"><div class="truncate font-semibold">${esc(d.en)}</div><div class="truncate text-xs text-zinc-500">${sub}</div></div>
        <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEVEL_CLS[d.level]}">${d.level}</span>
      </div>
    </div>`;
}

function backHandler() {
  C.app.querySelector('[data-act="back"]').onclick = () => { stop(); const daily = R?.daily; R = null; daily ? C.renderHome() : renderList(); };
}

// ขั้น 1: ฟังบทสนทนาทั้งหมดก่อน
function startDialog(d, daily) {
  stop();
  R = { d, daily, i: 0, right: 0, helped: 0 };
  window.scrollTo({ top: 0 });
  C.app.innerHTML = header(d, `ขั้น 1/2 · ฟังบทสนทนา · ${esc(d.th)}`) + `
    <main class="grid gap-4 pb-12 pt-4">
      <section class="${CARD} !p-4 text-sm">
        <div class="font-semibold">📍 ${esc(d.scene)}</div>
        <p class="mt-1 text-zinc-500">ฟังให้จบก่อน แล้วคุณจะได้เล่นเป็น <b class="text-purple-700 dark:text-purple-300">B (ฝั่งขวา สีม่วง)</b> พูดโต้ตอบด้วยไมค์</p>
      </section>
      <div class="flex flex-wrap gap-2">
        <button data-act="play" class="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white">${icon("speaker", "h-4 w-4")} ฟังทั้งบทสนทนา</button>
        <button data-act="th" class="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">ซ่อนคำแปล</button>
      </div>
      <div id="chat" class="grid gap-2.5">${d.lines.map(l => bubble(l)).join("")}</div>
      ${C.button('data-act="go"', `เริ่มเล่นบทบาท (คุณคือ B) ${icon("arrow", "ml-2 h-5 w-5")}`)}
    </main>`;
  backHandler();
  bindSay(C.app);
  let showTh = true;
  C.app.querySelector('[data-act="th"]').onclick = e => {
    showTh = !showTh;
    C.app.querySelectorAll("[data-th]").forEach(p => p.classList.toggle("hidden", !showTh));
    e.currentTarget.textContent = showTh ? "ซ่อนคำแปล" : "แสดงคำแปล";
  };
  C.app.querySelector('[data-act="play"]').onclick = () => playAll(d.lines);
  C.app.querySelector('[data-act="go"]').onclick = () => roleplay();
}

function playAll(lines, i = 0) {
  if (!R || i >= lines.length) return;
  const els = C.app.querySelectorAll("#chat > div");
  els.forEach((el, k) => el.classList.toggle("opacity-40", k !== i));
  speakThen(lines[i].en, () => {
    if (i + 1 >= lines.length) els.forEach(el => el.classList.remove("opacity-40"));
    setTimeout(() => playAll(lines, i + 1), 250);
  });
}

// พูดแล้วทำต่อ (มีตัวจับเวลาสำรอง เผื่อเบราว์เซอร์ไม่แจ้งว่าพูดจบ)
function speakThen(text, next) {
  let fired = false;
  const go = () => { if (!fired) { fired = true; next(); } };
  setTimeout(go, Math.max(2500, text.split(" ").length * 520));
  C.speak(text, go);
}

// ขั้น 2: เล่นบทบาท — แอปพูด A ผู้เรียนพูด B
function roleplay() {
  const d = R.d;
  R.i = 0; R.right = 0; R.helped = 0;
  const totalB = d.lines.filter(l => l.who === "B").length;
  window.scrollTo({ top: 0 });
  C.app.innerHTML = header(d, `ขั้น 2/2 · เล่นบทบาท · คุณคือ B`) + `
    <main class="grid gap-3 pb-6 pt-4">
      <div id="chat" class="grid gap-2.5"></div>
      <div id="turn" class="sticky bottom-0 -mx-4 bg-gradient-to-t from-zinc-50 from-80% to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 dark:from-zinc-950"></div>
    </main>`;
  backHandler();
  const chat = C.app.querySelector("#chat"), turn = C.app.querySelector("#turn");
  const add = html => {
    chat.insertAdjacentHTML("beforeend", html);
    bindSay(chat);
    chat.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" });
  };

  const step = () => {
    if (!R) return;
    if (R.i >= d.lines.length) return finishDialog(totalB);
    const line = d.lines[R.i];
    if (line.who === "A") {
      add(bubble(line));
      turn.innerHTML = `<p class="py-3 text-center text-sm text-zinc-500">🔊 กำลังฟังอีกฝ่ายพูด…</p>`;
      speakThen(line.en, () => { R.i++; step(); });
      return;
    }
    yourTurn(line);
  };

  const yourTurn = line => {
    const words = line.en.split(" ");
    const hint = words.slice(0, Math.min(2, words.length - 1)).join(" ") + " …";
    let tries = 0, helped = false;
    turn.innerHTML = `
      <section class="${CARD} !p-4 grid gap-3 text-center ring-2 !ring-purple-300 dark:!ring-purple-500/40">
        <div class="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-300">ตาคุณพูด (B)</div>
        <p class="text-xl font-semibold">${esc(line.th)}</p>
        <p data-hint class="text-zinc-500">คำใบ้: <span class="font-medium text-zinc-800 dark:text-zinc-200">${esc(hint)}</span></p>
        <div id="mic" class="grid gap-2"></div>
        <div class="flex flex-wrap justify-center gap-2">
          <button data-act="show" class="rounded-full bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">👀 ดูประโยคเต็ม</button>
          <button data-act="model" class="rounded-full bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">🔊 ฟังตัวอย่าง</button>
          <button data-act="skip" class="rounded-full bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">ข้าม</button>
        </div>
      </section>`;
    const pass = (heard, ok) => {
      if (ok && !helped) R.right++;
      else R.helped++;
      add(bubble(line, { note: heard ? `${ok ? "✓" : "↪"} คุณพูดว่า: “${esc(heard)}”` : "↪ ข้ามประโยคนี้" }));
      turn.innerHTML = "";
      R.i++;
      setTimeout(step, ok ? 500 : 900);
    };
    const w = micWidget(turn.querySelector("#mic"), {
      target: line.en, lang: C.store.settings.accent || "en-US", esc,
      onResult: (heard, ok) => {
        if (ok) return setTimeout(() => pass(heard, true), 700);
        tries++;
        w.status.innerHTML = `ยังไม่ตรง คำสีแดงคือคำที่ต่างไป ลองอีกครั้ง${tries >= 2 ? " หรือกด <b>ดูประโยคเต็ม</b> / <b>ฟังตัวอย่าง</b>" : ""}`;
      },
    });
    turn.querySelector('[data-act="show"]').onclick = e => {
      helped = true;
      turn.querySelector("[data-hint]").innerHTML = `อ่านออกเสียง: <span class="font-semibold text-zinc-900 dark:text-zinc-100">${esc(line.en)}</span>`;
      e.currentTarget.remove();
    };
    turn.querySelector('[data-act="model"]').onclick = () => { helped = true; stopListening(true); C.speak(line.en, null, 0.75); };
    turn.querySelector('[data-act="skip"]').onclick = () => { stopListening(true); C.speak(line.en); pass(null, false); };
  };
  step();
}

function finishDialog(totalB) {
  const d = R.d;
  const p = progress();
  const prev = p[d.id] || { times: 0, best: 0 };
  p[d.id] = { times: prev.times + 1, best: Math.max(prev.best || 0, R.right), last: C.daily().date };
  const day = C.daily();
  day.dialogs = (day.dialogs || 0) + 1;
  C.save();
  const stars = R.right === totalB ? 3 : R.right >= totalB / 2 ? 2 : 1;
  const nxt = nextDialog();
  const turn = C.app.querySelector("#turn");
  turn.innerHTML = `
    <section class="${CARD} grid gap-3 text-center">
      <div class="text-4xl">${"⭐".repeat(stars)}</div>
      <p class="text-xl font-bold">จบบทสนทนาแล้ว! พูดเองได้ ${R.right}/${totalB} ประโยค</p>
      <p class="text-sm text-zinc-500">${R.right === totalB ? "เยี่ยมมาก ลองบทถัดไปหรือฝึกบทนี้อีกครั้งโดยไม่ดูคำใบ้" : "ลองฝึกบทนี้อีกครั้ง ประโยคที่ใช้ตัวช่วยจะง่ายขึ้นเมื่อพูดซ้ำ"}</p>
      ${R.daily ? C.button('data-act="home"', `ภารกิจนี้เสร็จแล้ว · ไปภารกิจถัดไป ${icon("arrow", "ml-2 h-5 w-5")}`) : ""}
      <div class="grid grid-cols-2 gap-2.5">
        ${C.button('data-act="again"', "ฝึกบทนี้อีกครั้ง", "ghost")}
        ${C.button('data-act="next"', nxt && nxt.id !== d.id ? "บทถัดไป" : "ดูบทสนทนาทั้งหมด", "ghost")}
      </div>
    </section>`;
  turn.querySelector('[data-act="home"]')?.addEventListener("click", () => { R = null; C.renderHome(); });
  turn.querySelector('[data-act="again"]').onclick = () => roleplay();
  turn.querySelector('[data-act="next"]').onclick = () => (nxt && nxt.id !== d.id ? startDialog(nxt, R.daily) : renderList());
}
