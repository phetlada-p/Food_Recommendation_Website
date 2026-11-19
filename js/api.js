// =====================================================
//  api.js  -  ตัวกลางติดต่อข้อมูล (ข้อมูลจริงในเครื่อง <-> Flask API)
// =====================================================
//
//  API_MODE = "auto"   -> ลองเรียก Flask API ก่อน ถ้าเชื่อมต่อไม่ได้ จะคำนวณในเบราว์เซอร์แทน
//                         (เว็บจึงใช้งานได้เสมอ แม้ Flask ยังไม่เปิด)
//  API_MODE = "api"    -> ใช้ Flask API อย่างเดียว (ถ้าเชื่อมต่อไม่ได้ จะขึ้นหน้า error)
//  API_MODE = "local"  -> คำนวณในเบราว์เซอร์อย่างเดียว ไม่เรียก API
//
//  การคำนวณในเบราว์เซอร์ใช้ข้อมูลจริงจาก dataset ของสมาชิกคนที่ 2
//  (js/recipes-data.js สร้างโดย tools/build_frontend_data.py) และใช้วิธีเดียวกับ
//  dataset/recommender.py คือ TF-IDF + Cosine Similarity แล้วจัดอันดับ
//
//  ต้องโหลด js/recipes-data.js ก่อนไฟล์นี้ (ใช้ตอนคำนวณในเบราว์เซอร์)
//
//  รูปแบบข้อมูลที่ตกลงกับสมาชิกคนที่ 2 และ 3
//  ---------------------------------------------------
//  POST {API_BASE}/api/recommend
//    ส่ง:  { "ingredients": ["เนื้อวัว", "กระเทียม"], "top_n": 30 }
//          ชื่อวัตถุดิบเป็นภาษาไทย ตรงกับคอลัมน์ ingredient_th ใน ingredient_mapping_147.csv
//    ได้:  [ { id, name, en_name, score, similarity, status,
//              matched:[...], missing:[...], course, region, province, time }, ... ]
//          id          = recipe_id เช่น "R025"
//          name        = th_name
//          score       = coverage (0-100)  = matched / วัตถุดิบทั้งหมดของเมนู x 100
//          similarity  = TF-IDF cosine similarity (0-1)
//          status      = "ทำได้ทันที" หรือ "ต้องซื้อเพิ่ม"
//          matched/missing = ชื่อวัตถุดิบ "ภาษาไทย" (ไม่ใช่ภาษาอังกฤษ)
//          time        = นาที หรือ null ถ้าไม่มีข้อมูล
//          เรียงลำดับ: ทำได้ทันทีก่อน -> coverage มาก -> similarity มาก
//
//  GET  {API_BASE}/api/recipe/<id>
//    ได้:  { id, name, en_name, course, region, province,
//            ingredients:[...ไทย],
//            required_ingredients:[...], optional_ingredients:[...],
//            instructions:[...], cooking_time_minutes, total_time_minutes,
//            time_notes, source_url }
//          ฟิลด์ที่ dataset ไม่มี ให้ส่ง [] / null / "" ได้เลย (หน้าเว็บรองรับ)

const API_MODE = "auto";
const API_BASE = "";
const API_TIMEOUT_MS = 5000;
const TOP_N = 30;   // จำนวนเมนูสูงสุดที่ขอจากระบบ

// แหล่งข้อมูลของคำขอล่าสุด: "api" หรือ "local" (ใช้แสดงให้ผู้ใช้เห็นในหน้าเว็บ)
let lastDataSource = "local";

function getDataSource() {
    return lastDataSource;
}


// ---------- ฟังก์ชันช่วยใช้ร่วมกัน ----------

// กัน HTML แทรกจากข้อความภายนอก
function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function readList(key) {
    try {
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
}

// ชื่อไทยที่ส่งให้โมเดล (จากหน้า ingredients.html)
function getSelectedIngredients() {
    return readList("selectedIngredients");
}

// ชื่อที่แสดงให้ผู้ใช้เห็น
function getSelectedLabels() {
    return readList("selectedLabels");
}

function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}


// ---------- ประเภทอาหาร / ภูมิภาค ----------

const COURSE_INFO = {
    "main dish": { label: "อาหารจานหลัก", emoji: "🍛" },
    "snack":     { label: "ของว่าง",       emoji: "🥟" },
    "dessert":   { label: "ของหวาน",       emoji: "🍮" },
    "salad":     { label: "ยำ/สลัด",       emoji: "🥗" },
    "soup":      { label: "ซุป",           emoji: "🍲" }
};

const REGION_LABEL = {
    "Central": "ภาคกลาง",
    "North": "ภาคเหนือ",
    "South": "ภาคใต้",
    "Northeast": "ภาคอีสาน",
    "Various": "หลายภูมิภาค"
};

function courseLabel(course) {
    return (COURSE_INFO[course] || {}).label || "อาหาร";
}

function courseEmoji(course) {
    return (COURSE_INFO[course] || {}).emoji || "🍽️";
}

// คืนค่าว่างถ้าไม่ระบุภูมิภาค (Unknown)
function regionLabel(region) {
    return REGION_LABEL[region] || "";
}


// ---------- เมนูโปรด (เก็บในเบราว์เซอร์) ----------

function getFavorites() {
    return readList("favoriteRecipes").map(String);
}

function isFavorite(id) {
    return getFavorites().includes(String(id));
}

// สลับสถานะโปรด คืนค่า true ถ้าตอนนี้เป็นเมนูโปรด
function toggleFavorite(id) {
    const key = String(id);
    let list = getFavorites();
    const nowFavorite = !list.includes(key);

    list = nowFavorite ? list.concat(key) : list.filter(function (x) { return x !== key; });

    try {
        localStorage.setItem("favoriteRecipes", JSON.stringify(list));
    } catch (error) {
        console.error(error);
    }
    return nowFavorite;
}


// ---------- ตัวคำนวณในเบราว์เซอร์ (เหมือน dataset/recommender.py) ----------
//
//  TF-IDF แบบเดียวกับ sklearn TfidfVectorizer(smooth_idf=True, norm="l2")
//    idf(t)  = ln((1 + n) / (1 + df(t))) + 1
//    cosine  = ผลรวม idf^2 ของวัตถุดิบที่ตรงกัน / (|เวกเตอร์ผู้ใช้| x |เวกเตอร์เมนู|)

let tfidfCache = null;

function getTfidf() {
    if (tfidfCache) {
        return tfidfCache;
    }

    const n = RECIPE_DATA.length;
    const df = {};

    RECIPE_DATA.forEach(function (r) {
        r.ing.forEach(function (e) { df[e] = (df[e] || 0) + 1; });
    });

    const idf = {};
    Object.keys(df).forEach(function (e) {
        idf[e] = Math.log((1 + n) / (1 + df[e])) + 1;
    });

    const docNorm = RECIPE_DATA.map(function (r) {
        let sum = 0;
        r.ing.forEach(function (e) { sum += idf[e] * idf[e]; });
        return Math.sqrt(sum);
    });

    tfidfCache = { idf: idf, docNorm: docNorm };
    return tfidfCache;
}

function recipeTime(r) {
    return r.ttotal || r.tcook || null;
}


// วัตถุดิบที่นับเป็น "เนื้อสัตว์" สำหรับสูตรที่ระบุส่วนผสมแบบกว้าง ๆ
// เช่น สูตรระบุ meat แต่ผู้ใช้เลือก pork / ground pork
const MEAT_INGREDIENTS = new Set([
    "pork", "ground pork", "pork belly", "pork leg", "pork offal",
    "pork spine", "pork skin", "pork blood",
    "chicken", "chicken feet", "beef", "duck", "meat"
]);

function ingredientMatches(recipeIngredient, userSet) {
    if (userSet.has(recipeIngredient)) return true;

    // สูตรที่ระบุ "meat" ยอมรับชนิดเนื้อสัตว์ที่ผู้ใช้เลือก
    return recipeIngredient === "meat" &&
        Array.from(userSet).some(function (item) {
            return MEAT_INGREDIENTS.has(item);
        });
}

function expandQueryIngredients(userSet) {
    const expanded = new Set(userSet);
    if (Array.from(userSet).some(function (item) {
        return MEAT_INGREDIENTS.has(item) && item !== "meat";
    })) {
        expanded.add("meat");
    }
    return expanded;
}


function mockRecommend(thaiList, topN) {
    // 1. แปลงไทย -> อังกฤษ ด้วย ingredient_mapping_147.csv
    const userSet = new Set();
    thaiList.forEach(function (name) {
        const en = INGREDIENT_MAP[String(name).trim()];
        if (en) {
            userSet.add(en);
        }
    });

    // ตรวจสอบการแปลงชื่อวัตถุดิบ
    console.log("วัตถุดิบที่เลือก:", thaiList);
    console.log("ผลการแปลง:", Array.from(userSet));
    console.log("INGREDIENT_MAP เนื้อหมู:", INGREDIENT_MAP["เนื้อหมู"]);

    if (userSet.size === 0) {
        return [];
    }


    // 2. เวกเตอร์ TF-IDF ของผู้ใช้ (เฉพาะวัตถุดิบที่โมเดลรู้จัก)
    const tfidf = getTfidf();
    // เพิ่ม feature กลาง "meat" ในเวกเตอร์ค้นหาเมื่อผู้ใช้มีเนื้อสัตว์ชนิดใดชนิดหนึ่ง
    // เพื่อให้ TF-IDF จับคู่กับสูตรที่ใช้คำรวมว่า meat ได้ด้วย
    const queryFeatures = expandQueryIngredients(userSet);
    let queryNormSq = 0;
    queryFeatures.forEach(function (e) {
        if (tfidf.idf[e] !== undefined) {
            queryNormSq += tfidf.idf[e] * tfidf.idf[e];
        }
    });
    const queryNorm = Math.sqrt(queryNormSq);

    // 3. คะแนนของแต่ละเมนู
    const results = [];
    // เก็บชื่อไทยที่ผู้ใช้เลือกแยกตามชื่ออังกฤษ เพื่อให้สูตรที่ใช้คำกว้าง ๆ
    // เช่น "meat" แสดงชื่อวัตถุดิบจริงที่ผู้ใช้เลือก (เช่น "เนื้อหมู")
    const selectedMeatLabels = thaiList.filter(function (name) {
        const en = INGREDIENT_MAP[String(name).trim()];
        return en && MEAT_INGREDIENTS.has(en) && en !== "meat";
    });

    RECIPE_DATA.forEach(function (r, index) {
        const matched = [];
        const missing = [];
        let dot = 0;

        r.ing.forEach(function (e, i) {
            if (ingredientMatches(e, userSet)) {
                // แทนคำกลาง "เนื้อสัตว์" ด้วยชื่อเนื้อสัตว์ที่ผู้ใช้เลือกจริง
                // นับเป็น 1 วัตถุดิบตามจำนวนช่องในสูตร ไม่เพิ่มคะแนนซ้ำ
                if (e === "meat" && selectedMeatLabels.length > 0) {
                    matched.push(selectedMeatLabels.join(" / "));
                } else {
                    matched.push(r.ingTh[i]);
                }
            } else {
                missing.push(r.ingTh[i]);
            }

            if (queryFeatures.has(e)) {
                dot += tfidf.idf[e] * tfidf.idf[e];
            }
        });

        if (matched.length === 0) {
            return;
        }

        const coverage = (matched.length / r.ing.length) * 100;
        const denom = queryNorm * tfidf.docNorm[index];
        const similarity = denom > 0 ? dot / denom : 0;

        results.push({
            id: r.id,
            name: r.name,
            en_name: r.en,
            score: Math.round(coverage),
            coverage: coverage,
            similarity: similarity,
            status: missing.length === 0 ? "ทำได้ทันที" : "ต้องซื้อเพิ่ม",
            matched: matched,
            missing: missing,
            course: r.course,
            region: r.region,
            province: r.province,
            time: recipeTime(r),
            _index: index
        });
    });

    // 4. จัดอันดับให้ตรงกับวัตถุดิบมากที่สุด:
    //    coverage สูง -> จำนวนวัตถุดิบที่ตรงมาก -> cosine สูง -> เมนูทำได้ทันที
    //    ไม่ดันเมนูที่ตรงเพียงเล็กน้อยขึ้นหน้าเพียงเพราะมี missing น้อย
    const round = function (x) { return Math.round(x * 1e9); };

    results.sort(function (a, b) {
        if (round(a.coverage) !== round(b.coverage)) { return b.coverage - a.coverage; }
        if (a.matched.length !== b.matched.length) { return b.matched.length - a.matched.length; }
        if (round(a.similarity) !== round(b.similarity)) { return b.similarity - a.similarity; }
        const pa = a.status === "ทำได้ทันที" ? 0 : 1;
        const pb = b.status === "ทำได้ทันที" ? 0 : 1;
        if (pa !== pb) { return pa - pb; }
        return a._index - b._index;
    });

    return results.slice(0, topN).map(function (item) {
        delete item._index;
        return item;
    });
}

function mockRecipeDetail(id) {
    const r = RECIPE_DATA.find(function (x) { return x.id === String(id); });
    if (!r) {
        return null;
    }
    return {
        id: r.id,
        name: r.name,
        en_name: r.en,
        course: r.course,
        region: r.region,
        province: r.province,
        ingredients: r.ingTh,
        required_ingredients: r.req || [],
        optional_ingredients: r.opt || [],
        instructions: r.steps || [],
        cooking_time_minutes: r.tcook || null,
        total_time_minutes: r.ttotal || null,
        time_notes: r.tnote || "",
        source_url: r.src || ""
    };
}


// ---------- เรียก Flask API ----------

async function callApi(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);

    try {
        const response = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, options || {}));

        if (!response.ok) {
            throw new Error("API error " + response.status);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

// ใช้ API ก่อนตาม API_MODE ถ้าไม่ได้ให้ใช้ฟังก์ชันในเครื่อง (เฉพาะโหมด auto)
async function withFallback(apiCall, localCall) {
    if (API_MODE === "local") {
        lastDataSource = "local";
        return await localCall();
    }

    try {
        const data = await apiCall();
        lastDataSource = "api";
        return data;
    } catch (error) {
        if (API_MODE === "api") {
            throw error;
        }
        console.warn("เชื่อมต่อ Flask API ไม่ได้ ใช้การคำนวณในเบราว์เซอร์แทน:", error.message);
        lastDataSource = "local";
        return await localCall();
    }
}


// ---------- ฟังก์ชันหลักที่หน้าเว็บเรียกใช้ ----------

async function getRecommendations(ingredients) {
    return await withFallback(
        async function () {
            const data = await callApi("/api/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ingredients: ingredients, top_n: TOP_N })
            });

            if (!Array.isArray(data)) {
                throw new Error("รูปแบบข้อมูลจาก API ไม่ถูกต้อง");
            }
            return data;
        },
        async function () {
            await delay(600);   // จำลองว่า AI กำลังคิด
            return mockRecommend(ingredients, TOP_N);
        }
    );
}

async function getRecipe(id) {
    return await withFallback(
        function () {
            return callApi("/api/recipe/" + encodeURIComponent(id));
        },
        async function () {
            await delay(200);
            const recipe = mockRecipeDetail(id);
            if (!recipe) {
                throw new Error("ไม่พบสูตรอาหาร");
            }
            return recipe;
        }
    );
}
