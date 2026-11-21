// =====================================================
//  theme.js  -  ปุ่มสลับธีม (สไตล์ดั้งเดิม / โทนสไลด์) มุมซ้ายล่าง
//  ธีมที่เลือกจำไว้ใน localStorage ส่วนการสลับสไตล์จริงทำในสคริปต์ใน <head> ของแต่ละหน้า
// =====================================================

(function () {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";

    function current() {
        return document.documentElement.getAttribute("data-theme") === "slide" ? "slide" : "original";
    }

    function label() {
        btn.textContent = current() === "slide" ? "🎨 ธีม: โทนสไลด์" : "🎨 ธีม: ดั้งเดิม";
        btn.title = "คลิกเพื่อสลับธีม";
    }

    function apply(theme) {
        const slide = theme === "slide";
        document.documentElement.setAttribute("data-theme", theme);
        document.getElementById("css-base-original").media = slide ? "not all" : "all";
        document.getElementById("css-foody-original").media = slide ? "not all" : "all";
        document.getElementById("css-base-slide").media = slide ? "all" : "not all";
        document.getElementById("css-foody-slide").media = slide ? "all" : "not all";
        try { localStorage.setItem("foodyTheme", theme); } catch (e) {}
        label();
    }

    btn.addEventListener("click", function () {
        apply(current() === "slide" ? "original" : "slide");
    });

    label();
    document.body.appendChild(btn);
})();
