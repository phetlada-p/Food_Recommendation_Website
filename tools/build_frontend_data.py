#!/usr/bin/env python3
"""
build_frontend_data.py  -  แปลง dataset ของสมาชิกคนที่ 2 ให้หน้าเว็บใช้ได้

อ่าน:  dataset/datasets/thailand_foods_ai_dataset.json
       dataset/datasets/ingredient_mapping_147.csv
เขียน: js/ingredients-data.js   (รายการวัตถุดิบที่ให้ผู้ใช้เลือก)
       js/recipes-data.js       (สูตรอาหาร + ตารางแปลงชื่อไทย -> อังกฤษ)

วิธีรัน (จากโฟลเดอร์โปรเจกต์):   python tools/build_frontend_data.py
รันใหม่ทุกครั้งที่สมาชิกคนที่ 2 แก้ dataset

ส่วนที่สมาชิกคนที่ 1 ดูแลเอง คือตารางด้านล่าง (หมวดหมู่, อีโมจิ, ชื่อที่แสดง)
"""
import json
import sys
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "js"

# ใช้ขั้นตอนเตรียมข้อมูลชุดเดียวกับโมเดล (dataset/data_prep.py) เพื่อให้หน้าเว็บกับโมเดลได้ผลตรงกัน
sys.path.insert(0, str(ROOT / "dataset"))
from data_prep import label_of, load_prepared  # noqa: E402


# ---------------------------------------------------------------
# 2) ตารางที่ปรับเองได้
# ---------------------------------------------------------------
# หมายเหตุใน ingredient_mapping_147.csv ที่มีคำเหล่านี้ = เป็นชื่อเมนู ไม่ใช่วัตถุดิบ
# จะไม่ให้ผู้ใช้เลือกในหน้าเว็บ (แต่ยังแสดงในรายการวัตถุดิบของสูตรตามเดิม)
NOT_INGREDIENT_WORDS = (
    "ชื่อเมนู", "ชื่ออาหาร", "ชื่อชุดอาหาร", "ชื่อข้าวหรือเมนู",
    "ไม่ใช่วัตถุดิบ", "ไม่น่าจะเป็น", "คล้ายชื่อเมนู",
)
# คีย์ภาษาไทยที่ไม่ให้เลือกเพิ่มเติม
EXCLUDE_TH = {"แกง/เครื่องแกง"}   # ซ้ำซ้อนกับ "เครื่องแกง"

CATEGORIES = OrderedDict([
    ("meat",      "เนื้อสัตว์และอาหารทะเล"),
    ("vegetable", "ผักและถั่ว"),
    ("fruit",     "ผลไม้และมะพร้าว"),
    ("dairy",     "ไข่และนม"),
    ("staple",    "ข้าว แป้ง เส้น"),
    ("seasoning", "เครื่องปรุงและน้ำแกง"),
    ("herb",      "สมุนไพรและเครื่องเทศ"),
    ("other",     "อื่น ๆ"),
])

# คีย์ = ชื่ออังกฤษหลัง standardize
CATEGORY = {}
for _cat, _keys in {
    "meat": "chicken,pork,beef,fish,shrimp,crab,crab meat,pork belly,ground pork,pork blood,blood tofu,"
            "pork leg,pork skin,pork spine,pork offal,offal,chicken feet,fermented fish,"
            "fermented fish entrails,fish paste,meat,isan sausage,northern sausage,shrimp paste balls",
    "vegetable": "bean sprouts,morning glory,chives,taro,taro stems,wax gourd,potato,cassava,mixed vegetables,"
                 "vegetable,pickled mustard greens,senna siamea leaves,green beans,mung beans",
    "fruit": "banana,pineapple,jackfruit,ripe mango,fruit,coconut",
    "dairy": "egg,egg yolk,fried eggs,hard-boiled eggs,butter,soy milk",
    "staple": "rice,glutinous rice,rice flour,glutinous rice flour,flour,rice noodles,noodles,crispy noodles,"
              "rice crackers,fermented rice noodles,yeast",
    "seasoning": "sugar,palm sugar,fish sauce,soy sauce,salt,oil,coconut milk,shrimp paste,curry paste,"
                 "green curry paste,red curry paste,massaman curry paste,sour curry paste,yellow curry paste,"
                 "hang lay curry paste,panaeng curry paste,tamarind paste,tamarind sauce,sweet and sour sauce,"
                 "peanut sauce,flavored syrup,broth,beef broth,blood broth,clear soup,sour broth,lime juice",
    "herb": "herb,spices,garlic,chili,ginger,galangal,turmeric,holy basil,pandan,pandan leaves,garcinia cowa,"
            "curry powder,chinese five-spice",
    "other": "peanuts,sesame,gelatin,grass jelly,ice,chestnuts,custard",
}.items():
    for _k in _keys.split(","):
        CATEGORY[_k] = _cat

DEFAULT_EMOJI = {"meat": "🥩", "vegetable": "🥬", "fruit": "🍎", "dairy": "🥚",
                 "staple": "🌾", "seasoning": "🧂", "herb": "🌿", "other": "🍴"}
EMOJI = {
    "chicken": "🍗", "pork": "🐖", "beef": "🥩", "fish": "🐟", "shrimp": "🦐", "crab": "🦀", "crab meat": "🦀",
    "pork belly": "🥓", "ground pork": "🥩", "pork blood": "🩸", "blood tofu": "🩸", "pork leg": "🍖",
    "pork offal": "🍖", "offal": "🍖", "chicken feet": "🍗", "fermented fish": "🐟",
    "isan sausage": "🌭", "northern sausage": "🌭", "shrimp paste balls": "🍤",
    "bean sprouts": "🌱", "morning glory": "🥬", "taro": "🍠", "cassava": "🍠", "wax gourd": "🥒",
    "potato": "🥔", "mixed vegetables": "🥗", "green beans": "🌱", "mung beans": "🌱",
    "banana": "🍌", "pineapple": "🍍", "jackfruit": "🍈", "ripe mango": "🥭", "coconut": "🥥",
    "egg": "🥚", "egg yolk": "🍳", "fried eggs": "🍳", "hard-boiled eggs": "🥚", "butter": "🧈", "soy milk": "🥛",
    "rice": "🍚", "glutinous rice": "🍙", "rice noodles": "🍜", "noodles": "🍜", "crispy noodles": "🍜",
    "fermented rice noodles": "🍜", "rice crackers": "🍘", "yeast": "🍞",
    "sugar": "🍬", "palm sugar": "🍯", "fish sauce": "🍶", "soy sauce": "🍶", "salt": "🧂", "oil": "🛢️",
    "coconut milk": "🥥", "shrimp paste": "🦐", "tamarind paste": "🍯", "tamarind sauce": "🍯",
    "sweet and sour sauce": "🍅", "peanut sauce": "🥜", "flavored syrup": "🍯", "lime juice": "🍋",
    "broth": "🍲", "beef broth": "🍲", "blood broth": "🍲", "clear soup": "🍲", "sour broth": "🍲",
    "garlic": "🧄", "chili": "🌶️", "spices": "🌰", "pandan": "🍃", "pandan leaves": "🍃",
    "garcinia cowa": "🍋", "curry powder": "🍛", "chinese five-spice": "🥢",
    "peanuts": "🥜", "sesame": "🌰", "gelatin": "🍮", "grass jelly": "🍮", "ice": "🧊",
    "chestnuts": "🌰", "custard": "🍮",
}
for _k in list(CATEGORY):
    if _k.endswith("curry paste"):
        EMOJI.setdefault(_k, "🍛")


def main():
    data = load_prepared()
    recipes_raw = data["recipes_raw"]
    recipes = data["recipes"]
    th2en, en2th, notes = data["th2en"], data["en2th"], data["notes"]
    warnings = list(data["warnings"])

    freq = Counter()
    for r in recipes:
        freq.update(r["ing"])
    classes = set(freq)

    # ---------- วัตถุดิบที่ให้ผู้ใช้เลือก ----------
    groups = OrderedDict()          # label -> dict
    for en, count in freq.items():
        if en not in en2th:
            continue
        for th in en2th[en]:
            note = notes.get(th, "")
            if th in EXCLUDE_TH or any(w in note for w in NOT_INGREDIENT_WORDS):
                continue
            lab = label_of(th)
            g = groups.setdefault(lab, {"label": lab, "names": [], "ens": set(), "category": None, "emoji": None})
            if th not in g["names"]:
                g["names"].append(th)
            g["ens"].add(en)

    items = []
    for lab, g in groups.items():
        ens = sorted(g["ens"], key=lambda e: -freq[e])
        main_en = ens[0]
        cat = CATEGORY.get(main_en)
        if cat is None:
            warnings.append("ยังไม่ได้กำหนดหมวดของ '%s' (%s) -> ใส่ 'other'" % (lab, main_en))
            cat = "other"
        count = sum(1 for r in recipes if any(e in g["ens"] for e in r["ing"]))
        items.append({
            "label": lab,
            "names": g["names"],
            "emoji": EMOJI.get(main_en, DEFAULT_EMOJI[cat]),
            "category": cat,
            "count": count,
        })
    items.sort(key=lambda i: (-i["count"], i["label"]))

    # ---------- เขียนไฟล์ ----------
    header = ("// ไฟล์นี้สร้างอัตโนมัติจาก tools/build_frontend_data.py  ห้ามแก้ด้วยมือ\n"
              "// ถ้า dataset เปลี่ยน ให้รัน:  python tools/build_frontend_data.py\n")

    def dumps(o):
        return json.dumps(o, ensure_ascii=False, separators=(",", ":"))

    with open(OUT_DIR / "ingredients-data.js", "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write("//\n// label = ชื่อที่แสดง | names = ชื่อไทยที่ส่งไปให้โมเดล (ต้องตรงกับ ingredient_mapping_147.csv)\n")
        f.write("// count = จำนวนเมนูใน dataset ที่ใช้วัตถุดิบนี้\n\n")
        f.write("const INGREDIENT_CATEGORIES = %s;\n\n" % dumps(CATEGORIES))
        f.write("const INGREDIENT_DATA = [\n")
        f.write(",\n".join("    " + dumps(i) for i in items))
        f.write("\n];\n")

    with open(OUT_DIR / "recipes-data.js", "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write("//\n// INGREDIENT_MAP = ตารางแปลงชื่อวัตถุดิบไทย -> อังกฤษ (จาก ingredient_mapping_147.csv)\n")
        f.write("// RECIPE_DATA    = สูตรที่มีรายการวัตถุดิบ (ing = ชื่ออังกฤษที่ใช้คำนวณ, ingTh = ชื่อไทยที่แสดง)\n\n")
        f.write("const INGREDIENT_MAP = %s;\n\n" % dumps(th2en))
        f.write("const RECIPE_DATA = [\n")
        f.write(",\n".join("    " + dumps(r) for r in recipes))
        f.write("\n];\n")

    # ---------- สรุป ----------
    print("สูตรทั้งหมดใน dataset      :", len(recipes_raw))
    print("สูตรที่มีวัตถุดิบ (ใช้ได้)   :", len(recipes))
    print("สูตรที่มีขั้นตอนทำ          :", sum(1 for r in recipes if r.get("steps")))
    print("วัตถุดิบที่ใช้ในสูตร (ชนิด)  :", len(classes))
    print("วัตถุดิบที่ให้เลือกในเว็บ    :", len(items))
    print("แยกตามหมวด                :", dict(Counter(i["category"] for i in items)))
    print("ชื่อที่รวมหลายคีย์ (alias)   :", [(i["label"], i["names"]) for i in items if len(i["names"]) > 1])
    for w in sorted(set(warnings)):
        print("เตือน:", w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
