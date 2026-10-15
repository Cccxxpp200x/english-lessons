// โหลดข้อมูลจากโฟลเดอร์ data/ แล้วแสดงผลหน้าแรกและหน้าบทเรียน
const DATA = "data/";
const STORE_KEY = "english-lessons:progress";

async function getJSON(path) {
  const res = await fetch(DATA + path);
  if (!res.ok) throw new Error(`โหลด ${path} ไม่สำเร็จ (${res.status})`);
  return res.json();
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}

function saveBestScore(id, score, total) {
  try {
    const p = loadProgress();
    const prev = p[id];
    if (!prev || score / total > prev.score / prev.total) {
      p[id] = { score, total };
      localStorage.setItem(STORE_KEY, JSON.stringify(p));
    }
  } catch { /* เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล ข้ามไป */ }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---------- หน้าแรก ----------
async function renderHome() {
  const list = document.getElementById("lesson-list");
  try {
    const { lessons } = await getJSON("index.json");
    const progress = loadProgress();
    list.innerHTML = lessons.map(l => {
      const best = progress[l.id];
      const score = best ? `<span class="badge">คะแนนดีที่สุด ${best.score}/${best.total}</span>` : "";
      return `<li><a href="lesson.html?id=${encodeURIComponent(l.id)}">
        <span><span class="title">${escapeHTML(l.title)}</span>
        <span class="muted"> · ${escapeHTML(l.titleEn)}</span></span>
        <span>${score} <span class="badge">${escapeHTML(l.level)}</span></span>
      </a></li>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<li class="muted">${escapeHTML(err.message)}</li>`;
  }
}

// ---------- หน้าบทเรียน ----------
async function renderLesson() {
  const id = new URLSearchParams(location.search).get("id");
  const body = document.getElementById("lesson-body");
  let lesson;
  try {
    const { lessons } = await getJSON("index.json");
    const entry = lessons.find(l => l.id === id);
    if (!entry) throw new Error("ไม่พบบทเรียนนี้");
    lesson = await getJSON(entry.file);
  } catch (err) {
    document.getElementById("lesson-title").textContent = "เกิดข้อผิดพลาด";
    body.innerHTML = `<p class="muted">${escapeHTML(err.message)}</p>`;
    return;
  }

  document.title = `${lesson.title} · เรียนภาษาอังกฤษ`;
  document.getElementById("lesson-title").textContent = `${lesson.title} (${lesson.titleEn})`;

  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.toggle("active", t === tab));
    tab.dataset.mode === "quiz" ? showQuiz(body, lesson) : showCards(body, lesson);
  }));
  showCards(body, lesson);
}

function showCards(body, lesson) {
  const words = lesson.words;
  let i = 0, flipped = false;

  function draw() {
    const w = words[i];
    body.innerHTML = `
      <div class="card" id="card">
        ${flipped
          ? `<div class="meaning">${escapeHTML(w.meaning)}</div>
             <div class="example">${escapeHTML(w.example)}<br>${escapeHTML(w.exampleTh)}</div>`
          : `<div class="word">${escapeHTML(w.word)}</div>
             <div class="muted">${escapeHTML(w.pos)}</div>`}
        <div class="hint">แตะการ์ดเพื่อ${flipped ? "ดูคำศัพท์" : "ดูความหมาย"}</div>
      </div>
      <div class="controls">
        <button id="prev" ${i === 0 ? "disabled" : ""}>&larr; ก่อนหน้า</button>
        <button id="say">🔊 ฟังเสียง</button>
        <span class="muted">${i + 1} / ${words.length}</span>
        <button id="next" class="primary" ${i === words.length - 1 ? "disabled" : ""}>ถัดไป &rarr;</button>
      </div>`;
    body.querySelector("#card").onclick = () => { flipped = !flipped; draw(); };
    body.querySelector("#say").onclick = () => speak(w.word);
    body.querySelector("#prev").onclick = () => { i--; flipped = false; draw(); };
    body.querySelector("#next").onclick = () => { i++; flipped = false; draw(); };
  }
  draw();
}

function showQuiz(body, lesson) {
  const questions = shuffle(lesson.words);
  let i = 0, score = 0;

  function draw() {
    if (i >= questions.length) {
      saveBestScore(lesson.id, score, questions.length);
      body.innerHTML = `
        <div class="result">
          <div class="score">${score} / ${questions.length}</div>
          <p>${score === questions.length ? "เยี่ยมมาก ถูกทุกข้อ!" : "ลองทบทวนแฟลชการ์ดแล้วทำใหม่อีกครั้ง"}</p>
          <button class="primary" id="again">ทำแบบทดสอบอีกครั้ง</button>
        </div>`;
      body.querySelector("#again").onclick = () => showQuiz(body, lesson);
      return;
    }
    const q = questions[i];
    const others = shuffle(lesson.words.filter(w => w !== q)).slice(0, 3);
    const choices = shuffle([q, ...others]);
    body.innerHTML = `
      <p class="muted">ข้อ ${i + 1} / ${questions.length} · คะแนน ${score}</p>
      <div class="question">${escapeHTML(q.word)}</div>
      <p class="muted" style="text-align:center">คำนี้แปลว่าอะไร?</p>
      <div class="choices">
        ${choices.map((c, n) => `<button data-n="${n}">${escapeHTML(c.meaning)}</button>`).join("")}
      </div>
      <div class="controls" style="margin-top:16px">
        <span></span>
        <button id="next" class="primary" hidden>ข้อต่อไป &rarr;</button>
      </div>`;
    const buttons = body.querySelectorAll(".choices button");
    buttons.forEach(btn => btn.onclick = () => {
      const picked = choices[btn.dataset.n];
      if (picked === q) score++;
      buttons.forEach(b => {
        b.disabled = true;
        if (choices[b.dataset.n] === q) b.classList.add("correct");
      });
      if (picked !== q) btn.classList.add("wrong");
      speak(q.word);
      const next = body.querySelector("#next");
      next.hidden = false;
      next.onclick = () => { i++; draw(); };
    });
  }
  draw();
}
