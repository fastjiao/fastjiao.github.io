/* ===== 主导航"联系我"交互 =====
 * hover 展开，离开 250ms 收回；
 * click 锁定展开（离开不收回），点击菜单外区域立即收回；
 * 渐入渐出由 CSS transition 处理。
 */
(function () {
    var items = document.querySelectorAll('.nav-links .nav-item');
    var CLOSE_DELAY = 250;

    items.forEach(function (item) {
        var menu = item.querySelector('.dropdown-menu');
        if (!menu) return;
        item._closeTimer = null;
        item._locked = false;

        function open() {
            if (item._closeTimer) { clearTimeout(item._closeTimer); item._closeTimer = null; }
            item.classList.add('open');
        }

        function scheduleClose() {
            if (item._locked) return;
            if (item._closeTimer) clearTimeout(item._closeTimer);
            item._closeTimer = setTimeout(function () {
                item.classList.remove('open');
                item._closeTimer = null;
            }, CLOSE_DELAY);
        }

        item.addEventListener('mouseenter', open);
        item.addEventListener('mouseleave', scheduleClose);

        item.addEventListener('click', function (e) {
            if (menu.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            if (item._locked) {
                item._locked = false;
                item.classList.remove('open');
            } else {
                item._locked = true;
                open();
            }
        });
    });

    document.addEventListener('click', function (e) {
        items.forEach(function (item) {
            if (item.classList.contains('open') && !item.contains(e.target)) {
                item.classList.remove('open');
                item._locked = false;
            }
        });
    });
})();
