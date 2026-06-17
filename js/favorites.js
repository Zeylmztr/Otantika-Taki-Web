(function (window) {
    'use strict';

    var STORAGE_KEY = 'otantika_favorites';

    function getFavorites() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var ids = raw ? JSON.parse(raw) : [];
            return Array.isArray(ids) ? ids : [];
        } catch (e) {
            return [];
        }
    }

    function saveFavorites(ids) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        updateBadges();
        syncAllHearts();
        document.dispatchEvent(new CustomEvent('favorites:updated', { detail: ids }));
    }

    function isFavorite(productId) {
        return getFavorites().indexOf(productId) !== -1;
    }

    function toggleFavorite(productId) {
        if (!productId) return false;
        var ids = getFavorites();
        var index = ids.indexOf(productId);
        if (index === -1) {
            ids.push(productId);
        } else {
            ids.splice(index, 1);
        }
        saveFavorites(ids);
        return index === -1;
    }

    function updateBadges() {
        var count = getFavorites().length;
        document.querySelectorAll('.header-favorites-link, .offcanvas-favorites-link').forEach(function (link) {
            var tip = link.querySelector('.tip');
            if (!tip) {
                tip = document.createElement('div');
                tip.className = 'tip';
                link.appendChild(tip);
            }
            tip.textContent = String(count);
            tip.style.display = count > 0 ? '' : 'none';
        });
    }

    function updateHeartState(el, active) {
        if (!el) return;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', active ? 'true' : 'false');
        el.setAttribute('title', active ? 'Favorilerden çıkar' : 'Favorilere ekle');
    }

    function syncAllHearts() {
        document.querySelectorAll('.toggle-favorite[data-favorite-id]').forEach(function (el) {
            updateHeartState(el, isFavorite(el.getAttribute('data-favorite-id')));
        });
    }

    function renderFavoritesPage() {
        var container = document.getElementById('favorites-products');
        if (!container) return;

        var ids = getFavorites();
        if (!ids.length) {
            container.innerHTML = '<div class="col-12 favorites-empty">' +
                '<p>Henüz favori ürününüz yok.</p>' +
                '<a href="./shop.html" class="primary-btn">Mağazaya Git</a></div>';
            return;
        }

        fetch('/api/products')
            .then(function (res) { return res.json(); })
            .then(function (products) {
                var favoriteProducts = products.filter(function (p) {
                    return ids.indexOf(p.id) !== -1;
                });
                if (!favoriteProducts.length) {
                    container.innerHTML = '<div class="col-12 favorites-empty"><p>Favori ürünler bulunamadı.</p></div>';
                    return;
                }
                if (window.OtantikaCatalog && window.OtantikaCatalog.renderProducts) {
                    window.OtantikaCatalog.renderProducts(container, favoriteProducts, 'shop');
                }
            })
            .catch(function () {
                container.innerHTML = '<div class="col-12"><p>Favoriler yüklenemedi.</p></div>';
            });
    }

    function bindProductDetail(product) {
        var btn = document.querySelector('.product-detail-favorite');
        if (!btn || !product) return;
        btn.setAttribute('data-favorite-id', product.id);
        updateHeartState(btn, isFavorite(product.id));
    }

    function bindGlobalEvents() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.toggle-favorite');
            if (!btn) return;
            e.preventDefault();
            var productId = btn.getAttribute('data-favorite-id');
            if (!productId) return;
            var added = toggleFavorite(productId);
            updateHeartState(btn, added);
        });
    }

    document.addEventListener('favorites:updated', function () {
        renderFavoritesPage();
    });

    document.addEventListener('DOMContentLoaded', function () {
        updateBadges();
        syncAllHearts();
        bindGlobalEvents();
        renderFavoritesPage();
    });

    window.OtantikaFavorites = {
        getFavorites: getFavorites,
        isFavorite: isFavorite,
        toggleFavorite: toggleFavorite,
        updateBadges: updateBadges,
        syncAllHearts: syncAllHearts,
        bindProductDetail: bindProductDetail,
        renderFavoritesPage: renderFavoritesPage
    };
})(window);
