(function () {
    'use strict';

    var BADGES = {
        new: 'Yeni',
        sale: 'İndirim',
        stockout: 'Tükendi'
    };

    var shopState = {
        allProducts: [],
        container: null,
        loading: false
    };

    function formatPrice(price) {
        return '₺' + Number(price).toLocaleString('tr-TR');
    }

    function badgeHtml(badge) {
        if (!badge || !BADGES[badge]) return '';
        var cls = badge === 'sale' ? 'label sale' : 'label ' + badge;
        return '<div class="' + cls + '">' + BADGES[badge] + '</div>';
    }

    function priceHtml(product) {
        if (product.oldPrice) {
            return '<div class="product__price">' + formatPrice(product.price) +
                ' <span>' + formatPrice(product.oldPrice) + '</span></div>';
        }
        return '<div class="product__price">' + formatPrice(product.price) + '</div>';
    }

    function starsHtml() {
        return '<div class="rating">' +
            '<i class="fa fa-star"></i>'.repeat(5) +
            '</div>';
    }

    function getProductImages(product) {
        if (product.images && product.images.length) {
            return product.images;
        }
        if (product.image) {
            return [product.image];
        }
        return [];
    }

    function buildProductPicHtml(product, detailUrl) {
        var images = getProductImages(product);
        var badge = badgeHtml(product.badge);
        var hover = '<ul class="product__hover">' +
            '<li><a href="' + detailUrl + '" title="Ürün Detayı"><span class="arrow_expand"></span></a></li>' +
            '<li><a href="#" class="toggle-favorite" data-favorite-id="' + encodeURIComponent(product.id) + '" title="Favorilere ekle"><span class="icon_heart_alt"></span></a></li>' +
            '<li><a href="#" class="add-to-cart" data-product-id="' + encodeURIComponent(product.id) + '" title="Sepete Ekle"><span class="icon_bag_alt"></span></a></li>' +
            '</ul>';

        if (images.length > 1) {
            var slides = images.map(function (src) {
                return '<div class="product-card-gallery__slide set-bg" data-setbg="' + src + '"></div>';
            }).join('');

            return '<div class="product__item__pic product-card-gallery">' +
                '<div class="product-card-gallery__main">' +
                '<a href="' + detailUrl + '" class="product-card-gallery__link" aria-label="' + product.name + ' detayı">' +
                '<div class="product-card-gallery__track">' + slides + '</div></a></div>' +
                '<button type="button" class="product-card-gallery__nav product-card-gallery__nav--prev" aria-label="Önceki görsel">' +
                '<i class="arrow_carrot-left"></i></button>' +
                '<button type="button" class="product-card-gallery__nav product-card-gallery__nav--next" aria-label="Sonraki görsel">' +
                '<i class="arrow_carrot-right"></i></button>' +
                badge + hover + '</div>';
        }

        var cover = images[0] || product.image || '';
        return '<div class="product__item__pic set-bg" data-setbg="' + cover + '">' +
            '<a href="' + detailUrl + '" class="product__item__pic-link" aria-label="' + product.name + ' detayı"></a>' +
            badge + hover + '</div>';
    }

    function buildProductCard(product, layout) {
        var colClass = layout === 'shop' ? 'col-lg-4 col-md-6' : 'col-lg-3 col-md-4 col-sm-6';
        var saleClass = product.badge === 'sale' ? ' sale' : '';
        var detailUrl = './product-details.html?id=' + encodeURIComponent(product.id);

        return '<div class="' + colClass + ' mix ' + product.category + '">' +
            '<div class="product__item' + saleClass + '">' +
            buildProductPicHtml(product, detailUrl) +
            '<div class="product__item__text">' +
            '<h6><a href="' + detailUrl + '">' + product.name + '</a></h6>' +
            starsHtml() +
            priceHtml(product) +
            '</div></div></div>';
    }

    function applyBackgrounds(container) {
        $(container).find('.set-bg').each(function () {
            var bg = $(this).data('setbg');
            $(this).css('background-image', 'url(' + bg + ')');
        });
    }

    function initCardGalleries(container) {
        container.querySelectorAll('.product-card-gallery').forEach(function (gallery) {
            var track = gallery.querySelector('.product-card-gallery__track');
            if (!track) return;

            var slideCount = track.children.length;
            if (slideCount <= 1) return;

            var currentIndex = 0;
            var prevBtn = gallery.querySelector('.product-card-gallery__nav--prev');
            var nextBtn = gallery.querySelector('.product-card-gallery__nav--next');

            function showIndex(index) {
                currentIndex = (index + slideCount) % slideCount;
                track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showIndex(currentIndex - 1);
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showIndex(currentIndex + 1);
                });
            }
        });
    }

    function initGallery(container) {
        applyBackgrounds(container);
        initCardGalleries(container);
        if (typeof mixitup !== 'undefined' && $(container).hasClass('property__gallery')) {
            if (homeMixerInstance && typeof homeMixerInstance.destroy === 'function') {
                homeMixerInstance.destroy();
                homeMixerInstance = null;
            }
            homeMixerInstance = mixitup(container, {
                selectors: {
                    target: '.mix',
                    control: '.filter__controls [data-filter]'
                },
                controls: {
                    toggleDefault: 'all'
                }
            });
            $('.filter__controls [data-filter]').off('click.otantikaFilter').on('click.otantikaFilter', function () {
                $('.filter__controls li').removeClass('active');
                $(this).addClass('active');
            });
        }
    }

    var homeMixerInstance = null;

    function getCategoryFilter() {
        var category = new URLSearchParams(window.location.search).get('category');
        if (!category) return null;
        if (window.OtantikaCategories && window.OtantikaCategories.normalizeId) {
            return window.OtantikaCategories.normalizeId(category);
        }
        return category;
    }

    function getSelectedColors() {
        if (window.ShopFilters && window.ShopFilters.getSelectedColors) {
            return window.ShopFilters.getSelectedColors();
        }
        return [];
    }

    function getProductColors(product) {
        if (product.colors && product.colors.length) {
            return product.colors;
        }
        if (product.variants && product.variants.length) {
            return product.variants.map(function (v) { return v.color; });
        }
        return [];
    }

    function filterProducts(products) {
        var category = getCategoryFilter();
        var colors = getSelectedColors();

        return products.filter(function (p) {
            if (category && p.category !== category) return false;
            if (colors.length) {
                var productColors = getProductColors(p);
                if (!productColors.some(function (c) { return colors.indexOf(c) !== -1; })) {
                    return false;
                }
            }
            return true;
        });
    }

    function markActiveCategory() {
        if (window.location.pathname.indexOf('shop.html') === -1) return;

        var category = getCategoryFilter();
        document.querySelectorAll('.categories__simple a').forEach(function (link) {
            var href = link.getAttribute('href') || '';
            var match = href.match(/category=([^&]+)/);
            var linkCategory = match ? match[1] : null;
            var active = category ? linkCategory === category : !linkCategory;
            link.classList.toggle('active', active);
        });
    }

    function renderProducts(container, products, layout) {
        if (!products.length) {
            container.innerHTML = '<div class="col-12"><p>Seçilen filtrelere uygun ürün bulunamadı.</p></div>';
            markActiveCategory();
            return;
        }
        container.innerHTML = products.map(function (p) {
            return buildProductCard(p, layout);
        }).join('');
        initGallery(container);
        if (window.OtantikaFavorites) {
            window.OtantikaFavorites.syncAllHearts();
        }
        markActiveCategory();
    }

    function renderShopCatalog(container) {
        var layout = container.getAttribute('data-catalog-layout') || 'shop';
        if (shopState.loading) {
            container.innerHTML = '<div class="col-12 catalog-loading"><p>Ürünler yükleniyor...</p></div>';
            return;
        }
        renderProducts(container, filterProducts(shopState.allProducts), layout);
    }

    function renderCatalog(container) {
        var layout = container.getAttribute('data-catalog-layout') || 'home';
        var limit = container.getAttribute('data-catalog-limit');
        var category = getCategoryFilter();
        var url = '/api/products';
        if (layout === 'home') {
            url += '?limit=' + (limit || '8');
        }

        var loadProducts = function () {
            fetch(url)
                .then(function (res) { return res.json(); })
                .then(function (products) {
                    if (layout === 'shop') {
                        shopState.loading = false;
                        shopState.allProducts = products;
                        shopState.container = container;
                        document.dispatchEvent(new CustomEvent('catalog:products-loaded', { detail: products }));
                        renderShopCatalog(container);
                        return;
                    }

                    if (category) {
                        products = products.filter(function (p) { return p.category === category; });
                    }
                    renderProducts(container, products, layout);
                })
                .catch(function () {
                    shopState.loading = false;
                    container.innerHTML = '<div class="col-12"><p>Ürünler yüklenemedi.</p></div>';
                });
        };

        if (layout === 'home' && window.OtantikaCategories) {
            window.OtantikaCategories.load().then(loadProducts);
        } else {
            loadProducts();
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var container = document.getElementById('catalog-products');
        if (!container) return;
        var layout = container.getAttribute('data-catalog-layout') || 'home';
        if (layout === 'shop') {
            shopState.loading = true;
            shopState.container = container;
            renderShopCatalog(container);
        }
        renderCatalog(container);
    });

    document.addEventListener('categories:loaded', function () {
        markActiveCategory();
    });

    document.addEventListener('shop:filters-changed', function () {
        if (!shopState.container || shopState.loading) return;
        renderShopCatalog(shopState.container);
    });

    window.OtantikaCatalog = {
        renderProducts: renderProducts,
        getProductColors: getProductColors,
        getAllProducts: function () { return shopState.allProducts.slice(); },
        isLoading: function () { return shopState.loading; }
    };
})();
