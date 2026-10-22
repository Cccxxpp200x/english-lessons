"""แปลง tools/patterns.txt เป็น data/patterns.json พร้อมตรวจความถูกต้อง

รัน: python tools/build_patterns.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "patterns.txt"
DST = ROOT / "data" / "patterns.json"
LEVELS = {"A1", "A2", "B1"}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    tabs, cats, patterns, errors = [], [], [], []
    cur_cat = cur = None
    seen_ids = set()

    for n, raw in enumerate(SRC.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") and not line.startswith("##"):
            continue
        where = f"line {n}"
        parts = [p.strip() for p in line.lstrip("@#->").split("|")]
        if line.startswith("@"):
            if len(parts) == 4:
                tabs.append({"id": parts[0], "en": parts[1], "th": parts[2], "icon": parts[3]})
            continue  # "@food" เดี่ยวๆ ใช้คั่นส่วนให้อ่านง่าย
        if line.startswith("##"):
            tab, _, cid = parts[0].partition(".")
            cur_cat = parts[0]
            cats.append({"id": cur_cat, "tab": tab, "en": parts[1], "th": parts[2]})
            continue
        if line.startswith("-"):
            en, th, emoji = (parts + ["", ""])[:3]
            cur["slots"].append({"en": en, "th": th, "emoji": emoji})
            continue
        if line.startswith(">"):
            label, frame, th = parts
            cur["variants"].append({"label": label, "frame": frame, "th": th})
            continue
        level, frame, th, use, *note = parts
        if level not in LEVELS:
            errors.append(f"{where}: ระดับไม่ถูกต้อง {level}")
        pid = re.sub(r"[^a-z0-9]+", "-", frame.lower().replace("{x}", "x")).strip("-")[:48]
        if pid in seen_ids:
            errors.append(f"{where}: id ซ้ำ {pid}")
        seen_ids.add(pid)
        cur = {"id": pid, "cat": cur_cat, "level": level, "frame": frame, "th": th, "use": use,
               "note": note[0] if note else "", "slots": [], "variants": []}
        patterns.append(cur)

    tab_ids = {t["id"] for t in tabs}
    for c in cats:
        if c["tab"] not in tab_ids:
            errors.append(f"หมวด {c['id']}: ไม่มีแท็บ {c['tab']}")
    for p in patterns:
        tag = p["id"]
        for f in [p["frame"], p["th"]] + [v["frame"] for v in p["variants"]] + [v["th"] for v in p["variants"]]:
            if f.count("{x}") != 1:
                errors.append(f"{tag}: ต้องมี {{x}} หนึ่งที่: {f}")
        if len(p["slots"]) < 6:
            errors.append(f"{tag}: คำเติมช่องน้อยกว่า 6 ({len(p['slots'])})")
        if not p["variants"]:
            errors.append(f"{tag}: ไม่มีรูปเปลี่ยน")
        ens = [s["en"].lower() for s in p["slots"]]
        if len(set(ens)) != len(ens):
            errors.append(f"{tag}: คำเติมช่องซ้ำ")
        for s in p["slots"]:
            if not s["th"] or not s["emoji"]:
                errors.append(f"{tag}: คำเติม '{s['en']}' ไม่มีคำแปลหรืออีโมจิ")
            if re.search(r"[\"“”{}]", s["en"]):
                errors.append(f"{tag}: คำเติมมีอักขระต้องห้าม: {s['en']}")
            full = p["frame"].replace("{x}", s["en"])
            if len(full.split()) < 3:
                errors.append(f"{tag}: ประโยคสั้นเกินไปสำหรับเรียงบัตรคำ: {full}")

    if errors:
        print("\n".join(errors))
        sys.exit(1)

    DST.write_text(json.dumps({"tabs": tabs, "cats": cats, "patterns": patterns}, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8", newline="\n")
    by_level = {lv: sum(p["level"] == lv for p in patterns) for lv in sorted(LEVELS)}
    print(f"ok: {len(patterns)} รูปประโยค, {len(cats)} หมวด, {len(tabs)} แท็บ, ระดับ {by_level}")


if __name__ == "__main__":
    main()
