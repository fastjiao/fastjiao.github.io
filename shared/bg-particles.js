/* ===== 全站共享背景粒子系统 =====
 * 从 index.html 抽取，供所有引用 shared_theme.css 的页面使用。
 * 自动查找 .bg-particles canvas 并启动星尘动效，随鼠标轻微扰动。
 * 页面不可见时暂停动画省电；尊重 prefers-reduced-motion。
 */
(function () {
    const cv = document.querySelector('.bg-particles');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let particles = [];
    let W = 0, H = 0;
    let mx = -9999, my = -9999;
    let raf = null;
    let last = 0;
    const COLORS = ['99,102,241', '168,85,247', '14,165,233', '255,255,255'];

    function count() {
        return Math.min(35, Math.max(15, Math.floor(W * H / 50000)));
    }

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = W * dpr;
        cv.height = H * dpr;
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        spawn();
    }

    function spawn() {
        const n = count();
        particles = [];
        for (let i = 0; i < n; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 0.5 + Math.random() * 1.6,
                vx: (Math.random() - 0.5) * 0.16,
                vy: (Math.random() - 0.5) * 0.16,
                a: 0.12 + Math.random() * 0.42,
                c: COLORS[Math.floor(Math.random() * COLORS.length)],
                tw: Math.random() * Math.PI * 2
            });
        }
    }

    function tick(t) {
        const dt = Math.min(50, t - last);
        last = t;
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx * (dt / 16);
            p.y += p.vy * (dt / 16);
            const dx = p.x - mx, dy = p.y - my;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < 10000) {
                const d = Math.sqrt(dist2) || 1;
                p.x += (dx / d) * 0.5 * (1 - d / 100) * (dt / 16);
                p.y += (dy / d) * 0.5 * (1 - d / 100) * (dt / 16);
            }
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;
            p.tw += 0.02 * (dt / 16);
            const alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + p.c + ',' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
        raf = requestAnimationFrame(tick);
    }

    function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    function resume() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    document.addEventListener('visibilitychange', function () {
        document.hidden ? pause() : resume();
    });

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', function (e) {
        mx = e.clientX;
        my = e.clientY;
    });

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    resize();
    resume();
})();
