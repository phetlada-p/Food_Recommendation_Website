// =====================================================
//  menus.js  -  หน้าเมนูทั้งหมด (ค้นหา/กรอง ไม่ต้องเลือกวัตถุดิบก่อน)
//  ต้องโหลด recipes-data.js และ food-art.js ก่อน
// =====================================================

const MENU_PAGE = 24;

const menuGrid = document.getElementById("menuGrid");
const menuCount = document.getElementById("menuCount");
const menuMore = document.getElementById("menuMore");
const menuSearch = document.getElementById("menuSearch");
const menuTabs = document.getElementById("menuTabs");
const menuRegion = document.getElementById("menuRegion");
const menuSort = document.getElementById("menuSort");

let menuCourse = "all";
let menuVisible = MENU_PAGE;
let shuffleSeed = 1;

function filteredMenus() {
    const q = menuSearch.value.trim().toLowerCase();
    const region = menuRegion.value;

    const list = RECIPE_DATA.filter(function (r) {
        if (menuCourse === "other") {
            if (r.course !== "salad" && r.course !== "soup") return false;
        } else if (menuCourse !== "all" && r.course !== menuCourse) {
            return false;
        }
        if (region !== "all" && r.region !== region) return false;
        if (!q) return true;

        return r.name.toLowerCase().includes(q) ||
            r.en.toLowerCase().includes(q) ||
            r.ingTh.some(function (n) { return n.toLowerCase().includes(q); });
    });

    if (menuSort.value === "name") {
        list.sort(function (a, b) { return a.name.localeCompare(b.name, "th"); });
    } else if (menuSort.value === "ing") {
        list.sort(function (a, b) {
            return a.ing.length - b.ing.length || a.name.localeCompare(b.name, "th");
        });
    } else {
        const rand = artRandom(shuffleSeed);
        list.sort(function () { return rand() - 0.5; });
    }
    return list;
}

function renderMenus() {
    const list = filteredMenus();
    const shown = list.slice(0, menuVisible);

    menuCount.textContent = list.length === 0
        ? ""
        : "แสดง " + shown.length + " จาก " + list.length + " เมนู";

    if (list.length === 0) {
        menuGrid.innerHTML = '<div class="state-box" style="grid-column:1/-1">' +
            '<div class="state-icon">🔍</div><h3>ไม่พบเมนูที่ค้นหา</h3>' +
            "<p>ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองเป็น \"ทั้งหมด\"</p></div>";
    } else {
        menuGrid.innerHTML = shown.map(pickCardHtml).join("");
    }

    menuMore.hidden = shown.length >= list.length;
}

function resetMenus() {
    menuVisible = MENU_PAGE;
    renderMenus();
}

let searchTimer = null;
menuSearch.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(resetMenus, 180);
});
menuRegion.addEventListener("change", resetMenus);
menuSort.addEventListener("change", function () {
    shuffleSeed = Math.floor(Math.random() * 4294967295);
    resetMenus();
});
menuTabs.addEventListener("click", function (e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    menuTabs.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t === tab); });
    menuCourse = tab.dataset.course;
    resetMenus();
});
menuMore.addEventListener("click", function () {
    menuVisible += MENU_PAGE;
    renderMenus();
});

renderMenus();
