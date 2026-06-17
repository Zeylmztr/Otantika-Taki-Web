(function (window) {
    'use strict';

    var STORAGE_KEY = 'otantika_cart';
    var COLOR_NAMES = {};

    function formatPrice(price) {
        return '₺' + Number(price).toLocaleString('tr-TR');
    }

    function loadColorNames() {
        return fetch('/api/colors')
            .then(function (res) { return res.json(); })
            .then(function (colors) {
                colors.forEach(function (c) { COLOR_NAMES[c.id] = c.name; });
            })
            .catch(function () {});
    }

    function colorDisplayName(colorId) {
        return COLOR_NAMES[colorId] || colorId;
    }

    function makeCartKey(productId, color) {
        return color ? productId + '::' + color : productId;
    }

    function getItemKey(item) {
        return item.cartKey || makeCartKey(item.id, item.color);
    }

    function getCart() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        updateBadges();
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
    }

    function getCartCount() {
        return getCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
    }

    function getSubtotal() {
        return getCart().reduce(function (sum, item) {
            return sum + Number(item.price) * item.qty;
        }, 0);
    }

    function buildCartOptions(product, options) {
        options = options || {};
        var variant = options.variant || null;
        var color = options.color || (variant ? variant.color : null);
        var image = options.image || (variant && variant.image) || product.image;
        var colorName = options.colorName || (color ? colorDisplayName(color) : '');

        return {
            cartKey: makeCartKey(product.id, color),
            id: product.id,
            color: color,
            colorName: colorName,
            name: product.name,
            price: Number(product.price),
            image: image,
        };
    }

    function addToCart(product, qty, options) {
        qty = Math.max(1, parseInt(qty, 10) || 1);
        var line = buildCartOptions(product, options);
        var items = getCart();
        var existing = items.find(function (item) { return getItemKey(item) === line.cartKey; });

        if (existing) {
            existing.qty += qty;
        } else {
            items.push(Object.assign({}, line, { qty: qty }));
        }

        saveCart(items);
        return items;
    }

    function removeFromCart(cartKey) {
        var items = getCart().filter(function (item) { return getItemKey(item) !== cartKey; });
        saveCart(items);
        return items;
    }

    function setQuantity(cartKey, qty) {
        qty = parseInt(qty, 10);
        var items = getCart();
        var item = items.find(function (i) { return getItemKey(i) === cartKey; });

        if (!item) return items;

        if (qty <= 0) {
            return removeFromCart(cartKey);
        }

        item.qty = qty;
        saveCart(items);
        return items;
    }

    function updateBadges() {
        var count = getCartCount();
        document.querySelectorAll('.header__right__widget li a, .offcanvas__widget li a').forEach(function (link) {
            if (!link.querySelector('.icon_bag_alt')) return;

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

    function fetchProduct(productId) {
        return fetch('/api/products/' + encodeURIComponent(productId))
            .then(function (res) {
                if (!res.ok) throw new Error('Ürün bulunamadı');
                return res.json();
            });
    }

    function defaultVariantOptions(product) {
        if (!product.variants || !product.variants.length) {
            return {};
        }
        var variant = product.variants[0];
        return {
            variant: variant,
            color: variant.color,
            colorName: colorDisplayName(variant.color),
            image: variant.image || product.image
        };
    }

    function handleAddToCart(productId, qty) {
        return fetchProduct(productId).then(function (product) {
            addToCart(product, qty, defaultVariantOptions(product));
            return product;
        });
    }

    function updateCartTotals() {
        var subtotal = getSubtotal();
        var subtotalEl = document.getElementById('cart-subtotal');
        var totalEl = document.getElementById('cart-total');
        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
        if (totalEl) totalEl.textContent = formatPrice(subtotal);
    }

    function updateCheckoutTotals() {
        var subtotal = getSubtotal();
        var subtotalEl = document.getElementById('checkout-subtotal');
        var totalEl = document.getElementById('checkout-total');
        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
        if (totalEl) totalEl.textContent = formatPrice(subtotal);
    }

    function renderCheckoutPage() {
        var list = document.getElementById('checkout-order-items');
        if (!list) return;

        var items = getCart();
        var header = '<li>' +
            '<span class="top__text">Ürün</span>' +
            '<span class="top__text__right">Toplam</span>' +
            '</li>';

        if (!items.length) {
            list.innerHTML = header +
                '<li class="checkout__order__empty">Sepetiniz boş. <a href="./shop.html">Alışverişe başlayın</a></li>';
            updateCheckoutTotals();
            var emptyBtn = document.querySelector('.checkout__order .site-btn');
            if (emptyBtn) emptyBtn.disabled = true;
            return;
        }

        list.innerHTML = header + items.map(function (item, index) {
            var num = String(index + 1).padStart(2, '0');
            var label = item.name;
            if (item.colorName) label += ' (' + item.colorName + ')';
            if (item.qty > 1) label += ' × ' + item.qty;
            var lineTotal = Number(item.price) * item.qty;
            return '<li>' + num + '. ' + label + ' <span>' + formatPrice(lineTotal) + '</span></li>';
        }).join('');

        updateCheckoutTotals();

        var submitBtn = document.querySelector('.checkout__order .site-btn');
        if (submitBtn) submitBtn.disabled = false;
    }

    function applyQtyChange(input) {
        if (!input || !input.getAttribute('data-cart-qty')) return;

        var cartKey = input.getAttribute('data-cart-qty');
        var qty = Math.max(1, parseInt(input.value, 10) || 1);
        input.value = qty;

        setQuantity(cartKey, qty);

        var item = getCart().find(function (i) { return getItemKey(i) === cartKey; });
        if (!item) return;

        var lineEl = document.querySelector('[data-line-total="' + cartKey + '"]');
        if (lineEl) {
            lineEl.textContent = formatPrice(Number(item.price) * item.qty);
        }

        updateCartTotals();
    }

    function initQtyControls(scope) {
        var $scope = scope ? $(scope) : $(document);
        $scope.find('.pro-qty').each(function () {
            var $qty = $(this);
            if ($qty.data('qty-init')) return;
            $qty.data('qty-init', true);
            if (!$qty.find('.qtybtn').length) {
                $qty.prepend('<span class="dec qtybtn">-</span>');
                $qty.append('<span class="inc qtybtn">+</span>');
            }
        });

        $scope.find('.pro-qty').off('click.cartQty').on('click.cartQty', '.qtybtn', function () {
            var $button = $(this);
            var $input = $button.parent().find('input');
            var oldValue = parseInt($input.val(), 10) || 1;
            var newVal = $button.hasClass('inc') ? oldValue + 1 : Math.max(1, oldValue - 1);
            $input.val(newVal);

            if ($input.attr('data-cart-qty')) {
                applyQtyChange($input[0]);
            }
        });

        $scope.find('[data-cart-qty]').off('change.cartQty input.cartQty').on('change.cartQty input.cartQty', function () {
            applyQtyChange(this);
        });
    }

    function starsHtml() {
        return '<div class="rating">' + '<i class="fa fa-star"></i>'.repeat(5) + '</div>';
    }

    function setCheckoutLinkState(hasItems) {
        var checkoutLink = document.querySelector('.cart__total__procced a[href="./checkout.html"]');
        if (!checkoutLink) return;
        checkoutLink.style.opacity = hasItems ? '' : '0.5';
        checkoutLink.style.pointerEvents = hasItems ? '' : 'none';
    }

    function renderCartPage() {
        var tbody = document.getElementById('cart-items');
        if (!tbody) return;

        var items = getCart();

        if (!items.length) {
            tbody.innerHTML = '<tr id="cart-empty-row"><td colspan="5" class="text-center" style="padding:40px;">Sepetiniz boş. <a href="./shop.html">Alışverişe başlayın</a>.</td></tr>';
            updateCartTotals();
            setCheckoutLinkState(false);
            return;
        }

        tbody.innerHTML = items.map(function (item) {
            var cartKey = getItemKey(item);
            var lineTotal = Number(item.price) * item.qty;
            var colorLine = item.colorName
                ? '<p class="cart__variant">Renk: ' + item.colorName + '</p>'
                : '';

            return '<tr data-cart-id="' + cartKey + '">' +
                '<td class="cart__product__item">' +
                '<img src="' + item.image + '" alt="' + item.name + '">' +
                '<div class="cart__product__item__title">' +
                '<h6><a href="./product-details.html?id=' + encodeURIComponent(item.id) + '">' + item.name + '</a></h6>' +
                colorLine +
                starsHtml() +
                '</div></td>' +
                '<td class="cart__price">' + formatPrice(item.price) + '</td>' +
                '<td class="cart__quantity"><div class="pro-qty">' +
                '<input type="text" value="' + item.qty + '" data-cart-qty="' + cartKey + '">' +
                '</div></td>' +
                '<td class="cart__total" data-line-total="' + cartKey + '">' + formatPrice(lineTotal) + '</td>' +
                '<td class="cart__close"><span class="icon_close" data-remove-cart="' + cartKey + '"></span></td>' +
                '</tr>';
        }).join('');

        initQtyControls(tbody);
        updateCartTotals();
        setCheckoutLinkState(true);
    }

    function syncCartFromInputs() {
        document.querySelectorAll('[data-cart-qty]').forEach(function (input) {
            setQuantity(input.getAttribute('data-cart-qty'), input.value);
        });
        renderCartPage();
    }

    function bindCheckoutForm() {
        var form = document.querySelector('.checkout__form');
        if (!form || form.dataset.cartBound) return;
        form.dataset.cartBound = '1';
        form.addEventListener('submit', function (e) {
            if (!getCart().length) {
                e.preventDefault();
                alert('Sepetiniz boş. Önce ürün ekleyin.');
            }
        });
    }

    function bindGlobalEvents() {
        document.addEventListener('click', function (e) {
            var addBtn = e.target.closest('.add-to-cart');
            if (addBtn) {
                e.preventDefault();
                var productId = addBtn.getAttribute('data-product-id');
                if (!productId) return;

                handleAddToCart(productId, 1)
                    .then(function (product) {
                        var goCart = window.confirm(product.name + ' sepete eklendi. Sepete gitmek ister misiniz?');
                        if (goCart) window.location.href = './shop-cart.html';
                    })
                    .catch(function () { alert('Ürün sepete eklenemedi.'); });
                return;
            }

            var removeBtn = e.target.closest('[data-remove-cart]');
            if (removeBtn) {
                removeFromCart(removeBtn.getAttribute('data-remove-cart'));
                renderCartPage();
                return;
            }

            var updateBtn = e.target.closest('#cart-update-btn');
            if (updateBtn) {
                e.preventDefault();
                syncCartFromInputs();
            }
        });
    }

    function bindProductDetailCart(currentProduct, getSelectedVariant, colorLabelFn) {
        var cartBtn = document.querySelector('.cart-btn');
        if (!cartBtn || !currentProduct) return;

        cartBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var variants = currentProduct.variants || [];
            var selectedVariant = getSelectedVariant ? getSelectedVariant() : null;

            if (variants.length && !selectedVariant) {
                alert('Lütfen bir renk seçin.');
                return;
            }

            var qtyInput = document.querySelector('.product__details__button .pro-qty input');
            var qty = qtyInput ? qtyInput.value : 1;
            var colorName = selectedVariant
                ? (colorLabelFn ? colorLabelFn(selectedVariant.color) : colorDisplayName(selectedVariant.color))
                : '';

            addToCart(currentProduct, qty, selectedVariant ? {
                variant: selectedVariant,
                color: selectedVariant.color,
                colorName: colorName,
                image: selectedVariant.image || currentProduct.image
            } : {});

            var label = colorName ? currentProduct.name + ' (' + colorName + ')' : currentProduct.name;
            var goCart = window.confirm(label + ' sepete eklendi. Sepete gitmek ister misiniz?');
            if (goCart) window.location.href = './shop-cart.html';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadColorNames().finally(function () {
            updateBadges();
            bindGlobalEvents();
            bindCheckoutForm();
            renderCartPage();
            renderCheckoutPage();
        });

        document.querySelectorAll('.header__right__widget .icon_bag_alt, .offcanvas__widget .icon_bag_alt').forEach(function (icon) {
            var link = icon.closest('a');
            if (link) link.setAttribute('href', './shop-cart.html');
        });
    });

    window.OtantikaCart = {
        addToCart: addToCart,
        getCart: getCart,
        removeFromCart: removeFromCart,
        setQuantity: setQuantity,
        getCartCount: getCartCount,
        getSubtotal: getSubtotal,
        formatPrice: formatPrice,
        renderCartPage: renderCartPage,
        renderCheckoutPage: renderCheckoutPage,
        bindProductDetailCart: bindProductDetailCart,
        handleAddToCart: handleAddToCart
    };
})(window);
