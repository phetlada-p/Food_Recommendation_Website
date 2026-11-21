# What's in Your Fridge? — เว็บแนะนำเมนูอาหารไทยจากวัตถุดิบในตู้เย็น

เลือกวัตถุดิบที่มี (หรือถ่ายรูป) แล้วระบบแนะนำเมนูอาหารไทยที่ทำได้ พร้อมบอกว่าขาดอะไร

| สมาชิก | หน้าที่ | สถานะ |
|---|---|---|
| คนที่ 1 | UI / Frontend | เสร็จ |
| คนที่ 2 | AI Model / Dataset | เสร็จ |
| คนที่ 3 | Backend / Evaluation / Report | Flask API, SQLite, ผลประเมิน, สคริปต์ทดสอบ เสร็จ — เหลือรายงานและสไลด์ ดู [`MEMBER3_TODO.md`](MEMBER3_TODO.md) |

## วิธีรัน

```
pip install -r requirements.txt
python app.py
```

แล้วเปิด http://localhost:5001 (Flask เสิร์ฟทั้งหน้าเว็บและ API ที่พอร์ตนี้ เปลี่ยนได้ด้วยตัวแปร `PORT`)

- เปิดแค่หน้าเว็บ: ดับเบิลคลิก `index.html` หรือใช้ GitHub Pages ได้ จะคำนวณในเบราว์เซอร์ (โหมดในเครื่อง) ผลเหมือนกัน แต่ **ใช้การสแกนรูปไม่ได้**
- หน้าผลแนะนำมีป้ายบอกที่มา: 🟢 Flask API / 🟡 โหมดในเครื่อง
- กล้องใช้ได้เฉพาะ `localhost` หรือ https

### การสแกนรูปภาพ (ไม่บังคับ)
ใช้โมเดล [ConvNeXt-Food-CLF-75](https://github.com/Alas-V/ConvNeXt-Food-CLF-75) (Apache-2.0, ผู้พัฒนา Artem V., Macro F1 0.65) ต้องมีไฟล์น้ำหนักอย่างใดอย่างหนึ่ง

1. วางไฟล์ที่ `tools/model_weights/checkpoint.pth.tar` หรือ
2. ตั้งตัวแปร `HF_TOKEN` ให้โหลดจาก Hugging Face อัตโนมัติ (อย่าใส่ token ในโค้ดหรือ GitHub)

ถ้าไม่มี torch หรือไม่มีไฟล์น้ำหนัก `/api/recognize` จะตอบ 503 และหน้าเว็บแจ้งผู้ใช้ ส่วนอื่นยังใช้ได้ปกติ
ตอนนี้จับคู่เป็นวัตถุดิบไทยได้ **10 ชนิด** (กล้วย ไข่ ปลา กระเทียม ขิง เส้นก๋วยเตี๋ยว ถั่วลิสง หมู กุ้ง ถั่วงอก) แก้ที่ `INGREDIENT_MAPPING` ใน `tools/food_image_recognizer.py`

## หน้าตาเว็บ (2 ธีม สลับได้)
มีปุ่ม 🎨 มุมซ้ายล่างทุกหน้า สลับระหว่าง
- **ดั้งเดิม** (ค่าเริ่มต้น): แดง-ชมพู-ขาว  ไฟล์ `css/style.css` + `css/foody-original.css`
- **โทนสไลด์**: ครีม แดงอิฐ เหลืองมัสตาร์ด เขียวใบไม้ ฟ้าลายสก๊อต  ไฟล์ `css/style-slide.css` + `css/foody.css`

ธีมที่เลือกจำไว้ในเบราว์เซอร์ ถ้าอยากเปลี่ยนค่าเริ่มต้น แก้คำว่า `"original"` ในสคริปต์ใน `<head>` ของแต่ละหน้า

- **หน้าแรก**: สไลด์เมนูเด่น 8 เมนู เลื่อนเองทุก 5.5 วินาที (หยุดเมื่อเอาเมาส์ชี้ มีปุ่มหยุด/ลูกศร/จุด/ปัดบนมือถือ) แก้รายการและคำบรรยายที่ `FEATURED` ใน `js/food-art.js`
- **เมนูแนะนำวันนี้**: 8 เมนูไม่ต้องเลือกวัตถุดิบ เปลี่ยนทุกวัน มีแท็บหมวดและปุ่ม "สุ่มใหม่"
- **หน้า `menus.html`**: เมนูทั้งหมด 225 เมนู ค้นหาชื่อ/วัตถุดิบ กรองหมวดและภาค เรียงลำดับ
- **ภาพอาหาร**: dataset ไม่มีรูป จึงวาดภาพประกอบ (SVG) ให้แต่ละเมนูตามประเภทอาหารและวัตถุดิบ (`js/food-art.js`) ถ้ามีรูปถ่ายจริง วางไฟล์ `images/recipes/<รหัสเมนู>.jpg` แล้วเพิ่มรหัสใน `DISH_PHOTOS` รูปจริงจะแสดงทับภาพวาดทุกหน้า
- ตัววิ่งวัตถุดิบ ตัวเลขสถิตินับขึ้น เอฟเฟกต์ตอนเลื่อน รองรับมือถือและ `prefers-reduced-motion`

## ทดสอบ

```
python -m unittest tests.test_api -v
```

ครอบคลุม: แนะนำเมนูปกติ/วัตถุดิบที่ไม่รู้จัก/รายการว่าง/ข้อมูลผิดรูปแบบ, รายละเอียดสูตร (พบ/ไม่พบ), SQLite, การเสิร์ฟหน้าเว็บ (ต้องไม่เปิด `app.py` และไฟล์ `.db`), การตรวจรูปภาพ

## โครงสร้างไฟล์

```
app.py                        Flask: เสิร์ฟหน้าเว็บ + API
index.html / menus.html / ingredients.html / recommendations.html / recipe-detail.html
css/style.css, css/foody.css (ธีมใหม่)
js/api.js                     ลองเรียก API ก่อน ไม่ได้ก็คำนวณในเบราว์เซอร์
js/ingredients-data.js, recipes-data.js   (สร้างอัตโนมัติ)
js/home.js, menus.js, food-art.js (ภาพอาหาร), ingredients.js, recommendations.js, recipe-detail.js, script.js
images/recipes/               รูปถ่ายจริงของเมนู (ไม่บังคับ)
tools/build_frontend_data.py  แปลง dataset -> js/*-data.js
tools/food_image_recognizer.py, ConvNeXt-Food-CLF-75/   โมเดลสแกนรูป
dataset/                      ส่วนของคนที่ 2 และฐานข้อมูล
  datasets/                   JSON, CSV, ตาราง mapping 147 วัตถุดิบ
  code.ipynb                  ทำความสะอาดข้อมูล, โมเดล, ทดสอบ
  data_prep.py, recommender.py, model/tfidf_model.joblib
  database.py                 สร้าง smart_fridge.db จาก dataset
  smart_fridge.db             SQLite (325 เมนู, 235 วัตถุดิบ, 802 ความสัมพันธ์)
  evaluation_results.txt      ผลประเมิน
tests/test_api.py
render.yaml                   ตั้งค่า deploy บน Render
```

## API

| Endpoint | ทำอะไร |
|---|---|
| `POST /api/recommend` | `{"ingredients": ["กระเทียม","พริก"], "top_n": 30}` -> เมนูเรียงตามอันดับ (TF-IDF + Cosine) |
| `GET /api/recipe/<id>` | รายละเอียดสูตรจากโมเดล |
| `POST /api/recognize` | ส่งรูป (`image`, jpg/png/webp ไม่เกิน 8 MB) -> วัตถุดิบที่ตรวจพบ |
| `GET /api/db/health` | จำนวนข้อมูลใน SQLite |
| `GET /api/db/recipes?limit=` | รายการเมนูจาก SQLite |
| `GET /api/db/recipe/<id>` | รายละเอียดเมนูพร้อมวัตถุดิบจาก SQLite |
| `GET /api/db/ingredients` | วัตถุดิบทั้งหมดจาก SQLite |

ตัวอย่างผลของ `/api/recommend` (1 รายการ)

```json
{ "id": "R009", "name": "กุ้งแช่น้ำปลา", "en_name": "Kung Chae Nam Pla",
  "score": 100, "coverage": 100.0, "similarity": 1.0, "status": "ทำได้ทันที",
  "matched": ["กุ้ง","น้ำปลา","กระเทียม","พริก"], "missing": [],
  "course": "main dish", "region": "South", "province": "Coastal provinces", "time": null }
```

หมายเหตุ: การแนะนำเมนูอ่านจากไฟล์โมเดล `tfidf_model.joblib` ส่วน SQLite ใช้ผ่าน `/api/db/*` เป็นฐานข้อมูลของระบบ (หน้าเว็บยังไม่ได้เรียก endpoint เหล่านี้)

## โมเดลแนะนำเมนู (คนที่ 2)

1. แปลงชื่อวัตถุดิบไทย -> อังกฤษด้วย `ingredient_mapping_147.csv`
2. แทนเมนูด้วยเวกเตอร์ **TF-IDF** (วัตถุดิบที่พบบ่อย เช่น น้ำตาล กะทิ ได้น้ำหนักน้อย)
3. วัดความคล้ายด้วย **Cosine Similarity**
4. **จัดอันดับ**: ทำได้ทันที -> Coverage มาก -> Similarity มาก
5. สูตรที่ระบุ "meat" กว้าง ๆ ยอมรับหมู ไก่ วัว ที่ผู้ใช้เลือก (ทำทั้งใน Python และ JS ให้ตรงกัน)

```
cd dataset
python recommender.py train    # สร้าง model/tfidf_model.joblib ใหม่
python recommender.py eval     # ทดสอบ TF-IDF เทียบ Binary
python recommender.py demo
python database.py             # สร้าง smart_fridge.db ใหม่จาก dataset
```

ผลประเมิน (สุ่มวัตถุดิบ 50% ของแต่ละเมนู 5 รอบ รวม 1,125 การทดสอบ)

| วิธี | Top-1 | Top-3 | Top-5 | L-Top-1 | L-Top-3 | L-Top-5 |
|---|---|---|---|---|---|---|
| Binary (0/1 เดิม) | 23.8% | 35.6% | 42.4% | 24.9% | 37.6% | 45.1% |
| TF-IDF | 25.9% | 37.5% | 44.5% | 29.1% | 39.0% | 46.9% |

`L-` = นับเมนูที่วัตถุดิบเหมือนกันเป๊ะเป็นคำตอบถูกด้วย รายละเอียดใน `dataset/evaluation_results.txt`
เมื่อ dataset เปลี่ยน ให้รัน `python tools/build_frontend_data.py` เพื่ออัปเดตข้อมูลหน้าเว็บ

## Deploy (Render)
ใช้ `render.yaml` (gunicorn) ต้องตั้ง `HF_TOKEN` ใน Environment ถ้าต้องการสแกนรูป
`torch` ใช้หน่วยความจำมาก แพ็กเกจฟรีอาจไม่พอ ถ้าไม่พอ ลบ 4 บรรทัดสุดท้ายของ `requirements.txt` ระบบแนะนำเมนูจะยังทำงานได้
GitHub Pages ใช้เสิร์ฟได้แค่โหมดในเครื่อง (ไม่มี Flask)

## ข้อจำกัดของ dataset
- 325 เมนู แต่ **225 เมนูมีรายการวัตถุดิบ** (โมเดลใช้ 225)
- มี **ขั้นตอนทำเพียง 7 เมนู**
- ไม่มีรูปอาหาร ปริมาณ แคลอรี่ หรือระดับความยาก
- เมนูส่วนใหญ่มีวัตถุดิบ 3 อย่าง และมีคำกว้าง ๆ (สมุนไพร เนื้อสัตว์ เครื่องเทศ) ปนมาก
- 318 จาก 325 เมนูเป็น "not_individually_verified" ตามคอลัมน์ `verification_status`
