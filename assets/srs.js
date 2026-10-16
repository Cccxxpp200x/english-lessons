// ตรรกะ Spaced Repetition และการจัดคิวประจำวัน (ไม่มีโค้ดหน้าจอ ทดสอบแยกได้)

export const EASY_STEPS = [3, 7, 14, 30, 60, 120]; // วัน
export const LEECH_THRESHOLD = 3; // ลืม (Again) ครบกี่ครั้งถึงนับเป็น Leech
export const WARMUP_MAX = 5;

// วันที่แบบ YYYY-MM-DD ตามเวลาท้องถิ่น
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

export function newCard(today) {
  return { reps: 0, interval: 0, due: today, lapses: 0, last: null, leech: false };
}

// rating: "again" | "hard" | "easy"
export function rate(card, rating, today) {
  const c = { ...(card || newCard(today)), last: today };
  if (rating === "again") {
    c.reps = 0;
    c.interval = 0;
    c.due = today;
    c.lapses += 1;
    c.leech = c.lapses >= LEECH_THRESHOLD;
  } else if (rating === "hard") {
    c.reps += 1;
    c.interval = 1;
    c.due = addDays(today, 1);
  } else if (rating === "easy") {
    c.reps += 1;
    c.interval = nextEasyInterval(c.interval);
    c.due = addDays(today, c.interval);
  } else {
    throw new Error(`unknown rating: ${rating}`);
  }
  return c;
}

export function nextEasyInterval(current) {
  return EASY_STEPS.find(s => s > current) ?? current * 2;
}

// คำที่เคลียร์จากคิว Wrap-up แล้ว: นัดทบทวนพรุ่งนี้
export function graduate(card, today) {
  return { ...card, interval: 1, due: addDays(today, 1), last: today };
}

export function emptyDaily(today) {
  return { date: today, newIds: [], warmDone: false, wrap: [], done: [], sentences: 0 };
}

// ---------- ฝึกเรียงประโยค ----------

// แยกประโยคเป็นคำสำหรับทำบัตรคำ: ตัดเครื่องหมายท้ายประโยคออกไปแสดงแยก
// และทำตัวแรกเป็นตัวพิมพ์เล็ก (ยกเว้น I) เพื่อไม่ให้ตัวพิมพ์ใหญ่เป็นคำใบ้ว่าคำไหนขึ้นต้น
export function tokenizeSentence(en) {
  const m = en.trim().match(/^(.*?)([.!?]*)$/);
  const toks = m[1].split(/\s+/).filter(Boolean);
  const tiles = toks.map((t, i) => (i === 0 && !/^I(\b|')/.test(t) ? t[0].toLowerCase() + t.slice(1) : t));
  return { toks, tiles, end: m[2] };
}

export function isCorrectOrder(chosen, toks) {
  return chosen.join(" ").toLowerCase() === toks.join(" ").toLowerCase();
}

// ประโยคที่เหมาะกับการเรียง: ไม่มีเครื่องหมายคำพูด และมีอย่างน้อย 4 คำ
export function usableSentence(en) {
  return !/["“”]/.test(en) && tokenizeSentence(en).toks.length >= 4;
}

// จัดคิวของวันนี้ แยกเป็น 4 ช่วง
export function buildSession(ids, cards, daily, newPerDay, today) {
  const yesterday = addDays(today, -1);
  const inWrap = new Set(daily.wrap);
  const done = new Set(daily.done);

  const warm = daily.warmDone ? [] : ids
    .filter(id => {
      const c = cards[id];
      return c && c.last === yesterday && c.due > today && !inWrap.has(id) && !done.has(id);
    })
    .slice(0, WARMUP_MAX);

  const review = ids
    .filter(id => {
      const c = cards[id];
      return c && c.due <= today && !inWrap.has(id) && !done.has(id);
    })
    .sort((a, b) => cards[a].due.localeCompare(cards[b].due));

  const quota = Math.max(0, newPerDay - daily.newIds.length);
  const fresh = ids.filter(id => !cards[id]).slice(0, quota);

  return { warm, review, fresh, wrap: [...daily.wrap] };
}
