(function () {
    'use strict';

    var cachedCategories = [];

    var LEGACY_CATEGORY_IDS = {
        women: 'kolyeler',
        men: 'bileklikler',
        kid: 'kupeler',
        accessories: 'gozluk-ipleri',
        cosmetic: 'aksesuarlar'
    };

    function normalizeCategoryId(id) {
        if (!id) return id;
        return LEGACY_CATEGORY_IDS[id] || id;
    }

    function applySetBg(container) {
        if (typeof jQuery === 'undefined') return;
        jQuery(container).find('.set-bg').each(function () {
            var bg = jQuery(this).data('setbg');
            jQuery(this).css('background-image', 'url(' + bg + ')');
        });
    }

    function renderHomeFilters(categories) {
        var list = document.getElementById('home-category-filters');
        if (!list) return;

        var active = categories
            .filter(function (c) { return c.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        list.innerHTML = '<li class="active" data-filter="*">Tümü</li>' +
            active.map(function (c) {
                return '<li data-filter=".' + c.id + '">' + c.name + '</li>';
            }).join('');
    }

    function renderShopCategories(categories) {
        var list = document.getElementById('shop-categories-list');
        if (!list) return;

        var active = categories
            .filter(function (c) { return c.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        list.innerHTML = '<li><a href="./shop.html">Tümü</a></li>' +
            active.map(function (c) {
                return '<li><a href="./shop.html?category=' + encodeURIComponent(c.id) + '">' +
                    c.name + '</a></li>';
            }).join('');
    }

    function renderHomeCategories(categories) {
        var grid = document.getElementById('home-categories-grid');
        if (!grid) return;

        var featured = categories
            .filter(function (c) { return c.featured && c.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        grid.innerHTML = featured.map(function (c) {
            var image = c.image || 'img/categories/aksesuarlar.png';
            return '<div class="col-lg-6 col-md-6 col-sm-6 p-0">' +
                '<div class="categories__item set-bg" data-setbg="' + image + '">' +
                '<div class="categories__text">' +
                '<h4>' + c.name + '</h4>' +
                '<a href="./shop.html?category=' + encodeURIComponent(c.id) + '">Alışverişe Başla</a>' +
                '</div></div></div>';
        }).join('');

        applySetBg(grid);
    }

    function loadCategories() {
        return fetch('/api/categories')
            .then(function (res) { return res.json(); })
            .then(function (categories) {
                cachedCategories = categories;
                renderShopCategories(categories);
                renderHomeCategories(categories);
                renderHomeFilters(categories);
                document.dispatchEvent(new CustomEvent('categories:loaded', { detail: categories }));
                return categories;
            })
            .catch(function () {
                cachedCategories = [];
            });
    }

    function getCategoryName(id) {
        var found = cachedCategories.find(function (c) { return c.id === id; });
        return found ? found.name : id;
    }

    window.OtantikaCategories = {
        load: loadCategories,
        getAll: function () { return cachedCategories.slice(); },
        getName: getCategoryName,
        normalizeId: normalizeCategoryId
    };

    document.addEventListener('DOMContentLoaded', loadCategories);
})();
