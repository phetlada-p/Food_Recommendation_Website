import sys
from pathlib import Path

import torch
import timm
from PIL import Image
from torchvision import transforms

# กำหนดตำแหน่งไฟล์
ROOT = Path(__file__).resolve().parent.parent
MODEL_REPO = ROOT / "tools" / "ConvNeXt-Food-CLF-75"
CHECKPOINT_PATH = ROOT / "tools" / "model_weights" / "checkpoint.pth.tar"
IMAGE_PATH = ROOT / "images" / "food.jpg"

# เพิ่มตำแหน่งโค้ดโมเดล
sys.path.insert(0, str(MODEL_REPO))

# ไม่ดาวน์โหลด pretrained weights ซ้ำ
original_create_model = timm.create_model

def create_model_without_download(*args, **kwargs):
    kwargs["pretrained"] = False
    return original_create_model(*args, **kwargs)

timm.create_model = create_model_without_download

from model.model import create_classifier

def main():
    print("=" * 55)
    print("ทดสอบ AI Food Ingredient Recognition")
    print("=" * 55)

    device = torch.device("cpu")
    print("Device:", device)

    if not CHECKPOINT_PATH.exists():
        raise FileNotFoundError(f"ไม่พบไฟล์โมเดล: {CHECKPOINT_PATH}")

    if not IMAGE_PATH.exists():
        raise FileNotFoundError(f"ไม่พบรูปภาพ: {IMAGE_PATH}")

    # โหลด checkpoint
    print("\n[1] กำลังโหลดข้อมูลโมเดล...")
    checkpoint = torch.load(
        CHECKPOINT_PATH,
        map_location="cpu",
        weights_only=False
    )

    ingredient_list = checkpoint["ingredient_list"]
    print("จำนวนคลาส:", len(ingredient_list))

    # สร้างโมเดล
    print("\n[2] กำลังสร้างโครงสร้างโมเดล...")
    model = create_classifier(
        num_ingredients=len(ingredient_list),
        checkpoint_path=None
    )

    # โหลดน้ำหนักจาก checkpoint
    print("\n[3] กำลังโหลดน้ำหนัก AI...")
    result = model.load_state_dict(
        checkpoint["model_state_dict"],
        strict=True
    )
    print("โหลดน้ำหนักสำเร็จ:", result)

    model = model.to(device)
    model.eval()

    # เตรียมรูปภาพตามรูปแบบที่โมเดลใช้
    print("\n[4] กำลังเตรียมรูปภาพ...")
    transform = transforms.Compose([
        transforms.Resize((640, 640)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

    image = Image.open(IMAGE_PATH).convert("RGB")
    image_tensor = transform(image).unsqueeze(0).to(device)

    # ทำนายวัตถุดิบ
    print("\n[5] กำลังให้ AI วิเคราะห์รูปภาพ...")
    with torch.no_grad():
        logits = model(image_tensor)
        probabilities = torch.sigmoid(logits)[0]

    # แสดงผล 10 อันดับแรก
    top_values, top_indices = torch.topk(
        probabilities,
        k=min(10, len(ingredient_list))
    )

    print("\n" + "=" * 55)
    print("ผลการทำนายวัตถุดิบ 10 อันดับแรก")
    print("=" * 55)

    for rank, (score, index) in enumerate(
        zip(top_values.tolist(), top_indices.tolist()), start=1
    ):
        ingredient = ingredient_list[index]
        print(f"{rank:2}. {ingredient:20} {score * 100:6.2f}%")

    print("\n" + "=" * 55)
    print("วัตถุดิบที่มีคะแนนตั้งแต่ 50% ขึ้นไป")
    print("=" * 55)

    found = False
    for score, index in zip(
        probabilities.tolist(), range(len(ingredient_list))
    ):
        if score >= 0.5:
            print(f"- {ingredient_list[index]} ({score * 100:.2f}%)")
            found = True

    if not found:
        print("ไม่มีคลาสที่ได้คะแนนถึง 50%")

    print("\nทดสอบโมเดลเสร็จสิ้น!")

if __name__ == "__main__":
    main()
