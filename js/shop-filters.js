(function () {
    'use strict';

    var allColorOptions = [];
    var savedSelection = [];

    function getSelectedColors() {
        var colors = [];
        document.querySelectorAll('#color-filters input[type="checkbox"]:checked').forEach(function (cb) {
            colors.push(cb.value);
        });
        return colors;
    }

    function rememberSelection() {
        var current = getSelectedColors();
        if (current.length) {
            savedSelection = current.slice();
        }
    }

    function updateClearButton() {
        var btn = document.getElementById('color-filter-clear');
        if (!btn) return;
        btn.classList.toggle('hidden', getSelectedColors().length === 0);
    }

    function notifyFilterChange() {
        rememberSelection();
        updateClearButton();
        document.dispatchEvent(new CustomEvent('shop:filters-changed'));
    }

    function buildColorFilters() {
        var container = document.getElementById('color-filters');
        if (!container || !allColorOptions.length) return;

        var colors = allColorOptions.slice();
        var selection = getSelectedColors();
        if (!selection.length && savedSelection.length) {
            selection = savedSelection.slice();
        }

        container.innerHTML = colors.map(function (color) {
            var checked = selection.indexOf(color.id) !== -1 ? ' checked' : '';
            return '<label for="color-' + color.id + '">' +
                '<span class="color-swatch color-swatch--' + color.id + '"></span>' +
                color.name +
                '<input type="checkbox" id="color-' + color.id + '" value="' + color.id + '"' + checked + '>' +
                '<span class="checkmark"></span></label>';
        }).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
            input.addEventListener('change', notifyFilterChange);
        });

        savedSelection = selection.slice();
        updateClearButton();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var clearBtn = document.getElementById('color-filter-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                savedSelection = [];
                document.querySelectorAll('#color-filters input[type="checkbox"]').forEach(function (cb) {
                    cb.checked = false;
                });
                notifyFilterChange();
            });
        }

        fetch('/api/colors')
            .then(function (res) { return res.json(); })
            .then(function (colors) {
                allColorOptions = colors;
                buildColorFilters();
            })
            .catch(function () {
                var container = document.getElementById('color-filters');
                if (container) container.innerHTML = '<p>Renk filtreleri yüklenemedi.</p>';
            });
    });

    document.addEventListener('catalog:products-loaded', function () {
        if (allColorOptions.length) {
            buildColorFilters();
        }
    });

    window.ShopFilters = {
        getSelectedColors: getSelectedColors
    };
})();
