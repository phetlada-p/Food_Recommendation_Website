
import json
import csv
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "datasets"

JSON_FILE = DATASET_DIR / "thailand_foods_ai_dataset.json"
MAPPING_FILE = DATASET_DIR / "ingredient_mapping_147.csv"
DB_FILE = BASE_DIR / "smart_fridge.db"


def to_list(value):
    """แปลงข้อมูลให้เป็น list"""
    if value is None or value == "":
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, str):
        return [x.strip() for x in value.split("|") if x.strip()]

    return []


def load_mapping():
    """อ่านตารางแปลชื่อวัตถุดิบ"""
    mapping = {}

    if not MAPPING_FILE.exists():
        return mapping

    with open(MAPPING_FILE, encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)

        for row in reader:
            english = (row.get("ingredient_en") or "").strip().lower()
            thai = (row.get("ingredient_th") or "").strip()

            if english and thai:
                mapping[english] = thai

    return mapping


def create_database():
    connection = sqlite3.connect(DB_FILE)
    connection.execute("PRAGMA foreign_keys = ON")

    cursor = connection.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS recipes (
        recipe_id TEXT PRIMARY KEY,
        en_name TEXT,
        th_name TEXT,
        ingredients_original TEXT,
        course TEXT,
        province TEXT,
        region TEXT,
        instructions TEXT,
        cooking_time_minutes INTEGER,
        prep_time_minutes INTEGER,
        total_time_minutes INTEGER,
        ingredient_data_status TEXT,
        verification_status TEXT,
        source_url TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        ingredient_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_en TEXT NOT NULL UNIQUE,
        ingredient_th TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipe_id TEXT NOT NULL,
        ingredient_id INTEGER NOT NULL,
        ingredient_type TEXT NOT NULL,
        PRIMARY KEY (recipe_id, ingredient_id, ingredient_type),
        FOREIGN KEY (recipe_id)
            REFERENCES recipes(recipe_id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id)
            REFERENCES ingredients(ingredient_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON recipe_ingredients(recipe_id);

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
    ON recipe_ingredients(ingredient_id);
    """)

    connection.commit()
    return connection


def import_data():
    if not JSON_FILE.exists():
        raise FileNotFoundError(f"ไม่พบไฟล์ {JSON_FILE}")

    with open(JSON_FILE, encoding="utf-8") as file:
        recipes = json.load(file)

    if not isinstance(recipes, list):
        raise ValueError("Dataset ต้องเป็น list")

    mapping = load_mapping()
    connection = create_database()
    cursor = connection.cursor()

    # ล้างข้อมูลเดิมก่อนนำเข้ารอบใหม่
    cursor.execute("DELETE FROM recipe_ingredients")
    cursor.execute("DELETE FROM recipes")
    cursor.execute("DELETE FROM ingredients")

    for recipe in recipes:
        recipe_id = recipe.get("recipe_id")

        if not recipe_id:
            continue

        instructions = recipe.get("instructions") or []

        cursor.execute("""
            INSERT INTO recipes (
                recipe_id, en_name, th_name, ingredients_original,
                course, province, region, instructions,
                cooking_time_minutes, prep_time_minutes,
                total_time_minutes, ingredient_data_status,
                verification_status, source_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            recipe_id,
            recipe.get("en_name"),
            recipe.get("th_name"),
            recipe.get("ingredients_original"),
            recipe.get("course"),
            recipe.get("province"),
            recipe.get("region"),
            json.dumps(instructions, ensure_ascii=False),
            recipe.get("cooking_time_minutes"),
            recipe.get("prep_time_minutes"),
            recipe.get("total_time_minutes"),
            recipe.get("ingredient_data_status"),
            recipe.get("verification_status"),
            recipe.get("source_url")
        ))

        english_list = to_list(recipe.get("ingredients_en"))
        thai_list = to_list(recipe.get("ingredients_th_translation_draft"))

        required = to_list(recipe.get("required_ingredients"))
        optional = to_list(recipe.get("optional_ingredients"))

        # เก็บชื่อวัตถุดิบพร้อมคำแปล
        ingredient_roles = {}

        for index, english in enumerate(english_list):
            english = str(english).strip()
            if not english:
                continue

            thai = ""
            if index < len(thai_list):
                thai = str(thai_list[index]).strip()

            if not thai:
                thai = mapping.get(english.lower(), "")

            ingredient_roles.setdefault(english, set()).add("source_list")

            cursor.execute("""
                INSERT INTO ingredients (ingredient_en, ingredient_th)
                VALUES (?, ?)
                ON CONFLICT(ingredient_en)
                DO UPDATE SET
                    ingredient_th = CASE
                        WHEN ingredients.ingredient_th IS NULL
                             OR ingredients.ingredient_th = ''
                        THEN excluded.ingredient_th
                        ELSE ingredients.ingredient_th
                    END
            """, (english, thai or english))

        for ingredient in required:
            ingredient = str(ingredient).strip()
            if ingredient:
                ingredient_roles.setdefault(ingredient, set()).add("required")

        for ingredient in optional:
            ingredient = str(ingredient).strip()
            if ingredient:
                ingredient_roles.setdefault(ingredient, set()).add("optional")

        # เชื่อมเมนูกับวัตถุดิบ
        for english, roles in ingredient_roles.items():
            thai = mapping.get(english.lower(), "")

            cursor.execute("""
                INSERT INTO ingredients (ingredient_en, ingredient_th)
                VALUES (?, ?)
                ON CONFLICT(ingredient_en) DO NOTHING
            """, (english, thai or english))

            cursor.execute("""
                SELECT ingredient_id
                FROM ingredients
                WHERE ingredient_en = ?
            """, (english,))

            ingredient_id = cursor.fetchone()[0]

            for role in roles:
                cursor.execute("""
                    INSERT OR IGNORE INTO recipe_ingredients
                    (recipe_id, ingredient_id, ingredient_type)
                    VALUES (?, ?, ?)
                """, (recipe_id, ingredient_id, role))

    connection.commit()

    recipe_count = cursor.execute(
        "SELECT COUNT(*) FROM recipes"
    ).fetchone()[0]

    ingredient_count = cursor.execute(
        "SELECT COUNT(*) FROM ingredients"
    ).fetchone()[0]

    relation_count = cursor.execute(
        "SELECT COUNT(*) FROM recipe_ingredients"
    ).fetchone()[0]

    connection.close()

    print("\nนำเข้าข้อมูลสำเร็จ!")
    print(f"สูตรอาหาร: {recipe_count}")
    print(f"วัตถุดิบ: {ingredient_count}")
    print(f"ความสัมพันธ์เมนู-วัตถุดิบ: {relation_count}")
    print(f"ไฟล์ฐานข้อมูล: {DB_FILE}")


if __name__ == "__main__":
    import_data()
