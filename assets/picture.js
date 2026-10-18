// โหมดฝึกอธิบายภาพ (Picture Talk): Hotspot คำศัพท์ในภาพ → กรอบความคิด 3 ส่วน → ฝึก 3 ระดับ
// Level 1 เลือกคำตอบ/เรียงประโยค · Level 2 เติมคำ · Level 3 พูด/เขียนอิสระ + ตรวจ + ฟังคำตอบตัวอย่าง
// ใช้ helper จาก app.js ผ่าน ctx เพื่อไม่ให้ import วนกัน

const BAG_KEY = "english-lessons:picbag";
const AI_KEY = "english-lessons:anthropic-key";
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";

let C = null; // ctx จาก app.js
let pics = [];
let pic = null;
let level = 1;

const STARTERS = [
  { en: "This picture shows ...", th: "ภาพนี้แสดง…", part: "overview" },
  { en: "It looks like they are in ...", th: "ดูเหมือนพวกเขาอยู่ใน…", part: "overview" },
  { en: "In the foreground, I can see ...", th: "ด้านหน้า ฉันเห็น…", part: "details" },
  { en: "In the background, there is ...", th: "ด้านหลังมี…", part: "details" },
  { en: "On the left side of the picture, there is ...", th: "ทางซ้ายของภาพมี…", part: "details" },
  { en: "On the right, a man is ...", th: "ทางขวา ผู้ชายคนหนึ่งกำลัง…", part: "details" },
  { en: "Next to the ..., there is ...", th: "ข้างๆ … มี…", part: "details" },
  { en: "It looks like they are ...", th: "ดูเหมือนพวกเขากำลัง…", part: "inference" },
  { en: "They seem ... because ...", th: "พวกเขาดู… เพราะ…", part: "inference" },
  { en: "Maybe they are going to ...", th: "บางทีพวกเขาอาจจะ…", part: "inference" },
];

const FRAME = [
  { key: "overview", n: 1, en: "Overview / Setting", th: "ภาพรวม: ที่ไหน ทำอะไรกันอยู่",
    tips: ["This picture shows ...", "In a coffee shop / At a business meeting"] },
  { key: "details", n: 2, en: "Details & Positions", th: "รายละเอียด: ใครทำอะไร อยู่ตรงไหน",
    tips: ["In the foreground (ข้างหน้า) · In the background (ข้างหลัง)", "On the left / right (ซ้าย/ขวา) · Next to (ข้างๆ)", "Present Continuous: A man is drinking coffee."] },
  { key: "inference", n: 3, en: "Inference / Context", th: "คาดเดาบริบท: บรรยากาศ ความรู้สึก",
    tips: ["They look happy.", "It seems like a busy morning."] },
];

// ---------- data ----------
async function loadPics() {
  if (pics.length) return;
  const res = await fetch("data/pictures.json");
  if (!res.ok) throw new Error(`โหลดรูปภาพไม่สำเร็จ (${res.status})`);
  pics = (await res.json()).pictures;
}

// สุ่มแบบไม่ซ้ำจนกว่าจะครบทั้ง 10 ภาพ และไม่ให้ภาพแรกของรอบใหม่ซ้ำกับภาพล่าสุด
function pickRandom(exclude) {
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem(BAG_KEY)) || []; } catch { /* ข้าม */ }
  bag = bag.filter(id => pics.some(p => p.id === id) && id !== exclude);
  if (!bag.length) bag = pics.map(p => p.id).filter(id => id !== exclude);
  const id = bag[Math.floor(Math.random() * bag.length)];
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bag.filter(x => x !== id))); } catch { /* ข้าม */ }
  return pics.find(p => p.id === id);
}

// ---------- SRS: เพิ่มคำจากภาพเข้าคิวทบทวน ----------
// คำที่อยู่ในคลัง 3,000 คำใช้การ์ดเดิม ส่วนคำใหม่สร้างเป็นคำเสริม (store.custom) แล้วเข้าคิววันนี้
export function customEntry(p, h) {
  const re = new RegExp(`\\b${h.word}\\b`, "i");
  const useAction = re.test(h.action);
  return {
    id: `pic-${p.id}-${h.word.toLowerCase().replace(/\W+/g, "-")}`,
    word: h.word, ipa: h.ipa, pos: h.pos, meaning: h.meaning, emoji: h.emoji, answer: h.word,
    collocation: useAction ? h.action : h.phrase, collocationTh: useAction ? h.actionTh : h.phraseTh,
    cloze: h.sentence.replace(re, "___"), clozeTh: h.sentenceTh,
    simple: `I can see ${h.phrase}.`.replace(re, "___"), simpleTh: `ฉันเห็น${h.phraseTh}`,
    source: p.id,
  };
}

function srsIdFor(h) {
  const base = C.byWord[h.word.toLowerCase()];
  if (base?.id && C.byId[base.id]) return base.id; // คำในบทเรียนหลัก
  return customEntry(pic, h).id;
}

const inQueue = h => !!C.store.cards[srsIdFor(h)];

function addToQueue(h) {
  const id = srsIdFor(h);
  if (C.store.cards[id]) return false;
  if (!C.byId[id]) {
    const e = customEntry(pic, h);
    C.store.custom = { ...(C.store.custom || {}), [id]: e };
    C.addWord(e);
  }
  C.store.cards[id] = C.srs.newCard(C.daily().date); // ถึงรอบวันนี้ จึงขึ้นในช่วงทบทวนทันที
  C.save();
  return true;
}

// ---------- UI helpers ----------
const esc = s => C.esc(s);
const icon = (...a) => C.icon(...a);
const label = t => `<div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">${t}</div>`;
const pill = (attrs, text, active = false) =>
  `<button ${attrs} class="rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${active
    ? "bg-purple-600 text-white ring-purple-600"
    : "bg-white text-zinc-700 ring-zinc-200 hover:ring-purple-300 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"}">${text}</button>`;

function bindSay(root) {
  root.querySelectorAll("[data-say]").forEach(b => (b.onclick = e => { e.stopPropagation(); C.speak(b.dataset.say); }));
  root.querySelectorAll("[data-say-slow]").forEach(b => (b.onclick = e => { e.stopPropagation(); C.speak(b.dataset.saySlow, null, 0.55); }));
}

// เล่นหลายประโยคต่อกัน (ใช้ฟังคำตอบตัวอย่างทั้งย่อหน้า)
function speakAll(list, i = 0) {
  if (i >= list.length) return;
  C.speak(list[i], () => setTimeout(() => speakAll(list, i + 1), 250));
}

// ---------- page ----------
export async function openPictures(ctx, keepPic = false) {
  C = ctx;
  C.unlockAudio();
  try { await loadPics(); } catch (e) { C.app.innerHTML = `<p class="py-10 text-center text-rose-600">${esc(e.message)}</p>`; return; }
  if (!keepPic || !pic) pic = pickRandom(pic?.id);
  level = 1;
  render();
}

function render() {
  const p = pic;
  const ratio = (p.h / p.w) * 100;
  C.app.innerHTML = `
    <header class="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-zinc-50/85 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md dark:bg-zinc-950/85">
      <button data-act="close" aria-label="ปิด" class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800">${icon("close")}</button>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">Picture Talk <span class="font-normal text-zinc-400">· ฝึกอธิบายภาพ</span></div>
        <div class="truncate text-xs text-zinc-500">${esc(p.title)} · ${esc(p.titleTh)}</div>
      </div>
      <button data-act="new-pic" class="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-purple-700 ring-1 ring-purple-200 hover:bg-purple-50 dark:bg-zinc-900 dark:text-purple-300 dark:ring-purple-500/30">${icon("repeat", "h-4 w-4")} ภาพใหม่</button>
    </header>

    <main class="grid gap-4 pb-10 pt-2 md:grid-cols-[3fr_2fr] md:items-start">
      <section class="animate-pop">
        <div id="pic" class="relative overflow-hidden rounded-[24px] bg-zinc-200 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-800" style="padding-top:${ratio}%">
          <img src="${esc(p.src)}" alt="${esc(p.title)}" class="absolute inset-0 h-full w-full object-cover" loading="eager" referrerpolicy="no-referrer">
          ${p.hotspots.map((h, i) => `
            <button data-hot="${i}" aria-label="${esc(h.word)}" style="left:${h.x}%;top:${h.y}%"
              class="group absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-sm font-bold text-purple-700 shadow-lg ring-2 ring-purple-500 transition hover:scale-110">
              <span data-ring class="absolute inset-0 hidden animate-ping rounded-full bg-amber-400/70"></span>
              <span class="relative">${i + 1}</span>
            </button>`).join("")}
        </div>
        <p class="mt-1.5 text-right text-[11px] text-zinc-400">Photo: <a class="underline" href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.author)}</a> / Unsplash</p>
      </section>

      <section class="${CARD()} !p-5">
        ${label("คำศัพท์และก้อนคำในภาพ · แตะเพื่อดู")}
        <ul class="mt-3 grid gap-1.5">
          ${p.hotspots.map((h, i) => `
            <li><button data-hot="${i}" class="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">${i + 1}</span>
              <span class="min-w-0 flex-1"><span class="font-semibold">${esc(h.phrase)}</span><span class="block truncate text-sm text-zinc-500">${esc(h.action)}</span></span>
              ${inQueue(h) ? `<span class="text-teal-600" title="อยู่ในคิวทบทวนแล้ว">${icon("check", "h-4 w-4")}</span>` : ""}
            </button></li>`).join("")}
        </ul>
      </section>

      <details class="${CARD()} !p-5 md:col-span-2" ${localStorage.getItem("english-lessons:frame-seen") ? "" : "open"}>
        <summary class="flex cursor-pointer list-none items-center justify-between font-semibold">สูตรการมองภาพ 3 ขั้น <span class="text-xs font-normal text-zinc-400">Description Framework</span></summary>
        <ol class="mt-4 grid gap-3 md:grid-cols-3">
          ${FRAME.map(f => `<li class="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <div class="flex items-center gap-2"><span class="grid h-6 w-6 place-items-center rounded-full bg-purple-600 text-xs font-bold text-white">${f.n}</span><b>${f.en}</b></div>
            <div class="mt-1 text-sm text-zinc-500">${f.th}</div>
            <ul class="mt-2 grid gap-1 text-sm">${f.tips.map(t => `<li class="text-zinc-700 dark:text-zinc-300">• ${esc(t)}</li>`).join("")}</ul>
          </li>`).join("")}
        </ol>
      </details>

      <section class="md:col-span-2">
        <div class="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          ${[[1, "Level 1", "เลือก/เรียง"], [2, "Level 2", "เติมคำ"], [3, "Level 3", "พูดอิสระ"]].map(([n, a, b]) => `
            <button data-level="${n}" class="flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${level === n
              ? "bg-white text-purple-700 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}">${a}<span class="block text-xs font-normal">${b}</span></button>`).join("")}
        </div>
        <div id="practice" class="mt-4"></div>
      </section>
    </main>`;

  C.app.querySelector('[data-act="close"]').onclick = () => { window.speechSynthesis?.cancel(); stopMic(); C.renderHome(); };
  C.app.querySelector('[data-act="new-pic"]').onclick = () => { stopMic(); pic = pickRandom(pic.id); level = 1; render(); window.scrollTo({ top: 0 }); };
  C.app.querySelectorAll("[data-hot]").forEach(b => (b.onclick = () => showHotspot(Number(b.dataset.hot))));
  C.app.querySelectorAll("[data-level]").forEach(b => (b.onclick = () => { stopMic(); level = Number(b.dataset.level); render(); C.app.querySelector("#practice").scrollIntoView({ block: "start", behavior: "smooth" }); }));
  C.app.querySelector("details").addEventListener("toggle", () => { try { localStorage.setItem("english-lessons:frame-seen", "1"); } catch { /* ข้าม */ } });
  ({ 1: level1, 2: level2, 3: level3 })[level]();
}

const CARD = () => "rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800";

function highlight(i) {
  C.app.querySelectorAll("#pic [data-hot]").forEach(b => {
    const on = Number(b.dataset.hot) === i;
    b.querySelector("[data-ring]").classList.toggle("hidden", !on);
    b.classList.toggle("!bg-amber-300", on);
    b.classList.toggle("!ring-amber-500", on);
  });
}

// ---------- hotspot sheet ----------
function showHotspot(i) {
  const h = pic.hotspots[i];
  highlight(i);
  document.getElementById("word-pop")?.remove();
  const row = (lab, en, th) => `<div class="flex items-start gap-3 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
      <div class="min-w-0 flex-1">${label(lab)}<div class="mt-0.5 text-lg">${C.hl(en, h.word)}</div><div class="text-sm text-zinc-500">${esc(th)}</div></div>
      ${C.sayBtn(en)}</div>`;
  const el = document.createElement("div");
  el.id = "word-pop";
  el.className = "fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-3 backdrop-blur-[2px] md:items-center";
  el.innerHTML = `
    <div role="dialog" class="animate-pop max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div class="flex items-start gap-4">
        <div class="text-4xl">${h.emoji}</div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2"><span class="text-3xl font-bold tracking-tight">${esc(h.word)}</span>
            <span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">${esc(h.pos)}</span></div>
          <div class="text-zinc-500">${esc(h.ipa)}</div>
          <div class="mt-1 text-lg font-semibold text-purple-700 dark:text-purple-300">${esc(h.meaning)}</div>
        </div>
        ${C.sayBtn(h.word, "md")}
      </div>
      <div class="mt-4 grid gap-2">
        ${row("คุณศัพท์ + คำนาม", h.phrase, h.phraseTh)}
        ${row("ก้อนคำแอ็กชัน", h.action, h.actionTh)}
        ${row("ประโยคอธิบายภาพ", h.sentence, h.sentenceTh)}
      </div>
      <div class="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button data-add class="rounded-2xl px-4 py-3 font-semibold ${inQueue(h)
          ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
          : "bg-purple-600 text-white hover:bg-purple-700"}" ${inQueue(h) ? "disabled" : ""}>${inQueue(h) ? `${icon("check", "mr-1 h-4 w-4 align-[-2px]")} อยู่ในคิวทบทวนแล้ว` : "+ เพิ่มเข้าคิวทบทวนวันนี้"}</button>
        <button data-pop-close class="rounded-2xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">ปิด</button>
      </div>
    </div>`;
  document.body.append(el);
  bindSay(el);
  el.onclick = ev => {
    const w = ev.target.closest("[data-w]");
    if (w) { ev.stopPropagation(); return C.showWordPopup(w.dataset.w); }
    if (ev.target === el || ev.target.closest("[data-pop-close]")) { el.remove(); highlight(-1); }
  };
  el.querySelector("[data-add]").onclick = e => {
    e.stopPropagation();
    if (addToQueue(h)) {
      const b = e.currentTarget;
      b.disabled = true;
      b.className = "rounded-2xl bg-teal-50 px-4 py-3 font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300";
      b.innerHTML = `${icon("check", "mr-1 h-4 w-4 align-[-2px]")} เพิ่มแล้ว ทบทวนได้วันนี้`;
      const li = C.app.querySelector(`ul [data-hot="${i}"]`);
      if (li && !li.querySelector(".text-teal-600")) li.insertAdjacentHTML("beforeend", `<span class="text-teal-600">${icon("check", "h-4 w-4")}</span>`);
    }
  };
  C.speak(h.word);
}

// ---------- Level 1: เลือกคำตอบ + เรียงประโยค ----------
function level1() {
  const box = C.app.querySelector("#practice");
  const others = pics.filter(p => p.id !== pic.id);
  const people = others.flatMap(p => p.hotspots.filter(h => h.answer).map(h => h.answer));
  const qs = [];
  qs.push({ q: "Where is this?", th: "ภาพนี้คือที่ไหน", answer: cap(pic.setting) + ".",
    options: [cap(pic.setting) + ".", ...C.shuffle(others).slice(0, 3).map(p => cap(p.setting) + ".")] });
  C.shuffle(pic.hotspots.map((h, i) => ({ h, i })).filter(x => x.h.question)).slice(0, 2).forEach(({ h, i }) =>
    qs.push({ q: h.question, th: "ดูจุดที่กระพริบในภาพ", hot: i, answer: h.answer,
      options: [h.answer, ...C.shuffle(people).slice(0, 3)] }));
  const objs = pic.hotspots.map((h, i) => ({ h, i })).filter(x => !x.h.question);
  C.shuffle(objs).slice(0, 2).forEach(({ h, i }) => qs.push({ q: "What is this?", th: "จุดที่กระพริบคืออะไร", hot: i, answer: cap(h.phrase),
    options: [cap(h.phrase), ...C.shuffle(pic.hotspots.filter(x => x !== h)).slice(0, 3).map(x => cap(x.phrase))] }));
  const detail = C.shuffle(pic.model.filter(m => m.part === "details" && C.srs.usableSentence(m.en)))[0];
  let idx = 0, right = 0;

  const header = n => `<div class="mb-3 flex items-center justify-between text-sm text-zinc-500"><span>Level 1 · ข้อ ${n} / ${qs.length + 1}</span><span>ถูก ${right}</span></div>`;

  function ask() {
    if (idx >= qs.length) return order();
    const q = qs[idx];
    highlight(q.hot ?? -1);
    if (q.hot != null) C.app.querySelector("#pic").scrollIntoView({ block: "nearest", behavior: "smooth" });
    box.innerHTML = header(idx + 1) + `<div class="${CARD()}">
      <div class="flex items-start gap-3"><p class="flex-1 text-xl font-semibold">${esc(q.q)}</p>${C.sayBtn(q.q)}</div>
      <p class="mt-1 text-sm text-zinc-500">${esc(q.th)}</p>
      <div class="mt-4 grid gap-2.5">${C.shuffle([...new Set(q.options)]).map((o, i) => `
        <button data-opt="${esc(o)}" class="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left font-medium ring-1 ring-zinc-200 transition hover:ring-purple-300 dark:bg-zinc-900 dark:ring-zinc-700">
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">${i + 1}</span><span class="flex-1">${esc(o)}</span></button>`).join("")}</div>
      <div id="l1-next" class="mt-4"></div></div>`;
    bindSay(box);
    C.speak(q.q);
    box.querySelectorAll("[data-opt]").forEach(b => (b.onclick = () => {
      const ok = b.dataset.opt === q.answer;
      if (ok) right++;
      box.querySelectorAll("[data-opt]").forEach(x => {
        x.disabled = true;
        if (x.dataset.opt === q.answer) x.classList.add("!ring-2", "!ring-teal-500", "bg-teal-50", "dark:bg-teal-500/10");
        else if (x === b) x.classList.add("!ring-2", "!ring-rose-500", "bg-rose-50", "dark:bg-rose-500/10");
        else x.classList.add("opacity-50");
      });
      C.speak(q.answer);
      box.querySelector("#l1-next").innerHTML = C.button('data-act="l1-next"', `ต่อไป ${icon("arrow", "ml-2 h-5 w-5")}`);
      box.querySelector('[data-act="l1-next"]').onclick = () => { idx++; ask(); };
    }));
  }

  // ข้อสุดท้าย: เรียงคำเป็นประโยคอธิบายภาพ
  function order() {
    highlight(-1);
    const { toks, tiles, end } = C.srs.tokenizeSentence(detail.en);
    let pool = C.shuffle(tiles.map((t, i) => i));
    if (pool.every((v, i) => v === i)) pool = pool.reverse();
    let picked = [];
    box.innerHTML = header(qs.length + 1) + `<div class="${CARD()}">
      <p class="text-xl font-semibold">เรียงคำเป็นประโยคอธิบายภาพ</p>
      <p class="mt-1 text-sky-700 dark:text-sky-300">${esc(detail.th)}</p>
      <div id="ans" class="mt-4 flex min-h-[60px] flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-3 dark:border-zinc-700"></div>
      <div id="pool" class="mt-4 flex flex-wrap justify-center gap-2"></div>
      <p id="msg" class="mt-3 hidden"></p>
      <div class="mt-4 grid grid-cols-[auto_1fr] gap-3">
        <button data-act="clear" class="rounded-2xl px-5 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700">ล้าง</button>
        ${C.button('data-act="check" disabled', "ตรวจประโยค")}
      </div></div>`;
    const ans = box.querySelector("#ans"), poolEl = box.querySelector("#pool"), check = box.querySelector('[data-act="check"]');
    const tile = "rounded-xl px-3.5 py-2 text-lg font-medium shadow-sm ring-1 transition active:scale-95";
    const draw = () => {
      ans.innerHTML = picked.map((p, k) => `<button data-k="${k}" class="${tile} bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30">${esc(tiles[p])}</button>`).join("")
        + (picked.length === tiles.length ? `<span class="self-center text-lg">${esc(end)}</span>` : "");
      poolEl.innerHTML = pool.map(p => `<button data-p="${p}" class="${tile} bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 ${picked.includes(p) ? "pointer-events-none opacity-0" : ""}">${esc(tiles[p])}</button>`).join("");
      check.disabled = picked.length !== tiles.length;
      poolEl.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => { picked.push(Number(b.dataset.p)); draw(); }));
      ans.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => { picked.splice(Number(b.dataset.k), 1); draw(); }));
    };
    draw();
    box.querySelector('[data-act="clear"]').onclick = () => { picked = []; draw(); };
    check.onclick = () => {
      const msg = box.querySelector("#msg");
      if (!C.srs.isCorrectOrder(picked.map(p => tiles[p]), toks)) {
        msg.className = "mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200";
        msg.innerHTML = `ยังไม่ถูก ประโยคที่ถูกคือ<br><b>${esc(detail.en)}</b><br><span class="text-sm">ลองเรียงใหม่อีกครั้ง</span>`;
        picked = []; draw(); C.speak(detail.en);
        return;
      }
      right++;
      C.speak(detail.en);
      box.innerHTML = `<div class="${CARD()} text-center">
        <div class="text-5xl">🎯</div>
        <p class="mt-3 text-xl font-bold">Level 1 เสร็จแล้ว · ถูก ${right} / ${qs.length + 1}</p>
        <p class="mt-1 text-zinc-500">ประโยค “${esc(detail.en)}” ถูกต้อง ลองพูดตาม 1 รอบ</p>
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          ${C.button('data-act="again"', "ทำ Level 1 อีกรอบ", "ghost")}
          ${C.button('data-act="go2"', `ไป Level 2 ${icon("arrow", "ml-2 h-5 w-5")}`)}
        </div></div>`;
      box.querySelector('[data-act="again"]').onclick = level1;
      box.querySelector('[data-act="go2"]').onclick = () => { level = 2; render(); C.app.querySelector("#practice").scrollIntoView({ block: "start" }); };
    };
  }
  ask();
}

const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- Level 2: เติมคำในประโยคอธิบายภาพ ----------
function level2() {
  const box = C.app.querySelector("#practice");
  const model = pic.model;
  const bank = model.map(m => m.blank);
  let idx = 0, right = 0;
  const done = [];

  function ask() {
    if (idx >= model.length) return summary();
    const m = model[idx];
    const re = new RegExp(`\\b${m.blank}\\b`);
    const [before, after] = m.en.split(re);
    const part = FRAME.find(f => f.key === m.part);
    box.innerHTML = `<div class="mb-3 flex items-center justify-between text-sm text-zinc-500"><span>Level 2 · ประโยค ${idx + 1} / ${model.length}</span><span>ถูก ${right}</span></div>
      <div class="${CARD()}">
        <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">${part.n}. ${part.en}</div>
        ${done.length ? `<div class="mb-4 grid gap-1 border-b border-zinc-100 pb-4 text-zinc-500 dark:border-zinc-800">${done.map(d => `<p>${C.tapWords(d)}</p>`).join("")}</div>` : ""}
        <p class="text-2xl leading-relaxed">${C.tapWords(before)}<span class="mx-1 inline-block min-w-24 border-b-[3px] border-dashed border-purple-400">&nbsp;</span>${C.tapWords(after)}</p>
        <button data-act="hint" class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">${icon("bulb", "h-4 w-4")} ดูคำแปล</button>
        <p id="hint" class="mt-2 hidden text-zinc-500">${esc(m.th)}</p>
        <form id="f" class="mt-5 grid gap-3">
          <input id="in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="พิมพ์คำที่หายไป"
            class="w-full rounded-2xl bg-white px-5 py-3.5 text-lg ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:ring-zinc-700">
          <div class="grid grid-cols-[1fr_auto] gap-3">${C.button('type="submit"', "ตรวจคำตอบ")}
            <button type="button" data-act="choices" class="rounded-2xl px-4 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700">ขอตัวเลือก</button></div>
        </form>
        <div id="res" class="mt-4"></div>
      </div>`;
    box.querySelector('[data-act="hint"]').onclick = e => { box.querySelector("#hint").classList.remove("hidden"); e.currentTarget.remove(); };
    const check = v => {
      const ok = v.trim().toLowerCase().replace(/[.!?]/g, "") === m.blank.toLowerCase();
      if (ok) right++;
      done.push(m.en);
      box.querySelector("#f").remove();
      box.querySelector("#res").innerHTML = `
        <div class="rounded-2xl ${ok ? "bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200" : "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"} px-4 py-3">
          ${ok ? "ถูกต้อง!" : `คำตอบคือ “<b>${esc(m.blank)}</b>”`}
          <div class="mt-1 flex items-start gap-3"><p class="flex-1 text-lg text-zinc-900 dark:text-zinc-100">${C.hl(m.en, m.blank)}</p>${C.sayBtn(m.en)}</div>
          <p class="text-sm opacity-80">${esc(m.th)}</p>
        </div>
        <div class="mt-3">${C.button('data-act="next"', `ต่อไป ${icon("arrow", "ml-2 h-5 w-5")}`)}</div>`;
      bindSay(box);
      C.speak(m.en);
      box.querySelector('[data-act="next"]').onclick = () => { idx++; ask(); };
    };
    const input = box.querySelector("#in");
    box.querySelector("#f").onsubmit = e => { e.preventDefault(); if (input.value.trim()) check(input.value); };
    box.querySelector('[data-act="choices"]').onclick = () => {
      const opts = C.shuffle([m.blank, ...C.shuffle(bank.filter(b => b !== m.blank)).slice(0, 3)]);
      box.querySelector("#f").innerHTML = `<div class="grid grid-cols-2 gap-2.5">${opts.map(o => C.button(`type="button" data-o="${esc(o)}"`, esc(o), "ghost")).join("")}</div>`;
      box.querySelectorAll("[data-o]").forEach(b => (b.onclick = () => check(b.dataset.o)));
    };
  }

  function summary() {
    box.innerHTML = `<div class="${CARD()}">
      <div class="text-center"><div class="text-5xl">📝</div><p class="mt-3 text-xl font-bold">Level 2 เสร็จแล้ว · ถูก ${right} / ${model.length}</p>
      <p class="mt-1 text-zinc-500">นี่คือคำอธิบายภาพฉบับเต็ม ฟังแล้วพูดตาม (Shadowing)</p></div>
      ${modelBlock()}
      <div class="mt-5 grid gap-3 sm:grid-cols-2">${C.button('data-act="again"', "ทำ Level 2 อีกรอบ", "ghost")}${C.button('data-act="go3"', `ไป Level 3 ${icon("arrow", "ml-2 h-5 w-5")}`)}</div></div>`;
    bindModel(box);
    box.querySelector('[data-act="again"]').onclick = level2;
    box.querySelector('[data-act="go3"]').onclick = () => { level = 3; render(); C.app.querySelector("#practice").scrollIntoView({ block: "start" }); };
  }
  ask();
}

// คำอธิบายภาพตัวอย่าง แบ่งตามกรอบ 3 ส่วน พร้อมปุ่มฟังทีละประโยคและฟังทั้งหมด
function modelBlock() {
  return `<div class="mt-5 grid gap-3">
    ${FRAME.map(f => {
      const ms = pic.model.filter(m => m.part === f.key);
      return `<div class="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
        ${label(`${f.n}. ${f.en}`)}
        ${ms.map(m => `<div class="mt-2 flex items-start gap-3"><div class="min-w-0 flex-1"><p class="text-lg leading-snug">${C.tapWords(m.en)}</p><p class="text-sm text-zinc-500">${esc(m.th)}</p></div>${C.sayBtn(m.en)}</div>`).join("")}
      </div>`;
    }).join("")}
    <div class="flex flex-wrap gap-2">
      <button data-act="play-all" class="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">${icon("speaker", "h-4 w-4")} ฟังทั้งหมด</button>
      <button data-act="stop-all" class="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">หยุด</button>
    </div>
  </div>`;
}

function bindModel(root) {
  bindSay(root);
  root.querySelector('[data-act="play-all"]').onclick = () => speakAll(pic.model.map(m => m.en));
  root.querySelector('[data-act="stop-all"]').onclick = () => window.speechSynthesis?.cancel();
}

// ---------- Level 3: พูด/เขียนอิสระ ----------
let rec = null, recTimer = null;
function stopMic() {
  clearInterval(recTimer);
  recTimer = null;
  try { rec?.stop(); } catch { /* ข้าม */ }
  rec = null;
}

function level3() {
  const box = C.app.querySelector("#practice");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasKey = !!getKey();
  box.innerHTML = `<div class="${CARD()}">
    <div class="flex items-start gap-3"><p class="flex-1 text-xl font-semibold">Describe what you see in this picture.</p>${C.sayBtn("Describe what you see in this picture.")}</div>
    <p class="mt-1 text-sm text-zinc-500">อธิบายภาพ 15–30 วินาที ใช้สูตร 3 ขั้น: ภาพรวม → รายละเอียดและตำแหน่ง → คาดเดาบริบท</p>

    <div class="mt-4">${label("ตัวช่วยเปิดประโยค · แตะเพื่อใส่ในกล่อง")}
      <div class="mt-2 flex flex-wrap gap-2">${STARTERS.map((s, i) => pill(`data-st="${i}" title="${esc(s.th)}"`, esc(s.en))).join("")}</div>
    </div>

    <div class="mt-4 grid gap-3">
      <div class="flex items-center gap-3">
        <button data-act="mic" ${SR ? "" : "disabled"} class="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-40">
          <span class="text-lg">🎙️</span><span id="mic-label">กดเพื่อพูด</span></button>
        <span id="mic-status" class="text-sm text-zinc-500">${SR ? "พูดเป็นภาษาอังกฤษ ระบบจะแปลงเสียงเป็นข้อความ (สูงสุด 30 วินาที)" : "เบราว์เซอร์นี้ไม่รองรับการแปลงเสียง ให้พิมพ์ หรือใช้ปุ่มไมค์บนคีย์บอร์ด"}</span>
      </div>
      <textarea id="desc" rows="6" placeholder="This picture shows ..." class="w-full rounded-2xl bg-white px-4 py-3 text-lg leading-relaxed ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:ring-zinc-700"></textarea>
      <div class="grid gap-3 sm:grid-cols-2">
        ${C.button('data-act="check3"', "ตรวจคำอธิบาย")}
        ${C.button('data-act="show-model"', "ดูคำตอบตัวอย่าง", "ghost")}
      </div>
    </div>
    <div id="fb" class="mt-5"></div>

    <details class="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/60">
      <summary class="cursor-pointer font-semibold">AI ปรับประโยค (ไม่บังคับ) ${hasKey ? `<span class="ml-1 text-teal-600">· เปิดใช้แล้ว</span>` : ""}</summary>
      <p class="mt-2 text-zinc-500">ตรวจแบบพื้นฐานใช้ได้ฟรีเสมอ ถ้าต้องการให้ Claude ดูภาพจริง ตรวจไวยากรณ์ และเขียนฉบับเจ้าของภาษา ให้ใส่ Anthropic API key ของคุณเอง
        คีย์เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งตรงไปที่ api.anthropic.com (มีค่าใช้จ่ายตามการใช้งานในบัญชีของคุณ ใช้เฉพาะเครื่องส่วนตัว)</p>
      <div class="mt-3 flex gap-2">
        <input id="key" type="password" autocomplete="off" placeholder="${hasKey ? "มีคีย์บันทึกไว้แล้ว" : "sk-ant-..."}" class="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700">
        <button data-act="save-key" class="rounded-xl bg-purple-600 px-4 font-semibold text-white">บันทึก</button>
        ${hasKey ? `<button data-act="del-key" class="rounded-xl px-3 text-rose-600 ring-1 ring-rose-200">ลบ</button>` : ""}
      </div>
    </details>
  </div>`;
  bindSay(box);
  const ta = box.querySelector("#desc");
  box.querySelectorAll("[data-st]").forEach(b => (b.onclick = () => {
    const s = STARTERS[Number(b.dataset.st)].en.replace(/ \.\.\.$/, " ");
    ta.value = (ta.value.trim() ? ta.value.trimEnd() + " " : "") + s;
    ta.focus();
    const pos = ta.value.indexOf("...") >= 0 ? ta.value.indexOf("...") : ta.value.length;
    ta.setSelectionRange(pos, ta.value.indexOf("...") >= 0 ? pos + 3 : pos);
  }));
  box.querySelector('[data-act="mic"]').onclick = () => toggleMic(box, ta);
  box.querySelector('[data-act="check3"]').onclick = () => { stopMic(); feedback(box, ta.value); };
  box.querySelector('[data-act="show-model"]').onclick = () => {
    const fb = box.querySelector("#fb");
    fb.innerHTML = `<div class="rounded-2xl ring-1 ring-zinc-200 p-4 dark:ring-zinc-800">${label("คำตอบตัวอย่าง (Model answer)")}${modelBlock()}</div>`;
    bindModel(fb);
  };
  box.querySelector('[data-act="save-key"]').onclick = () => {
    const v = box.querySelector("#key").value.trim();
    if (!v) return;
    try { localStorage.setItem(AI_KEY, v); } catch { /* ข้าม */ }
    level3();
  };
  const del = box.querySelector('[data-act="del-key"]');
  if (del) del.onclick = () => { try { localStorage.removeItem(AI_KEY); } catch { /* ข้าม */ } level3(); };
}

function toggleMic(box, ta) {
  const lab = box.querySelector("#mic-label"), status = box.querySelector("#mic-status");
  if (rec) { stopMic(); lab.textContent = "กดเพื่อพูด"; status.textContent = "หยุดฟังแล้ว แก้ไขข้อความได้ แล้วกดตรวจ"; return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  window.speechSynthesis?.cancel();
  rec = new SR();
  rec.lang = C.store.settings.accent || "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  const base = ta.value.trim() ? ta.value.trimEnd() + " " : "";
  rec.onresult = e => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    ta.value = base + text.trim();
  };
  rec.onerror = e => {
    status.textContent = e.error === "not-allowed" || e.error === "service-not-allowed"
      ? "ไม่ได้รับอนุญาตให้ใช้ไมค์ (iPhone: ตั้งค่า > Safari > ไมโครโฟน และเปิด Siri & Dictation)"
      : `ไมค์มีปัญหา (${e.error}) ลองอีกครั้ง หรือพิมพ์แทน`;
  };
  rec.onend = () => { if (rec) { stopMic(); lab.textContent = "กดเพื่อพูด"; } };
  try { rec.start(); } catch { status.textContent = "เริ่มไมค์ไม่ได้ ลองอีกครั้ง"; rec = null; return; }
  let left = 30;
  lab.textContent = "หยุด";
  status.textContent = `กำลังฟัง… ${left} วินาที`;
  recTimer = setInterval(() => {
    left--;
    status.textContent = `กำลังฟัง… ${left} วินาที`;
    if (left <= 0) { stopMic(); lab.textContent = "กดเพื่อพูด"; status.textContent = "ครบ 30 วินาทีแล้ว กดตรวจได้เลย"; }
  }, 1000);
}

// ---------- ตรวจคำอธิบายแบบพื้นฐาน (ทำงานในเครื่อง ไม่ต้องใช้ AI) ----------
const PERSON = "man|woman|boy|girl|teacher|student|mother|father|child|kid|lady|guy|person|daughter|son|traveler|customer|cook|friend|baby";
const MODALS = new Set("is are am was were can will would should could may might must to do does did not don't i".split(" "));

function ing(v) {
  if (/ie$/.test(v)) return v.slice(0, -2) + "ying";
  if (/[^e]e$/.test(v) && v !== "be") return v.slice(0, -1) + "ing";
  if (/^[^aeiou]*[aeiou][bdgmnprt]$/.test(v) && v.length <= 4) return v + v.slice(-1) + "ing";
  return v + "ing";
}

// คำนามที่เป็นพหูพจน์อยู่แล้ว หรือนับไม่ได้ ไม่ต้องเติม s
const NO_PLURAL = new Set("people children men women feet teeth police fish sheep money water rice food hair coffee tea bread milk information advice furniture homework".split(" "));
const IRR_PL = { man: "men", woman: "women", child: "children", person: "people", foot: "feet", tooth: "teeth" };
function plural(n) {
  if (IRR_PL[n]) return IRR_PL[n];
  if (/(s|x|z|ch|sh)$/.test(n)) return n + "es";
  if (/[^aeiou]y$/.test(n)) return n.slice(0, -1) + "ies";
  return n + "s";
}

export function analyze(text, p, verbs, nouns) {
  const t = " " + text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ") + " ";
  const words = text.match(/[A-Za-z']+/g) || [];
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2);
  const issues = [];
  const add = (from, to, why) => { if (!issues.some(x => x.from === from)) issues.push({ from, to, why }); };

  // 1) ประธานเอกพจน์ + กริยาช่องที่ 1 (เช่น "a man sit") → is + -ing
  const subj = new RegExp(`\\b((?:a|the|an) (?:\\w+ )?(?:${PERSON})|he|she)\\s+([a-z]+)\\b`, "g");
  for (const m of t.matchAll(subj)) {
    const v = m[2];
    if (verbs.has(v) && !MODALS.has(v)) add(`${m[1]} ${v}`, `${m[1]} is ${ing(v)}`, "บรรยายภาพใช้ Present Continuous: is/are + กริยาเติม -ing");
  }
  // 2) is/are + กริยาช่องที่ 1 (เช่น "is sit") → is sitting
  for (const m of t.matchAll(/\b(is|are|am)\s+([a-z]+)\b/g)) {
    if (verbs.has(m[2])) add(`${m[1]} ${m[2]}`, `${m[1]} ${ing(m[2])}`, "หลัง is/are ต้องใช้กริยาเติม -ing");
  }
  // 3) ประธานพหูพจน์ + is / เอกพจน์ + are
  for (const m of t.matchAll(/\b(they|we|people|children|students|two \w+|three \w+|four \w+)\s+is\b/g)) add(`${m[1]} is`, `${m[1]} are`, "ประธานพหูพจน์ใช้ are");
  for (const m of t.matchAll(/\b(he|she|it)\s+are\b/g)) add(`${m[1]} are`, `${m[1]} is`, "he / she / it ใช้ is");
  // 4) there is + จำนวนมากกว่าหนึ่ง
  for (const m of t.matchAll(/\bthere is (two|three|four|five|many|some|lots of) (\w+)/g)) add(`there is ${m[1]}`, `there are ${m[1]}`, "ของหลายชิ้นใช้ there are");
  // 5) ลืม a / the หน้าสถานที่
  for (const m of t.matchAll(/\b(in|at) (cafe|coffee shop|kitchen|classroom|park|beach|supermarket|airport|office|meeting|market|restaurant)\b/g)) add(`${m[1]} ${m[2]}`, `${m[1]} ${/^[aeiou]/.test(m[2]) ? "an" : "a"} ${m[2]}`, "คำนามนับได้เอกพจน์ต้องมี a / an / the");
  // 6) The picture show → shows (ประธานเอกพจน์ + Present Simple)
  for (const m of t.matchAll(/\b(this|the) (picture|photo|image) (show|look|seem)\b/g)) add(`${m[1]} ${m[2]} ${m[3]}`, `${m[1]} ${m[2]} ${m[3]}s`, "ประธานเอกพจน์ (he/she/it) กริยาเติม s");
  // 7) จำนวนมากกว่าหนึ่ง + คำนามเอกพจน์ (two friend) → two friends
  for (const m of t.matchAll(/\b(two|three|four|five|six|seven|many|several) ([a-z]+)\b/g)) {
    if (nouns.has(m[2]) && !m[2].endsWith("s") && !NO_PLURAL.has(m[2])) add(`${m[1]} ${m[2]}`, `${m[1]} ${plural(m[2])}`, "มากกว่าหนึ่งต้องใช้คำนามพหูพจน์ (เติม s/es)");
  }
  // 8) I + กริยา he/she (I is)
  for (const m of t.matchAll(/\bi (is|are)\b/g)) add(`I ${m[1]}`, "I am", "ประธาน I ใช้ am");

  const has = re => re.test(t);
  const settingWords = p.setting.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const checks = [
    { key: "overview", ok: has(/\b(this picture|this photo|the picture|this is|it is a|in a|at a|at the|in the)\b/) && (settingWords.some(w => t.includes(w)) || has(/\bpicture|photo\b/)),
      tip: `บอกภาพรวม เช่น “This picture shows ... ${p.setting}.”` },
    { key: "positions", ok: has(/\b(foreground|background|on the (left|right)|in the (middle|front|center|centre)|next to|behind|in front of|at the (top|bottom)|on the table)\b/),
      tip: "บอกตำแหน่ง: In the foreground / In the background / On the left / Next to ..." },
    { key: "continuous", ok: has(/\b(is|are|am)\s+\w+ing\b/), tip: "ใช้ Present Continuous: A woman is drinking coffee." },
    { key: "inference", ok: has(/\b(looks?|seems?|probably|maybe|might|perhaps|i think|it seems)\b/), tip: "คาดเดาบริบท: They look happy. / It seems like a busy morning." },
  ];
  const stem = w => w.toLowerCase().replace(/(es|s)$/, "");
  const used = p.hotspots.filter(h => t.includes(" " + stem(h.word)));
  const unused = p.hotspots.filter(h => !used.includes(h));
  const raw = checks.filter(c => c.ok).length + (sentences.length >= 4 && used.length >= 3 ? 1 : 0);
  const score = Math.max(1, Math.min(5, raw - Math.floor(issues.length / 2)));
  return { words: words.length, sentences: sentences.length, issues, checks, used, unused, score };
}

function feedback(box, text) {
  const fb = box.querySelector("#fb");
  if (text.trim().split(/\s+/).length < 3) {
    fb.innerHTML = `<p class="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">ลองพูดหรือพิมพ์อย่างน้อย 2–3 ประโยคก่อน แล้วค่อยกดตรวจ</p>`;
    return;
  }
  const r = analyze(text, pic, C.verbs(), C.nouns());
  let fixed = text;
  // แก้ตามจุดที่พบ โดยคงตัวพิมพ์ใหญ่ของตัวแรกไว้ (A woman sit → A woman is sitting)
  for (const i of r.issues) {
    const re = new RegExp(`\\b${i.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    fixed = fixed.replace(re, m => (/^[A-Z]/.test(m) ? i.to[0].toUpperCase() + i.to.slice(1) : i.to));
  }
  const names = { overview: "1. ภาพรวม", positions: "2. ตำแหน่ง", continuous: "2. is + -ing", inference: "3. คาดเดาบริบท" };
  fb.innerHTML = `<div class="grid gap-4">
    <div class="flex items-center justify-between rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 px-5 py-4 text-white">
      <div><div class="text-sm text-white/70">คะแนนรวม (โครงสร้าง + ความถูกต้อง)</div><div class="text-2xl font-bold">${"★".repeat(r.score)}${"☆".repeat(5 - r.score)}</div></div>
      <div class="text-right text-sm text-white/80">${r.sentences} ประโยค · ${r.words} คำ<br>ใช้คำจากภาพ ${r.used.length}/${pic.hotspots.length}</div>
    </div>

    <div>${label("สิ่งที่คุณพูด / เขียน")}<p class="mt-1 rounded-2xl bg-zinc-50 px-4 py-3 text-lg dark:bg-zinc-800/60">${esc(text)}</p></div>

    <div>${label("Grammar & Vocabulary Check")}
      ${r.issues.length ? `<ul class="mt-2 grid gap-2">${r.issues.map(i => `<li class="rounded-2xl bg-rose-50 px-4 py-3 dark:bg-rose-500/10">
          <span class="text-rose-700 line-through dark:text-rose-300">${esc(i.from)}</span> → <b class="text-teal-700 dark:text-teal-300">${esc(i.to)}</b>
          <div class="text-sm text-zinc-600 dark:text-zinc-400">${esc(i.why)}</div></li>`).join("")}</ul>
        <div class="mt-2 flex items-start gap-3 rounded-2xl bg-teal-50 px-4 py-3 dark:bg-teal-500/10"><p class="flex-1">${esc(fixed)}</p>${C.sayBtn(fixed)}</div>`
        : `<p class="mt-2 text-teal-700 dark:text-teal-300">ไม่พบข้อผิดพลาดที่ตรวจแบบพื้นฐานได้ ${getKey() ? "" : "(การตรวจละเอียดต้องใช้ AI ด้านล่าง)"}</p>`}
    </div>

    <div>${label("ใช้สูตร 3 ขั้นครบไหม")}
      <ul class="mt-2 grid gap-1.5">${r.checks.map(c => `<li class="flex items-start gap-2">${c.ok
        ? `<span class="text-teal-600">${icon("check", "h-5 w-5")}</span><span>${names[c.key]}</span>`
        : `<span class="text-amber-500">${icon("bulb", "h-5 w-5")}</span><span><b>${names[c.key]}</b> · <span class="text-zinc-500">${esc(c.tip)}</span></span>`}</li>`).join("")}</ul>
    </div>

    ${r.unused.length ? `<div>${label("ก้อนคำจากภาพที่ลองใช้เพิ่มได้")}
      <div class="mt-2 flex flex-wrap gap-2">${r.unused.slice(0, 5).map(h => `<button data-hot2="${pic.hotspots.indexOf(h)}" class="rounded-full bg-purple-50 px-3 py-1.5 text-sm text-purple-700 ring-1 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20">${esc(h.action)}</button>`).join("")}</div></div>` : ""}

    <div id="ai"></div>

    <div class="rounded-2xl ring-1 ring-zinc-200 p-4 dark:ring-zinc-800">${label("Audio Model Answer · ฟังแล้วพูดตาม")}${modelBlock()}</div>
  </div>`;
  bindModel(fb);
  fb.querySelectorAll("[data-hot2]").forEach(b => (b.onclick = () => showHotspot(Number(b.dataset.hot2))));
  fb.scrollIntoView({ block: "start", behavior: "smooth" });
  if (getKey()) aiFeedback(fb.querySelector("#ai"), text);
}

// ---------- AI (ไม่บังคับ): Claude ดูภาพจริงแล้วตรวจ + เขียนฉบับเจ้าของภาษา ----------
function getKey() { try { return localStorage.getItem(AI_KEY) || ""; } catch { return ""; } }

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["corrections", "native_version", "tips_th"],
  properties: {
    corrections: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["original", "corrected", "explanation_th"],
        properties: { original: { type: "string" }, corrected: { type: "string" }, explanation_th: { type: "string" } },
      },
    },
    native_version: { type: "string" },
    tips_th: { type: "array", items: { type: "string" } },
  },
};

async function aiFeedback(el, text) {
  el.innerHTML = `<div class="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">✨ Claude กำลังดูภาพและตรวจคำอธิบายของคุณ…</div>`;
  try {
    const { default: Anthropic } = await import(SDK_URL);
    const client = new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true });
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: AI_SCHEMA } },
      system: "You are a friendly English speaking coach for Thai beginners (A1-A2). The learner described a photo. " +
        "List each grammar or word-choice mistake (original phrase, corrected phrase, short explanation in Thai). " +
        "Then rewrite the whole description the way a native speaker would say it, keeping the learner's ideas, simple words, and present continuous for actions (3-6 sentences). " +
        "Give 2-3 short tips in Thai for describing pictures better. If something the learner says is not in the photo, mention it in a tip.",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: pic.src } },
          { type: "text", text: `Photo topic: ${pic.title} (${pic.setting}).\nLearner's description:\n${text}` },
        ],
      }],
    });
    if (response.stop_reason === "refusal") throw new Error("Claude ไม่สามารถตรวจข้อความนี้ได้");
    const block = response.content.find(b => b.type === "text");
    const r = JSON.parse(block.text);
    el.innerHTML = `<div class="grid gap-3 rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20">
      ${label("✨ AI · Grammar check")}
      ${r.corrections.length ? `<ul class="grid gap-2">${r.corrections.map(c => `<li><span class="text-rose-700 line-through dark:text-rose-300">${esc(c.original)}</span> → <b class="text-teal-700 dark:text-teal-300">${esc(c.corrected)}</b><div class="text-sm text-zinc-600 dark:text-zinc-400">${esc(c.explanation_th)}</div></li>`).join("")}</ul>` : `<p class="text-teal-700 dark:text-teal-300">ไวยากรณ์ถูกต้องดีมาก!</p>`}
      ${label("✨ Native Speaker Version")}
      <div class="flex items-start gap-3"><p class="flex-1 text-lg leading-relaxed">${C.tapWords(r.native_version)}</p>${C.sayBtn(r.native_version, "md")}</div>
      ${r.tips_th.length ? `<ul class="grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">${r.tips_th.map(x => `<li>💡 ${esc(x)}</li>`).join("")}</ul>` : ""}
    </div>`;
    bindSay(el);
  } catch (e) {
    const msg = e?.status === 401 ? "API key ไม่ถูกต้อง ลองตรวจคีย์อีกครั้ง"
      : e?.status === 429 ? "เรียกใช้บ่อยเกินไป รอสักครู่แล้วลองใหม่"
      : e?.status === 400 ? `คำขอไม่ถูกต้อง: ${e.message}`
      : e?.message || "เชื่อมต่อ AI ไม่สำเร็จ";
    el.innerHTML = `<p class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">AI: ${esc(msg)} (ผลตรวจพื้นฐานด้านบนยังใช้ได้)</p>`;
  }
}
