// =====================================================
//  ingredients.js  -  หน้าเลือกวัตถุดิบ
//  ต้องโหลด js/ingredients-data.js ก่อนไฟล์นี้
// =====================================================

const CATEGORY_EMOJI = {
    meat: "🥩", vegetable: "🥦", fruit: "🍎", dairy: "🥚",
    staple: "🍚", seasoning: "🧂", herb: "🌿", other: "🍴"
};

const categoryBox = document.getElementById("categoryButtons");
const ingredientGrid = document.getElementById("ingredientGrid");
const searchInput = document.getElementById("searchInput");
const selectedList = document.getElementById("selectedList");
const selectedCount = document.getElementById("selectedCount");
const confirmBtn = document.getElementById("confirmBtn");
const clearBtn = document.getElementById("clearBtn");
const noResult = document.getElementById("noResult");
const stickyBar = document.getElementById("stickyBar");
const stickyCount = document.getElementById("stickyCount");
const stickyConfirm = document.getElementById("stickyConfirm");

// หมวดหมู่ที่กำลังเลือก
let currentCategory = "all";

// วัตถุดิบที่เลือก: { label, emoji, names }  (names = ชื่อไทยที่ส่งให้โมเดล)
let selectedIngredients = [];

const itemByLabel = new Map();


// ---------- สร้างปุ่มหมวดหมู่ ----------

function addCategoryButton(key, text, active) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-btn" + (active ? " active" : "");
    button.dataset.category = key;
    button.textContent = text;
    categoryBox.appendChild(button);
}

addCategoryButton("all", "🍽️ ทั้งหมด", true);

Object.keys(INGREDIENT_CATEGORIES).forEach(function (key) {
    addCategoryButton(key, CATEGORY_EMOJI[key] + " " + INGREDIENT_CATEGORIES[key], false);
});

const categoryButtons = document.querySelectorAll(".category-btn");


// ---------- สร้างการ์ดวัตถุดิบจาก INGREDIENT_DATA ----------

INGREDIENT_DATA.forEach(function (item) {
    itemByLabel.set(item.label, item);

    const card = document.createElement("div");
    card.className = "ingredient-card";
    card.dataset.category = item.category;
    card.dataset.label = item.label;

    const icon = document.createElement("span");
    icon.className = "ingredient-icon";
    icon.textContent = item.emoji;

    const title = document.createElement("h4");
    title.textContent = item.label;

    const usage = document.createElement("small");
    usage.className = "ingredient-count";
    usage.textContent = "ใช้ใน " + item.count + " เมนู";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-btn";
    button.textContent = "＋ เลือก";

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(usage);
    card.appendChild(button);
    ingredientGrid.appendChild(card);
});

const ingredientCards = document.querySelectorAll(".ingredient-card");


// ---------- ค้นหาและกรอง ----------

function filterIngredients() {
    const searchText = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    ingredientCards.forEach(function (card) {
        const matchCategory =
            currentCategory === "all" || card.dataset.category === currentCategory;
        const matchSearch = card.dataset.label.toLowerCase().includes(searchText);

        if (matchCategory && matchSearch) {
            card.style.display = "";
            visibleCount++;
        } else {
            card.style.display = "none";
        }
    });

    noResult.style.display = visibleCount === 0 ? "block" : "none";
}

categoryButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        categoryButtons.forEach(function (btn) { btn.classList.remove("active"); });
        button.classList.add("active");
        currentCategory = button.dataset.category;
        filterIngredients();
    });
});

searchInput.addEventListener("input", filterIngredients);


// ---------- เลือก / ยกเลิกวัตถุดิบ ----------

function toggleIngredient(label) {
    const item = itemByLabel.get(label);
    if (!item) {
        return;
    }

    const index = selectedIngredients.findIndex(function (x) { return x.label === label; });

    if (index === -1) {
        selectedIngredients.push({ label: item.label, emoji: item.emoji, names: item.names });
    } else {
        selectedIngredients.splice(index, 1);
    }

    updateSelectedIngredients();
}

// กดที่การ์ดได้ทั้งใบ (ไม่ต้องเล็งปุ่ม)
ingredientGrid.addEventListener("click", function (event) {
    const card = event.target.closest(".ingredient-card");
    if (card) {
        toggleIngredient(card.dataset.label);
    }
});

// ปุ่ม ✕ ในรายการที่เลือก
selectedList.addEventListener("click", function (event) {
    const button = event.target.closest(".remove-btn");
    if (button) {
        toggleIngredient(button.dataset.label);
    }
});


// ---------- แถบลอยด้านล่าง: แสดงเฉพาะตอนมองไม่เห็นกล่อง "วัตถุดิบที่คุณเลือก" ----------

const selectedSection = document.querySelector(".selected-section");
let selectedSectionVisible = false;

function refreshStickyBar() {
    stickyBar.hidden = selectedIngredients.length === 0 || selectedSectionVisible;
}

if ("IntersectionObserver" in window && selectedSection) {
    new IntersectionObserver(function (entries) {
        selectedSectionVisible = entries[0].isIntersecting;
        refreshStickyBar();
    }).observe(selectedSection);
}


// ---------- อัปเดตหน้าจอ ----------

function updateSelectedIngredients() {
    const total = selectedIngredients.length;

    selectedCount.textContent = total;
    stickyCount.textContent = total;
    refreshStickyBar();

    confirmBtn.disabled = total === 0;
    clearBtn.disabled = total === 0;

    // รายการที่เลือก
    selectedList.textContent = "";

    if (total === 0) {
        selectedList.textContent = "ยังไม่มีวัตถุดิบที่เลือก";
    } else {
        selectedIngredients.forEach(function (item) {
            const chip = document.createElement("span");
            chip.className = "selected-item";
            chip.appendChild(document.createTextNode(item.emoji + " " + item.label));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-btn";
            remove.dataset.label = item.label;
            remove.setAttribute("aria-label", "ลบ " + item.label);
            remove.textContent = "✕";

            chip.appendChild(remove);
            selectedList.appendChild(chip);
        });
    }

    // สถานะการ์ด
    ingredientCards.forEach(function (card) {
        const isSelected = selectedIngredients.some(function (x) {
            return x.label === card.dataset.label;
        });

        card.classList.toggle("selected", isSelected);
        card.querySelector(".select-btn").textContent = isSelected ? "✓ เลือกแล้ว" : "＋ เลือก";
    });
}


// ---------- ปุ่มล้างและปุ่มยืนยัน ----------

clearBtn.addEventListener("click", function () {
    if (selectedIngredients.length === 0) {
        return;
    }

    if (confirm("คุณต้องการล้างรายการวัตถุดิบทั้งหมดใช่หรือไม่?")) {
        selectedIngredients = [];
        updateSelectedIngredients();
    }
});

confirmBtn.addEventListener("click", function () {
    if (selectedIngredients.length === 0) {
        return;
    }

    // names = ชื่อไทยที่ส่งให้โมเดล / labels = ชื่อที่แสดงในหน้าถัดไป
    const names = [];
    selectedIngredients.forEach(function (item) {
        item.names.forEach(function (n) {
            if (!names.includes(n)) { names.push(n); }
        });
    });

    const labels = selectedIngredients.map(function (item) { return item.label; });

    try {
        localStorage.setItem("selectedIngredients", JSON.stringify(names));
        localStorage.setItem("selectedLabels", JSON.stringify(labels));
    } catch (error) {
        console.error(error);
    }

    window.location.href = "recommendations.html";
});

// ปุ่มบนแถบล่าง = กดปุ่มยืนยันเดิม
stickyConfirm.addEventListener("click", function () {
    confirmBtn.click();
});


// ---------- เริ่มต้น: คืนค่าที่เคยเลือกไว้ (เช่น กดแก้ไขวัตถุดิบจากหน้าผลลัพธ์) ----------

try {
    const savedLabels = JSON.parse(localStorage.getItem("selectedLabels") || "[]");

    if (Array.isArray(savedLabels)) {
        savedLabels.forEach(function (label) {
            const item = itemByLabel.get(label);
            if (item) {
                selectedIngredients.push({ label: item.label, emoji: item.emoji, names: item.names });
            }
        });
    }
} catch (error) {
    selectedIngredients = [];
}

filterIngredients();
updateSelectedIngredients();

// =====================================================
// AI FOOD IMAGE RECOGNITION
// =====================================================

const openCameraBtn = document.getElementById("openCameraBtn");
const imageUpload = document.getElementById("imageUpload");
const cameraArea = document.getElementById("cameraArea");
const cameraPreview = document.getElementById("cameraPreview");
const capturePhotoBtn = document.getElementById("capturePhotoBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const cameraCanvas = document.getElementById("cameraCanvas");

const imagePreviewArea = document.getElementById("imagePreviewArea");
const imagePreview = document.getElementById("imagePreview");
const recognizeImageBtn = document.getElementById("recognizeImageBtn");

const recognitionLoading = document.getElementById("recognitionLoading");
const recognitionError = document.getElementById("recognitionError");
const recognitionResults = document.getElementById("recognitionResults");
const recognitionList = document.getElementById("recognitionList");

let cameraStream = null;
let selectedImageFile = null;
let imagePreviewUrl = null;


// ---------- แสดงข้อความผิดพลาด ----------

function showRecognitionError(message) {
    recognitionError.textContent = message;
    recognitionError.hidden = false;
}

function clearRecognitionError() {
    recognitionError.textContent = "";
    recognitionError.hidden = true;
}


// ---------- ปิดกล้อง ----------

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(function (track) {
            track.stop();
        });

        cameraStream = null;
    }

    cameraPreview.srcObject = null;
    cameraArea.hidden = true;
}

closeCameraBtn.addEventListener("click", stopCamera);


// ---------- จัดการรูปภาพที่เลือก ----------

function setSelectedImage(file) {
    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        showRecognitionError("กรุณาเลือกรูปภาพ JPG, PNG หรือ WEBP");
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showRecognitionError("รูปภาพต้องมีขนาดไม่เกิน 8 MB");
        return;
    }

    selectedImageFile = file;

    if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
    }

    imagePreviewUrl = URL.createObjectURL(file);
    imagePreview.src = imagePreviewUrl;

    imagePreviewArea.hidden = false;
    recognitionResults.hidden = true;
    recognitionList.textContent = "";

    clearRecognitionError();
}


// ---------- เลือกรูปภาพจากเครื่อง ----------

imageUpload.addEventListener("change", function (event) {
    const file = event.target.files[0];

    if (!file) return;

    stopCamera();
    setSelectedImage(file);

    // เลือกรูปเดิมซ้ำได้ในครั้งต่อไป
    imageUpload.value = "";
});


// ---------- เปิดกล้อง ----------

openCameraBtn.addEventListener("click", async function () {
    clearRecognitionError();

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

        showRecognitionError(
            "เบราว์เซอร์ไม่รองรับการเปิดกล้อง กรุณาใช้ปุ่มเลือกรูปภาพแทน"
        );
        return;
    }

    try {
        stopCamera();

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            },
            audio: false
        });

        cameraPreview.srcObject = cameraStream;
        cameraArea.hidden = false;

        await cameraPreview.play();

    } catch (error) {
        console.error("Camera error:", error);

        stopCamera();

        if (error.name === "NotAllowedError") {
            showRecognitionError(
                "กรุณาอนุญาตให้เว็บไซต์เข้าถึงกล้องก่อนใช้งาน"
            );
        } else {
            showRecognitionError(
                "ไม่สามารถเปิดกล้องได้ กรุณาลองเลือกรูปภาพแทน"
            );
        }
    }
});


// ---------- ถ่ายภาพจากกล้อง ----------

capturePhotoBtn.addEventListener("click", function () {
    if (!cameraStream || !cameraPreview.videoWidth) {
        showRecognitionError("กล้องยังไม่พร้อม กรุณารอสักครู่");
        return;
    }

    const width = cameraPreview.videoWidth;
    const height = cameraPreview.videoHeight;

    cameraCanvas.width = width;
    cameraCanvas.height = height;

    const context = cameraCanvas.getContext("2d");

    context.drawImage(
        cameraPreview,
        0,
        0,
        width,
        height
    );

    cameraCanvas.toBlob(function (blob) {
        if (!blob) {
            showRecognitionError("ไม่สามารถถ่ายภาพได้");
            return;
        }

        const file = new File(
            [blob],
            "camera-food.jpg",
            { type: "image/jpeg" }
        );

        setSelectedImage(file);
        stopCamera();

    }, "image/jpeg", 0.9);
});


// ---------- ส่งรูปภาพไปวิเคราะห์ด้วย AI ----------

recognizeImageBtn.addEventListener("click", async function () {
    if (!selectedImageFile) {
        showRecognitionError("กรุณาเลือกรูปภาพก่อน");
        return;
    }

    clearRecognitionError();

    recognitionResults.hidden = true;
    recognitionLoading.hidden = false;
    recognizeImageBtn.disabled = true;

    try {
        const formData = new FormData();

        formData.append("image", selectedImageFile);

        const response = await fetch("/api/recognize", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok || result.status !== "success") {
            throw new Error(
                result.error || result.message || "ไม่สามารถวิเคราะห์ภาพได้"
            );
        }

        displayRecognitionResults(result.predictions || []);

    } catch (error) {
        console.error("Recognition error:", error);

        showRecognitionError(
            error.message || "เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ"
        );

    } finally {
        recognitionLoading.hidden = true;
        recognizeImageBtn.disabled = false;
    }
});


// ---------- แสดงผลวัตถุดิบที่ AI ตรวจพบ ----------

function displayRecognitionResults(predictions) {
    recognitionList.textContent = "";

    if (!predictions.length) {
        recognitionList.textContent = "ไม่พบข้อมูลวัตถุดิบจากรูปภาพ";
        recognitionResults.hidden = false;
        return;
    }

    predictions.forEach(function (prediction) {
        const row = document.createElement("div");
        row.className = "recognition-item";

        const info = document.createElement("div");
        info.className = "recognition-info";

        const name = document.createElement("strong");

        name.textContent = prediction.label
            ? prediction.label
            : prediction.class_name + " (ยังไม่มีชื่อภาษาไทย)";

        const confidence = document.createElement("span");
        confidence.textContent =
            "ความมั่นใจ " + prediction.confidence + "%";

        info.appendChild(name);
        info.appendChild(confidence);

        const action = document.createElement("button");
        action.type = "button";
        action.className = "recognition-add-btn";

        const matchedItem = prediction.matched
            ? itemByLabel.get(prediction.label)
            : null;

        if (!matchedItem) {
            action.textContent = "ยังเพิ่มไม่ได้";
            action.disabled = true;

        } else {
            const alreadySelected = selectedIngredients.some(function (item) {
                return item.label === matchedItem.label;
            });

            action.textContent = alreadySelected
                ? "✓ เลือกแล้ว"
                : "＋ เพิ่มวัตถุดิบ";

            action.disabled = alreadySelected;

            action.addEventListener("click", function () {
                const isSelected = selectedIngredients.some(function (item) {
                    return item.label === matchedItem.label;
                });

                if (!isSelected) {
                    toggleIngredient(matchedItem.label);
                }

                action.textContent = "✓ เลือกแล้ว";
                action.disabled = true;
            });
        }

        row.appendChild(info);
        row.appendChild(action);

        recognitionList.appendChild(row);
    });

    recognitionResults.hidden = false;
}


// ---------- คืนทรัพยากรเมื่อออกจากหน้า ----------

window.addEventListener("beforeunload", function () {
    stopCamera();

    if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
    }
});

console.log("AI Food Image Recognition UI ready!");

