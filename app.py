
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import sys
import os

# --------------------------------
# 1. กำหนดตำแหน่งโปรเจกต์
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"

sys.path.insert(0, str(DATASET_DIR))

# --------------------------------
# 2. เชื่อมต่อ AI Model
# --------------------------------

from recommender import load_model

app = Flask(__name__)
CORS(app)

print("Loading Smart Fridge AI Model...")

model = load_model()

print("AI Model loaded successfully!")


# --------------------------------
# 3. หน้าแรกสำหรับตรวจสอบ Server
# --------------------------------

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "status": "success",
        "message": "Smart Fridge Backend is running!"
    })


# --------------------------------
# 4. API แนะนำเมนูอาหาร
# --------------------------------

@app.route("/api/recommend", methods=["POST"])
def recommend():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    ingredients = data.get("ingredients")
    top_n = data.get("top_n", 30)

    if not isinstance(ingredients, list):
        return jsonify({
            "error": "ingredients must be a list"
        }), 400

    if not all(isinstance(x, str) for x in ingredients):
        return jsonify({
            "error": "ingredients must contain text only"
        }), 400

    if not isinstance(top_n, int) or isinstance(top_n, bool) or not 1 <= top_n <= 100:
        return jsonify({
            "error": "top_n must be between 1 and 100"
        }), 400

    try:
        results = model.recommend(
            ingredients,
            top_n=top_n
        )

        return jsonify(results)

    except Exception as e:
        app.logger.exception("Recommendation error")
        return jsonify({"error": "Recommendation failed"}), 500


# --------------------------------
# 5. API รายละเอียดสูตรอาหาร
# --------------------------------

@app.route("/api/recipe/<recipe_id>", methods=["GET"])
def recipe_detail(recipe_id):

    try:
        result = model.get_recipe(recipe_id)

        if result is None:
            return jsonify({
                "error": "Recipe not found"
            }), 404

        return jsonify(result)

    except Exception as e:
        app.logger.exception("Recipe error")
        return jsonify({
            "error": "Unable to load recipe"
        }), 500


# --------------------------------
# 6. เริ่มต้น Flask Server
# --------------------------------


if __name__ == "__main__":
    print("Starting Smart Fridge Backend...")

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001)),
        debug=False
    )

