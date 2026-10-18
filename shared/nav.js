/* ===== 全站共享外壳脚本：自动注入背景层 + 统一导航栏 + 粒子动画 =====
 * 各普通页面只需引入本脚本（defer）与 shared_shell.css，即可获得与主页一致的背景和导航栏。
 * 导航栏顺序：首页 → 网页库 → 我的项目 → 教公台 → 添加水印工具 → 联系我(下拉)
 */
(function () {
    // ===== 1. 计算当前页面相对根目录的深度，用于生成正确的相对链接 =====
    var path = location.pathname.replace(/\\/g, '/');
    var depth = 0;
    if (/\/pages\/contact\//.test(path)) depth = 2;
    else if (/\/pages\//.test(path)) depth = 1;
    var prefix = depth === 0 ? '' : (depth === 1 ? '../' : '../../');

    // ===== 2. 导航项定义（rootPath 为从站点根目录出发的路径） =====
    var navItems = [
        { key: 'index', label: '首页', rootPath: 'index.html' },
        { key: 'web_ku', label: '网页库', rootPath: 'pages/web_ku/web_ku.html' },
        { key: 'project', label: '我的项目', rootPath: 'pages/project.html' },
        { key: 'jiaogt', label: '教公台', rootPath: 'jiaogt/jiaogt.html' },
        { key: 'watermark', label: '添加水印工具', rootPath: 'pages/watermark_tool.html' },
        {
            key: 'contact', label: '联系我', dropdown: [
                { label: '微信', rootPath: 'pages/contact/contact_weixin.html' },
                { label: 'QQ', rootPath: 'pages/contact/contact_qq.html' },
                { label: '小红书', rootPath: 'pages/contact/contact_xhs.html' },
                { label: '抖音', rootPath: 'pages/contact/contact_dy.html' }
            ]
        }
    ];

    // ===== 3. 判断当前页面属于哪个导航项（用于 active 高亮） =====
    var currentFile = path.split('/').pop() || 'index.html';
    function activeKey() {
        if (/^index\.html?$/.test(currentFile) || currentFile === '') return 'index';
        if (currentFile.indexOf('web_ku') === 0) return 'web_ku';
        if (currentFile.indexOf('project') === 0) return 'project';
        if (currentFile.indexOf('jiaogt') === 0) return 'jiaogt';
        if (currentFile.indexOf('watermark') === 0) return 'watermark';
        if (currentFile.indexOf('contact') === 0) return 'contact';
        return '';
    }
    var active = activeKey();

    // ===== 4. 注入背景层（若页面未提供） =====
    if (!document.querySelector('.bg-aurora')) {
        var aurora = document.createElement('div');
        aurora.className = 'bg-aurora';
        aurora.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(aurora, document.body.firstChild);
    }
    if (!document.querySelector('.bg-particles')) {
        var cv = document.createElement('canvas');
        cv.className = 'bg-particles';
        cv.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(cv, document.body.firstChild);
    }

    // ===== 5. 构建并注入导航栏（若页面未提供 site-header） =====
    if (!document.querySelector('.site-header')) {
        var header = document.createElement('header');
        header.className = 'site-header';
        header.setAttribute('role', 'banner');
        var container = document.createElement('div');
        container.className = 'container';

        var brand = document.createElement('a');
        brand.href = 'https://www.ljiao.me';
        brand.className = 'brand';
        brand.target = '_blank';
        brand.rel = 'noopener noreferrer';
        brand.textContent = 'www.ljiao.me';
        container.appendChild(brand);

        var nav = document.createElement('nav');
        nav.className = 'nav-links';
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', '主导航');

        navItems.forEach(function (item) {
            if (item.dropdown) {
                var wrap = document.createElement('div');
                wrap.className = 'nav-item nav-link' + (active === item.key ? ' active' : '');
                wrap.textContent = item.label;
                var ul = document.createElement('ul');
                ul.className = 'dropdown-menu';
                ul.setAttribute('aria-label', item.label + '下拉菜单');
                item.dropdown.forEach(function (sub) {
                    var li = document.createElement('li');
                    var a = document.createElement('a');
                    a.href = prefix + sub.rootPath;
                    a.textContent = sub.label;
                    li.appendChild(a);
                    ul.appendChild(li);
                });
                wrap.appendChild(ul);
                nav.appendChild(wrap);
            } else {
                var a = document.createElement('a');
                a.href = prefix + item.rootPath;
                a.className = 'nav-link' + (active === item.key ? ' active' : '');
                a.textContent = item.label;
                nav.appendChild(a);
            }
        });

        container.appendChild(nav);
        header.appendChild(container);
        // 导航栏插入到背景层之后、其他内容之前
        var firstContent = null;
        var bgAurora = document.querySelector('.bg-aurora');
        var bgParticles = document.querySelector('.bg-particles');
        if (bgParticles && bgParticles.nextSibling) {
            firstContent = bgParticles.nextSibling;
        } else if (bgAurora && bgAurora.nextSibling) {
            firstContent = bgAurora.nextSibling;
        }
        if (firstContent) {
            document.body.insertBefore(header, firstContent);
        } else {
            document.body.insertBefore(header, document.body.firstChild);
        }
    }

    // ===== 6. 启动背景星尘粒子动画（与 index.html 一致） =====
    (function () {
        var cv = document.querySelector('.bg-particles');
        if (!cv) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var ctx = cv.getContext('2d');
        var particles = [];
        var W = 0, H = 0;
        var mx = -9999, my = -9999;
        var raf = null;
        var last = 0;
        var COLORS = ['99,102,241', '168,85,247', '14,165,233', '255,255,255'];

        function count() { return Math.min(35, Math.max(15, Math.floor(W * H / 50000))); }
        function resize() {
            W = window.innerWidth; H = window.innerHeight;
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.width = W * dpr; cv.height = H * dpr;
            cv.style.width = W + 'px'; cv.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            spawn();
        }
        function spawn() {
            var n = count(); particles = [];
            for (var i = 0; i < n; i++) {
                particles.push({
                    x: Math.random() * W, y: Math.random() * H,
                    r: 0.5 + Math.random() * 1.6,
                    vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
                    a: 0.12 + Math.random() * 0.42,
                    c: COLORS[Math.floor(Math.random() * COLORS.length)],
                    tw: Math.random() * Math.PI * 2
                });
            }
        }
        function tick(t) {
            var dt = Math.min(50, t - last); last = t;
            ctx.clearRect(0, 0, W, H);
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16);
                var dx = p.x - mx, dy = p.y - my;
                var dist2 = dx * dx + dy * dy;
                if (dist2 < 10000) {
                    var d = Math.sqrt(dist2) || 1;
                    p.x += (dx / d) * 0.5 * (1 - d / 100) * (dt / 16);
                    p.y += (dy / d) * 0.5 * (1 - d / 100) * (dt / 16);
                }
                if (p.x < -10) p.x = W + 10;
                if (p.x > W + 10) p.x = -10;
                if (p.y < -10) p.y = H + 10;
                if (p.y > H + 10) p.y = -10;
                p.tw += 0.02 * (dt / 16);
                var alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + p.c + ',' + alpha.toFixed(3) + ')';
                ctx.fill();
            }
            raf = requestAnimationFrame(tick);
        }
        function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
        function resume() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
        document.addEventListener('visibilitychange', function () { document.hidden ? pause() : resume(); });
        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
        resize();
        resume();
    })();
})();
