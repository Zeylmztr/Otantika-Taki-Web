import json
import os
import re
import uuid
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session


def resolve_base_dir():
    env_base = os.environ.get("OTANTIKA_BASE_DIR")
    if env_base:
        return Path(env_base)
    return Path(__file__).resolve().parent.parent


BASE_DIR = resolve_base_dir()
DATA_DIR = BASE_DIR / "data"
PRODUCT_IMG_DIR = BASE_DIR / "img" / "product"
BLOG_IMG_DIR = BASE_DIR / "img" / "blog"
CATEGORY_IMG_DIR = BASE_DIR / "img" / "categories"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.secret_key = os.environ.get("OTANTIKA_SECRET", "otantika-dev-secret-degistirin")

COLLECTION_LIMIT = 8
MAX_PRODUCT_COLORS = 5

PRODUCT_COLORS = {
    "black": "Siyah",
    "white": "Beyaz",
    "red": "Kırmızı",
    "grey": "Gri",
    "blue": "Mavi",
    "beige": "Bej Tonları",
    "green": "Yeşil",
    "yellow": "Sarı",
    "purple": "Mor",
    "turquoise": "Turkuaz",
    "pink": "Pembe",
    "orange": "Turuncu",
    "brown": "Kahverengi",
    "gold": "Altın",
    "silver": "Gümüş",
    "multicolor": "Çok Renkli",
}

LEGACY_CATEGORY_IDS = {
    "women": "kolyeler",
    "men": "bileklikler",
    "kid": "kupeler",
    "accessories": "gozluk-ipleri",
    "cosmetic": "aksesuarlar",
}


def normalize_category_id(category_id):
    if not category_id:
        return category_id
    return LEGACY_CATEGORY_IDS.get(category_id, category_id)


def normalize_colors(colors):
    if not isinstance(colors, list):
        return []
    valid = [c for c in colors if c in PRODUCT_COLORS]
    return valid[:MAX_PRODUCT_COLORS]


def normalize_product_images(data, existing=None, is_update=False):
    existing = existing or {}
    explicit_images = "images" in data
    explicit_image = "image" in data

    if explicit_images:
        images = data.get("images")
        if not isinstance(images, list):
            images = []
        images = [img.strip() for img in images if isinstance(img, str) and img.strip()]
    elif existing.get("images"):
        images = list(existing["images"])
    elif data.get("image") or existing.get("image"):
        images = [data.get("image") or existing.get("image")]
    else:
        images = []

    if explicit_image:
        raw_primary = (data.get("image") or "").strip()
        if raw_primary:
            primary = raw_primary
            if primary not in images:
                images = [primary] + [img for img in images if img != primary]
        elif images:
            primary = images[0]
        elif is_update:
            primary = ""
        else:
            primary = existing.get("image") or ""
    elif images:
        primary = images[0]
    else:
        primary = (data.get("image") or existing.get("image") or "").strip()

    return images, primary


def normalize_variants(data, existing=None, primary_image="", all_images=None):
    existing = existing or {}
    all_images = all_images or []
    if not all_images and primary_image:
        all_images = [primary_image]

    variants = data.get("variants")
    if variants is None:
        if existing.get("variants"):
            variants = list(existing["variants"])
        elif data.get("colors") or existing.get("colors"):
            color_list = data.get("colors") if "colors" in data else existing.get("colors", [])
            variants = [
                {
                    "color": color,
                    "image": primary_image or (all_images[0] if all_images else ""),
                }
                for color in color_list
                if color in PRODUCT_COLORS
            ]
        else:
            variants = []

    if not isinstance(variants, list):
        variants = []

    normalized = []
    seen = set()
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        color = variant.get("color")
        if not color or color not in PRODUCT_COLORS or color in seen:
            continue
        seen.add(color)
        image = (variant.get("image") or "").strip()
        if not image:
            image = primary_image or (all_images[0] if all_images else "")
        normalized.append({"color": color, "image": image})
        if len(normalized) >= MAX_PRODUCT_COLORS:
            break

    colors = [v["color"] for v in normalized]
    return normalized, colors


def resolve_product_colors_and_variants(data, existing=None, primary_image="", all_images=None):
    existing = existing or {}
    has_variants_key = "variants" in data

    if has_variants_key:
        raw_variants = data.get("variants") or []
    elif existing.get("variants"):
        raw_variants = list(existing["variants"])
    else:
        raw_variants = None

    if raw_variants is None:
        variants, colors = normalize_variants(data, existing, primary_image, all_images)
    else:
        variant_data = {"variants": raw_variants}
        variants, variant_colors = normalize_variants(
            variant_data, existing, primary_image, all_images
        )
        if variants:
            colors = variant_colors
        elif "colors" in data:
            colors = normalize_colors(data.get("colors"))
        else:
            colors = normalize_colors(existing.get("colors", []))

    if not colors:
        return None, None, "En az bir ürün rengi seçin"

    return variants, colors, None


def now_ts():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def ensure_created_at(products):
    changed = False
    for i, p in enumerate(products):
        if not p.get("createdAt"):
            days_ago = max(len(products) - i, 1)
            dt = datetime.now() - timedelta(days=days_ago)
            p["createdAt"] = dt.strftime("%Y-%m-%dT%H:%M:%S")
            changed = True
    return changed


def sort_products_newest(products):
    return sorted(products, key=lambda p: p.get("createdAt", ""), reverse=True)


def trim_collection(products):
    active = sorted(
        [p for p in products if p.get("active", True)],
        key=lambda p: p.get("createdAt", ""),
    )
    if len(active) <= COLLECTION_LIMIT:
        return products, []
    to_remove = active[: len(active) - COLLECTION_LIMIT]
    remove_ids = {p["id"] for p in to_remove}
    remaining = [p for p in products if p["id"] not in remove_ids]
    return remaining, [p.get("name", p["id"]) for p in to_remove]


def read_products():
    return read_json("products.json")


def read_categories():
    return read_json("categories.json")


def sort_categories(categories):
    return sorted(categories, key=lambda c: (c.get("order", 0), c.get("name", "")))


def category_exists(category_id):
    category_id = normalize_category_id(category_id)
    return any(c.get("id") == category_id for c in read_categories())


def default_category_id():
    categories = sort_categories(
        [c for c in read_categories() if c.get("active", True)]
    )
    return categories[0]["id"] if categories else ""


def products_in_category(category_id):
    return sum(1 for p in read_products() if p.get("category") == category_id)


def save_products(products):
    products, removed = trim_collection(products)
    write_json("products.json", products)
    return removed


def read_json(name):
    path = DATA_DIR / name
    if not path.exists():
        return [] if name != "admin.json" else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(name, data):
    path = DATA_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def slugify(text):
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosucgiosu")
    text = text.translate(tr_map).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or str(uuid.uuid4())[:8]


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"error": "Yetkisiz erişim"}), 401
        return f(*args, **kwargs)

    return decorated


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    admin = read_json("admin.json")
    if password and password == admin.get("password"):
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "Hatalı şifre"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("admin", None)
    return jsonify({"ok": True})


@app.route("/api/auth/check")
def auth_check():
    return jsonify({"authenticated": bool(session.get("admin"))})


@app.route("/api/colors")
def list_colors():
    return jsonify([{"id": k, "name": v} for k, v in PRODUCT_COLORS.items()])


@app.route("/api/categories")
def list_categories():
    categories = sort_categories(
        [c for c in read_categories() if c.get("active", True)]
    )
    return jsonify(categories)


@app.route("/api/products")
def list_products():
    products = sort_products_newest(
        [p for p in read_products() if p.get("active", True)]
    )
    for product in products:
        if product.get("category"):
            product["category"] = normalize_category_id(product["category"])
    limit = request.args.get("limit", type=int)
    if limit:
        products = products[:limit]
    return jsonify(products)


@app.route("/api/products/<product_id>")
def get_product(product_id):
    for product in read_json("products.json"):
        if product.get("id") == product_id and product.get("active", True):
            return jsonify(product)
    return jsonify({"error": "Ürün bulunamadı"}), 404


@app.route("/api/admin/products")
@admin_required
def admin_list_products():
    return jsonify(sort_products_newest(read_products()))


@app.route("/api/admin/products", methods=["POST"])
@admin_required
def create_product():
    data = request.get_json(silent=True) or {}
    category_id = data.get("category") or default_category_id()
    if not category_id or not category_exists(category_id):
        return jsonify({"error": "Geçersiz kategori"}), 400
    products = read_json("products.json")
    product_id = data.get("id") or slugify(data.get("name", ""))
    if any(p.get("id") == product_id for p in products):
        product_id = f"{product_id}-{uuid.uuid4().hex[:4]}"
    images, primary_image = normalize_product_images(data)
    variants, colors, color_error = resolve_product_colors_and_variants(
        data, None, primary_image, images
    )
    if color_error:
        return jsonify({"error": color_error}), 400
    product = {
        "id": product_id,
        "name": data.get("name", "").strip(),
        "price": float(data.get("price", 0)),
        "oldPrice": float(data["oldPrice"]) if data.get("oldPrice") else None,
        "category": data.get("category", default_category_id()),
        "image": primary_image,
        "images": images,
        "badge": data.get("badge") or None,
        "description": data.get("description", "").strip(),
        "active": bool(data.get("active", True)),
        "variants": variants,
        "colors": colors,
        "createdAt": now_ts(),
    }
    products.insert(0, product)
    removed = save_products(products)
    return jsonify({**product, "removedFromCollection": removed}), 201


@app.route("/api/admin/products/<product_id>", methods=["PUT"])
@admin_required
def update_product(product_id):
    data = request.get_json(silent=True) or {}
    if "category" in data and not category_exists(data.get("category")):
        return jsonify({"error": "Geçersiz kategori"}), 400
    products = read_json("products.json")
    for i, product in enumerate(products):
        if product.get("id") == product_id:
            images, primary_image = normalize_product_images(data, product, is_update=True)
            variants, colors, color_error = resolve_product_colors_and_variants(
                data, product, primary_image, images
            )
            if color_error:
                return jsonify({"error": color_error}), 400
            updated = {
                **product,
                "name": data.get("name", product["name"]).strip(),
                "price": float(data.get("price", product["price"])),
                "oldPrice": float(data["oldPrice"]) if data.get("oldPrice") else None,
                "category": data.get("category", product["category"]),
                "image": primary_image,
                "images": images,
                "badge": data.get("badge") or None,
                "description": data.get("description", product.get("description", "")).strip(),
                "active": bool(data.get("active", product.get("active", True))),
                "variants": variants,
                "colors": colors,
                "createdAt": product.get("createdAt") or now_ts(),
            }
            products[i] = updated
            removed = save_products(products)
            return jsonify({**updated, "removedFromCollection": removed})
    return jsonify({"error": "Ürün bulunamadı"}), 404


@app.route("/api/admin/products/<product_id>", methods=["DELETE"])
@admin_required
def delete_product(product_id):
    products = read_json("products.json")
    new_products = [p for p in products if p.get("id") != product_id]
    if len(new_products) == len(products):
        return jsonify({"error": "Ürün bulunamadı"}), 404
    write_json("products.json", new_products)
    return jsonify({"ok": True})


@app.route("/api/posts")
def list_posts():
    posts = [p for p in read_json("posts.json") if p.get("published", True)]
    posts.sort(key=lambda p: p.get("date", ""), reverse=True)
    limit = request.args.get("limit", type=int)
    if limit:
        posts = posts[:limit]
    return jsonify(posts)


@app.route("/api/posts/<post_id>")
def get_post(post_id):
    for post in read_json("posts.json"):
        if post.get("id") == post_id and post.get("published", True):
            return jsonify(post)
    return jsonify({"error": "Yazı bulunamadı"}), 404


@app.route("/api/admin/posts")
@admin_required
def admin_list_posts():
    posts = read_json("posts.json")
    posts.sort(key=lambda p: p.get("date", ""), reverse=True)
    return jsonify(posts)


@app.route("/api/admin/posts", methods=["POST"])
@admin_required
def create_post():
    data = request.get_json(silent=True) or {}
    posts = read_json("posts.json")
    post_id = data.get("id") or slugify(data.get("title", ""))
    if any(p.get("id") == post_id for p in posts):
        post_id = f"{post_id}-{uuid.uuid4().hex[:4]}"
    post = {
        "id": post_id,
        "title": data.get("title", "").strip(),
        "excerpt": data.get("excerpt", "").strip(),
        "content": data.get("content", "").strip(),
        "image": data.get("image", ""),
        "author": data.get("author", "Otantika Takı").strip(),
        "date": data.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "published": bool(data.get("published", True)),
        "large": bool(data.get("large", False)),
    }
    posts.append(post)
    write_json("posts.json", posts)
    return jsonify(post), 201


@app.route("/api/admin/posts/<post_id>", methods=["PUT"])
@admin_required
def update_post(post_id):
    data = request.get_json(silent=True) or {}
    posts = read_json("posts.json")
    for i, post in enumerate(posts):
        if post.get("id") == post_id:
            posts[i] = {
                **post,
                "title": data.get("title", post["title"]).strip(),
                "excerpt": data.get("excerpt", post.get("excerpt", "")).strip(),
                "content": data.get("content", post.get("content", "")).strip(),
                "image": data.get("image", post["image"]),
                "author": data.get("author", post.get("author", "Otantika Takı")).strip(),
                "date": data.get("date", post.get("date", "")),
                "published": bool(data.get("published", post.get("published", True))),
                "large": bool(data.get("large", post.get("large", False))),
            }
            write_json("posts.json", posts)
            return jsonify(posts[i])
    return jsonify({"error": "Yazı bulunamadı"}), 404


@app.route("/api/admin/posts/<post_id>", methods=["DELETE"])
@admin_required
def delete_post(post_id):
    posts = read_json("posts.json")
    new_posts = [p for p in posts if p.get("id") != post_id]
    if len(new_posts) == len(posts):
        return jsonify({"error": "Yazı bulunamadı"}), 404
    write_json("posts.json", new_posts)
    return jsonify({"ok": True})


@app.route("/api/admin/categories")
@admin_required
def admin_list_categories():
    return jsonify(sort_categories(read_categories()))


@app.route("/api/admin/categories", methods=["POST"])
@admin_required
def create_category():
    data = request.get_json(silent=True) or {}
    categories = read_categories()
    category_id = data.get("id") or slugify(data.get("name", ""))
    if any(c.get("id") == category_id for c in categories):
        category_id = f"{category_id}-{uuid.uuid4().hex[:4]}"
    category = {
        "id": category_id,
        "name": data.get("name", "").strip(),
        "image": data.get("image", "").strip(),
        "order": int(data.get("order", len(categories) + 1)),
        "active": bool(data.get("active", True)),
        "featured": bool(data.get("featured", False)),
    }
    if not category["name"]:
        return jsonify({"error": "Kategori adı gerekli"}), 400
    categories.append(category)
    write_json("categories.json", categories)
    return jsonify(category), 201


@app.route("/api/admin/categories/<category_id>", methods=["PUT"])
@admin_required
def update_category(category_id):
    data = request.get_json(silent=True) or {}
    categories = read_categories()
    for i, category in enumerate(categories):
        if category.get("id") == category_id:
            updated = {
                **category,
                "name": data.get("name", category["name"]).strip(),
                "image": data.get("image", category.get("image", "")).strip(),
                "order": int(data.get("order", category.get("order", 0))),
                "active": bool(data.get("active", category.get("active", True))),
                "featured": bool(data.get("featured", category.get("featured", False))),
            }
            if not updated["name"]:
                return jsonify({"error": "Kategori adı gerekli"}), 400
            categories[i] = updated
            write_json("categories.json", categories)
            return jsonify(updated)
    return jsonify({"error": "Kategori bulunamadı"}), 404


@app.route("/api/admin/categories/<category_id>", methods=["DELETE"])
@admin_required
def delete_category(category_id):
    count = products_in_category(category_id)
    if count:
        return jsonify({
            "error": f"Bu kategoride {count} ürün var. Önce ürünleri başka kategoriye taşıyın."
        }), 400
    categories = read_categories()
    new_categories = [c for c in categories if c.get("id") != category_id]
    if len(new_categories) == len(categories):
        return jsonify({"error": "Kategori bulunamadı"}), 404
    write_json("categories.json", new_categories)
    return jsonify({"ok": True})


@app.route("/api/admin/upload", methods=["POST"])
@admin_required
def upload_image():
    if "file" not in request.files:
        return jsonify({"error": "Dosya seçilmedi"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Dosya seçilmedi"}), 400

    upload_type = request.form.get("type", "product")
    if upload_type == "product":
        target_dir = PRODUCT_IMG_DIR
        rel_prefix = "img/product"
    elif upload_type == "category":
        target_dir = CATEGORY_IMG_DIR
        rel_prefix = "img/categories"
    else:
        target_dir = BLOG_IMG_DIR
        rel_prefix = "img/blog"
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return jsonify({"error": "Geçersiz dosya türü"}), 400

    filename = f"{uuid.uuid4().hex}{ext}"
    file.save(target_dir / filename)
    rel = f"{rel_prefix}/{filename}"
    return jsonify({"path": rel})


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin/")
@app.route("/admin")
def admin_panel():
    return send_from_directory(BASE_DIR / "admin", "index.html")


@app.route("/<path:path>")
def static_files(path):
    path = path.rstrip("/")
    full = BASE_DIR / path
    if full.is_file():
        return send_from_directory(BASE_DIR, path)
    if full.is_dir() and (full / "index.html").is_file():
        return send_from_directory(BASE_DIR, f"{path}/index.html")
    if (BASE_DIR / f"{path}.html").is_file():
        return send_from_directory(BASE_DIR, f"{path}.html")
    return send_from_directory(BASE_DIR, "index.html")


def bootstrap_data():
    DATA_DIR.mkdir(exist_ok=True)
    PRODUCT_IMG_DIR.mkdir(parents=True, exist_ok=True)
    BLOG_IMG_DIR.mkdir(parents=True, exist_ok=True)
    CATEGORY_IMG_DIR.mkdir(parents=True, exist_ok=True)

    products = read_products()
    changed = ensure_created_at(products)
    products, removed = trim_collection(products)
    migrated = False
    for product in products:
        if not product.get("images") and product.get("image"):
            product["images"] = [product["image"]]
            migrated = True
        if not product.get("variants") and product.get("colors"):
            primary = product.get("image", "")
            imgs = product.get("images") or ([primary] if primary else [])
            variants, colors = normalize_variants(
                {"colors": product["colors"]}, product, primary, imgs
            )
            product["variants"] = variants
            product["colors"] = colors
            migrated = True
    if changed or removed or migrated:
        write_json("products.json", products)


def run_server(host="0.0.0.0", port=None, debug=False):
    port = int(port or os.environ.get("PORT", 8080))
    bootstrap_data()
    print(f"Otantika Takı sunucusu: http://localhost:{port}")
    print(f"Admin panel: http://localhost:{port}/admin/")
    app.run(host=host, port=port, debug=debug, use_reloader=False)


if __name__ == "__main__":
    run_server(debug=True)
