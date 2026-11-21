// =====================================================
//  home.js  -  หน้าแรก: สไลด์เมนูเด่น, เมนูแนะนำ, ตัววิ่งวัตถุดิบ, ตัวเลขสถิติ
//  ต้องโหลด recipes-data.js, ingredients-data.js, food-art.js ก่อน
// =====================================================

const SLIDE_MS = 5500;

// ---------- สไลด์เมนูเด่น ----------

const slidesEl = document.getElementById("slides");
const dotsEl = document.getElementById("dots");
const sliderEl = document.getElementById("slider");
const progressBar = document.getElementById("progressBar");
const pauseBtn = document.getElementById("pauseBtn");

const slideItems = FEATURED
    .map(function (f) { return { f: f, r: recipeById(f.id) }; })
    .filter(function (x) { return x.r; });

let current = 0;
let paused = false;
let hovering = false;
let timer = null;
let elapsed = 0;
let lastFrame = 0;

const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function buildSlides() {
    slidesEl.innerHTML = slideItems.map(function (x, i) {
        const chips = x.r.ingTh.slice(0, 4).map(function (n) {
            return '<span class="chip chip-have">' + htmlEsc(n) + "</span>";
        }).join("");

        return '<article class="slide' + (i === 0 ? " active" : "") + '" aria-hidden="' + (i !== 0) + '">' +
            '<div class="slide-text">' +
                '<span class="slide-tag">' + htmlEsc(x.f.tag) + "</span>" +
                "<h2>" + htmlEsc(x.r.name) + "</h2>" +
                '<p class="slide-en">' + htmlEsc(x.r.en) + "</p>" +
                '<p class="slide-blurb">' + htmlEsc(x.f.blurb) + "</p>" +
                '<div class="chip-row">' + chips + "</div>" +
                '<div class="recipe-meta">' + metaTags(x.r) + "</div>" +
                '<a class="btn btn-small" href="recipe-detail.html?id=' + encodeURIComponent(x.r.id) + '">ดูรายละเอียดเมนู →</a>' +
            "</div>" +
            '<div class="slide-art"><div class="art-plate">' + dishImageHtml(x.r, "slide-dish") + "</div></div>" +
        "</article>";
    }).join("");

    dotsEl.innerHTML = slideItems.map(function (x, i) {
        return '<button type="button" class="dot' + (i === 0 ? " active" : "") +
            '" data-i="' + i + '" aria-label="สไลด์ที่ ' + (i + 1) + ': ' + htmlEsc(x.r.name) + '"></button>';
    }).join("");
}

function goTo(index) {
    const n = slideItems.length;
    current = (index + n) % n;

    slidesEl.querySelectorAll(".slide").forEach(function (el, i) {
        el.classList.toggle("active", i === current);
        el.setAttribute("aria-hidden", String(i !== current));
    });
    dotsEl.querySelectorAll(".dot").forEach(function (el, i) {
        el.classList.toggle("active", i === current);
    });

    restartProgress();
}

function restartProgress() {
    elapsed = 0;
    progressBar.style.width = "0%";
}

function tick(now) {
    // นับเวลาเฉพาะตอนที่ไม่ถูกหยุด/ไม่ได้ชี้เมาส์อยู่ (จำกัดไม่เกิน 100ms ต่อเฟรม กันกระโดดตอนกลับมาที่แท็บ)
    const dt = Math.min(100, now - lastFrame);
    lastFrame = now;

    if (!paused && !hovering && !reduceMotion) {
        elapsed += dt;
        progressBar.style.width = Math.min(100, (elapsed / SLIDE_MS) * 100) + "%";

        if (elapsed >= SLIDE_MS) {
            goTo(current + 1);
        }
    }
    timer = requestAnimationFrame(tick);
}

function initSlider() {
    if (slideItems.length === 0) {
        sliderEl.hidden = true;
        return;
    }

    buildSlides();

    document.getElementById("prevBtn").addEventListener("click", function () { goTo(current - 1); });
    document.getElementById("nextBtn").addEventListener("click", function () { goTo(current + 1); });

    dotsEl.addEventListener("click", function (e) {
        const dot = e.target.closest(".dot");
        if (dot) goTo(Number(dot.dataset.i));
    });

    pauseBtn.addEventListener("click", function () {
        paused = !paused;
        pauseBtn.textContent = paused ? "▶" : "❚❚";
        pauseBtn.setAttribute("aria-label", paused ? "เล่นต่อ" : "หยุดเลื่อนอัตโนมัติ");
    });

    sliderEl.addEventListener("mouseenter", function () { hovering = true; });
    sliderEl.addEventListener("mouseleave", function () { hovering = false; });
    sliderEl.addEventListener("focusin", function () { hovering = true; });
    sliderEl.addEventListener("focusout", function () { hovering = false; });

    // ปัดซ้าย/ขวาบนมือถือ
    let touchX = null;
    sliderEl.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    sliderEl.addEventListener("touchend", function (e) {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 45) goTo(current + (dx < 0 ? 1 : -1));
        touchX = null;
    }, { passive: true });

    restartProgress();
    lastFrame = performance.now();
    timer = requestAnimationFrame(tick);

    if (reduceMotion) {
        pauseBtn.hidden = true;
        progressBar.parentElement.hidden = true;
    }
}


// ---------- เมนูแนะนำวันนี้ ----------

const pickGrid = document.getElementById("pickGrid");
const pickTabs = document.getElementById("pickTabs");
const PICK_COUNT = 8;

// เมนูที่เหมาะนำเสนอ: มีวัตถุดิบอย่างน้อย 3 อย่าง และไม่ใช่ชื่อที่มีวงเล็บ
const PICK_POOL = RECIPE_DATA.filter(function (r) {
    return r.ing.length >= 3 && !/[()]/.test(r.name);
});

let pickCourse = "all";
let pickSeed = artHash(new Date().toDateString());   // วันเดียวกันได้ชุดเดิม วันใหม่เปลี่ยนเอง

function seededShuffle(list, seed) {
    const rand = artRandom(seed);
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
}

function renderPicks() {
    const pool = PICK_POOL.filter(function (r) {
        return pickCourse === "all" || r.course === pickCourse;
    });
    const list = seededShuffle(pool, pickSeed).slice(0, PICK_COUNT);

    pickGrid.classList.remove("swap");
    void pickGrid.offsetWidth;      // รีสตาร์ทแอนิเมชัน
    pickGrid.classList.add("swap");
    pickGrid.innerHTML = list.map(pickCardHtml).join("");
}

pickTabs.addEventListener("click", function (e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    pickTabs.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t === tab); });
    pickCourse = tab.dataset.course;
    renderPicks();
});

document.getElementById("shuffleBtn").addEventListener("click", function () {
    pickSeed = Math.floor(Math.random() * 4294967295);
    renderPicks();
});


// ---------- ตัววิ่งวัตถุดิบ ----------

function buildTicker() {
    const items = INGREDIENT_DATA.slice(0, 30).map(function (i) {
        return "<span>" + htmlEsc(i.emoji) + " " + htmlEsc(i.label) + "</span>";
    }).join("");
    // ซ้ำสองชุดให้วนต่อเนื่อง
    document.getElementById("tickerTrack").innerHTML = items + items;
}


// ---------- ตัวเลขนับขึ้น ----------

function initCounters() {
    const counts = document.querySelectorAll("[data-count]");
    counts[0].dataset.count = RECIPE_DATA.length;
    counts[1].dataset.count = INGREDIENT_DATA.length;

    function run(el) {
        const target = Number(el.dataset.count);
        if (reduceMotion) { el.textContent = target; return; }
        const t0 = performance.now();
        (function step(now) {
            const p = Math.min(1, (now - t0) / 1200);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }

    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
            });
        }, { threshold: 0.6 });
        counts.forEach(function (el) { io.observe(el); });
    } else {
        counts.forEach(run);
    }
}


initSlider();
renderPicks();
buildTicker();
initCounters();
