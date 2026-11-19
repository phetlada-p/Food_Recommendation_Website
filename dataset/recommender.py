"""
recommender.py  -  โมเดลแนะนำเมนูอาหารไทยจากวัตถุดิบ  (สมาชิกคนที่ 2: AI Model / Dataset)

วิธีทำงาน
  1. แปลงชื่อวัตถุดิบภาษาไทยของผู้ใช้เป็นภาษาอังกฤษ ด้วย ingredient_mapping_147.csv
  2. แทนแต่ละเมนูด้วยเวกเตอร์ TF-IDF ของวัตถุดิบ
       - วัตถุดิบที่พบในหลายเมนู (เช่น น้ำตาล กะทิ) ได้น้ำหนักน้อย
       - วัตถุดิบที่พบในไม่กี่เมนู (เช่น กุ้ง ขิง) ได้น้ำหนักมาก
  3. วัดความคล้ายระหว่างวัตถุดิบของผู้ใช้กับแต่ละเมนูด้วย Cosine Similarity
  4. จัดอันดับ: ทำได้ทันที -> Coverage มาก -> Similarity มาก  (ตามที่ออกแบบใน code.ipynb)

วิธีใช้ในโค้ดอื่น (เช่น Flask API ของสมาชิกคนที่ 3)
    from recommender import load_model
    model = load_model()                                  # โหลด model/tfidf_model.joblib
    model.recommend(["กระเทียม", "น้ำปลา", "พริก"], top_n=30)   # -> list ของ dict
    model.get_recipe("R025")                              # -> dict รายละเอียดเมนู

วิธีรันจาก command line (ในโฟลเดอร์ dataset)
    python recommender.py train   สร้างและบันทึกไฟล์โมเดล
    python recommender.py eval    ทดสอบความแม่นยำ (TF-IDF เทียบกับแบบ 0/1 เดิม)
    python recommender.py demo    ลองแนะนำเมนูตัวอย่าง

ต้องติดตั้ง: pip install scikit-learn joblib
"""
import random
import sys

from data_prep import HERE, load_prepared

MODEL_DIR = HERE / "model"
MODEL_PATH = MODEL_DIR / "tfidf_model.joblib"

READY = "ทำได้ทันที"
NEED_MORE = "ต้องซื้อเพิ่ม"


# ชนิดวัตถุดิบที่ถือว่าเป็นเนื้อสัตว์ เมื่อสูตรใช้คำรวมว่า "meat"
MEAT_INGREDIENTS = {
    "pork", "ground pork", "pork belly", "pork leg", "pork offal",
    "pork spine", "pork skin", "pork blood",
    "chicken", "chicken feet", "beef", "duck", "meat",
}


def ingredient_matches(recipe_ingredient, user_set):
    """ตรวจว่าวัตถุดิบที่ผู้ใช้มีตรงกับวัตถุดิบในสูตรหรือไม่"""
    if recipe_ingredient in user_set:
        return True
    return (
        recipe_ingredient == "meat"
        and any(item in MEAT_INGREDIENTS for item in user_set)
    )


def expand_query_ingredients(user_ingredients):
    """เพิ่ม feature กลาง meat เมื่อผู้ใช้เลือกเนื้อสัตว์ชนิดใดชนิดหนึ่ง"""
    expanded = set(user_ingredients)
    if any(item in MEAT_INGREDIENTS and item != "meat"
           for item in user_ingredients):
        expanded.add("meat")
    return expanded


def identity(tokens):
    """analyzer ของ TfidfVectorizer: แต่ละเมนูมีรายการวัตถุดิบเป็นโทเค็นอยู่แล้ว
    (ต้องอยู่ระดับโมดูล เพื่อให้ joblib บันทึก/โหลดโมเดลได้)"""
    return tokens


class FoodRecommender:
    """
    method = "tfidf"   -> น้ำหนัก TF-IDF (โมเดลหลัก)
    method = "binary"  -> แบบ 0/1 เหมือน MultiLabelBinarizer เดิมใน notebook (ใช้เปรียบเทียบ)
    """

    def __init__(self, method="tfidf"):
        if method not in ("tfidf", "binary"):
            raise ValueError("method ต้องเป็น 'tfidf' หรือ 'binary'")
        self.method = method

    # ---------- สร้างโมเดล ----------

    def fit(self):
        from sklearn.feature_extraction.text import TfidfVectorizer

        data = load_prepared()
        self.recipes = data["recipes"]
        self.th2en = data["th2en"]

        self.vectorizer = TfidfVectorizer(
            analyzer=identity,
            use_idf=(self.method == "tfidf"),
            norm="l2",
        )
        self.matrix = self.vectorizer.fit_transform([r["ing"] for r in self.recipes])
        self.vocab = set(self.vectorizer.vocabulary_)
        self.index_by_id = {r["id"]: i for i, r in enumerate(self.recipes)}
        return self

    # ---------- ส่วนประกอบของการแนะนำ ----------

    def translate(self, ingredients_th):
        """ไทย -> อังกฤษ  คืนค่า (รายการอังกฤษไม่ซ้ำ, รายการที่ไม่พบใน mapping)"""
        found, not_found = [], []
        for name in ingredients_th:
            name = str(name).strip()
            en = self.th2en.get(name)
            if en is None:
                not_found.append(name)
            elif en not in found:
                found.append(en)
        return found, not_found

    def similarity(self, ingredients_en):
        """Cosine Similarity ระหว่างวัตถุดิบ (อังกฤษ) ที่ให้มา กับทุกเมนู"""
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity

        query_features = expand_query_ingredients(set(ingredients_en))
        known = [e for e in query_features if e in self.vocab]
        if not known:
            return np.zeros(len(self.recipes))
        query = self.vectorizer.transform([known])
        return cosine_similarity(query, self.matrix)[0]

    # ---------- แนะนำเมนู + จัดอันดับ ----------

    def recommend(self, ingredients_th, top_n=30):
        """
        รับรายชื่อวัตถุดิบภาษาไทย คืน list ของ dict เรียงตามอันดับ
        ฟิลด์ตรงกับที่หน้าเว็บ/Flask ใช้ (ดู README.md หัวข้อ API)
        """
        user_en, _ = self.translate(ingredients_th)
        if not user_en:
            return []

        user_set = set(user_en)
        # ชื่อไทยที่ผู้ใช้เลือกจริง ใช้แทนคำกลาง "เนื้อสัตว์" ในผล matched
        selected_meat_labels = [
            str(name).strip() for name in ingredients_th
            if self.th2en.get(str(name).strip()) in MEAT_INGREDIENTS
            and self.th2en.get(str(name).strip()) != "meat"
        ]
        sims = self.similarity(user_en)
        results = []

        for i, r in enumerate(self.recipes):
            matched = []
            for k, e in enumerate(r["ing"]):
                if ingredient_matches(e, user_set):
                    if e == "meat" and selected_meat_labels:
                        # ช่องเนื้อสัตว์ในสูตรนับเป็น 1 ช่อง แต่แสดงชื่อที่ผู้ใช้เลือก
                        matched.append(" / ".join(selected_meat_labels))
                    else:
                        matched.append(r["ingTh"][k])
            missing = [
                r["ingTh"][k] for k, e in enumerate(r["ing"])
                if not ingredient_matches(e, user_set)
            ]
            if not matched:
                continue

            coverage = len(matched) / len(r["ing"]) * 100
            results.append({
                "id": r["id"],
                "name": r["name"],
                "en_name": r["en"],
                "score": int(coverage + 0.5),          # ปัดแบบเดียวกับ JavaScript
                "coverage": coverage,
                "similarity": float(sims[i]),
                "status": READY if not missing else NEED_MORE,
                "matched": matched,
                "missing": missing,
                "course": r["course"],
                "region": r["region"],
                "province": r["province"],
                "time": r.get("ttotal") or r.get("tcook") or None,
                "_index": i,
            })

        # จัดอันดับตามความตรงของวัตถุดิบ:
        # coverage สูง -> จำนวนวัตถุดิบที่ตรงมาก -> cosine สูง -> ทำได้ทันที
        results.sort(key=lambda x: (
            -round(x["coverage"], 9),
            -len(x["matched"]),
            -round(x["similarity"], 9),
            0 if x["status"] == READY else 1,
            x["_index"],
        ))
        for x in results:
            del x["_index"]

        return results[:top_n]

    def get_recipe(self, recipe_id):
        """รายละเอียดเมนู (None ถ้าไม่พบ)"""
        i = self.index_by_id.get(str(recipe_id))
        if i is None:
            return None
        r = self.recipes[i]
        return {
            "id": r["id"],
            "name": r["name"],
            "en_name": r["en"],
            "course": r["course"],
            "region": r["region"],
            "province": r["province"],
            "ingredients": r["ingTh"],
            "required_ingredients": r.get("req", []),
            "optional_ingredients": r.get("opt", []),
            "instructions": r.get("steps", []),
            "cooking_time_minutes": r.get("tcook"),
            "total_time_minutes": r.get("ttotal"),
            "time_notes": r.get("tnote", ""),
            "source_url": r.get("src", ""),
        }

    def idf_table(self):
        """น้ำหนัก IDF ของแต่ละวัตถุดิบ (ใช้ดู/รายงาน) เรียงจากมากไปน้อย"""
        if self.method != "tfidf":
            return []
        pairs = zip(self.vectorizer.get_feature_names_out(), self.vectorizer.idf_)
        return sorted(((str(k), float(v)) for k, v in pairs), key=lambda p: -p[1])

    # ---------- บันทึก / โหลด ----------

    def save(self, path=MODEL_PATH):
        import joblib
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        return path


def load_model(path=MODEL_PATH):
    """โหลดโมเดลที่บันทึกไว้ ถ้ายังไม่มีไฟล์ จะสร้างใหม่และบันทึกให้"""
    import joblib
    if path.exists():
        return joblib.load(path)
    import recommender            # ให้ pickle อ้างถึง recommender.FoodRecommender เสมอ
    model = recommender.FoodRecommender("tfidf").fit()
    model.save(path)
    return model


# ---------------------------------------------------------------
#  ทดสอบโมเดล (Model Evaluation)
# ---------------------------------------------------------------

def evaluate(method="tfidf", n_runs=5, seed=42, top_ks=(1, 3, 5)):
    """
    วิธีเดียวกับเซลล์ Model Evaluation ใน code.ipynb:
    สำหรับแต่ละเมนู สุ่มวัตถุดิบมา 50% (อย่างน้อย 1 อย่าง) แล้วดูว่าโมเดลแนะนำเมนูนั้นกลับมาได้หรือไม่

    จัดอันดับด้วยคะแนน Similarity อย่างเดียว (เท่ากันเรียงตามลำดับใน dataset)
      strict  = เมนูต้นฉบับต้องอยู่ใน Top-K
      lenient = นับว่าถูก ถ้าใน Top-K มีเมนูที่ใช้วัตถุดิบชุดเดียวกับเมนูต้นฉบับ
                (dataset มีหลายเมนูที่วัตถุดิบเหมือนกันทุกอย่าง ทำให้แยกกันไม่ได้)
    """
    import recommender

    model = recommender.FoodRecommender(method).fit()
    recipes = model.recipes
    ing_sets = [frozenset(r["ing"]) for r in recipes]
    usable = [i for i, r in enumerate(recipes) if len(r["ing"]) >= 2]

    strict = {k: 0 for k in top_ks}
    lenient = {k: 0 for k in top_ks}
    total = 0

    for run in range(n_runs):
        random.seed(seed + run)
        for i in usable:
            ing = recipes[i]["ing"]
            query = random.sample(ing, max(1, len(ing) // 2))
            sims = model.similarity(query)
            order = sorted(range(len(recipes)), key=lambda j: (-round(float(sims[j]), 12), j))

            total += 1
            for k in top_ks:
                top = order[:k]
                if i in top:
                    strict[k] += 1
                if any(ing_sets[j] == ing_sets[i] for j in top):
                    lenient[k] += 1

    return {
        "method": method,
        "tests": total,
        "strict": {k: strict[k] / total * 100 for k in top_ks},
        "lenient": {k: lenient[k] / total * 100 for k in top_ks},
    }


# ---------------------------------------------------------------
#  command line
# ---------------------------------------------------------------

def _print_results(title, rows):
    print("\n" + title)
    for n, x in enumerate(rows, 1):
        print("%2d. %-22s coverage %5.1f%%  similarity %.3f  %s  มี=%s ขาด=%s" % (
            n, x["name"], x["coverage"], x["similarity"], x["status"],
            "+".join(x["matched"]), "+".join(x["missing"]) or "-"))


def main(argv):
    import recommender   # ใช้ชื่อโมดูล 'recommender' เสมอ (ไม่ใช่ __main__) เพื่อให้ไฟล์โมเดลโหลดได้จากที่อื่น

    command = argv[1] if len(argv) > 1 else "demo"

    if command == "train":
        model = recommender.FoodRecommender("tfidf").fit()
        path = model.save()
        print("บันทึกโมเดลแล้ว:", path)
        print("จำนวนเมนู:", len(model.recipes), "| จำนวนวัตถุดิบ (features):", len(model.vocab))
        print("วัตถุดิบที่ IDF สูงสุด (พบในไม่กี่เมนู):", [k for k, _ in model.idf_table()[:5]])
        print("วัตถุดิบที่ IDF ต่ำสุด (พบในหลายเมนู)  :", [k for k, _ in model.idf_table()[-5:]])

    elif command == "eval":
        print("กำลังทดสอบ (5 รอบ รอบละ ~200 เมนู)...")
        rows = [recommender.evaluate("binary"), recommender.evaluate("tfidf")]
        print("\n%-22s %8s %8s %8s   %8s %8s %8s" % ("วิธี", "Top1", "Top3", "Top5", "L-Top1", "L-Top3", "L-Top5"))
        for r in rows:
            name = "TF-IDF" if r["method"] == "tfidf" else "Binary (0/1 เดิม)"
            s, l = r["strict"], r["lenient"]
            print("%-22s %7.1f%% %7.1f%% %7.1f%%   %7.1f%% %7.1f%% %7.1f%%" % (
                name, s[1], s[3], s[5], l[1], l[3], l[5]))
        print("\nTop-K = เมนูต้นฉบับอยู่ใน K อันดับแรก | L- = นับเมนูที่วัตถุดิบเหมือนกันเป๊ะว่าถูกด้วย")
        print("จำนวนการทดสอบ:", rows[0]["tests"])

    else:
        model = recommender.load_model()
        _print_results("ตัวอย่าง 1: เนื้อวัว กระเทียม น้ำปลา พริก กะทิ",
                       model.recommend(["เนื้อวัว", "กระเทียม", "น้ำปลา", "พริก", "กะทิ"], top_n=5))
        _print_results("ตัวอย่าง 2: กระเทียม น้ำปลา พริก กุ้ง",
                       model.recommend(["กระเทียม", "น้ำปลา", "พริก", "กุ้ง"], top_n=5))
        _print_results("ตัวอย่าง 3: น้ำตาล กะทิ แป้ง",
                       model.recommend(["น้ำตาล", "กะทิ", "แป้ง"], top_n=5))
        print("\nตัวอย่าง 4: วัตถุดิบที่ไม่มีในฐานข้อมูล ->", model.recommend(["วัตถุดิบที่ไม่มีในฐานข้อมูล"]))


if __name__ == "__main__":
    main(sys.argv)
