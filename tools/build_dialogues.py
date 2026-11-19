"""แปลง tools/dialogues.txt เป็น data/dialogues.json พร้อมตรวจความถูกต้อง

รัน: python tools/build_dialogues.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "dialogues.txt"
DST = ROOT / "data" / "dialogues.json"
LEVELS = {"A1", "A2", "B1"}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    cats, dialogs, errors = [], [], []
    cur_cat = cur = None
    for n, raw in enumerate(SRC.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        parts = [p.strip() for p in line.split("|")]
        if line.startswith("##"):
            cid, en, th, emoji = [p.strip() for p in line[2:].split("|")]
            cur_cat = cid
            cats.append({"id": cid, "en": en, "th": th, "emoji": emoji})
        elif line.startswith("="):
            level, en, th, emoji, scene = [p.strip() for p in line[1:].split("|")]
            if level not in LEVELS:
                errors.append(f"line {n}: ระดับไม่ถูกต้อง {level}")
            did = re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")
            if any(d["id"] == did for d in dialogs):
                errors.append(f"line {n}: id ซ้ำ {did}")
            cur = {"id": did, "cat": cur_cat, "level": level, "en": en, "th": th, "emoji": emoji, "scene": scene, "lines": []}
            dialogs.append(cur)
        elif re.match(r"^[AB]:", line):
            who, rest = line[0], line[2:]
            en, th = [p.strip() for p in rest.split("|")]
            if who == "B" and re.search(r"\d", en):
                errors.append(f"line {n}: ประโยคของผู้เรียนมีตัวเลข (ระบบแปลงเสียงตรวจยาก): {en}")
            cur["lines"].append({"who": who, "en": en, "th": th})
        else:
            errors.append(f"line {n}: อ่านไม่ออก: {line}")

    for d in dialogs:
        b = [l for l in d["lines"] if l["who"] == "B"]
        if len(b) < 3:
            errors.append(f"{d['id']}: ผู้เรียนต้องพูดอย่างน้อย 3 ประโยค")
        if len(d["lines"]) < 6:
            errors.append(f"{d['id']}: บทสนทนาสั้นเกินไป")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    DST.write_text(json.dumps({"cats": cats, "dialogs": dialogs}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    lv = {x: sum(d["level"] == x for d in dialogs) for x in sorted(LEVELS)}
    print(f"ok: {len(dialogs)} บทสนทนา, {len(cats)} หมวด, {sum(len(d['lines']) for d in dialogs)} บรรทัด, ระดับ {lv}")


if __name__ == "__main__":
    main()
