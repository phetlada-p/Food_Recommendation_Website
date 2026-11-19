
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pathlib import Path
import sys
import sqlite3
import json

# ========================================
# 1. กำหนดตำแหน่งโปรเจกต์
# ========================================

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"
DATABASE_PATH = DATASET_DIR / "smart_fridge.db"

if str(DATASET_DIR) not in sys.path:
    sys.path.insert(0, str(DATASET_DIR))


# ========================================
# 2. เชื่อมต่อ AI Model
# ========================================

from recommender import load_model

app = Flask(__name__)
CORS(app)

print("Loading Smart Fridge AI Model...")

model = load_model()

print("AI Model loaded successfully!")


# ========================================
# 3. ฟังก์ชันเชื่อมต่อ SQLite
# ========================================

def get_db_connection():
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Database not found: {DATABASE_PATH}"
        )

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


# ========================================
# 4. หน้าแรกตรวจสอบ Server
# ========================================

@app.route("/", methods=["GET"])
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def frontend_files(filename):

    allowed_html = {
        "index.html",
        "ingredients.html",
        "recommendations.html",
        "recipe-detail.html"
    }

    allowed_folders = {
        "css",
        "js",
        "images"
    }

    first_folder = filename.split("/")[0]

    if filename in allowed_html or first_folder in allowed_folders:
        return send_from_directory(BASE_DIR, filename)

    return jsonify({
        "error": "File not found"
    }), 404

# ========================================
# 5. ตรวจสอบสถานะ AI Model
# ========================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "Flask API and AI Model are ready"
    }), 200


# ========================================
# 6. ตรวจสอบสถานะ SQLite Database
# ========================================

@app.route("/api/db/health", methods=["GET"])
def database_health():
    try:
        conn = get_db_connection()

        recipes = conn.execute(
            "SELECT COUNT(*) FROM recipes"
        ).fetchone()[0]

        ingredients = conn.execute(
            "SELECT COUNT(*) FROM ingredients"
        ).fetchone()[0]

        relationships = conn.execute(
            "SELECT COUNT(*) FROM recipe_ingredients"
        ).fetchone()[0]

        conn.close()

        return jsonify({
            "status": "ok",
            "message": "SQLite Database connected successfully",
            "database": "smart_fridge.db",
            "counts": {
                "recipes": recipes,
                "ingredients": ingredients,
                "relationships": relationships
            }
        }), 200

    except Exception:
        app.logger.exception("Database health error")

        return jsonify({
            "status": "error",
            "message": "Cannot connect to SQLite Database"
        }), 500


# ========================================
# 7. API แนะนำเมนูอาหารด้วย AI
# ========================================

@app.route("/api/recommend", methods=["POST"])
def recommend():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid JSON request"
        }), 400

    ingredients = data.get("ingredients")
    top_n = data.get("top_n", 30)

    if not isinstance(ingredients, list):
        return jsonify({
            "error": "ingredients must be a list"
        }), 400

    if not all(
        isinstance(item, str) and item.strip()
        for item in ingredients
    ):
        return jsonify({
            "error": "ingredients must contain non-empty text only"
        }), 400

    if (
        isinstance(top_n, bool)
        or not isinstance(top_n, int)
        or not 1 <= top_n <= 100
    ):
        return jsonify({
            "error": "top_n must be an integer between 1 and 100"
        }), 400

    try:
        ingredients = [item.strip() for item in ingredients]

        results = model.recommend(
            ingredients,
            top_n=top_n
        )

        return jsonify(results), 200

    except Exception:
        app.logger.exception("Recommendation error")

        return jsonify({
            "error": "Recommendation failed"
        }), 500


# ========================================
# 8. API รายการสูตรอาหารจาก SQLite
# ========================================

@app.route("/api/db/recipes", methods=["GET"])
def database_recipes():

    try:
        limit = request.args.get("limit", default=50, type=int)

        if limit is None or not 1 <= limit <= 325:
            return jsonify({
                "error": "limit must be between 1 and 325"
            }), 400

        conn = get_db_connection()

        rows = conn.execute("""
            SELECT
                recipe_id,
                en_name,
                th_name,
                course,
                province,
                region,
                cooking_time_minutes,
                prep_time_minutes,
                total_time_minutes
            FROM recipes
            ORDER BY recipe_id
            LIMIT ?
        """, (limit,)).fetchall()

        conn.close()

        return jsonify({
            "status": "success",
            "count": len(rows),
            "recipes": [dict(row) for row in rows]
        }), 200

    except Exception:
        app.logger.exception("Database recipes error")

        return jsonify({
            "error": "Unable to load recipes from database"
        }), 500


# ========================================
# 9. API รายการวัตถุดิบจาก SQLite
# ========================================

@app.route("/api/db/ingredients", methods=["GET"])
def database_ingredients():

    try:
        conn = get_db_connection()

        rows = conn.execute("""
            SELECT
                ingredient_id,
                ingredient_en,
                ingredient_th
            FROM ingredients
            ORDER BY ingredient_th
        """).fetchall()

        conn.close()

        return jsonify({
            "status": "success",
            "count": len(rows),
            "ingredients": [dict(row) for row in rows]
        }), 200

    except Exception:
        app.logger.exception("Database ingredients error")

        return jsonify({
            "error": "Unable to load ingredients from database"
        }), 500


# ========================================
# 10. API รายละเอียดสูตรอาหารจาก SQLite
# ========================================

@app.route("/api/db/recipe/<recipe_id>", methods=["GET"])
def database_recipe_detail(recipe_id):

    try:
        conn = get_db_connection()

        recipe = conn.execute("""
            SELECT *
            FROM recipes
            WHERE recipe_id = ?
        """, (recipe_id,)).fetchone()

        if recipe is None:
            conn.close()

            return jsonify({
                "error": "Recipe not found",
                "id": recipe_id
            }), 404

        ingredients = conn.execute("""
            SELECT
                i.ingredient_id,
                i.ingredient_en,
                i.ingredient_th,
                ri.ingredient_type
            FROM recipe_ingredients ri
            JOIN ingredients i
                ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id = ?
            ORDER BY i.ingredient_th
        """, (recipe_id,)).fetchall()

        conn.close()

        result = dict(recipe)

        # แปลง instructions จาก JSON text เป็นข้อมูล JSON
        try:
            result["instructions"] = json.loads(
                result["instructions"]
            )
        except (TypeError, ValueError):
            pass

        result["ingredients"] = [
            dict(item) for item in ingredients
        ]

        return jsonify({
            "status": "success",
            "recipe": result
        }), 200

    except Exception:
        app.logger.exception("Database recipe detail error")

        return jsonify({
            "error": "Unable to load recipe details"
        }), 500


# ========================================
# 11. API รายละเอียดสูตรอาหารจาก AI Model (เดิม)
# ========================================

@app.route("/api/recipe/<recipe_id>", methods=["GET"])
def recipe_detail(recipe_id):

    try:
        result = model.get_recipe(recipe_id)

        if result is None:
            return jsonify({
                "error": "Recipe not found",
                "id": recipe_id
            }), 404

        return jsonify(result), 200

    except Exception:
        app.logger.exception("Recipe detail error")

        return jsonify({
            "error": "Unable to load recipe"
        }), 500


# ========================================
# 12. จัดการกรณีไม่พบ URL
# ========================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Endpoint not found"
    }), 404


# ========================================
# 13. เริ่มต้น Flask Server
# ========================================

if __name__ == "__main__":

    import os

    print("Starting Smart Fridge Backend...")
    print(f"SQLite Database: {DATABASE_PATH}")

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001)),
        debug=False
    )
