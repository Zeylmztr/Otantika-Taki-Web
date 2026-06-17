(function () {
    'use strict';

    var COLOR_META = [];

    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function formatPrice(price) {
        return '₺' + Number(price).toLocaleString('tr-TR');
    }

    function colorLabel(colorId) {
        var found = COLOR_META.find(function (c) { return c.id === colorId; });
        return found ? found.name : colorId;
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

    function getVariantDisplayImages(product, variant) {
        var base = getProductImages(product);
        if (variant && variant.image) {
            var rest = base.filter(function (img) { return img !== variant.image; });
            return [variant.image].concat(rest);
        }
        return base;
    }

    function initProductGallery(product, initialImages) {
        var images = initialImages && initialImages.length ? initialImages : getProductImages(product);
        var gallery = document.getElementById('product-gallery');
        var thumbsEl = document.getElementById('product-thumbs');
        var track = document.getElementById('product-gallery-track');
        if (!gallery || !thumbsEl || !track || !images.length) {
            return { setImages: function () {} };
        }

        var prevBtn = gallery.querySelector('.product-gallery__nav--prev');
        var nextBtn = gallery.querySelector('.product-gallery__nav--next');
        var currentIndex = 0;

        function rebuildGallery() {
            track.innerHTML = images.map(function (src) {
                return '<img class="product__big__img" src="' + src + '" alt="' + product.name + '">';
            }).join('');

            thumbsEl.innerHTML = images.map(function (src, i) {
                return '<a href="#" class="pt' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' +
                    '<img src="' + src + '" alt="' + product.name + '"></a>';
            }).join('');
        }

        function showIndex(index) {
            if (!images.length) return;
            currentIndex = (index + images.length) % images.length;
            track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';

            thumbsEl.querySelectorAll('.pt').forEach(function (el, idx) {
                el.classList.toggle('active', idx === currentIndex);
            });

            var showNav = images.length > 1;
            if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
            if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';
        }

        function setImages(newImages) {
            if (!newImages || !newImages.length) return;
            images = newImages;
            currentIndex = 0;
            rebuildGallery();
            showIndex(0);
        }

        rebuildGallery();
        showIndex(0);

        if (prevBtn) {
            prevBtn.onclick = function (e) {
                e.preventDefault();
                showIndex(currentIndex - 1);
            };
        }

        if (nextBtn) {
            nextBtn.onclick = function (e) {
                e.preventDefault();
                showIndex(currentIndex + 1);
            };
        }

        thumbsEl.onclick = function (e) {
            var pt = e.target.closest('.pt');
            if (!pt) return;
            e.preventDefault();
            showIndex(parseInt(pt.getAttribute('data-index'), 10));
        };

        return { setImages: setImages };
    }

    function initProductVariants(product, gallery) {
        var container = document.getElementById('product-variant-colors');
        var row = document.getElementById('product-variant-row');
        var selectedLabel = document.getElementById('product-selected-color');
        var variants = product.variants || [];
        var selectedVariant = variants.length ? variants[0] : null;

        if (!container || !variants.length) {
            if (row) row.style.display = 'none';
            return function () { return null; };
        }

        if (row) row.style.display = '';

        container.innerHTML = variants.map(function (variant, index) {
            var name = colorLabel(variant.color);
            return '<label class="' + (index === 0 ? 'active' : '') + '" data-variant-color="' + variant.color + '" title="' + name + '">' +
                '<input type="radio" name="variant__radio" value="' + variant.color + '"' + (index === 0 ? ' checked' : '') + '>' +
                '<span class="checkmark color-swatch color-swatch--' + variant.color + '"></span></label>';
        }).join('');

        function updateSelectedLabel(variant) {
            if (selectedLabel && variant) {
                selectedLabel.textContent = 'Seçili renk: ' + colorLabel(variant.color);
            }
        }

        function selectVariant(variant) {
            selectedVariant = variant;
            updateSelectedLabel(variant);
            if (gallery) {
                gallery.setImages(getVariantDisplayImages(product, variant));
            }
        }

        container.addEventListener('click', function (e) {
            var label = e.target.closest('[data-variant-color]');
            if (!label) return;

            container.querySelectorAll('label').forEach(function (el) {
                el.classList.remove('active');
            });
            label.classList.add('active');

            var color = label.getAttribute('data-variant-color');
            var variant = variants.find(function (v) { return v.color === color; });
            if (variant) selectVariant(variant);
        });

        selectVariant(selectedVariant);

        return function () {
            return selectedVariant;
        };
    }

    function loadColors() {
        return fetch('/api/colors')
            .then(function (res) { return res.json(); })
            .then(function (colors) {
                COLOR_META = colors;
                return colors;
            })
            .catch(function () {
                COLOR_META = [];
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var id = getParam('id');
        if (!id) return;

        Promise.all([
            loadColors(),
            fetch('/api/products/' + encodeURIComponent(id)).then(function (res) {
                if (!res.ok) throw new Error('not found');
                return res.json();
            })
        ]).then(function (results) {
            var product = results[1];
            document.title = product.name + ' | Otantika Takı';

            var title = document.getElementById('product-title');
            if (title) {
                title.innerHTML = product.name + ' <span>Marka: Otantika Takı</span>';
            }

            var priceEl = document.getElementById('product-price');
            if (priceEl) {
                priceEl.innerHTML = product.oldPrice
                    ? formatPrice(product.price) + ' <span>' + formatPrice(product.oldPrice) + '</span>'
                    : formatPrice(product.price);
            }

            var desc = document.getElementById('product-description');
            if (desc) desc.textContent = product.description || '';

            var initialImages = product.variants && product.variants.length
                ? getVariantDisplayImages(product, product.variants[0])
                : getProductImages(product);
            var gallery = initProductGallery(product, initialImages);
            var getSelectedVariant = initProductVariants(product, gallery);

            var tabDesc = document.getElementById('product-tab-description');
            if (tabDesc) tabDesc.innerHTML = '<p>' + (product.description || '') + '</p>';

            var breadcrumb = document.getElementById('product-breadcrumb-name');
            if (breadcrumb) breadcrumb.textContent = product.name;

            if (window.OtantikaCart) {
                window.OtantikaCart.bindProductDetailCart(product, getSelectedVariant, colorLabel);
            }
            if (window.OtantikaFavorites) {
                window.OtantikaFavorites.bindProductDetail(product);
            }
        }).catch(function () {
            var title = document.getElementById('product-title');
            if (title) title.textContent = 'Ürün bulunamadı';
        });
    });
})();
