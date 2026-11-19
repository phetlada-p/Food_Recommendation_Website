"""
data_prep.py  -  เตรียมข้อมูลสำหรับโมเดลแนะนำเมนู (ใช้ร่วมกันโดยโมเดลและหน้าเว็บ)

ทำสิ่งเดียวกับขั้นตอน Data Cleaning / Ingredient Standardization ใน code.ipynb
แต่เขียนเป็นฟังก์ชันที่เรียกใช้ซ้ำได้ ไม่ต้องรัน notebook

ใช้เฉพาะ library มาตรฐานของ Python (ไม่ต้องติดตั้งอะไรเพิ่ม)
"""
import csv
import json
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "datasets"
DATASET_JSON = DATA_DIR / "thailand_foods_ai_dataset.json"
MAPPING_CSV = DATA_DIR / "ingredient_mapping_147.csv"

# เหมือน ingredient_mapping ในส่วน Ingredient Standardization ของ code.ipynb
PLURALS = {
    "chillies": "chili", "chilli": "chili", "chilies": "chili",
    "eggs": "egg", "vegetables": "vegetable", "herbs": "herb",
}

# ชื่อที่แสดงในหน้าเว็บ (ถ้าไม่ระบุ จะตัดเอาคำแรกก่อนเครื่องหมาย "/")
LABEL = {
    "เครื่องแกง": "พริกแกง",
    "ถั่วเขียว/ถั่วแขก": "ถั่วแขก",
    "เลือดหมู/เลือดก้อน": "เลือดก้อน",
}


def std(text):
    """ทำความสะอาดชื่อวัตถุดิบอังกฤษ: ตัดช่องว่าง, ตัวพิมพ์เล็ก, รวมคำพหูพจน์"""
    text = re.sub(r"\s+", " ", text).strip().lower()
    return PLURALS.get(text, text)


def label_of(th_key):
    """ชื่อไทยแบบสั้นสำหรับแสดงผล"""
    return LABEL.get(th_key, th_key.split("/")[0].strip())


def load_raw():
    """อ่านไฟล์ dataset ดิบ -> (รายการสูตร, แถวของ mapping)"""
    with open(DATASET_JSON, encoding="utf-8") as f:
        recipes_raw = json.load(f)
    with open(MAPPING_CSV, encoding="utf-8-sig") as f:
        mapping_rows = list(csv.DictReader(f))
    return recipes_raw, mapping_rows


def build_mapping(mapping_rows):
    """
    คืนค่า (th2en, en2th, notes)
      th2en : ไทย -> อังกฤษ  (ถ้าชื่อไทยซ้ำ ใช้แถวหลังสุด เหมือน dict(zip(...)) ใน notebook)
      en2th : อังกฤษ -> [ไทย, ...]  (เก็บทุกแถว ใช้ตอนแสดงผล)
      notes : ไทย -> review_note
    """
    th2en, notes = {}, {}
    en2th = defaultdict(list)
    for row in mapping_rows:
        th = row["ingredient_th"].strip()
        en = std(row["ingredient_en"])

        th2en[th] = en
        notes[th] = row["review_note"].strip()

        if th not in en2th[en]:
            en2th[en].append(th)
    return th2en, dict(en2th), notes


def build_recipes(recipes_raw, en2th):
    """
    แปลงสูตรดิบเป็นรูปแบบที่โมเดลและหน้าเว็บใช้
    เฉพาะสูตรที่มีรายการวัตถุดิบ (เหมือน model_df ใน notebook = 225 สูตร)

    แต่ละสูตร:
      id, name (ไทย), en, course, region, province
      ing   = ชื่อวัตถุดิบอังกฤษที่ standardize แล้ว (ไม่ซ้ำ) ใช้คำนวณ
      ingTh = ชื่อไทยที่ตรงกับ ing ทีละตัว ใช้แสดงผล
      สูตรที่มีขั้นตอนทำ จะมี req, opt, steps, src, tcook, ttotal, tnote เพิ่ม
    """
    warnings = []

    def display_label(en, draft_th=""):
        if en in en2th:
            return label_of(en2th[en][0])
        if draft_th:
            return draft_th
        warnings.append("ไม่มีชื่อไทยของ '%s' ใช้ชื่ออังกฤษแทน" % en)
        return en

    recipes = []
    for x in recipes_raw:
        if not x["ingredients_en"]:
            continue

        keys, labels, seen = [], [], set()
        drafts = list(x["ingredients_th_translation_draft"]) + [""] * len(x["ingredients_en"])

        for en_raw, draft in zip(x["ingredients_en"], drafts):
            key = std(en_raw)
            if not key or key in seen:
                continue
            seen.add(key)
            keys.append(key)
            labels.append(display_label(key, draft))

        rec = OrderedDict()
        rec["id"] = x["recipe_id"]
        rec["name"] = x["th_name"]
        rec["en"] = x["en_name"]
        rec["ing"] = keys
        rec["ingTh"] = labels
        rec["course"] = x["course"]
        rec["region"] = x["region"]
        rec["province"] = x["province"]

        if x["instructions"]:
            rec["req"] = x["required_ingredients"]
            rec["opt"] = x["optional_ingredients"]
            rec["steps"] = x["instructions"]
            rec["src"] = x["source_url"]
            rec["tcook"] = x["cooking_time_minutes"]
            rec["ttotal"] = x["total_time_minutes"]
            rec["tnote"] = x["time_notes"]

        recipes.append(rec)

    return recipes, sorted(set(warnings))


def load_prepared():
    """โหลดและเตรียมข้อมูลทั้งหมดในครั้งเดียว"""
    recipes_raw, mapping_rows = load_raw()
    th2en, en2th, notes = build_mapping(mapping_rows)
    recipes, warnings = build_recipes(recipes_raw, en2th)
    return {
        "recipes_raw": recipes_raw,
        "recipes": recipes,
        "th2en": th2en,
        "en2th": en2th,
        "notes": notes,
        "warnings": warnings,
    }


if __name__ == "__main__":
    data = load_prepared()
    print("สูตรทั้งหมด:", len(data["recipes_raw"]))
    print("สูตรที่ใช้กับโมเดลได้:", len(data["recipes"]))
    print("ตาราง mapping:", len(data["th2en"]))
    for w in data["warnings"]:
        print("เตือน:", w)
