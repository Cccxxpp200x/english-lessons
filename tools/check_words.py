"""ตรวจไฟล์คำศัพท์ใน data/words/ ก่อน commit

วิธีใช้:  python tools/check_words.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data" / "words"
FIELDS = ["id", "word", "ipa", "pos", "meaning", "collocation", "collocationTh",
          "cloze", "clozeTh", "simple", "simpleTh", "emoji"]

errors = []
seen_ids = {}
seen_sentences = {}
total = 0

files = json.loads((ROOT / "index.json").read_text(encoding="utf-8"))["files"]
for name in files:
    try:
        words = json.loads((ROOT / name).read_text(encoding="utf-8"))["words"]
    except Exception as e:  # noqa: BLE001
        errors.append(f"{name}: อ่านไฟล์ไม่ได้ ({e})")
        continue
    for w in words:
        total += 1
        where = f"{name} · {w.get('id', '?')}"
        for f in FIELDS:
            if not str(w.get(f, "")).strip():
                errors.append(f"{where}: ไม่มีฟิลด์ {f}")
        wid = w.get("id")
        if wid in seen_ids:
            errors.append(f"{where}: id ซ้ำกับใน {seen_ids[wid]}")
        seen_ids[wid] = name
        if not re.search(rf"\b{re.escape(w.get('word', ''))}\b", w.get("collocation", ""), re.I):
            errors.append(f"{where}: collocation ไม่มีคำ '{w.get('word')}'")
        for f in ("cloze", "simple"):
            s = w.get(f, "")
            if s.count("___") != 1:
                errors.append(f"{where}: {f} ต้องมี ___ หนึ่งจุดพอดี")
            if s in seen_sentences:
                errors.append(f"{where}: {f} ซ้ำกับประโยคของ {seen_sentences[s]}")
            seen_sentences[s] = wid

if errors:
    print("\n".join(errors))
    print(f"\nพบปัญหา {len(errors)} จุด")
    sys.exit(1)
print(f"ผ่าน: {total} คำ จาก {len(files)} ไฟล์")
