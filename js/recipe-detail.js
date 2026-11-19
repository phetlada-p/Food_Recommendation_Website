// =====================================================
//  recipe-detail.js  -  หน้ารายละเอียดเมนู
//  ต้องโหลด api.js ก่อนไฟล์นี้
// =====================================================
//
//  dataset มีขั้นตอนทำเพียงบางเมนู (ประมาณ 7 จาก 225)
//  หน้านี้จึงต้องแสดงผลได้ทั้งกรณีที่มีและไม่มีขั้นตอน

const detailArea = document.getElementById("detailArea");
const toast = document.getElementById("toast");

const mySelected = getSelectedIngredients();
const myLabels = getSelectedLabels();
const hasSelection = mySelected.length > 0;

let recipe = null;
let toastTimer = null;


// ---------- ฟังก์ชันช่วย ----------

function shortName(name) {
    return String(name).split("/")[0].trim();
}

// วัตถุดิบนี้อยู่ในรายการที่ผู้ใช้เลือกไว้หรือไม่
function isHave(name) {
    const short = shortName(name);

    return myLabels.includes(short) ||
        mySelected.includes(name) ||
        mySelected.some(function (key) { return shortName(key) === short; });
}

// อนุญาตเฉพาะลิงก์ http/https เท่านั้น
function safeUrl(url) {
    try {
        const parsed = new URL(url);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.href : "";
    } catch (error) {
        return "";
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove("show");
    }, 2200);
}

function showMessage(icon, title, text) {
    detailArea.innerHTML = `
        <div class="state-box">
            <div class="state-icon">${icon}</div>
            <h3>${esc(title)}</h3>
            <p>${esc(text)}</p>
            <a href="recommendations.html" class="btn">← กลับไปหน้าเมนูแนะนำ</a>
        </div>
    `;
}

function plainList(items) {
    return items.map(function (name) {
        return '<li class="ing-row"><span class="ing-name">' + esc(name) + "</span></li>";
    }).join("");
}


// ---------- สร้างหน้าสูตรอาหาร ----------

function render() {
    const ingredients = recipe.ingredients || [];
    const required = recipe.required_ingredients || [];
    const optional = recipe.optional_ingredients || [];
    const steps = recipe.instructions || [];

    // วัตถุดิบหลัก + สถานะมี/ต้องซื้อ
    const mainList = ingredients.map(function (name) {
        const have = isHave(name);

        let status = "";
        if (hasSelection) {
            status = have
                ? '<span class="tag tag-have">✓ มีแล้ว</span>'
                : '<span class="tag tag-need">🛒 ต้องซื้อ</span>';
        }

        return `
            <li class="ing-row ${hasSelection && !have ? "need" : ""}">
                <span class="ing-name">${esc(name)}</span>
                ${status}
            </li>
        `;
    }).join("");

    const missing = hasSelection
        ? ingredients.filter(function (name) { return !isHave(name); })
        : [];

    const shoppingBox = missing.length > 0
        ? `
            <div class="shopping-box">
                <strong>🛒 ของที่ต้องซื้อเพิ่ม</strong>
                <p>${missing.map(esc).join(", ")}</p>
                <button id="copyBtn" class="clear-btn" type="button">📋 คัดลอกรายการซื้อ</button>
            </div>
        `
        : (hasSelection
            ? '<div class="shopping-box all-have">🎉 คุณมีวัตถุดิบหลักครบแล้ว เริ่มทำได้เลย!</div>'
            : "");

    // เครื่องปรุงตามสูตรอ้างอิง (มีเฉพาะบางเมนู)
    const requiredBox = required.length > 0
        ? '<h4 class="sub-head">เครื่องปรุงทั้งหมดตามสูตรอ้างอิง</h4><ul class="ing-list light">' + plainList(required) + "</ul>"
        : "";

    const optionalBox = optional.length > 0
        ? '<h4 class="sub-head">ใส่เพิ่มได้ (ไม่บังคับ)</h4><ul class="ing-list light">' + plainList(optional) + "</ul>"
        : "";

    // ขั้นตอนทำ หรือข้อความแจ้งว่ายังไม่มี
    let stepsCard;

    if (steps.length > 0) {
        const stepList = steps.map(function (text, index) {
            return `
                <li class="step-row">
                    <label>
                        <input type="checkbox" class="step-check">
                        <span class="step-num">${index + 1}</span>
                        <span class="step-text">${esc(text)}</span>
                    </label>
                </li>
            `;
        }).join("");

        stepsCard = `
            <div class="card-head">
                <h3>👨‍🍳 วิธีทำ</h3>
                <span class="progress-text" id="progressText"></span>
            </div>
            <ol class="step-list">${stepList}</ol>
        `;
    } else {
        const query = encodeURIComponent("วิธีทำ " + recipe.name);

        stepsCard = `
            <div class="card-head">
                <h3>👨‍🍳 วิธีทำ</h3>
            </div>
            <div class="no-steps">
                <div class="state-icon">📖</div>
                <h4>ฐานข้อมูลยังไม่มีขั้นตอนของเมนูนี้</h4>
                <p>เมนูนี้มีเฉพาะรายชื่อวัตถุดิบหลัก คุณสามารถค้นหาวิธีทำเพิ่มเติมได้จากลิงก์ด้านล่าง</p>
                <div class="link-row">
                    <a class="clear-btn link-btn" target="_blank" rel="noopener noreferrer"
                       href="https://www.google.com/search?q=${query}">🔎 ค้นหาบน Google</a>
                    <a class="clear-btn link-btn" target="_blank" rel="noopener noreferrer"
                       href="https://www.youtube.com/results?search_query=${query}">▶️ ค้นหาบน YouTube</a>
                </div>
            </div>
        `;
    }

    // แหล่งข้อมูล
    const source = safeUrl(recipe.source_url || "");
    const sourceBox = source
        ? '<p class="source-note">แหล่งข้อมูลสูตร: <a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">' +
          esc(new URL(source).hostname) + "</a></p>"
        : "";

    // เวลา
    const total = recipe.total_time_minutes;
    const cook = recipe.cooking_time_minutes;
    const timeTags = [];
    if (total) { timeTags.push("⏱️ รวม " + total + " นาที"); }
    if (cook) { timeTags.push("🔥 ปรุง " + cook + " นาที"); }

    const region = regionLabel(recipe.region);
    const place = [recipe.province, region].filter(function (x) { return x && x !== "Unknown"; });

    const metaTags = [
        '<span>' + esc(courseLabel(recipe.course)) + "</span>",
        place.length ? "<span>📍 " + esc(place.join(" · ")) + "</span>" : "",
        timeTags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("")
    ].join("");

    const timeNote = recipe.time_notes
        ? '<p class="time-note">' + esc(recipe.time_notes) + "</p>"
        : "";

    const fav = isFavorite(recipe.id);

    detailArea.innerHTML = `
        <div class="detail-hero">
            <div class="detail-thumb">
                <span class="thumb-emoji big">${esc(courseEmoji(recipe.course))}</span>
            </div>

            <div class="detail-info">
                <p class="subtitle">🍽️ ${esc(recipe.en_name || "RECIPE")}</p>
                <h2>${esc(recipe.name)}</h2>

                <div class="recipe-meta big">${metaTags}</div>
                ${timeNote}

                <button type="button" id="favBtn" class="fav-pill ${fav ? "active" : ""}">
                    ${fav ? "❤️ เป็นเมนูโปรดแล้ว" : "🤍 เพิ่มเป็นเมนูโปรด"}
                </button>
            </div>
        </div>

        <div class="detail-layout">

            <section class="detail-card">
                <div class="card-head">
                    <h3>🧺 วัตถุดิบหลัก</h3>
                </div>

                <ul class="ing-list">${mainList || '<li class="ing-row"><span class="ing-name">ไม่มีข้อมูลวัตถุดิบ</span></li>'}</ul>

                ${requiredBox}
                ${optionalBox}
                ${shoppingBox}

                <p class="data-note">ข้อมูลวัตถุดิบรวบรวมจากฐานข้อมูลอาหารไทย อาจยังไม่ครบทุกส่วนผสม</p>
            </section>

            <section class="detail-card">
                ${stepsCard}
                ${sourceBox}
            </section>

        </div>
    `;

    bindEvents(missing);
    updateProgress();
}


// ---------- ปุ่มและการโต้ตอบ ----------

function bindEvents(missing) {
    document.querySelectorAll(".step-check").forEach(function (box) {
        box.addEventListener("change", function () {
            box.closest(".step-row").classList.toggle("done", box.checked);
            updateProgress();
        });
    });

    document.getElementById("favBtn").addEventListener("click", function () {
        const nowFavorite = toggleFavorite(recipe.id);
        showToast(nowFavorite ? "เพิ่มในเมนูโปรดแล้ว ❤️" : "นำออกจากเมนูโปรดแล้ว");
        render();
    });

    const copyBtn = document.getElementById("copyBtn");
    if (copyBtn) {
        copyBtn.addEventListener("click", function () {
            const text = "รายการซื้อสำหรับ " + recipe.name + "\n" +
                missing.map(function (name) { return "- " + name; }).join("\n");

            if (navigator.clipboard) {
                navigator.clipboard.writeText(text)
                    .then(function () { showToast("คัดลอกรายการซื้อแล้ว ✓"); })
                    .catch(function () { showToast("คัดลอกไม่สำเร็จ"); });
            } else {
                showToast("เบราว์เซอร์นี้ไม่รองรับการคัดลอก");
            }
        });
    }
}

function updateProgress() {
    const label = document.getElementById("progressText");
    if (!label) {
        return;
    }

    const boxes = document.querySelectorAll(".step-check");
    const done = document.querySelectorAll(".step-check:checked").length;
    label.textContent = "ทำแล้ว " + done + "/" + boxes.length + " ขั้นตอน";
}


// ---------- โหลดสูตรอาหาร ----------

async function loadRecipe() {
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        showMessage("🤔", "ไม่พบเมนู", "กรุณาเลือกเมนูจากหน้าเมนูแนะนำ");
        return;
    }

    detailArea.innerHTML = `
        <div class="state-box">
            <div class="loading-pan">🍳</div>
            <h3>กำลังโหลดข้อมูลเมนู...</h3>
        </div>
    `;

    try {
        recipe = await getRecipe(id);
        document.title = recipe.name + " | What's in Your Fridge?";
        render();
    } catch (error) {
        console.error(error);
        showMessage("⚠️", "โหลดข้อมูลเมนูไม่สำเร็จ", "ไม่พบเมนูนี้ หรือเชื่อมต่อระบบไม่ได้");
    }
}

loadRecipe();
