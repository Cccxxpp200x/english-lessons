// แปลงเสียงพูดเป็นข้อความ (Web Speech API) ใช้ร่วมกันทุกโหมดฝึกพูด
// ปัญหาเดิมบน iPhone: Safari มักไม่ส่ง "ผลสุดท้าย" ถ้าไม่สั่งหยุดเอง ทำให้พูดแล้วเงียบหาย
// วิธีแก้: ขอผลระหว่างพูด (interim) แสดงสด, หยุดเองเมื่อเงียบ 1.6 วินาที แล้วใช้ข้อความล่าสุดที่ได้ยินมาตรวจ
// และปุ่มหยุดใช้ stop() (ได้ผลลัพธ์) ไม่ใช้ abort() (ทิ้งผลลัพธ์)

export const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const CONTRACTIONS = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is",
  "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "let's": "let us",
  "i'd": "i would", "i'll": "i will", "i've": "i have", "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "can't": "can not", "cannot": "can not", "won't": "will not", "isn't": "is not", "aren't": "are not",
  "wasn't": "was not", "wouldn't": "would not", "you'll": "you will", "we'll": "we will", "ok": "okay",
  "you've": "you have", "we've": "we have", "how's": "how is", "where's": "where is", "who's": "who is",
  "couldn't": "could not", "shouldn't": "should not", "haven't": "have not", "hasn't": "has not",
};
const NUMBERS = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten" };
export const normWords = s => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' -]/g, " ").split(/\s+/).filter(Boolean)
  .flatMap(w => (CONTRACTIONS[w] || NUMBERS[w] || w.replace(/'/g, "")).split(" "));

function wordDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// ยอมให้ผิดได้เล็กน้อย (ประมาณ 1 คำต่อ 5 คำ) เพราะระบบแปลงเสียงอาจฟังคำสั้นๆ ผิด
export function speechMatches(heard, target) {
  const a = normWords(heard), b = normWords(target);
  return b.length > 0 && wordDistance(a, b) <= Math.max(1, Math.floor(b.length / 5));
}

// เทียบทีละคำเพื่อไฮไลต์คำที่ตรง/ไม่ตรงกับประโยคเป้าหมาย
export function markWords(heard, target, esc) {
  const want = new Set(normWords(target));
  return heard.split(/\s+/).filter(Boolean).map(w => {
    const ok = normWords(w).every(x => want.has(x));
    return `<span class="${ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 underline decoration-wavy dark:text-rose-400"}">${esc(w)}</span>`;
  }).join(" ");
}

let active = null;      // รอบการฟังที่กำลังทำงาน
let shared = null;      // ใช้ตัวรับเสียงตัวเดียวซ้ำ (iPhone มักพังเมื่อสร้างตัวใหม่ทุกครั้ง)
let waiting = null;     // รอบใหม่ที่รอให้รอบเก่าจบก่อนค่อยเริ่ม

export function stopListening(discard = false) {
  waiting = null;
  if (!active) return;
  if (discard) active.discard = true;
  try { active.rec.stop(); } catch { /* ข้าม */ }
}

// ฟังหนึ่งครั้ง: onReady() เมื่อไมค์เปิดจริง, onText(ข้อความ) ระหว่างพูด, onDone(ข้อความทั้งหมด, ตัวเลือกอื่น) ตอนจบ
// สาเหตุที่ "พูดได้แค่ประโยคแรก" บน iPhone: หลังแอปอ่านเฉลยออกเสียง ระบบเสียงยังไม่ว่าง
// และการเริ่มฟังขณะที่รอบเก่ายังไม่จบสนิท ทำให้รอบใหม่เงียบไปเฉยๆ จึง (1) รอรอบเก่าจบก่อน
// (2) ถ้ายังมีเสียงอ่านค้าง ให้หยุดแล้วรอสักครู่ (3) ถ้าไมค์ไม่เปิด ลองใหม่อัตโนมัติ 1 ครั้งด้วยตัวรับเสียงตัวใหม่
export function listen(opts) {
  if (!SR) { opts.onError?.("unsupported"); return; }
  waiting = null;
  if (active) {
    // รอบเก่ายังไม่จบ: สั่งหยุดแบบทิ้งผล แล้วค่อยเริ่มรอบใหม่ตอนรอบเก่าจบ
    active.discard = true;
    waiting = () => listen(opts);
    try { active.rec.abort(); } catch { /* ข้าม */ }
    setTimeout(() => { if (waiting) { const w = waiting; waiting = null; active = null; w(); } }, 600);
    return;
  }
  const synth = window.speechSynthesis;
  const busy = synth && (synth.speaking || synth.pending);
  synth?.cancel();
  if (busy) { setTimeout(() => begin(opts, false), 300); return; }
  begin(opts, false);
}

function begin({ lang = "en-US", onReady, onText, onDone, onError, silenceMs = 1600, maxMs = 15000 }, retried) {
  if (!shared || retried) shared = new SR();
  const rec = shared;
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = !IS_IOS; // continuous บน iOS ทำให้ข้อความซ้ำ จึงใช้แบบประโยคเดียว
  rec.maxAlternatives = 3;
  const state = { rec, text: "", alts: [], discard: false, opened: false };
  active = state;
  let silence = null;
  const cap = setTimeout(() => { try { rec.stop(); } catch { /* ข้าม */ } }, maxMs);
  const armSilence = ms => {
    clearTimeout(silence);
    silence = setTimeout(() => { try { rec.stop(); } catch { /* ข้าม */ } }, ms);
  };
  const retry = () => {
    clearTimeout(silence);
    clearTimeout(cap);
    if (active === state) active = null;
    setTimeout(() => begin({ lang, onReady, onText, onDone, onError, silenceMs, maxMs }, true), 350);
  };
  rec.onaudiostart = () => { state.opened = true; onReady?.(); armSilence(6000); }; // ไม่พูดเลย 6 วินาที = จบ
  rec.onresult = e => {
    let text = "";
    const alts = [];
    for (let i = 0; i < e.results.length; i++) {
      text += (text ? " " : "") + e.results[i][0].transcript.trim();
      if (e.results[i].isFinal) for (let k = 1; k < e.results[i].length; k++) alts.push(e.results[i][k].transcript.trim());
    }
    state.opened = true;
    state.text = text;
    state.alts = alts;
    onText?.(text);
    armSilence(silenceMs);
  };
  rec.onerror = e => { state.error = e.error; };
  rec.onend = () => {
    clearTimeout(silence);
    clearTimeout(cap);
    if (active === state) active = null;
    if (waiting) { const w = waiting; waiting = null; return w(); }
    if (state.discard) return;
    if (state.text) return onDone?.(state.text, state.alts);
    const fatal = state.error === "not-allowed" || state.error === "service-not-allowed";
    if (!state.opened && !retried && !fatal) return retry(); // ไมค์ไม่ได้เปิดจริง ลองใหม่อัตโนมัติ
    onError?.(state.error || "no-speech");
  };
  try { rec.start(); } catch {
    if (!retried) return retry();
    active = null;
    clearTimeout(cap);
    onError?.("start");
  }
}

export const micErrorText = err => ({
  "not-allowed": "ไม่ได้รับอนุญาตให้ใช้ไมค์ · iPhone: ตั้งค่า > Safari > ไมโครโฟน = อนุญาต และเปิด Siri & Dictation (ตั้งค่า > ทั่วไป > คีย์บอร์ด > เปิดใช้งานการป้อนตามคำบอก)",
  "service-not-allowed": "ระบบแปลงเสียงยังไม่เปิด · iPhone: ตั้งค่า > ทั่วไป > คีย์บอร์ด > เปิด \"การป้อนตามคำบอก\" (Dictation) แล้วลองใหม่",
  "no-speech": "ไม่ได้ยินเสียงพูด ลองพูดให้ดังขึ้นอีกนิด หรือถือมือถือใกล้ปากขึ้น",
  "audio-capture": "ไม่พบไมโครโฟน หรือแอปอื่นกำลังใช้ไมค์อยู่",
  "network": "เชื่อมต่อระบบแปลงเสียงไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
  "unsupported": "เบราว์เซอร์นี้แปลงเสียงไม่ได้ ใช้ Safari (iPhone) หรือ Chrome",
})[err] || `ไมค์มีปัญหา (${err}) ลองกดใหม่อีกครั้ง`;

// ปุ่มไมค์พร้อมกล่องแสดงคำที่พูดแบบสด: ใช้ได้ทุกหน้าฝึกพูด
// onResult(ข้อความ, ตรงหรือไม่) — ผู้เรียกตัดสินใจเองว่าจะไปต่อหรือให้ลองใหม่
export function micWidget(root, { target, lang, esc, onResult }) {
  if (!SR) {
    root.innerHTML = `<p class="text-sm text-zinc-500">${micErrorText("unsupported")}</p>`;
    return;
  }
  root.innerHTML = `
    <button type="button" data-mic class="mx-auto inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-rose-600/25 transition active:scale-95">
      <span data-dot class="h-3 w-3 rounded-full bg-white/90"></span><span data-lab>🎙️ กดแล้วพูด</span></button>
    <div data-live class="min-h-[3.25rem] rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-3 text-left text-lg leading-snug text-zinc-400 dark:border-zinc-700">คำที่คุณพูดจะแสดงตรงนี้</div>
    <p data-status class="text-sm text-zinc-500">กดปุ่ม พูดทั้งประโยค แล้วหยุดพูด ระบบจะตรวจให้เอง</p>`;
  const btn = root.querySelector("[data-mic]"), lab = root.querySelector("[data-lab]"), dot = root.querySelector("[data-dot]");
  const live = root.querySelector("[data-live]"), status = root.querySelector("[data-status]");
  let listening = false;
  const idle = text => {
    listening = false;
    lab.textContent = text;
    btn.classList.remove("!bg-zinc-900", "dark:!bg-white", "dark:!text-zinc-900");
    dot.classList.remove("animate-ping");
  };
  btn.onclick = () => {
    if (listening) { status.textContent = "กำลังตรวจ…"; stopListening(); return; }
    listening = true;
    lab.textContent = "■ หยุดและตรวจ";
    btn.classList.add("!bg-zinc-900", "dark:!bg-white", "dark:!text-zinc-900");
    dot.classList.add("animate-ping");
    live.className = live.className.replace("text-zinc-400", "text-zinc-900 dark:text-zinc-100");
    live.innerHTML = `<span class="text-zinc-400">กำลังเปิดไมค์…</span>`;
    status.textContent = "รอสักครู่ แล้วพูดให้ครบทั้งประโยค";
    listen({
      lang,
      onReady: () => {
        if (!live.textContent.startsWith("กำลังเปิด")) return;
        live.innerHTML = `<span class="text-rose-500">● กำลังฟัง… พูดได้เลย</span>`;
        status.textContent = "พูดให้ครบทั้งประโยค แล้วหยุดพูดสักครู่ ระบบจะตรวจให้เอง";
      },
      onText: text => { live.innerHTML = esc(text) + ` <span class="inline-block h-4 w-0.5 animate-pulse bg-rose-500 align-middle"></span>`; },
      onDone: (text, alts) => {
        idle("🎙️ พูดอีกครั้ง");
        const match = [text, ...alts].find(t => speechMatches(t, target));
        live.innerHTML = target ? markWords(match || text, target, esc) : esc(text);
        onResult(match || text, !!match);
      },
      onError: err => {
        idle("🎙️ กดแล้วพูด");
        live.innerHTML = `<span class="text-zinc-400">ยังไม่ได้ยินอะไร</span>`;
        status.textContent = micErrorText(err);
      },
    });
  };
  return { status };
}
