(function () {
    'use strict';

    var PREVIEW_LIMIT = 6;

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    }

    function postUrl(post) {
        return './blog-details.html?id=' + encodeURIComponent(post.id);
    }

    function buildPostGridItem(post) {
        var largeClass = post.large ? ' large__item' : '';
        var url = postUrl(post);
        return '<div class="col-lg-4 col-md-4 col-sm-6">' +
            '<article class="blog__item blog__item--clickable" data-href="' + url + '">' +
            '<div class="blog__item__pic' + largeClass + ' set-bg" data-setbg="' + post.image + '"></div>' +
            '<div class="blog__item__text">' +
            '<h6>' + post.title + '</h6>' +
            '<ul><li>yazar: <span>' + (post.author || 'Otantika Takı') + '</span></li>' +
            '<li>' + formatDate(post.date) + '</li></ul>' +
            '<span class="blog__item__more">Detaylı yazı &rarr;</span>' +
            '</div></article></div>';
    }

    function buildPostListItem(post) {
        var url = postUrl(post);
        var excerpt = post.excerpt ? '<p class="blog__list__item__excerpt">' + post.excerpt + '</p>' : '';
        return '<div class="col-lg-12">' +
            '<article class="blog__list__item blog__item--clickable" data-href="' + url + '">' +
            '<div class="blog__list__item__pic set-bg" data-setbg="' + post.image + '"></div>' +
            '<div class="blog__list__item__body">' +
            '<h5>' + post.title + '</h5>' +
            '<p class="blog__list__item__meta">' + formatDate(post.date) +
            ' · ' + (post.author || 'Otantika Takı') + '</p>' +
            excerpt +
            '<span class="blog__list__item__more">Detaylı yazı &rarr;</span>' +
            '</div></article></div>';
    }

    function bindPostLinks(root) {
        root.querySelectorAll('.blog__item--clickable').forEach(function (item) {
            item.addEventListener('click', function () {
                window.location.href = item.getAttribute('data-href');
            });
        });
    }

    function applyBackgrounds(root) {
        $(root).find('.set-bg').each(function () {
            var bg = $(this).data('setbg');
            $(this).css('background-image', 'url(' + bg + ')');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('blog-posts');
        if (!grid) return;

        var list = document.getElementById('blog-list');
        var moreWrap = document.getElementById('blog-more-wrap');
        var showAllBtn = document.getElementById('blog-show-all');
        var limit = parseInt(grid.getAttribute('data-blog-limit'), 10) || PREVIEW_LIMIT;
        var showAllView = new URLSearchParams(window.location.search).get('view') === 'all';
        var allPosts = [];

        function renderGrid(posts) {
            grid.classList.remove('hidden');
            list.classList.add('hidden');
            grid.innerHTML = posts.slice(0, limit).map(buildPostGridItem).join('');
            applyBackgrounds(grid);
            bindPostLinks(grid);

            if (posts.length > limit && moreWrap) {
                moreWrap.classList.remove('hidden');
            } else if (moreWrap) {
                moreWrap.classList.add('hidden');
            }
        }

        function renderList(posts) {
            grid.classList.add('hidden');
            list.classList.remove('hidden');
            if (moreWrap) moreWrap.classList.add('hidden');
            list.innerHTML = posts.map(buildPostListItem).join('');
            applyBackgrounds(list);
            bindPostLinks(list);

            if (window.location.search.indexOf('view=all') === -1) {
                history.replaceState(null, '', '?view=all');
            }
        }

        fetch('/api/posts')
            .then(function (res) { return res.json(); })
            .then(function (posts) {
                allPosts = posts;
                if (showAllView || posts.length <= limit) {
                    if (showAllView) {
                        renderList(posts);
                    } else {
                        renderGrid(posts);
                    }
                } else {
                    renderGrid(posts);
                }
            })
            .catch(function () {
                grid.innerHTML = '<div class="col-12"><p>Blog yazıları yüklenemedi.</p></div>';
            });

        if (showAllBtn) {
            showAllBtn.addEventListener('click', function (e) {
                e.preventDefault();
                renderList(allPosts);
                list.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    });
})();
