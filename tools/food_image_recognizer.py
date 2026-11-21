import sys
import os
from pathlib import Path

from huggingface_hub import hf_hub_download

import torch
import timm
from PIL import Image, UnidentifiedImageError
from torchvision import transforms


# ==========================================
# 1. กำหนดตำแหน่งไฟล์
# ==========================================

ROOT = Path(__file__).resolve().parent.parent

MODEL_REPO = ROOT / "tools" / "ConvNeXt-Food-CLF-75"
CHECKPOINT_PATH = (
    ROOT / "tools" / "model_weights" / "checkpoint.pth.tar"
)
HF_MODEL_REPO = "AXM22AOM/food-recommendation-model"

# ใช้ CPU เพื่อให้ทำงานได้กับ Mac ที่ใช้อยู่
DEVICE = torch.device("cpu")


# ==========================================
# 2. จับคู่ชื่อคลาส AI กับวัตถุดิบภาษาไทย
# ==========================================

INGREDIENT_MAPPING = {
    "banana": "กล้วย",
    "egg": "ไข่",
    "fish": "ปลา",
    "garlic": "กระเทียม",
    "ginger": "ขิง",
    "noodle": "เส้นก๋วยเตี๋ยว",
    "peanut": "ถั่วลิสง",
    "pork": "เนื้อหมู",
    "shrimp": "กุ้ง",
    "sprouts": "ถั่วงอก",
    "rice": "ข้าว",
    "sugar": "น้ำตาล",
}


# ==========================================
# 3. คลาสสำหรับโหลดและใช้งานโมเดล
# ==========================================

class FoodImageRecognizer:

    def __init__(self):

        print("=" * 55)
        print("กำลังโหลด AI Food Image Recognition")
        print("=" * 55)

        if not MODEL_REPO.exists():
            raise FileNotFoundError(
                f"ไม่พบโฟลเดอร์โมเดล: {MODEL_REPO}"
            )

        # ตรวจสอบไฟล์โมเดลในเครื่องก่อน
        checkpoint_path = CHECKPOINT_PATH

        # ถ้าไม่มีไฟล์ในเครื่อง ให้ดาวน์โหลดจาก Hugging Face
        if not checkpoint_path.exists():
            print("ไม่พบไฟล์โมเดลในเครื่อง")
            print("กำลังดาวน์โหลดจาก Hugging Face...")

            hf_token = os.environ.get("HF_TOKEN")

            if not hf_token:
                raise RuntimeError(
                    "ไม่พบ HF_TOKEN กรุณาตั้งค่า Hugging Face Token"
                )

            checkpoint_path = Path(
                hf_hub_download(
                    repo_id=HF_MODEL_REPO,
                    filename="checkpoint.pth.tar",
                    token=hf_token
                )
            )

            print("ดาวน์โหลดไฟล์โมเดลสำเร็จ")

        if str(MODEL_REPO) not in sys.path:
            sys.path.insert(0, str(MODEL_REPO))

        # ป้องกัน timm ดาวน์โหลด pretrained weights ซ้ำ
        original_create_model = timm.create_model

        def create_model_without_download(*args, **kwargs):
            kwargs["pretrained"] = False
            return original_create_model(*args, **kwargs)

        timm.create_model = create_model_without_download

        try:
            from model.model import create_classifier

            # โหลดข้อมูล checkpoint
            checkpoint = torch.load(
                checkpoint_path,
                map_location=DEVICE,
                weights_only=False
            )

            self.ingredient_list = checkpoint["ingredient_list"]

            # สร้างโครงสร้างโมเดล
            self.model = create_classifier(
                num_ingredients=len(self.ingredient_list),
                checkpoint_path=None
            )

            # โหลดน้ำหนัก AI
            self.model.load_state_dict(
                checkpoint["model_state_dict"],
                strict=True
            )

        finally:
            # คืนค่า timm.create_model เดิม
            timm.create_model = original_create_model

        self.model = self.model.to(DEVICE)
        self.model.eval()

        # แปลงรูปภาพตามรูปแบบที่โมเดลผ่านการฝึก
        self.transform = transforms.Compose([
            transforms.Resize((640, 640)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

        print("โหลดโมเดลตรวจจับวัตถุดิบสำเร็จ")
        print("จำนวนคลาส:", len(self.ingredient_list))
        print("อุปกรณ์:", DEVICE)
        print("=" * 55)

    # ======================================
    # 4. วิเคราะห์รูปภาพ
    # ======================================

    def predict(self, image_file, top_k=10):

        try:
            image = Image.open(image_file).convert("RGB")

        except (UnidentifiedImageError, OSError):
            raise ValueError("ไฟล์รูปภาพไม่ถูกต้องหรือไม่สามารถเปิดได้")

        image_tensor = self.transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            logits = self.model(image_tensor)
            probabilities = torch.sigmoid(logits)[0]

        top_values, top_indices = torch.topk(
            probabilities,
            k=min(top_k, len(self.ingredient_list))
        )

        predictions = []

        for score, index in zip(
            top_values.tolist(),
            top_indices.tolist()
        ):

            class_name = self.ingredient_list[index]

            matched_label = INGREDIENT_MAPPING.get(class_name)

            predictions.append({
                "class_name": class_name,
                "confidence": round(float(score) * 100, 2),
                "label": matched_label,
                "matched": matched_label is not None
            })

        return {
            "status": "success",
            "message": "วิเคราะห์รูปภาพสำเร็จ",
            "total_classes": len(self.ingredient_list),
            "predictions": predictions
        }
