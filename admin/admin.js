(function () {
    'use strict';

    var state = {
        tab: 'products',
        products: [],
        posts: [],
        categories: [],
        editingId: null,
        productImages: [],
        productVariants: [],
        pendingProductColors: [],
        initialProductImage: '',
        initialProductImages: [],
        pendingUploads: 0
    };

    var PRODUCT_COLORS = [];
    var MAX_PRODUCT_COLORS = 5;

    function $(id) { return document.getElementById(id); }

    function api(url, options) {
        options = options || {};
        options.credentials = 'same-origin';
        options.headers = options.headers || {};
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        return fetch(url, options).then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
                return data;
            });
        });
    }

    function showLogin() {
        $('login-screen').classList.remove('hidden');
        $('admin-app').classList.add('hidden');
    }

    function showAdmin() {
        $('login-screen').classList.add('hidden');
        $('admin-app').classList.remove('hidden');
        loadCurrentTab();
    }

    function checkAuth() {
        return api('/api/auth/check').then(function (data) {
            if (data.authenticated) showAdmin();
            else showLogin();
        }).catch(showLogin);
    }

    function categoryName(id) {
        var found = state.categories.find(function (c) { return c.id === id; });
        return found ? found.name : id;
    }

    function renderCategorySelect(selected) {
        var select = $('product-category');
        if (!select) return;
        var active = state.categories.filter(function (c) { return c.active !== false; });
        if (!active.length) {
            select.innerHTML = '<option value="">Kategori yok</option>';
            return;
        }
        select.innerHTML = active.map(function (c) {
            return '<option value="' + c.id + '">' + c.name + '</option>';
        }).join('');
        if (selected && active.some(function (c) { return c.id === selected; })) {
            select.value = selected;
        } else {
            select.value = active[0].id;
        }
    }

    function switchTab(tab) {
        state.tab = tab;
        document.querySelectorAll('.nav-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        $('products-panel').classList.toggle('hidden', tab !== 'products');
        $('categories-panel').classList.toggle('hidden', tab !== 'categories');
        $('posts-panel').classList.toggle('hidden', tab !== 'posts');

        var titles = { products: 'Ürünler', categories: 'Kategoriler', posts: 'Blog Yazıları' };
        var addLabels = { products: '+ Yeni Ürün', categories: '+ Yeni Kategori', posts: '+ Yeni Yazı' };
        $('panel-title').textContent = titles[tab] || 'Yönetim';
        $('add-new-btn').textContent = addLabels[tab] || '+ Yeni Ekle';
        loadCurrentTab();
    }

    function loadCurrentTab() {
        if (state.tab === 'products') loadProducts();
        else if (state.tab === 'categories') loadCategories();
        else loadPosts();
    }

    function colorName(id) {
        var found = PRODUCT_COLORS.find(function (c) { return c.id === id; });
        return found ? found.name : id;
    }

    function loadColors() {
        if (PRODUCT_COLORS.length) return Promise.resolve(PRODUCT_COLORS);
        return api('/api/colors').then(function (colors) {
            PRODUCT_COLORS = colors;
            return colors;
        });
    }

    function renderAdminColorPicker(selected) {
        var container = $('product-colors');
        if (!container) return;

        selected = selected || [];
        container.innerHTML = PRODUCT_COLORS.map(function (color) {
            var checked = selected.indexOf(color.id) !== -1 ? ' checked' : '';
            return '<label class="admin-color-option">' +
                '<input type="checkbox" value="' + color.id + '"' + checked + '>' +
                '<span class="color-swatch color-swatch--' + color.id + '"></span>' +
                '<span>' + color.name + '</span></label>';
        }).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
            input.addEventListener('change', function () {
                var checked = container.querySelectorAll('input[type="checkbox"]:checked');
                if (checked.length > MAX_PRODUCT_COLORS) {
                    input.checked = false;
                    alert('En fazla ' + MAX_PRODUCT_COLORS + ' renk seçebilirsiniz.');
                }
            });
        });
    }

    function getSelectedProductColors() {
        var selected = [];
        document.querySelectorAll('#product-colors input[type="checkbox"]:checked').forEach(function (cb) {
            selected.push(cb.value);
        });
        return selected;
    }

    function setProductColors(selected) {
        loadColors().then(function () {
            renderAdminColorPicker(selected || []);
        });
    }

    function variantColorName(colorId) {
        var found = PRODUCT_COLORS.find(function (c) { return c.id === colorId; });
        return found ? found.name : colorId;
    }

    function uploadVariantImage(index, file) {
        if (!file) return Promise.resolve();
        return uploadFile(file, 'product').then(function (path) {
            state.productVariants[index].image = path;
            renderProductVariantsList();
        }).catch(function (err) { alert(err.message); });
    }

    function triggerVariantImagePicker(index) {
        var list = $('product-variants-list');
        if (!list) return;
        var row = list.querySelector('[data-variant-index="' + index + '"]');
        if (!row) return;
        var fileInput = row.querySelector('.variant-image-file');
        if (fileInput) fileInput.click();
    }

    function renderProductVariantsList() {
        var list = $('product-variants-list');
        if (!list) return;

        if (!state.productVariants.length) {
            list.innerHTML = '<p class="admin-images-empty">Henüz varyant yok. "Varyant Ekle" ile her renk için ayrı görsel yükleyebilirsiniz.</p>';
            return;
        }

        list.innerHTML = state.productVariants.map(function (variant, index) {
            var colorOptions = PRODUCT_COLORS.map(function (color) {
                var selected = variant.color === color.id ? ' selected' : '';
                return '<option value="' + color.id + '"' + selected + '>' + color.name + '</option>';
            }).join('');

            var colorLabel = variantColorName(variant.color);
            var previewHtml = variant.image
                ? '<img src="../' + variant.image + '" alt="' + colorLabel + '" class="variant-preview">'
                : '<span class="variant-upload-icon">+</span>';

            var uploadText = variant.image ? 'Görseli değiştir' : 'Bu renk için ürün görseli seç';

            return '<div class="admin-variant-row" data-variant-index="' + index + '">' +
                '<div class="variant-row-top">' +
                '<label class="variant-color-label">Renk<select class="variant-color-select">' + colorOptions + '</select></label>' +
                '<button type="button" class="btn btn-danger btn-sm variant-remove">Kaldır</button>' +
                '</div>' +
                '<label class="variant-upload-zone">' +
                '<input type="file" accept="image/*" class="variant-image-file">' +
                '<div class="variant-upload-content">' + previewHtml +
                '<div><span class="variant-upload-text">' + uploadText + '</span>' +
                '<span class="variant-upload-hint">' + colorLabel + '</span></div>' +
                '</div></label>' +
                (variant.image ? '<button type="button" class="variant-clear-image">Görseli kaldır</button>' : '') +
                '</div>';
        }).join('');
    }

    function setProductVariants(variants) {
        state.productVariants = (variants || []).map(function (v) {
            return { color: v.color, image: v.image || '' };
        });
        renderProductVariantsList();
    }

    function addProductVariant() {
        loadColors().then(function () {
            if (state.productVariants.length >= MAX_PRODUCT_COLORS) {
                alert('En fazla ' + MAX_PRODUCT_COLORS + ' varyant ekleyebilirsiniz.');
                return;
            }
            var used = state.productVariants.map(function (v) { return v.color; });
            var nextColor = PRODUCT_COLORS.find(function (c) { return used.indexOf(c.id) === -1; });
            if (!nextColor) {
                alert('Tüm renkler zaten eklendi.');
                return;
            }
            state.productVariants.push({ color: nextColor.id, image: '' });
            var newIndex = state.productVariants.length - 1;
            renderProductVariantsList();
            setTimeout(function () { triggerVariantImagePicker(newIndex); }, 50);
        });
    }

    function removeProductVariant(index) {
        state.productVariants.splice(index, 1);
        renderProductVariantsList();
    }

    function getProductVariantsPayload() {
        return state.productVariants.map(function (v) {
            return { color: v.color, image: v.image || '' };
        });
    }

    function formatPrice(price) {
        return '₺' + Number(price).toLocaleString('tr-TR');
    }

    function renderProducts() {
        var list = $('products-list');
        if (!state.products.length) {
            list.innerHTML = '<p>Henüz ürün yok. Yeni ürün ekleyin.</p>';
            return;
        }
        list.innerHTML = state.products.map(function (p) {
            var colorText = (p.colors && p.colors.length)
                ? ' · ' + p.colors.map(colorName).join(', ')
                : '';
            return '<article class="item-card">' +
                '<img src="../' + p.image + '" alt="">' +
                '<div><h4>' + p.name + '</h4><p>' + categoryName(p.category) +
                ' · ' + formatPrice(p.price) + colorText +
                (p.active ? '' : ' · <strong>Taslak</strong>') + '</p></div>' +
                '<div class="item-actions">' +
                '<button class="btn btn-secondary" data-edit-product="' + p.id + '">Düzenle</button>' +
                '<button class="btn btn-danger" data-delete-product="' + p.id + '">Sil</button>' +
                '</div></article>';
        }).join('');
    }

    function renderPosts() {
        var list = $('posts-list');
        if (!state.posts.length) {
            list.innerHTML = '<p>Henüz blog yazısı yok.</p>';
            return;
        }
        list.innerHTML = state.posts.map(function (p) {
            return '<article class="item-card">' +
                '<img src="../' + p.image + '" alt="">' +
                '<div><h4>' + p.title + '</h4><p>' + p.date +
                (p.published ? '' : ' · <strong>Taslak</strong>') + '</p></div>' +
                '<div class="item-actions">' +
                '<button class="btn btn-secondary" data-edit-post="' + p.id + '">Düzenle</button>' +
                '<button class="btn btn-danger" data-delete-post="' + p.id + '">Sil</button>' +
                '</div></article>';
        }).join('');
    }

    function renderCategories() {
        var list = $('categories-list');
        if (!state.categories.length) {
            list.innerHTML = '<p>Henüz kategori yok. Yeni kategori ekleyin.</p>';
            return;
        }
        list.innerHTML = state.categories.map(function (c) {
            var flags = [];
            if (c.featured) flags.push('Ana sayfa');
            if (c.active === false) flags.push('Taslak');
            var meta = 'Sıra: ' + (c.order || 0);
            if (flags.length) meta += ' · ' + flags.join(', ');
            return '<article class="item-card">' +
                (c.image ? '<img src="../' + c.image + '" alt="">' : '<div class="item-card__placeholder"></div>') +
                '<div><h4>' + c.name + '</h4><p>' + meta + '</p></div>' +
                '<div class="item-actions">' +
                '<button class="btn btn-secondary" data-edit-category="' + c.id + '">Düzenle</button>' +
                '<button class="btn btn-danger" data-delete-category="' + c.id + '">Sil</button>' +
                '</div></article>';
        }).join('');
    }

    function loadCategories() {
        return api('/api/admin/categories').then(function (categories) {
            state.categories = categories;
            renderCategories();
            renderCategorySelect();
            return categories;
        });
    }

    function loadProducts() {
        return Promise.all([
            state.categories.length ? Promise.resolve(state.categories) : loadCategories(),
            api('/api/admin/products')
        ]).then(function (results) {
            state.products = results[1];
            renderProducts();
        });
    }

    function loadPosts() {
        return api('/api/admin/posts').then(function (posts) {
            state.posts = posts;
            renderPosts();
        });
    }

    function setProductImages(images) {
        state.productImages = Array.isArray(images) ? images.slice() : [];
        renderProductImagesList();
    }

    function renderProductImagesList() {
        var list = $('product-images-list');
        if (!list) return;
        if (!state.productImages.length) {
            list.innerHTML = '<p class="admin-images-empty">Henüz görsel eklenmedi.</p>';
            return;
        }
        list.innerHTML = state.productImages.map(function (path, index) {
            return '<div class="admin-image-item">' +
                '<img src="../' + path + '" alt="">' +
                '<button type="button" class="admin-image-remove" data-remove-image="' + index + '" title="Kaldır">&times;</button>' +
                '</div>';
        }).join('');
    }

    function removeProductImage(index) {
        state.productImages.splice(index, 1);
        renderProductImagesList();
    }

    function syncFormValidation(mode) {
        var productName = $('product-name');
        var productPrice = $('product-price');
        var categoryName = $('category-name');
        if (productName) productName.required = mode === 'product';
        if (productPrice) productPrice.required = mode === 'product';
        if (categoryName) categoryName.required = mode === 'category';
    }

    function syncProductEditState(item) {
        if (item && item.variants && item.variants.length) {
            state.productVariants = item.variants.map(function (v) {
                return { color: v.color, image: v.image || '' };
            });
            state.pendingProductColors = item.variants.map(function (v) { return v.color; });
        } else {
            state.productVariants = [];
            state.pendingProductColors = item && item.colors ? item.colors.slice() : [];
        }
        state.initialProductImage = item ? (item.image || '') : '';
        state.initialProductImages = item && item.images && item.images.length
            ? item.images.slice()
            : (item && item.image ? [item.image] : []);
    }

    function populateProductForm(item) {
        renderProductVariantsList();
        var selectedColors = state.pendingProductColors.slice();
        if (!selectedColors.length && item && item.colors) {
            selectedColors = item.colors.slice();
        }
        renderAdminColorPicker(selectedColors);
    }

    function updateSaveButton() {
        var btn = document.querySelector('#entity-form button[type="submit"]');
        if (!btn) return;
        btn.disabled = state.pendingUploads > 0;
        btn.textContent = state.pendingUploads > 0 ? 'Görseller yükleniyor...' : 'Kaydet';
    }

    function finalizeVariantsForSave(variants) {
        var newPrimary = state.productImages[0] || '';
        return variants.map(function (v) {
            var img = (v.image || '').trim();
            if (!img) {
                img = newPrimary;
            } else if (
                newPrimary &&
                img === state.initialProductImage &&
                newPrimary !== state.initialProductImage
            ) {
                img = newPrimary;
            }
            return { color: v.color, image: img };
        });
    }

    function openModal(mode, item) {
        state.editingId = item ? item.id : null;
        $('entity-mode').value = mode;
        $('modal').classList.remove('hidden');

        document.querySelector('.product-fields').classList.toggle('hidden', mode !== 'product');
        document.querySelector('.category-fields').classList.toggle('hidden', mode !== 'category');
        document.querySelector('.post-fields').classList.toggle('hidden', mode !== 'post');
        syncFormValidation(mode);

        var modeLabels = { product: 'Ürün', category: 'Kategori', post: 'Blog Yazısı' };
        $('modal-title').textContent = (item ? 'Düzenle: ' : 'Yeni ') + (modeLabels[mode] || '');

        if (mode === 'product') {
            renderCategorySelect(item ? item.category : null);
            $('product-name').value = item ? item.name : '';
            $('product-price').value = item ? item.price : '';
            $('product-old-price').value = item && item.oldPrice ? item.oldPrice : '';
            if (item && item.category) $('product-category').value = item.category;
            $('product-badge').value = item && item.badge ? item.badge : '';
            $('product-description').value = item ? item.description || '' : '';
            $('product-active').checked = item ? item.active !== false : true;
            var images = item && item.images && item.images.length
                ? item.images
                : (item && item.image ? [item.image] : []);
            setProductImages(images);
            syncProductEditState(item);
            loadColors().then(function () {
                populateProductForm(item);
            });
        } else if (mode === 'category') {
            $('category-name').value = item ? item.name : '';
            $('category-order').value = item ? (item.order || 1) : (state.categories.length + 1);
            $('category-active').checked = item ? item.active !== false : true;
            $('category-featured').checked = item ? !!item.featured : false;
            $('category-image').value = item ? item.image || '' : '';
            previewImage('category-image-preview', item ? item.image : null);
        } else {
            $('post-title-input').value = item ? item.title : '';
            $('post-excerpt').value = item ? item.excerpt || '' : '';
            $('post-content').value = item ? item.content || '' : '';
            $('post-author').value = item ? item.author : 'Otantika Takı';
            $('post-date').value = item ? item.date : new Date().toISOString().slice(0, 10);
            $('post-published').checked = item ? item.published !== false : true;
            $('post-large').checked = item ? !!item.large : false;
            $('post-image').value = item ? item.image : '';
            previewImage('post-image-preview', item ? item.image : null);
        }
    }

    function closeModal() {
        $('modal').classList.add('hidden');
        $('entity-form').reset();
        state.editingId = null;
        state.pendingProductColors = [];
        state.initialProductImage = '';
        state.initialProductImages = [];
        state.pendingUploads = 0;
        updateSaveButton();
        setProductImages([]);
        setProductVariants([]);
        setProductColors([]);
        var imagesFile = $('product-images-file');
        if (imagesFile) imagesFile.value = '';
    }

    function previewImage(elId, path) {
        var img = $(elId);
        if (path) {
            img.src = '../' + path;
            img.classList.remove('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
        }
    }

    function uploadFile(file, type) {
        state.pendingUploads += 1;
        updateSaveButton();
        var fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);
        return fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                return data.path;
            })
            .finally(function () {
                state.pendingUploads = Math.max(0, state.pendingUploads - 1);
                updateSaveButton();
            });
    }

    function saveProduct(e) {
        e.preventDefault();

        if (state.pendingUploads > 0) {
            alert('Görsel yükleme devam ediyor. Lütfen bitmesini bekleyin.');
            return;
        }

        var name = $('product-name').value.trim();
        var price = $('product-price').value;
        var category = $('product-category').value;
        var variants = finalizeVariantsForSave(getProductVariantsPayload());
        var colors = variants.length
            ? variants.map(function (v) { return v.color; })
            : getSelectedProductColors();

        if (!colors.length && state.pendingProductColors.length) {
            colors = state.pendingProductColors.slice();
        }

        if (!name) {
            alert('Ürün adı gerekli.');
            return;
        }
        if (!price && price !== 0) {
            alert('Fiyat gerekli.');
            return;
        }
        if (!category) {
            alert('Kategori seçin.');
            return;
        }
        if (!colors.length) {
            alert('En az bir ürün rengi seçin. Mağazada renk filtresi buna göre çalışır.');
            return;
        }

        var payload = {
            name: name,
            price: price,
            oldPrice: $('product-old-price').value || null,
            category: category,
            badge: $('product-badge').value || null,
            description: $('product-description').value.trim(),
            active: $('product-active').checked,
            images: state.productImages.slice(),
            image: state.productImages[0] || (variants[0] && variants[0].image) || '',
            variants: variants,
            colors: colors
        };

        var req = state.editingId
            ? api('/api/admin/products/' + state.editingId, { method: 'PUT', body: payload })
            : api('/api/admin/products', { method: 'POST', body: payload });

        req.then(function (data) {
            closeModal();
            loadProducts();
            if (data.removedFromCollection && data.removedFromCollection.length) {
                alert('Koleksiyon limiti (8) aşıldı. Silinen: ' + data.removedFromCollection.join(', '));
            }
        }).catch(function (err) { alert(err.message); });
    }

    function saveCategory(e) {
        e.preventDefault();
        var name = $('category-name').value.trim();
        if (!name) {
            alert('Kategori adı gerekli.');
            return;
        }
        var payload = {
            name: name,
            order: $('category-order').value || 1,
            active: $('category-active').checked,
            featured: $('category-featured').checked,
            image: $('category-image').value
        };

        var req = state.editingId
            ? api('/api/admin/categories/' + state.editingId, { method: 'PUT', body: payload })
            : api('/api/admin/categories', { method: 'POST', body: payload });

        req.then(function () {
            closeModal();
            loadCategories();
        }).catch(function (err) { alert(err.message); });
    }

    function savePost(e) {
        e.preventDefault();
        var payload = {
            title: $('post-title-input').value.trim(),
            excerpt: $('post-excerpt').value.trim(),
            content: $('post-content').value.trim(),
            author: $('post-author').value.trim(),
            date: $('post-date').value,
            published: $('post-published').checked,
            large: $('post-large').checked,
            image: $('post-image').value
        };

        var req = state.editingId
            ? api('/api/admin/posts/' + state.editingId, { method: 'PUT', body: payload })
            : api('/api/admin/posts', { method: 'POST', body: payload });

        req.then(function () {
            closeModal();
            loadPosts();
        }).catch(function (err) { alert(err.message); });
    }

    function bindEvents() {
        $('login-form').addEventListener('submit', function (e) {
            e.preventDefault();
            api('/api/auth/login', {
                method: 'POST',
                body: { password: $('login-password').value }
            }).then(showAdmin).catch(function (err) {
                $('login-error').textContent = err.message;
            });
        });

        $('logout-btn').addEventListener('click', function () {
            api('/api/auth/logout', { method: 'POST' }).finally(showLogin);
        });

        document.querySelectorAll('.nav-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
        });

        $('add-new-btn').addEventListener('click', function () {
            if (state.tab === 'products') openModal('product', null);
            else if (state.tab === 'categories') openModal('category', null);
            else openModal('post', null);
        });

        document.querySelectorAll('[data-close="true"]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });

        $('entity-form').addEventListener('submit', function (e) {
            var mode = $('entity-mode').value;
            if (mode === 'product') saveProduct(e);
            else if (mode === 'category') saveCategory(e);
            else savePost(e);
        });

        $('categories-list').addEventListener('click', function (e) {
            var editId = e.target.getAttribute('data-edit-category');
            var deleteId = e.target.getAttribute('data-delete-category');
            if (editId) {
                var item = state.categories.find(function (c) { return c.id === editId; });
                if (item) openModal('category', item);
            }
            if (deleteId && confirm('Bu kategori silinsin mi?')) {
                api('/api/admin/categories/' + deleteId, { method: 'DELETE' })
                    .then(loadCategories)
                    .catch(function (err) { alert(err.message); });
            }
        });

        $('products-list').addEventListener('click', function (e) {
            var editId = e.target.getAttribute('data-edit-product');
            var deleteId = e.target.getAttribute('data-delete-product');
            if (editId) {
                var item = state.products.find(function (p) { return p.id === editId; });
                if (item) openModal('product', item);
            }
            if (deleteId && confirm('Bu ürün silinsin mi?')) {
                api('/api/admin/products/' + deleteId, { method: 'DELETE' }).then(loadProducts);
            }
        });

        $('posts-list').addEventListener('click', function (e) {
            var editId = e.target.getAttribute('data-edit-post');
            var deleteId = e.target.getAttribute('data-delete-post');
            if (editId) {
                var item = state.posts.find(function (p) { return p.id === editId; });
                if (item) openModal('post', item);
            }
            if (deleteId && confirm('Bu yazı silinsin mi?')) {
                api('/api/admin/posts/' + deleteId, { method: 'DELETE' }).then(loadPosts);
            }
        });

        $('add-variant-btn').addEventListener('click', addProductVariant);

        $('product-variants-list').addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.variant-remove');
            if (removeBtn) {
                var row = removeBtn.closest('[data-variant-index]');
                if (row) removeProductVariant(parseInt(row.getAttribute('data-variant-index'), 10));
                return;
            }
            var clearBtn = e.target.closest('.variant-clear-image');
            if (clearBtn) {
                var clearRow = clearBtn.closest('[data-variant-index]');
                if (clearRow) {
                    var idx = parseInt(clearRow.getAttribute('data-variant-index'), 10);
                    state.productVariants[idx].image = '';
                    renderProductVariantsList();
                }
            }
        });

        $('product-variants-list').addEventListener('change', function (e) {
            var select = e.target.closest('.variant-color-select');
            if (select) {
                var row = select.closest('[data-variant-index]');
                if (!row) return;
                var index = parseInt(row.getAttribute('data-variant-index'), 10);
                var newColor = select.value;
                var duplicate = state.productVariants.some(function (v, i) {
                    return i !== index && v.color === newColor;
                });
                if (duplicate) {
                    alert('Bu renk zaten ekli.');
                    renderProductVariantsList();
                    return;
                }
                state.productVariants[index].color = newColor;
            }

            var fileInput = e.target.closest('.variant-image-file');
            if (fileInput && fileInput.files[0]) {
                var fileRow = fileInput.closest('[data-variant-index]');
                if (!fileRow) return;
                var fileIndex = parseInt(fileRow.getAttribute('data-variant-index'), 10);
                uploadVariantImage(fileIndex, fileInput.files[0]).then(function () {
                    fileInput.value = '';
                });
            }
        });

        $('product-images-file').addEventListener('change', function (e) {
            var files = Array.prototype.slice.call(e.target.files || []);
            if (!files.length) return;
            var uploads = files.map(function (file) {
                return uploadFile(file, 'product');
            });
            Promise.all(uploads).then(function (paths) {
                setProductImages(state.productImages.concat(paths));
                e.target.value = '';
            }).catch(function (err) { alert(err.message); });
        });

        $('product-images-list').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-remove-image]');
            if (!btn) return;
            removeProductImage(parseInt(btn.getAttribute('data-remove-image'), 10));
        });

        $('category-image-file').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            uploadFile(file, 'category').then(function (path) {
                $('category-image').value = path;
                previewImage('category-image-preview', path);
            }).catch(function (err) { alert(err.message); });
        });

        $('post-image-file').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            uploadFile(file, 'blog').then(function (path) {
                $('post-image').value = path;
                previewImage('post-image-preview', path);
            }).catch(function (err) { alert(err.message); });
        });
    }

    bindEvents();
    loadColors();
    loadCategories();
    checkAuth();
})();
