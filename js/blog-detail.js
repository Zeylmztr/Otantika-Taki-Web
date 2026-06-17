(function () {
    'use strict';

    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    }

    document.addEventListener('DOMContentLoaded', function () {
        var id = getParam('id');
        if (!id) return;

        fetch('/api/posts/' + encodeURIComponent(id))
            .then(function (res) {
                if (!res.ok) throw new Error('not found');
                return res.json();
            })
            .then(function (post) {
                document.title = post.title + ' | Otantika Takı';

                var title = document.getElementById('post-title');
                if (title) title.textContent = post.title;

                var breadcrumb = document.getElementById('post-breadcrumb-title');
                if (breadcrumb) breadcrumb.textContent = post.title;

                var author = document.getElementById('post-author');
                if (author) author.textContent = post.author || 'Otantika Takı';

                var date = document.getElementById('post-date');
                if (date) date.textContent = formatDate(post.date);

                var image = document.getElementById('post-image');
                if (image) {
                    image.src = post.image;
                    image.alt = post.title;
                }

                var content = document.getElementById('post-content');
                if (content) {
                    var html = post.content || '<p>' + (post.excerpt || '') + '</p>';
                    if (post.excerpt && post.content) {
                        html = '<p class="blog__details__lead">' + post.excerpt + '</p>' + html;
                    }
                    content.innerHTML = html;
                }
            })
            .catch(function () {
                var title = document.getElementById('post-title');
                if (title) title.textContent = 'Yazı bulunamadı';
            });
    });
})();
