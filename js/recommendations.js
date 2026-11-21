// =====================================================
//  recommendations.js  -  หน้าผลการแนะนำเมนู
//  ต้องโหลด api.js ก่อนไฟล์นี้
// =====================================================

const PAGE_SIZE = 12;

const resultArea = document.getElementById("resultArea");
const summaryChips = document.getElementById("summaryChips");
const toolbar = document.getElementById("toolbar");
const resultCount = document.getElementById("resultCount");
const sortSelect = document.getElementById("sortSelect");
const courseSelect = document.getElementById("courseSelect");
const statusSelect = document.getElementById("statusSelect");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const sourceNote = document.getElementById("sourceNote");

const selectedIngredients = getSelectedIngredients();
const selectedLabels = getSelectedLabels();

let allResults = [];
let visibleCount = PAGE_SIZE;


// ---------- สถานะต่าง ๆ ของหน้า ----------

function showLoading() {
    sourceNote.hidden = true;
    toolbar.hidden = true;
    loadMoreBtn.hidden = true;
    resultArea.innerHTML = `
        <div class="state-box">
            <div class="loading-pan">🍳</div>
            <h3>AI กำลังคิดเมนูให้คุณ...</h3>
            <p>กำลังเปรียบเทียบวัตถุดิบกับสูตรอาหาร</p>
        </div>
    `;
}

function showEmptySelection() {
    toolbar.hidden = true;
    loadMoreBtn.hidden = true;
    resultArea.innerHTML = `
        <div class="state-box">
            <div class="state-icon">🧺</div>
            <h3>ยังไม่ได้เลือกวัตถุดิบ</h3>
            <p>กลับไปเลือกวัตถุดิบที่มีในตู้เย็นก่อน แล้วเรามาหาเมนูกัน</p>
            <a href="ingredients.html" class="btn">🥕 ไปเลือกวัตถุดิบ</a>
        </div>
    `;
}

function showNoResult() {
    toolbar.hidden = true;
    loadMoreBtn.hidden = true;
    resultArea.innerHTML = `
        <div class="state-box">
            <div class="state-icon">🥺</div>
            <h3>ยังไม่พบเมนูที่ตรงกับวัตถุดิบ</h3>
            <p>ลองเพิ่มวัตถุดิบอีกสักหน่อย แล้วค้นหาใหม่อีกครั้ง</p>
            <a href="ingredients.html" class="btn">➕ เพิ่มวัตถุดิบ</a>
        </div>
    `;
}

function showError() {
    toolbar.hidden = true;
    loadMoreBtn.hidden = true;
    resultArea.innerHTML = `
        <div class="state-box">
            <div class="state-icon">⚠️</div>
            <h3>เชื่อมต่อระบบไม่สำเร็จ</h3>
            <p>กรุณาลองใหม่อีกครั้ง หรือตรวจสอบว่า Flask API เปิดอยู่</p>
            <button id="retryBtn" class="btn retry-btn">🔄 ลองใหม่</button>
        </div>
    `;

    document.getElementById("retryBtn").addEventListener("click", loadResults);
}


// ---------- แสดงวัตถุดิบที่เลือกไว้ด้านบน ----------

function renderSummary() {
    const shown = selectedLabels.length > 0 ? selectedLabels : selectedIngredients;

    if (shown.length === 0) {
        summaryChips.innerHTML = '<span class="chip chip-muted">ยังไม่มี</span>';
        return;
    }

    summaryChips.innerHTML = shown
        .map(function (name) {
            return '<span class="chip chip-selected">' + esc(name) + "</span>";
        })
        .join("");
}


// ---------- สร้างการ์ดเมนู ----------

function cardHtml(item, index, isFirstRank) {
    const total = item.matched.length + item.missing.length;
    const ready = item.status === "ทำได้ทันที";
    const best = isFirstRank && index === 0;
    const fav = isFavorite(item.id);

    const matchedChips = item.matched
        .map(function (n) { return '<span class="chip chip-have">✓ ' + esc(n) + "</span>"; })
        .join("");

    const missingChips = item.missing
        .map(function (n) { return '<span class="chip chip-need">' + esc(n) + "</span>"; })
        .join("");

    const region = regionLabel(item.region);
    const meta = [
        '<span class="tag tag-course">' + esc(courseLabel(item.course)) + "</span>",
        region ? '<span class="tag tag-region">📍 ' + esc(region) + "</span>" : "",
        item.time ? '<span class="tag tag-time">⏱️ ' + esc(item.time) + " นาที</span>" : ""
    ].join("");

    const similarity = Number(item.similarity);
    const cosineText = isNaN(similarity) ? "" : " · TF-IDF Cosine " + similarity.toFixed(2);

    return `
        <article class="recipe-card ${best ? "best" : ""}">

            <div class="recipe-thumb">
                ${dishImageHtml({ id: item.id, name: item.name, course: item.course, ingTh: item.matched.concat(item.missing) }, "card-dish")}
                ${best ? '<span class="best-badge">🏆 แนะนำที่สุด</span>' : ""}

                <button type="button"
                        class="fav-btn ${fav ? "active" : ""}"
                        data-id="${esc(item.id)}"
                        aria-label="เพิ่มเป็นเมนูโปรด">
                    ${fav ? "❤️" : "🤍"}
                </button>
            </div>

            <div class="recipe-body">

                <div class="recipe-title-row">
                    <h3>${esc(item.name)}</h3>
                    <span class="score-badge">${esc(item.score)}%</span>
                </div>

                <p class="recipe-en">${esc(item.en_name || "")}</p>

                <span class="status-pill ${ready ? "ready" : "need"}">
                    ${ready ? "✅ ทำได้ทันที" : "🛒 ต้องซื้อเพิ่ม " + item.missing.length + " อย่าง"}
                </span>

                <div class="match-bar">
                    <div class="match-fill" style="width: ${Number(item.score) || 0}%"></div>
                </div>
                <p class="match-text">
                    มีวัตถุดิบ ${item.matched.length}/${total} อย่าง${cosineText}
                </p>

                <div class="chip-row">
                    ${matchedChips}
                    ${missingChips}
                </div>

                <div class="recipe-meta">${meta}</div>

                <a href="recipe-detail.html?id=${encodeURIComponent(item.id)}" class="btn btn-small">
                    ดูรายละเอียด →
                </a>

            </div>

        </article>
    `;
}


// ---------- กรอง เรียงลำดับ และแสดงผล ----------

function applyFilters(list) {
    const course = courseSelect.value;
    const status = statusSelect.value;

    return list.filter(function (item) {
        if (course === "other") {
            if (item.course === "main dish" || item.course === "snack" || item.course === "dessert") {
                return false;
            }
        } else if (course !== "all" && item.course !== course) {
            return false;
        }

        if (status === "ready" && item.status !== "ทำได้ทันที") {
            return false;
        }
        if (status === "fav" && !isFavorite(item.id)) {
            return false;
        }
        return true;
    });
}

function renderResults() {
    const sortKey = sortSelect.value;
    const list = applyFilters(allResults.slice());

    // rank = ลำดับจากระบบ (ไม่ต้องเรียงใหม่)
    if (sortKey === "name") {
        list.sort(function (a, b) { return a.name.localeCompare(b.name, "th"); });
    }

    toolbar.hidden = false;

    if (list.length === 0) {
        resultCount.textContent = "ไม่พบเมนูตามตัวกรอง";
        loadMoreBtn.hidden = true;
        resultArea.innerHTML = `
            <div class="state-box">
                <div class="state-icon">🔍</div>
                <h3>ไม่มีเมนูที่ตรงกับตัวกรองนี้</h3>
                <p>ลองเปลี่ยนตัวกรองเป็น "ทั้งหมด"</p>
            </div>
        `;
        return;
    }

    const shown = list.slice(0, visibleCount);
    const isFirstRank = sortKey === "rank";

    resultCount.textContent =
        "แสดง " + shown.length + " จาก " + list.length + " เมนูที่เหมาะกับคุณ";

    resultArea.innerHTML =
        '<div class="recipe-grid">' +
        shown.map(function (item, index) { return cardHtml(item, index, isFirstRank); }).join("") +
        "</div>";

    loadMoreBtn.hidden = shown.length >= list.length;
}

function resetAndRender() {
    visibleCount = PAGE_SIZE;
    renderResults();
}

sortSelect.addEventListener("change", resetAndRender);
courseSelect.addEventListener("change", resetAndRender);
statusSelect.addEventListener("change", resetAndRender);

loadMoreBtn.addEventListener("click", function () {
    visibleCount += PAGE_SIZE;
    renderResults();
});

// กดหัวใจเมนูโปรด (จับที่พื้นที่ผลลัพธ์ เพราะการ์ดถูกสร้างใหม่ตลอด)
resultArea.addEventListener("click", function (event) {
    const button = event.target.closest(".fav-btn");
    if (!button) {
        return;
    }

    const nowFavorite = toggleFavorite(button.dataset.id);

    // ถ้ากำลังดูเฉพาะเมนูโปรด ให้สร้างรายการใหม่ ไม่งั้นแค่เปลี่ยนไอคอน
    if (statusSelect.value === "fav") {
        renderResults();
    } else {
        button.classList.toggle("active", nowFavorite);
        button.textContent = nowFavorite ? "❤️" : "🤍";
    }
});


// ---------- โหลดข้อมูลจาก API ----------

// บอกผู้ใช้ว่าผลลัพธ์มาจาก Flask API หรือคำนวณในเบราว์เซอร์
function showSourceNote() {
    const fromApi = getDataSource() === "api";

    sourceNote.hidden = false;
    sourceNote.classList.toggle("from-api", fromApi);
    sourceNote.textContent = fromApi
        ? "🟢 ผลลัพธ์จาก AI Model ผ่าน Flask API"
        : "🟡 โหมดในเครื่อง: คำนวณด้วย TF-IDF ในเบราว์เซอร์ (ยังไม่ได้เชื่อมต่อ Flask API)";
}

async function loadResults() {
    showLoading();

    try {
        allResults = await getRecommendations(selectedIngredients);

        if (!Array.isArray(allResults) || allResults.length === 0) {
            showNoResult();
            return;
        }

        showSourceNote();
        resetAndRender();
    } catch (error) {
        console.error(error);
        showError();
    }
}


// ---------- เริ่มทำงาน ----------

renderSummary();

if (selectedIngredients.length === 0) {
    showEmptySelection();
} else {
    loadResults();
}
