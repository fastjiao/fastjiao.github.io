/* ===== SPA 路由器（视图动态注入）=====
 * 拦截导航点击 → fetch 目标页面 HTML → DOMParser 解析 → 剥离壳元素
 * （导航栏/背景）→ 路径修正 → 注入 #view 容器 → 执行视图脚本 → 过渡动画。
 *
 * 路径修正：以目标页面 URL 为基准，把片段内相对 src/href resolve 成绝对路径，
 *           站内页面链接转回 hash 路由（反查表）。
 * CSS 管理：页面特有 <style>/<link> 注入 head 并标记 data-view-style，切换时清理上一页。
 * JS 管理：页面特有脚本重新执行；公共脚本（bg-particles/shared_nav/router）跳过。
 *
 * 已知限制（阶段3 统一处理）：页面特有脚本的全局副作用（如 mousemove 监听器）
 *           未自动清理。轻量页因元素已从 DOM 移除，无视觉影响，仅微小内存泄漏。
 *           重交互页（web_ku）需自带 mount/unmount 钩子。
 */
(function () {
    // 路由表：hash → { url, title }
    var ROUTES = {
        '#/':               { url: 'index.html',                   title: 'Lovejiao' },
        '#/web_ku':         { url: 'pages/web_ku/web_ku.html',     title: '网页库' },
        '#/project':        { url: 'pages/project.html',           title: '我的项目' },
        '#/about':          { url: 'pages/about.html',             title: '关于我' },
        '#/admin':          { url: 'pages/admin.html',             title: '登录' },
        '#/myplace':        { url: 'pages/myplace.html',           title: '我的空间' },
        '#/photo_manage':   { url: 'pages/photo_manage.html',      title: '管理平台' },
        '#/watermark':      { url: 'pages/watermark_tool.html',    title: '图片加水印工具' },
        '#/contact/weixin': { url: 'pages/contact/contact_weixin.html', title: '微信' },
        '#/contact/qq':     { url: 'pages/contact/contact_qq.html',     title: 'QQ' },
        '#/contact/xhs':    { url: 'pages/contact/contact_xhs.html',    title: '小红书' },
        '#/contact/dy':     { url: 'pages/contact/contact_dy.html',     title: '抖音' }
    };

    // 全部路由已接入 SPA
    var ENABLED = {
        '#/': true, '#/web_ku': true, '#/project': true, '#/about': true, '#/admin': true,
        '#/myplace': true, '#/photo_manage': true, '#/watermark': true,
        '#/contact/weixin': true, '#/contact/qq': true, '#/contact/xhs': true, '#/contact/dy': true
    };

    // url → hash 反查表：把片段内站内链接转回 hash 路由
    var URL_TO_HASH = {};
    Object.keys(ROUTES).forEach(function (h) { URL_TO_HASH[ROUTES[h].url] = h; });

    // 壳已加载的公共脚本（按文件名匹配），提取时跳过避免重复执行
    var SHARED_SCRIPTS = ['bg-particles.js', 'shared_nav.js', 'router.js'];
    // 壳已加载的公共 CSS（按文件名匹配），提取时跳过
    var SHARED_CSS = ['shared_theme.css'];
    // 剥离选择器：这些元素壳里已有，从片段中移除
    var STRIP_SELECTORS = ['.bg-aurora', '.bg-particles', '.site-header']; // web_ku 保留自带 navbar，由 body.view-webku 隐藏壳导航栏

    var view = document.getElementById('view');
    var head = document.head;
    var fragmentCache = {};   // url → 解析后的片段
    var isLoading = false;    // 防重入
    var isFirst = true;       // 首次渲染无淡出动画
    var executedSrc = {};     // 已执行的 src 脚本（避免 photo-manager.js 顶层 const 重复声明）

    // 判断属性值是否为需跳过 resolve 的协议（外链/锚点/data URI）
    function isExternal(v) {
        return !v || /^(data:|https?:|mailto:|tel:|javascript:|#)/.test(v);
    }

    // 解析并缓存页面片段
    function loadFragment(url) {
        if (fragmentCache[url]) return Promise.resolve(fragmentCache[url]);
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('加载失败: ' + url + ' (' + r.status + ')');
            return r.text();
        }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var baseUrl = new URL(url, location.href);

            // 1) 剥离壳元素
            STRIP_SELECTORS.forEach(function (sel) {
                doc.querySelectorAll(sel).forEach(function (el) { el.remove(); });
            });

            // 2) 提取 head 样式：内联 <style> 与 <link rel=stylesheet>（公共 CSS 跳过）
            var styles = [];
            doc.querySelectorAll('head style').forEach(function (s) {
                if (s.textContent.trim()) styles.push({ type: 'inline', css: s.textContent });
            });
            doc.querySelectorAll('head link[rel="stylesheet"]').forEach(function (l) {
                var href = l.getAttribute('href');
                var name = (href || '').split('/').pop();
                if (SHARED_CSS.indexOf(name) !== -1) return;       // 公共跳过
                styles.push({ type: 'link', href: new URL(href, baseUrl).href });
            });

            // 3) 提取脚本：head + body 的 <script>，公共脚本跳过
            var scripts = [];
            function collectScript(s) {
                var src = s.getAttribute('src');
                if (src) {
                    var name = src.split('/').pop();
                    if (SHARED_SCRIPTS.indexOf(name) !== -1) return; // 公共跳过
                    scripts.push({ type: 'src', content: new URL(src, baseUrl).href });
                } else if (s.textContent.trim()) {
                    scripts.push({ type: 'inline', content: s.textContent });
                }
            }
            doc.querySelectorAll('head script').forEach(collectScript);
            doc.querySelectorAll('body script').forEach(collectScript);

            // 4) 主体内容：body 剩余子节点迁移到片段
            var frag = document.createDocumentFragment();
            while (doc.body.firstChild) frag.appendChild(doc.body.firstChild);

            // 5) 路径修正：片段内相对 src/href resolve 成绝对路径；站内链接转 hash
            frag.querySelectorAll('[src],[href]').forEach(function (el) {
                if (el.hasAttribute('src') && !isExternal(el.getAttribute('src'))) {
                    el.setAttribute('src', new URL(el.getAttribute('src'), baseUrl).href);
                }
                if (el.hasAttribute('href') && !isExternal(el.getAttribute('href'))) {
                    var h = el.getAttribute('href');
                    var abs = new URL(h, baseUrl).href;
                    var rel = abs.replace(location.origin + '/', '');
                    if (URL_TO_HASH[rel]) {
                        // 站内页面：转 hash 路由
                        el.setAttribute('data-route', URL_TO_HASH[rel]);
                        el.setAttribute('href', URL_TO_HASH[rel]);
                    } else {
                        el.setAttribute('href', abs);
                    }
                }
            });

            fragmentCache[url] = { frag: frag, styles: styles, scripts: scripts, title: doc.title, baseUrl: baseUrl.href };
            return fragmentCache[url];
        });
    }

    // 清理上一页注入的样式与脚本标签（不撤销已执行副作用，见文件头已知限制）
    function clearInjected() {
        head.querySelectorAll('style[data-view-style],link[data-view-style],script[data-view-script]').forEach(function (n) { n.remove(); });
    }

    // 注入当前页样式
    function injectStyles(styles) {
        styles.forEach(function (s) {
            var node;
            if (s.type === 'inline') {
                node = document.createElement('style');
                node.textContent = s.css;
            } else {
                node = document.createElement('link');
                node.rel = 'stylesheet';
                node.href = s.href;
            }
            node.setAttribute('data-view-style', '');
            head.appendChild(node);
        });
    }

    // 执行视图脚本：先加载所有 src 脚本（保证依赖顺序，如 photo-manager.js 先于使用它的 inline），
    // 再执行 inline 脚本（包 IIFE，顶层 const/let/function 变局部避免重复声明）
    function runScripts(scripts) {
        var srcs = scripts.filter(function (s) { return s.type === 'src' && !executedSrc[s.content]; });
        var inlines = scripts.filter(function (s) { return s.type === 'inline'; });
        return Promise.all(srcs.map(function (s) {
            return new Promise(function (resolve) {
                executedSrc[s.content] = true;
                var node = document.createElement('script');
                node.src = s.content;
                node.onload = node.onerror = resolve; // 加载完成或失败都继续
                node.setAttribute('data-view-script', '');
                head.appendChild(node);
            });
        })).then(function () {
            inlines.forEach(function (s) {
                var node = document.createElement('script');
                node.textContent = '(function(){\n' + s.content + '\n})();';
                node.setAttribute('data-view-script', '');
                head.appendChild(node);
            });
        });
    }

    // 高亮当前导航项
    function updateActive(hash) {
        document.querySelectorAll('.nav-links .nav-link').forEach(function (el) {
            el.classList.toggle('active', el.getAttribute('data-route') === hash);
        });
    }

    // 切换视图
    function render(hash) {
        if (isLoading) return;
        var route = ROUTES[hash];
        if (!route) { view.innerHTML = '<p style="padding:60px;text-align:center;color:var(--text-secondary)">页面不存在</p>'; return; }
        // 未接入 SPA 的路由：fallback 整页跳转（阶段2 全量接入后移除此分支）
        if (!ENABLED[hash]) { location.href = route.url; return; }

        isLoading = true;
        // web_ku 视图保留自带导航栏，隐藏壳导航栏
        document.body.classList.toggle('view-webku', hash === '#/web_ku');
        function doRender() {
            // 清理上一页注册的副作用（如 web_ku 的 document 监听器）
            if (window.__viewCleanups && window.__viewCleanups.length) {
                window.__viewCleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
                window.__viewCleanups = [];
            }
            clearInjected();
            view.innerHTML = '';
            loadFragment(route.url).then(function (f) {
                injectStyles(f.styles);
                document.title = f.title || route.title;
                window.__VIEW_BASE__ = f.baseUrl; // 供视图脚本解析相对路径（如动态加载库）
                // cloneNode(true)：缓存片段可复用，避免 appendChild 抽空
                view.appendChild(f.frag.cloneNode(true));
                runScripts(f.scripts).then(function () {
                    view.classList.remove('leaving');
                    updateActive(hash);
                    window.scrollTo(0, 0);
                    isLoading = false;
                });
            }).catch(function (err) {
                console.error(err);
                view.innerHTML = '<p style="padding:60px;text-align:center;color:var(--text-secondary)">加载失败：' + err.message + '</p>';
                view.classList.remove('leaving');
                isLoading = false;
            });
        }
        // 首次渲染无淡出；之后先淡出再替换
        if (isFirst) { isFirst = false; doRender(); }
        else { view.classList.add('leaving'); setTimeout(doRender, 180); }
    }

    // 事件委托：拦截带 data-route 的链接点击
    document.addEventListener('click', function (e) {
        var a = e.target.closest('a');
        if (!a || a.target === '_blank') return;
        var route = a.getAttribute('data-route');
        if (!route) return;
        e.preventDefault();
        if (location.hash !== route) location.hash = route;
        else render(route);
    });

    // hash 变化触发渲染
    window.addEventListener('hashchange', function () { render(location.hash || '#/'); });

    // 初始渲染：无 hash 默认首页 #/
    render(location.hash || '#/');
})();
