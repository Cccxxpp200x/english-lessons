// โปรไฟล์ผู้เรียนบนเครื่องนี้: แต่ละโปรไฟล์มีความคืบหน้าของตัวเอง เข้าด้วย PIN 6 หลัก
// PIN เก็บเป็นค่าแฮช (SHA-256 + salt) ไม่เก็บตัวเลขจริง เป็นแค่ตัวกันคนอื่นในบ้านเปิดผิดโปรไฟล์ ไม่ใช่การเข้ารหัสข้อมูล
// ข้อมูลทั้งหมดอยู่ใน localStorage ของเบราว์เซอร์นี้เท่านั้น จึงมีปุ่มสำรอง/กู้คืนเป็นไฟล์

const LIST_KEY = "english-lessons:profiles";
const ACTIVE_KEY = "english-lessons:active"; // sessionStorage: โปรไฟล์ที่ปลดล็อกแล้วในแท็บนี้
const LEGACY_KEY = "english-lessons:v2"; // ข้อมูลก่อนมีระบบโปรไฟล์
const MIGRATED_KEY = "english-lessons:legacy-migrated";
export const dataKey = id => `english-lessons:v2:${id}`;
const EMOJIS = ["🦊", "🐼", "🐯", "🐸", "🦉", "🐬", "🦁", "🐨", "🐙", "🦄", "🐝", "🌟"];

let C = null;

// ---------- storage ----------
const read = (k, store = localStorage) => { try { return JSON.parse(store.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const profiles = () => read(LIST_KEY) || [];
const saveProfiles = list => write(LIST_KEY, list);

export function activeProfile() {
  let id = null;
  try { id = sessionStorage.getItem(ACTIVE_KEY); } catch { /* ข้าม */ }
  return profiles().find(p => p.id === id) || null;
}
function setActive(id) { try { id ? sessionStorage.setItem(ACTIVE_KEY, id) : sessionStorage.removeItem(ACTIVE_KEY); } catch { /* ข้าม */ } }

const legacyData = () => (localStorage.getItem(MIGRATED_KEY) ? null : read(LEGACY_KEY));
const learnedCount = data => Object.keys(data?.cards || {}).length;

async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const randomHex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");

async function createProfile(name, emoji, pin) {
  const salt = randomHex(16);
  const p = { id: randomHex(6), name, emoji, salt, pinHash: await hashPin(pin, salt), created: new Date().toISOString() };
  // โปรไฟล์แรก: ย้ายความคืบหน้าเดิม (ก่อนมีโปรไฟล์) เข้ามา ข้อมูลเดิมยังเก็บไว้ไม่ลบ
  const legacy = legacyData();
  if (legacy && !profiles().length) {
    write(dataKey(p.id), legacy);
    localStorage.setItem(MIGRATED_KEY, p.id);
  }
  saveProfiles([...profiles(), p]);
  return p;
}

const checkPin = async (p, pin) => (await hashPin(pin, p.salt)) === p.pinHash;

function deleteProfile(id) {
  saveProfiles(profiles().filter(p => p.id !== id));
  try { localStorage.removeItem(dataKey(id)); } catch { /* ข้าม */ }
  if (activeProfile()?.id === id) setActive(null);
}

// ---------- UI helpers ----------
const esc = s => C.esc(s);
const icon = (...a) => C.icon(...a);
const CARD = "rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-16px_rgba(76,29,149,.25)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800";
const avatar = (p, size = "h-16 w-16 text-3xl") =>
  `<span class="grid ${size} shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/20 dark:to-indigo-500/20">${esc(p.emoji)}</span>`;

function screen(inner) {
  C.app.innerHTML = `
    <main class="flex min-h-dvh flex-col justify-center gap-6 py-10">
      <div class="text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-purple-600/30">A</div>
        <h1 class="mt-3 text-2xl font-bold">Active Recall English</h1>
      </div>
      ${inner}
    </main>`;
}

// แป้นตัวเลข PIN 6 หลัก ใช้ได้ทั้งแตะและพิมพ์จากคีย์บอร์ด
function pinPad(root, onDone) {
  let pin = "";
  const dots = root.querySelector("[data-dots]");
  const draw = () => {
    dots.innerHTML = Array.from({ length: 6 }, (_, i) =>
      `<span class="h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-purple-600" : "bg-zinc-200 dark:bg-zinc-700"}"></span>`).join("");
  };
  const press = k => {
    if (k === "del") pin = pin.slice(0, -1);
    else if (/^\d$/.test(k) && pin.length < 6) pin += k;
    draw();
    if (pin.length === 6) { const v = pin; pin = ""; setTimeout(() => { draw(); onDone(v); }, 120); }
  };
  root.querySelector("[data-pad]").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "del"].map(k => k === ""
    ? "<span></span>"
    : `<button type="button" data-k="${k}" class="grid h-16 place-items-center rounded-2xl bg-white text-2xl font-semibold ring-1 ring-zinc-200 transition active:scale-95 active:bg-purple-50 dark:bg-zinc-900 dark:ring-zinc-800">${k === "del" ? "⌫" : k}</button>`).join("");
  root.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => press(String(b.dataset.k))));
  const onKey = e => {
    if (!document.body.contains(dots)) return document.removeEventListener("keydown", onKey);
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("del");
  };
  document.addEventListener("keydown", onKey);
  draw();
  return { shake() { dots.classList.remove("animate-shake"); void dots.offsetWidth; dots.classList.add("animate-shake"); } };
}

const padBlock = `<div data-dots class="flex justify-center gap-3"></div>
  <div data-pad class="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3"></div>`;

// ---------- screens ----------
export function showProfiles(ctx) {
  C = ctx;
  const list = profiles();
  if (!list.length) return showCreate(true);
  screen(`
    <section class="${CARD}">
      <h2 class="text-center text-xl font-bold">Who's learning?</h2>
      <p class="mt-1 text-center text-sm text-zinc-500">เลือกโปรไฟล์ แล้วใส่ PIN 6 หลัก</p>
      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        ${list.map(p => `
          <button data-pick="${p.id}" class="flex flex-col items-center gap-2 rounded-2xl p-4 ring-1 ring-zinc-200 transition hover:ring-purple-300 dark:ring-zinc-800">
            ${avatar(p)}
            <span class="max-w-full truncate font-semibold">${esc(p.name)}</span>
            <span class="text-xs text-zinc-500">${learnedCount(read(dataKey(p.id)))} words</span>
          </button>`).join("")}
        <button data-act="add" class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-4 text-zinc-500 hover:border-purple-300 hover:text-purple-600 dark:border-zinc-700">
          <span class="grid h-16 w-16 place-items-center rounded-2xl text-3xl">＋</span><span class="font-semibold">Add profile</span>
        </button>
      </div>
    </section>`);
  C.app.querySelectorAll("[data-pick]").forEach(b => (b.onclick = () => showUnlock(list.find(p => p.id === b.dataset.pick))));
  C.app.querySelector('[data-act="add"]').onclick = () => showCreate(false);
}

function showUnlock(p) {
  let fails = 0, lockedUntil = 0;
  screen(`
    <section class="${CARD} text-center">
      <div class="flex justify-center">${avatar(p)}</div>
      <h2 class="mt-3 text-xl font-bold">${esc(p.name)}</h2>
      <p id="msg" class="mt-1 text-sm text-zinc-500">Enter your 6-digit PIN · ใส่ PIN 6 หลัก</p>
      <div class="mt-5">${padBlock}</div>
      <div class="mt-6 flex justify-between text-sm">
        <button data-act="back" class="text-zinc-500 underline">← Profiles</button>
        <button data-act="forgot" class="text-rose-600 underline">Forgot PIN?</button>
      </div>
    </section>`);
  const msg = C.app.querySelector("#msg");
  const pad = pinPad(C.app, async pin => {
    if (Date.now() < lockedUntil) return;
    if (await checkPin(p, pin)) { setActive(p.id); C.enter(p); return; }
    fails++;
    pad.shake();
    if (fails >= 5) {
      lockedUntil = Date.now() + 30000;
      msg.textContent = "ใส่ผิด 5 ครั้ง รอ 30 วินาทีแล้วลองใหม่";
      setTimeout(() => { fails = 0; msg.textContent = "Enter your 6-digit PIN · ใส่ PIN 6 หลัก"; }, 30000);
    } else msg.textContent = `PIN ไม่ถูกต้อง (${fails}/5)`;
  });
  C.app.querySelector('[data-act="back"]').onclick = () => showProfiles(C);
  C.app.querySelector('[data-act="forgot"]').onclick = () => {
    // PIN เก็บแบบแฮช กู้คืนไม่ได้ ทางเดียวคือลบโปรไฟล์ (ถ้ามีไฟล์สำรองไว้ สร้างใหม่แล้วกู้คืนได้)
    const typed = prompt(`ลืม PIN: กู้คืน PIN ไม่ได้ ทางเดียวคือลบโปรไฟล์นี้และประวัติการเรียนทั้งหมด\n(ถ้ามีไฟล์สำรองไว้ สร้างโปรไฟล์ใหม่แล้วกู้คืนจากไฟล์ได้)\n\nพิมพ์ชื่อโปรไฟล์ "${p.name}" เพื่อยืนยันการลบ`);
    if (typed !== null && typed.trim() === p.name) { deleteProfile(p.id); showProfiles(C); }
  };
}

function showCreate(first) {
  const legacy = first ? legacyData() : null;
  const taken = new Set(profiles().map(p => p.emoji));
  let emoji = EMOJIS.find(e => !taken.has(e)) || EMOJIS[0];
  screen(`
    <section class="${CARD}">
      <h2 class="text-xl font-bold">${first ? "Create your profile" : "Add a profile"}</h2>
      <p class="mt-1 text-sm text-zinc-500">${first ? "สร้างโปรไฟล์เพื่อเก็บประวัติการเรียน ไม่ต้องใช้อีเมล" : "แต่ละโปรไฟล์มีประวัติการเรียนแยกกัน"}</p>
      ${legacy && learnedCount(legacy) ? `<p class="mt-3 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">ประวัติการเรียนเดิม ${learnedCount(legacy)} คำในเครื่องนี้ จะย้ายเข้าโปรไฟล์นี้ให้อัตโนมัติ</p>` : ""}
      <label class="mt-5 block text-sm text-zinc-500" for="pname">Name · ชื่อโปรไฟล์</label>
      <input id="pname" maxlength="20" autocomplete="off" class="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-lg ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:ring-zinc-700">
      <div class="mt-4 text-sm text-zinc-500">Avatar</div>
      <div id="emojis" class="mt-2 flex flex-wrap gap-2"></div>
      <div class="mt-5">${C.button('data-act="next"', "Next: set PIN →")}</div>
      ${first ? "" : `<button data-act="back" class="mt-4 text-sm text-zinc-500 underline">← Profiles</button>`}
    </section>`);
  const drawEmojis = () => {
    const box = C.app.querySelector("#emojis");
    box.innerHTML = EMOJIS.map(e => `<button data-e="${e}" class="grid h-12 w-12 place-items-center rounded-xl text-2xl ring-2 ${e === emoji ? "ring-purple-500 bg-purple-50 dark:bg-purple-500/20" : "ring-transparent bg-zinc-100 dark:bg-zinc-800"}">${e}</button>`).join("");
    box.querySelectorAll("[data-e]").forEach(b => (b.onclick = () => { emoji = b.dataset.e; drawEmojis(); }));
  };
  drawEmojis();
  const nameEl = C.app.querySelector("#pname");
  nameEl.focus();
  C.app.querySelector('[data-act="back"]')?.addEventListener("click", () => showProfiles(C));
  C.app.querySelector('[data-act="next"]').onclick = () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); nameEl.classList.add("!ring-rose-500"); return; }
    if (profiles().some(p => p.name.toLowerCase() === name.toLowerCase())) { alert("มีโปรไฟล์ชื่อนี้แล้ว"); return; }
    setPin({ name, emoji, first });
  };
}

// ตั้ง PIN สองรอบ (ใส่ + ยืนยัน) แล้วสร้างโปรไฟล์
function setPin({ name, emoji, first }) {
  let firstPin = null;
  const draw = (title, note) => {
    screen(`
      <section class="${CARD} text-center">
        <div class="flex justify-center">${avatar({ emoji })}</div>
        <h2 class="mt-3 text-xl font-bold">${title}</h2>
        <p id="msg" class="mt-1 text-sm text-zinc-500">${note}</p>
        <div class="mt-5">${padBlock}</div>
        <button data-act="back" class="mt-6 text-sm text-zinc-500 underline">← Back</button>
      </section>`);
    C.app.querySelector('[data-act="back"]').onclick = () => (first && !profiles().length ? showCreate(true) : showProfiles(C));
  };
  const step1 = () => {
    draw(`Set a PIN for ${esc(name)}`, "ตั้ง PIN 6 หลัก (จำไว้ให้ดี กู้คืนไม่ได้)");
    pinPad(C.app, pin => {
      if (/^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
        C.app.querySelector("#msg").textContent = "PIN ง่ายเกินไป ลองตัวเลขอื่น";
        return;
      }
      firstPin = pin;
      step2();
    });
  };
  const step2 = () => {
    draw("Confirm your PIN", "ใส่ PIN เดิมอีกครั้ง");
    const pad = pinPad(C.app, async pin => {
      if (pin !== firstPin) { pad.shake(); C.app.querySelector("#msg").textContent = "PIN ไม่ตรงกัน ตั้งใหม่อีกครั้ง"; setTimeout(step1, 900); return; }
      const p = await createProfile(name, emoji, pin);
      setActive(p.id);
      C.enter(p);
    });
  };
  step1();
}

// ---------- จัดการโปรไฟล์ (เปิดจากหน้าแรก) ----------
export function showProfileSheet(ctx, p) {
  C = ctx;
  document.getElementById("word-pop")?.remove();
  const el = document.createElement("div");
  el.id = "word-pop";
  el.className = "fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-3 backdrop-blur-[2px] md:items-center";
  const row = (act, ic, text, sub, cls = "") => `<button data-act="${act}" class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${cls}">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-800">${ic}</span>
      <span class="min-w-0 flex-1"><span class="block font-semibold">${text}</span><span class="block text-xs text-zinc-500">${sub}</span></span></button>`;
  el.innerHTML = `
    <div role="dialog" class="animate-pop max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div class="flex items-center gap-4">${avatar(p, "h-14 w-14 text-2xl")}
        <div class="min-w-0 flex-1"><div class="truncate text-xl font-bold">${esc(p.name)}</div><div class="text-sm text-zinc-500">${learnedCount(C.store)} words learned</div></div></div>
      <div class="mt-4 grid gap-1">
        ${row("switch", "🔁", "Switch profile", "สลับ/ล็อกโปรไฟล์ (ต้องใส่ PIN ใหม่)")}
        ${row("backup", "💾", "Back up progress", "บันทึกเป็นไฟล์ .json เก็บไว้ หรือย้ายไปเครื่องอื่น")}
        ${row("restore", "📂", "Restore from backup", "กู้คืนจากไฟล์สำรอง (แทนที่ข้อมูลปัจจุบัน)")}
        ${row("change-pin", "🔑", "Change PIN", "เปลี่ยน PIN 6 หลัก")}
        ${row("delete", "🗑️", "Delete this profile", "ลบโปรไฟล์และประวัติการเรียนทั้งหมด", "text-rose-600")}
      </div>
      <p id="sheet-msg" class="mt-2 hidden rounded-2xl px-4 py-3 text-sm"></p>
      <input id="restore-file" type="file" accept="application/json,.json" class="hidden">
      <button data-close class="mt-3 w-full rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">Close</button>
    </div>`;
  document.body.append(el);
  const close = () => el.remove();
  const note = (text, ok = true) => {
    const m = el.querySelector("#sheet-msg");
    m.className = `mt-2 rounded-2xl px-4 py-3 text-sm ${ok ? "bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200" : "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"}`;
    m.textContent = text;
  };
  el.onclick = e => { if (e.target === el || e.target.closest("[data-close]")) close(); };
  const on = (act, fn) => (el.querySelector(`[data-act="${act}"]`).onclick = fn);

  on("switch", () => { setActive(null); location.reload(); });

  on("backup", () => {
    C.save();
    const data = { app: "english-lessons", version: 1, profile: { name: p.name, emoji: p.emoji }, exportedAt: new Date().toISOString(), data: read(dataKey(p.id)) };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `english-progress-${p.name.replace(/[^\w฀-๿-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    note("ดาวน์โหลดไฟล์สำรองแล้ว (iPhone: อยู่ในแอป Files > Downloads)");
  });

  const fileEl = el.querySelector("#restore-file");
  on("restore", () => fileEl.click());
  fileEl.onchange = async () => {
    const f = fileEl.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const data = j?.app === "english-lessons" ? j.data : j;
      if (!data || typeof data.cards !== "object") throw new Error("bad");
      const n = learnedCount(data);
      if (!confirm(`กู้คืน ${n} คำจากไฟล์นี้เข้าโปรไฟล์ "${p.name}"?\nความคืบหน้าปัจจุบัน (${learnedCount(C.store)} คำ) จะถูกแทนที่`)) return;
      write(dataKey(p.id), data);
      location.reload();
    } catch {
      note("ไฟล์นี้ไม่ใช่ไฟล์สำรองของเว็บนี้", false);
    } finally { fileEl.value = ""; }
  };

  on("change-pin", () => { close(); changePin(p); });

  on("delete", () => {
    const typed = prompt(`ลบโปรไฟล์ "${p.name}" และประวัติการเรียน ${learnedCount(C.store)} คำ? ย้อนกลับไม่ได้\n(แนะนำให้สำรองข้อมูลก่อน)\n\nพิมพ์ชื่อโปรไฟล์เพื่อยืนยัน`);
    if (typed === null) return;
    if (typed.trim() !== p.name) { note("ชื่อไม่ตรง ยังไม่ได้ลบ", false); return; }
    deleteProfile(p.id);
    location.reload();
  });
}

// เปลี่ยน PIN: ใส่ PIN เดิม → PIN ใหม่ → ยืนยัน
function changePin(p) {
  const back = () => C.renderHome();
  let newPin = null;
  const draw = (title, note) => {
    C.app.innerHTML = `<main class="flex min-h-dvh flex-col justify-center py-10"><section class="${CARD} text-center">
      <div class="flex justify-center">${avatar(p)}</div>
      <h2 class="mt-3 text-xl font-bold">${title}</h2><p id="msg" class="mt-1 text-sm text-zinc-500">${note}</p>
      <div class="mt-5">${padBlock}</div>
      <button data-act="cancel" class="mt-6 text-sm text-zinc-500 underline">Cancel</button></section></main>`;
    C.app.querySelector('[data-act="cancel"]').onclick = back;
  };
  draw("Current PIN", "ใส่ PIN ปัจจุบัน");
  const pad = pinPad(C.app, async pin => {
    if (!(await checkPin(p, pin))) { pad.shake(); C.app.querySelector("#msg").textContent = "PIN ไม่ถูกต้อง"; return; }
    draw("New PIN", "ตั้ง PIN ใหม่ 6 หลัก");
    pinPad(C.app, pin2 => {
      newPin = pin2;
      draw("Confirm new PIN", "ใส่ PIN ใหม่อีกครั้ง");
      const pad3 = pinPad(C.app, async pin3 => {
        if (pin3 !== newPin) { pad3.shake(); C.app.querySelector("#msg").textContent = "ไม่ตรงกัน ลองใหม่ที่ปุ่ม Cancel"; return; }
        const salt = randomHex(16);
        const hash = await hashPin(pin3, salt);
        saveProfiles(profiles().map(x => (x.id === p.id ? { ...x, salt, pinHash: hash } : x)));
        Object.assign(p, { salt, pinHash: hash });
        C.renderHome();
      });
    });
  });
}
