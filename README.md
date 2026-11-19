# What's in Your Fridge? — เว็บแนะนำเมนูอาหารไทยจากวัตถุดิบในตู้เย็น

| สมาชิก | หน้าที่ | สถานะ |
|---|---|---|
| คนที่ 1 | UI / Frontend | เสร็จ (เชื่อม API แล้ว ใช้งานได้แม้ Flask ยังไม่เปิด) |
| คนที่ 2 | AI Model / Dataset | เสร็จ (Dataset, Source Code, Model พร้อมส่งมอบ) |
| คนที่ 3 | Backend / Evaluation / Report | **ยังไม่ได้ทำ** ดูรายการใน [`MEMBER3_TODO.md`](MEMBER3_TODO.md) |

## วิธีเปิดเว็บ

ดับเบิลคลิก `index.html` ได้เลย (ไม่ต้องติดตั้งอะไร)  
หรือรันเซิร์ฟเวอร์จากโฟลเดอร์นี้: `python -m http.server 8000` แล้วเปิด http://localhost:8000

หน้าผลแนะนำจะมีป้ายบอกว่าผลลัพธ์มาจากไหน  
🟢 มาจากโมเดลผ่าน Flask API / 🟡 คำนวณในเบราว์เซอร์ (ยังไม่ได้เชื่อม Flask)

## โครงสร้างไฟล์

```
index.html / ingredients.html / recommendations.html / recipe-detail.html   4 หน้าเว็บ
css/style.css
js/
  api.js                ตัวกลางข้อมูล: ลองเรียก Flask ก่อน ถ้าไม่ได้ใช้การคำนวณในเบราว์เซอร์
  ingredients-data.js   (สร้างอัตโนมัติ) รายการวัตถุดิบที่ให้เลือก
  recipes-data.js       (สร้างอัตโนมัติ) สูตรอาหาร + ตารางแปลงไทย -> อังกฤษ
  ingredients.js / recommendations.js / recipe-detail.js / script.js
tools/build_frontend_data.py   แปลง dataset -> js/*-data.js
dataset/                       ส่วนของคนที่ 2
  datasets/                    Dataset (JSON, CSV, ตาราง mapping 147 วัตถุดิบ)
  code.ipynb                   ขั้นตอนทำความสะอาดข้อมูล, โมเดล, การทดสอบ
  data_prep.py                 เตรียมข้อมูล (ใช้ร่วมกับหน้าเว็บ)
  recommender.py               Source Code ของโมเดล TF-IDF + Cosine + จัดอันดับ + ทดสอบ
  model/tfidf_model.joblib     ไฟล์ Model ที่บันทึกแล้ว
```

ติดตั้ง library: `pip install -r requirements.txt`

---

## ส่วนของคนที่ 1 (UI / Frontend)

- ออกแบบเว็บ 4 หน้า: หน้าแรก, เลือกวัตถุดิบ, ผลการแนะนำเมนู, รายละเอียดสูตร
- ระบบเลือกวัตถุดิบ 105 ชนิดจาก dataset: ค้นหา, กรองตามหมวด, แถบสรุปติดขอบล่าง, จำรายการที่เลือกไว้
- หน้าผลการแนะนำ: Coverage, สถานะ "ทำได้ทันที/ต้องซื้อเพิ่ม", TF-IDF Cosine, กรอง/เรียง, เมนูโปรด
- หน้ารายละเอียด: วัตถุดิบ (มีแล้ว/ต้องซื้อ), ขั้นตอนทำ, รายการซื้อเพิ่ม, ลิงก์ค้นหาวิธีทำสำหรับเมนูที่ยังไม่มีขั้นตอน
- เชื่อม Frontend กับ API: `js/api.js` ตั้งค่าที่ `API_MODE`

```js
const API_MODE = "auto";   // "auto" ลอง API ก่อนแล้วสำรองในเครื่อง | "api" ใช้ API อย่างเดียว | "local" ไม่เรียก API
const API_BASE = "http://127.0.0.1:5000";
```

เมื่อ dataset เปลี่ยน ให้รัน `python tools/build_frontend_data.py` ใหม่ (หมวดหมู่และอีโมจิของวัตถุดิบแก้ได้ที่ต้นไฟล์นั้น)

## ส่วนของคนที่ 2 (AI Model / Dataset)

ทำความสะอาดข้อมูลและมาตรฐานชื่อวัตถุดิบอยู่ใน `dataset/code.ipynb` ส่วนโมเดลที่ส่งมอบอยู่ใน `dataset/recommender.py`

วิธีทำงานของโมเดล
1. แปลงชื่อวัตถุดิบไทยของผู้ใช้เป็นอังกฤษด้วย `ingredient_mapping_147.csv`
2. แทนแต่ละเมนูด้วยเวกเตอร์ **TF-IDF** (วัตถุดิบที่พบในหลายเมนู เช่น น้ำตาล กะทิ ได้น้ำหนักน้อย)
3. วัดความคล้ายด้วย **Cosine Similarity**
4. **จัดอันดับ**: ทำได้ทันที -> Coverage มาก -> Similarity มาก

คำสั่ง (รันในโฟลเดอร์ `dataset`)

```
python recommender.py train    สร้างและบันทึก model/tfidf_model.joblib
python recommender.py eval     ทดสอบ TF-IDF เทียบกับแบบ 0/1 เดิม
python recommender.py demo     ลองแนะนำเมนูตัวอย่าง
```

ใช้ในโค้ดอื่น

```python
from recommender import load_model
model = load_model()
model.recommend(["กระเทียม", "น้ำปลา", "พริก"], top_n=30)   # list ของ dict
model.get_recipe("R025")                                     # dict รายละเอียดเมนู
```

ผลทดสอบปัจจุบัน (สุ่มวัตถุดิบ 50% ของแต่ละเมนู 5 รอบ รวม 1,125 การทดสอบ)

| วิธี | Top-1 | Top-3 | Top-5 | L-Top-1 | L-Top-3 | L-Top-5 |
|---|---|---|---|---|---|---|
| Binary (0/1 เดิม) | 26.3% | 38.5% | 45.2% | 27.4% | 40.5% | 47.8% |
| TF-IDF | 26.5% | 37.8% | 44.5% | 29.7% | 39.4% | 46.9% |

`L-` = นับเมนูที่วัตถุดิบเหมือนกันเป๊ะเป็นคำตอบที่ถูกด้วย (dataset มีหลายเมนูที่วัตถุดิบชุดเดียวกัน เช่น น้ำตาล+กะทิ+แป้ง)  
สองวิธีได้ผลใกล้เคียงกัน เพราะ dataset ส่วนใหญ่มีวัตถุดิบเพียง 3 อย่างต่อเมนู

## รูปแบบ API ที่หน้าเว็บคาดหวัง

โมเดล (`recommend`, `get_recipe`) คืนข้อมูลรูปแบบนี้อยู่แล้ว Flask แค่ส่งต่อเป็น JSON

`POST /api/recommend`

```json
// ส่ง
{ "ingredients": ["กระเทียม", "น้ำปลา", "พริก", "กุ้ง"], "top_n": 30 }

// ได้ (list เรียงตามอันดับ)
[
  {
    "id": "R009", "name": "กุ้งแช่น้ำปลา", "en_name": "Kung Chae Nam Pla",
    "score": 100, "coverage": 100.0, "similarity": 1.0, "status": "ทำได้ทันที",
    "matched": ["กุ้ง", "น้ำปลา", "กระเทียม", "พริก"], "missing": [],
    "course": "main dish", "region": "South", "province": "Coastal provinces", "time": null
  }
]
```

`GET /api/recipe/<id>`

```json
{
  "id": "R025", "name": "ข้าวซอย", "en_name": "Kao Soi",
  "course": "main dish", "region": "North", "province": "Chiang Mai",
  "ingredients": ["ก๋วยเตี๋ยวแกง", "เนื้อไก่", "กะทิ"],
  "required_ingredients": ["ลูกกระวานดำ", "..."], "optional_ingredients": ["น้ำปลา", "..."],
  "instructions": ["คั่วลูกกระวาน...", "..."],
  "cooking_time_minutes": 60, "total_time_minutes": 100,
  "time_notes": "...", "source_url": "https://..."
}
```

ฟิลด์ที่ dataset ไม่มีจะเป็น `[]` / `null` / `""` หน้าเว็บรองรับทุกกรณี

## ข้อจำกัดของ dataset ที่ควรเขียนในรายงาน

- มี 325 เมนู แต่ **225 เมนูมีรายการวัตถุดิบ** (อีก 100 เมนูโมเดลไม่ได้ใช้)
- มี **ขั้นตอนการทำเพียง 7 เมนู** ที่เหลือมีเฉพาะรายชื่อวัตถุดิบ
- ไม่มีรูปอาหาร ปริมาณ แคลอรี่ หรือระดับความยาก
- เมนูส่วนใหญ่มีวัตถุดิบ 3 อย่าง และมีคำกว้าง ๆ เช่น สมุนไพร เนื้อสัตว์ เครื่องเทศ ปะปนมาก
- 318 จาก 325 เมนูยังเป็น "not_individually_verified" ตามคอลัมน์ `verification_status`
