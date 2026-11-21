"""ทดสอบ Flask API ของระบบ (ไม่ต้องเปิดเซิร์ฟเวอร์)

รัน:  python -m unittest tests.test_api -v
      (ต้องรันจากโฟลเดอร์หลักของโปรเจกต์ และติดตั้ง requirements.txt แล้ว)

หมายเหตุ: ถ้าไม่ได้ติดตั้ง torch หรือไม่มีไฟล์น้ำหนักโมเดลรูปภาพ
/api/recognize จะตอบ 503 ซึ่งเทสต์ถือว่าถูกต้อง
"""
import io
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app as backend  # noqa: E402


class ApiTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = backend.app.test_client()

    def recommend(self, body):
        return self.client.post("/api/recommend", json=body)

    # ---------- /api/recommend ----------

    def test_recommend_normal(self):
        r = self.recommend({"ingredients": ["เนื้อหมู", "กระเทียม", "พริก", "น้ำปลา"], "top_n": 10})
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(0 < len(data) <= 10)
        for key in ("id", "name", "score", "coverage", "similarity",
                    "status", "matched", "missing"):
            self.assertIn(key, data[0])
        # เรียงจากดีไปน้อย: เมนู "ทำได้ทันที" ต้องมาก่อนเมนูที่ต้องซื้อเพิ่ม
        statuses = [x["status"] for x in data]
        if "ทำได้ทันที" in statuses and "ต้องซื้อเพิ่ม" in statuses:
            self.assertLess(statuses.index("ทำได้ทันที"),
                            statuses.index("ต้องซื้อเพิ่ม"))

    def test_recommend_thai_output(self):
        data = self.recommend({"ingredients": ["กระเทียม", "พริก"]}).get_json()
        for item in data:
            for name in item["matched"] + item["missing"]:
                self.assertTrue(any("฀" <= ch <= "๿" for ch in name), name)

    def test_recommend_unknown_ingredient(self):
        r = self.recommend({"ingredients": ["ไม่มีวัตถุดิบนี้"]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), [])

    def test_recommend_empty_list(self):
        r = self.recommend({"ingredients": []})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), [])

    def test_recommend_bad_requests(self):
        bad = [
            {"ingredients": "กระเทียม"},
            {"ingredients": [1, 2]},
            {"ingredients": ["  "]},
            {"ingredients": ["กระเทียม"], "top_n": 0},
            {"ingredients": ["กระเทียม"], "top_n": 101},
            {"ingredients": ["กระเทียม"], "top_n": True},
            {"top_n": 5},
        ]
        for body in bad:
            with self.subTest(body=body):
                self.assertEqual(self.recommend(body).status_code, 400)
        r = self.client.post("/api/recommend", data="not json",
                             content_type="text/plain")
        self.assertEqual(r.status_code, 400)

    def test_recommend_meat_generic(self):
        # สูตรที่ระบุ "meat" กว้าง ๆ ต้องจับคู่กับหมู/ไก่/วัวที่ผู้ใช้เลือกได้
        data = self.recommend({"ingredients": ["เนื้อหมู", "พริก", "กระเทียม"],
                               "top_n": 100}).get_json()
        nam_tok = [x for x in data if x["name"] == "น้ำตก"]
        self.assertTrue(nam_tok)
        self.assertEqual(nam_tok[0]["status"], "ทำได้ทันที")

    # ---------- /api/recipe ----------

    def test_recipe_found(self):
        r = self.client.get("/api/recipe/R025")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["id"], "R025")
        self.assertTrue(data["instructions"])

    def test_recipe_not_found(self):
        self.assertEqual(self.client.get("/api/recipe/NOPE").status_code, 404)

    # ---------- SQLite ----------

    def test_db_health(self):
        r = self.client.get("/api/db/health")
        self.assertEqual(r.status_code, 200)
        counts = r.get_json()["counts"]
        self.assertEqual(counts["recipes"], 325)
        self.assertGreater(counts["ingredients"], 0)
        self.assertGreater(counts["relationships"], 0)

    def test_db_recipes_and_detail(self):
        r = self.client.get("/api/db/recipes?limit=5")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["count"], 5)
        self.assertEqual(self.client.get("/api/db/recipes?limit=0").status_code, 400)
        ok = self.client.get("/api/db/recipe/R025")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.get_json()["recipe"]["ingredients"])
        self.assertEqual(self.client.get("/api/db/recipe/NOPE").status_code, 404)

    def test_db_ingredients(self):
        r = self.client.get("/api/db/ingredients")
        self.assertEqual(r.status_code, 200)
        self.assertGreater(r.get_json()["count"], 100)

    # ---------- เสิร์ฟหน้าเว็บ ----------

    def test_frontend_files(self):
        for path in ("/", "/ingredients.html", "/recommendations.html",
                     "/recipe-detail.html", "/js/api.js", "/css/style.css"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)
        # ต้องไม่เปิดไฟล์โค้ดหลังบ้านหรือฐานข้อมูลให้ดาวน์โหลด
        for path in ("/app.py", "/dataset/smart_fridge.db", "/requirements.txt"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    # ---------- /api/recognize ----------

    def test_recognize_validation(self):
        r = self.client.post("/api/recognize")
        # 503 = โมเดลรูปภาพยังไม่พร้อม, 400 = ไม่ได้แนบไฟล์
        self.assertIn(r.status_code, (400, 503))
        if backend.image_recognizer is None:
            return
        txt = {"image": (io.BytesIO(b"abc"), "a.txt")}
        self.assertEqual(
            self.client.post("/api/recognize", data=txt,
                             content_type="multipart/form-data").status_code, 400)
        fake = {"image": (io.BytesIO(b"not an image"), "a.jpg")}
        self.assertEqual(
            self.client.post("/api/recognize", data=fake,
                             content_type="multipart/form-data").status_code, 400)


if __name__ == "__main__":
    unittest.main()
