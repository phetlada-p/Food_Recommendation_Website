// =====================================================
//  food-art.js  -  ภาพอาหารของแต่ละเมนู + รายการเมนูเด่นหน้าแรก
// =====================================================
//
//  dataset ไม่มีรูปอาหาร ไฟล์นี้จึง "วาดภาพประกอบ" (SVG) ให้แต่ละเมนูตามประเภทอาหารและวัตถุดิบ
//  ถ้าอยากใช้รูปถ่ายจริง: วางไฟล์ images/recipes/<รหัสเมนู>.jpg  เช่น images/recipes/R061.jpg
//  แล้วเพิ่มรหัสนั้นในรายการ DISH_PHOTOS ด้านล่าง ระบบจะแสดงรูปจริงทับภาพวาดให้เอง

const ART_OUTLINE = "#7A2E12";

// รหัสเมนูที่มีรูปถ่ายจริงใน images/recipes/ (ชื่อไฟล์ <รหัส>.jpg)
// เพิ่มรหัสที่นี่เมื่อวางรูปใหม่ จะได้ไม่ต้องขอไฟล์ที่ไม่มีให้เบราว์เซอร์
const DISH_PHOTOS = [];

function artHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

function artRandom(seed) {
    let s = seed || 1;
    return function () {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}


// ---------- ประเภทของอาหาร ----------

function dishKind(recipe) {
    const text = String(recipe.name || "") + " " + (recipe.ingTh || []).join(" ");
    const name = String(recipe.name || "");

    if (recipe.course === "dessert") return "dessert";
    if (recipe.course === "snack") return "snack";
    if (/ต้มยำ|ต้มข่า|แกงจืด/.test(name)) return "soup";
    if (/ยำ|ส้มตำ|ลาบ|น้ำตก|สลัด|พล่า|ตำ/.test(name)) return "salad";
    if (/ก๋วยเตี๋ยว|เส้น|ขนมจีน|ผัดไทย|หมี่|ราดหน้า|วุ้นเส้น|ข้าวซอย/.test(name)) return "noodle";
    if (/ต้ม|ซุป|แกงจืด/.test(name)) return "soup";
    if (/แกง|พะแนง|ฉู่ฉี่|ห่อหมก/.test(name)) return "curry";
    if (/ข้าว/.test(name)) return "rice";
    if (/ผัด|ทอด|เจียว|ย่าง|ปิ้ง/.test(name)) return "fried";
    if (/ผัก|เนื้อ|ไก่|หมู|ปลา|กุ้ง/.test(text)) return "fried";
    return "plate";
}

function liquidColor(recipe) {
    const name = String(recipe.name || "");
    const text = name + " " + (recipe.ingTh || []).join(" ");

    if (/เขียวหวาน/.test(name)) return "#A9C97A";
    if (/ต้มยำ/.test(name)) return "#D8561F";
    if (/มัสมั่น|พะแนง|เผ็ด|ฉู่ฉี่|ข้าวซอย/.test(name)) return "#DD8A33";
    if (/กะทิ/.test(text) && /ต้ม|แกง/.test(name)) return "#F3E0B8";
    if (/จืด|ซุป|ต้ม/.test(name)) return "#F1D68C";
    return "#E39A45";
}


// ---------- ของตกแต่งบนจาน (เลือกตามวัตถุดิบ) ----------

const GARNISH_RULES = [
    [/พริก/, "chili"],
    [/กุ้ง/, "shrimp"],
    [/ไข่/, "egg"],
    [/หมู|เนื้อ|ไส้|เลือด|หนัง|ขา/, "meat"],
    [/ไก่|เป็ด/, "chicken"],
    [/ปลา|หมึก|หอย|ปู/, "fish"],
    [/มะเขือเทศ/, "tomato"],
    [/มะนาว|ส้ม/, "lime"],
    [/เห็ด/, "mushroom"],
    [/ถั่ว|งา|เกาลัด/, "nut"],
    [/มะม่วง|ทุเรียน|ขนุน|สับปะรด|ฟักทอง|กล้วย|ผลไม้|ตาล/, "fruit"],
    [/ผัก|กะเพรา|โหระพา|สมุนไพร|ใบ|ตะไคร้|ข่า|มะกรูด|ผักชี|หอม|แตง/, "leaf"]
];

function garnishFor(recipe) {
    const list = [];
    (recipe.ingTh || []).forEach(function (name) {
        for (let i = 0; i < GARNISH_RULES.length; i++) {
            if (GARNISH_RULES[i][0].test(name)) {
                list.push(GARNISH_RULES[i][1]);
                break;
            }
        }
    });

    if (list.length === 0) list.push("leaf", "chili");
    if (list.length < 3) list.push("leaf");
    return list.slice(0, 6);
}

function drawGarnish(type, x, y, rand) {
    const o = 'stroke="' + ART_OUTLINE + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
    const rot = Math.round(rand() * 120 - 60);
    const g = 'transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot + ')"';

    switch (type) {
        case "chili":
            return '<g ' + g + '><path d="M-10 0 Q0 -6 10 0 Q0 6 -10 0Z" fill="#D7261E" ' + o + '/><path d="M10 0 l4 -3" ' + o + '/></g>';
        case "shrimp":
            return '<g ' + g + '><path d="M-11 4 Q-12 -10 2 -9 Q12 -8 10 3 Q6 -3 0 -3 Q-6 -2 -6 6Z" fill="#F4875B" ' + o + '/></g>';
        case "egg":
            return '<g ' + g + '><ellipse cx="0" cy="0" rx="11" ry="8" fill="#FFFDF5" ' + o + '/><circle cx="1" cy="0" r="4.2" fill="#FFB81C" stroke="' + ART_OUTLINE + '" stroke-width="1.4"/></g>';
        case "meat":
            return '<g ' + g + '><rect x="-9" y="-6" width="18" height="12" rx="5" fill="#C9694A" ' + o + '/></g>';
        case "chicken":
            return '<g ' + g + '><path d="M-9 2 Q-8 -8 2 -7 Q11 -5 8 4 Q0 8 -9 2Z" fill="#E7B56B" ' + o + '/></g>';
        case "fish":
            return '<g ' + g + '><ellipse cx="0" cy="0" rx="9" ry="5" fill="#E8B5A5" ' + o + '/><path d="M9 0 l6 -5 v10Z" fill="#E8B5A5" ' + o + '/></g>';
        case "tomato":
            return '<g ' + g + '><circle r="8" fill="#E8412C" ' + o + '/><path d="M-4 -7 l4 3 l4 -3" fill="none" stroke="#4E8A2E" stroke-width="2"/></g>';
        case "lime":
            return '<g ' + g + '><circle r="8" fill="#C5E27A" ' + o + '/><path d="M0 -8 V8 M-8 0 H8" stroke="' + ART_OUTLINE + '" stroke-width="1.2"/></g>';
        case "mushroom":
            return '<g ' + g + '><path d="M-9 1 Q-8 -9 0 -9 Q8 -9 9 1Z" fill="#E9D2B0" ' + o + '/><rect x="-3" y="1" width="6" height="6" rx="2" fill="#F6EAD4" ' + o + '/></g>';
        case "nut":
            return '<g ' + g + '><ellipse cx="-5" cy="0" rx="4.5" ry="3.2" fill="#D9A25B" ' + o + '/><ellipse cx="5" cy="3" rx="4.5" ry="3.2" fill="#D9A25B" ' + o + '/></g>';
        case "fruit":
            return '<g ' + g + '><path d="M-10 3 Q0 -12 10 3Z" fill="#FFC53D" ' + o + '/></g>';
        default:
            return '<g ' + g + '><path d="M-11 0 Q0 -10 11 0 Q0 10 -11 0Z" fill="#7DB04B" ' + o + '/><path d="M-9 0 H9" stroke="' + ART_OUTLINE + '" stroke-width="1.2"/></g>';
    }
}

function scatter(types, area, rand) {
    let out = "";
    types.forEach(function (type) {
        const angle = rand() * Math.PI * 2;
        const dist = Math.sqrt(rand());
        const x = area.cx + Math.cos(angle) * area.rx * dist;
        const y = area.cy + Math.sin(angle) * area.ry * dist;
        out += drawGarnish(type, x, y, rand);
    });
    return out;
}


// ---------- ภาชนะแต่ละแบบ ----------

function bowl(fill, rim) {
    return '' +
        '<path d="M28 98 Q32 158 100 162 Q168 158 172 98Z" fill="' + rim + '" stroke="' + ART_OUTLINE + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M70 166 H130" stroke="' + ART_OUTLINE + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M44 124 Q100 140 156 124" fill="none" stroke="#FFF4E4" stroke-width="3" opacity=".7" stroke-linecap="round"/>' +
        '<ellipse cx="100" cy="98" rx="72" ry="17" fill="' + fill + '" stroke="' + ART_OUTLINE + '" stroke-width="3"/>';
}

function plate() {
    return '' +
        '<ellipse cx="100" cy="128" rx="84" ry="32" fill="#FFF4E4" stroke="' + ART_OUTLINE + '" stroke-width="3"/>' +
        '<ellipse cx="100" cy="126" rx="64" ry="22" fill="#FFFFFF" stroke="#EAD3B0" stroke-width="2"/>';
}

function steam(rand) {
    let out = "";
    [70, 100, 130].forEach(function (x) {
        const h = 22 + rand() * 10;
        out += '<path class="steam" d="M' + x + " 78 q-8 -" + h / 3 + " 0 -" + h / 2 + " t0 -" + h / 2 + '" fill="none" stroke="#C9A98B" stroke-width="3" stroke-linecap="round" opacity=".7"/>';
    });
    return out;
}

function noodleLines(rand, cx, cy, rx, ry) {
    let out = "";
    for (let i = 0; i < 9; i++) {
        const x = cx - rx * 0.8 + rand() * rx * 1.6;
        const y = cy - ry * 0.6 + rand() * ry * 1.2;
        out += '<path d="M' + (x - 14).toFixed(1) + " " + y.toFixed(1) + " q7 -9 14 0 t14 0" + '" fill="none" stroke="#F2D27A" stroke-width="4" stroke-linecap="round"/>';
    }
    return out;
}


function dishArtSvg(recipe) {
    const kind = dishKind(recipe);
    const rand = artRandom(artHash(String(recipe.id || recipe.name)));
    const garnish = garnishFor(recipe);
    let body = "";

    if (kind === "soup" || kind === "curry") {
        const fill = liquidColor(recipe);
        body = steam(rand) + bowl(fill, "#FBE6C4") +
            scatter(garnish, { cx: 100, cy: 98, rx: 52, ry: 9 }, rand);

    } else if (kind === "noodle" && /ผัด|วุ้นเส้น/.test(recipe.name || "")) {
        body = steam(rand) + plate() +
            noodleLines(rand, 100, 120, 50, 14) +
            scatter(garnish, { cx: 100, cy: 118, rx: 46, ry: 12 }, rand);

    } else if (kind === "noodle") {
        body = steam(rand) + bowl("#E9A24D", "#EAF1FA") +
            noodleLines(rand, 100, 96, 56, 11) +
            scatter(garnish, { cx: 100, cy: 96, rx: 50, ry: 8 }, rand);

    } else if (kind === "rice") {
        body = steam(rand) + plate() +
            '<path d="M42 126 Q50 78 100 76 Q150 78 158 126 Q100 144 42 126Z" fill="#FFFDF7" stroke="' + ART_OUTLINE + '" stroke-width="3" stroke-linejoin="round"/>' +
            '<path d="M70 104 q4 -3 8 0 M96 92 q4 -3 8 0 M118 108 q4 -3 8 0 M84 118 q4 -3 8 0" stroke="#D9C9A8" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
            scatter(garnish, { cx: 100, cy: 112, rx: 48, ry: 14 }, rand);

    } else if (kind === "salad") {
        let leaves = "";
        for (let i = 0; i < 8; i++) {
            leaves += drawGarnish("leaf", 55 + rand() * 90, 108 + rand() * 30, rand);
        }
        body = plate() + leaves +
            scatter(garnish.concat(["tomato", "nut"]), { cx: 100, cy: 120, rx: 52, ry: 14 }, rand);

    } else if (kind === "fried") {
        body = steam(rand) + plate() +
            '<path d="M44 128 Q40 100 76 96 Q104 84 136 98 Q164 108 156 128 Q100 150 44 128Z" fill="#B96A33" stroke="' + ART_OUTLINE + '" stroke-width="3" stroke-linejoin="round"/>' +
            scatter(garnish, { cx: 100, cy: 116, rx: 46, ry: 11 }, rand);

    } else if (kind === "dessert") {
        body = bowl("#FFF7E6", "#F5C9D0") +
            '<path d="M44 102 Q100 118 156 102" fill="none" stroke="#FFD9A0" stroke-width="5" stroke-linecap="round" opacity=".9"/>' +
            scatter(garnish.concat(["fruit", "fruit"]), { cx: 100, cy: 99, rx: 46, ry: 8 }, rand);

    } else if (kind === "snack") {
        body = '<ellipse cx="100" cy="132" rx="82" ry="28" fill="#D9A566" stroke="' + ART_OUTLINE + '" stroke-width="3"/>' +
            '<ellipse cx="100" cy="128" rx="68" ry="21" fill="#E8BE84" stroke="#B98644" stroke-width="2"/>' +
            ['#E5A84E', '#D9903A', '#EDBB63', '#D9903A'].map(function (c, i) {
                const x = 62 + i * 26 + rand() * 6;
                const y = 122 + (i % 2) * 8;
                return '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="13" fill="' + c + '" stroke="' + ART_OUTLINE + '" stroke-width="2.6"/>' +
                    '<path d="M' + (x - 6).toFixed(1) + " " + (y - 3) + ' q6 -5 12 0" fill="none" stroke="#FFF1D0" stroke-width="2" stroke-linecap="round"/>';
            }).join("") +
            scatter(garnish.slice(0, 3), { cx: 100, cy: 140, rx: 44, ry: 6 }, rand);

    } else {
        body = plate() + scatter(garnish, { cx: 100, cy: 124, rx: 50, ry: 14 }, rand);
    }

    return '<svg class="dish-svg" viewBox="8 44 184 140" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' + body + "</svg>";
}


// ---------- ภาพของเมนู: รูปจริง (ถ้ามี) ทับภาพวาด ----------

function safeRecipeId(id) {
    return String(id || "").replace(/[^A-Za-z0-9_-]/g, "");
}

function dishImageHtml(recipe, extraClass) {
    const kind = dishKind(recipe);
    const id = safeRecipeId(recipe.id);
    const photo = (id && DISH_PHOTOS.indexOf(id) !== -1)
        ? '<img class="dish-photo" src="images/recipes/' + id + '.jpg" alt="" loading="lazy" onerror="this.remove()">'
        : "";

    return '<div class="dish-img k-' + kind + " " + (extraClass || "") + '">' +
        dishArtSvg(recipe) + photo + "</div>";
}


// ---------- เมนูเด่นหน้าแรก (เขียนคำบรรยายสั้น ๆ ไว้ให้) ----------

const FEATURED = [
    { id: "R135", tag: "ซิกเนเจอร์ไทย", blurb: "ต้มน้ำใสรสจัดจ้าน หอมตะไคร้ ข่า ใบมะกรูด เปรี้ยว เผ็ด เค็ม ครบในชามเดียว" },
    { id: "R050", tag: "ยอดนิยมตลอดกาล", blurb: "เส้นจันท์ผัดซอสรสกลมกล่อม หวาน เปรี้ยว เค็ม โรยถั่วลิสงคั่ว เสิร์ฟพร้อมมะนาวและถั่วงอก" },
    { id: "R061", tag: "สายแซ่บห้ามพลาด", blurb: "มะละกอสับตำกับพริก กระเทียม น้ำปลา มะนาว กรอบสดชื่น เผ็ดแซ่บถึงใจ" },
    { id: "R096", tag: "แกงรสละมุน", blurb: "แกงกะทิหอมเครื่องเทศ ตุ๋นนุ่มจนเข้าเนื้อ รสหวานมัน เหมาะกินกับข้าวสวยร้อน ๆ" },
    { id: "R025", tag: "รสเด่นแดนเหนือ", blurb: "แกงกะทิหอมเครื่องแกง ราดเส้น โรยเส้นกรอบ ซดน้ำแกงเข้มข้นอุ่น ๆ" },
    { id: "R145", tag: "จานด่วนที่ใคร ๆ ก็รัก", blurb: "ผัดเผ็ดหอมใบกะเพราไฟแรง กินกับข้าวสวยและไข่ดาวกรอบ ๆ อร่อยได้ในไม่กี่นาที" },
    { id: "R129", tag: "ซดคล่องคอ", blurb: "ต้มกะทิรสหวานมัน หอมข่า เปรี้ยวมะนาวนิด ๆ ใส่ไก่นุ่มเคี้ยวเพลิน" },
    { id: "R291", tag: "ของหวานสุดฮิต", blurb: "ข้าวเหนียวมูนหอมมัน เสิร์ฟกับมะม่วงสุกหวานฉ่ำและราดกะทิ" }
];


// ---------- ตัวช่วยร่วมกันของหน้าแรกและหน้าเมนู ----------

const REGION_TH = {
    Central: "ภาคกลาง", North: "ภาคเหนือ", Northeast: "ภาคอีสาน", South: "ภาคใต้"
};
const COURSE_TH = {
    "main dish": "จานหลัก", snack: "ของว่าง", dessert: "ของหวาน", salad: "ยำ/สลัด", soup: "ซุป"
};

function htmlEsc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function recipeById(id) {
    return RECIPE_DATA.find(function (r) { return r.id === id; });
}

function metaTags(recipe) {
    const region = REGION_TH[recipe.region] || "";
    return '<span class="tag tag-course">' + htmlEsc(COURSE_TH[recipe.course] || "อาหาร") + "</span>" +
        (region ? '<span class="tag tag-region">📍 ' + htmlEsc(region) + "</span>" : "");
}



function pickCardHtml(r) {
    const chips = r.ingTh.slice(0, 3).map(function (n) {
        return '<span class="chip chip-mini">' + htmlEsc(n) + "</span>";
    }).join("");

    return '<a class="pick-card" href="recipe-detail.html?id=' + encodeURIComponent(r.id) + '">' +
        dishImageHtml(r, "card-dish") +
        '<div class="pick-body">' +
            "<h3>" + htmlEsc(r.name) + "</h3>" +
            '<p class="recipe-en">' + htmlEsc(r.en) + "</p>" +
            '<div class="chip-row">' + chips + "</div>" +
            '<div class="recipe-meta">' + metaTags(r) + "</div>" +
        "</div></a>";
}

