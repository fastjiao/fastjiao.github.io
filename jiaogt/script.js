/* ==========================================================
   教公台 · Jiao Workbench 发布页交互脚本
   功能：①明暗主题切换（最优先，绝对可靠）
        ②滚动进度条
        ③滚动入场动画
        ④粒子背景画布 + 鼠标跟随光晕（增强，失败不影响主体）
   说明：各模块用 try-catch 隔离，单项失败不会拖垮整页
   ========================================================== */

(function () {
  "use strict";

  const html = document.documentElement;
  const THEME_KEY = "jiao-theme";
  let particleRGB = [110, 150, 180]; // 提前声明，供颜色刷新共用

  /* 安全读写 localStorage（file:// 或禁用存储时可能抛错） */
  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* 忽略 */ }
  }

  /* 读取 CSS 变量，刷新粒子颜色（随主题联动） */
  function updateParticleColor() {
    try {
      const raw = getComputedStyle(html).getPropertyValue("--particle").trim();
      const parts = raw.split(",").map(function (n) {
        return parseInt(n.trim(), 10);
      });
      if (parts.length === 3 && !parts.some(isNaN)) {
        particleRGB = parts;
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- ① 明暗主题切换（核心，最先执行） ---------- */
  var theme = safeGet(THEME_KEY);
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  html.setAttribute("data-theme", theme);

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      safeSet(THEME_KEY, next);
      updateParticleColor();
    });
  }

  // 跟随系统主题变化（兼容 addEventListener / addListener）
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemTheme = function (e) {
      if (!safeGet(THEME_KEY)) {
        html.setAttribute("data-theme", e.matches ? "dark" : "light");
        updateParticleColor();
      }
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onSystemTheme);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(onSystemTheme);
    }
  } catch (e) { /* 忽略 */ }

  /* ---------- ② 滚动进度条 ---------- */
  try {
    var progress = document.getElementById("scrollProgress");
    if (progress) {
      var updateProgress = function () {
        var total =
          document.documentElement.scrollHeight - window.innerHeight;
        var ratio = total > 0 ? window.scrollY / total : 0;
        progress.style.width = ratio * 100 + "%";
      };
      window.addEventListener("scroll", updateProgress, { passive: true });
      updateProgress();
    }
  } catch (e) { /* 忽略 */ }

  /* ---------- ③ 滚动入场动画 ---------- */
  try {
    var revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealEls.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      // 不支持 IntersectionObserver 时直接全部显示
      revealEls.forEach(function (el) { el.classList.add("visible"); });
    }

    // 给功能卡片错开入场延迟，制造节奏
    document
      .querySelectorAll(".features-grid .feature-card")
      .forEach(function (el, i) {
        el.style.transitionDelay = (i % 3) * 0.08 + "s";
      });
  } catch (e) { /* 忽略 */ }

  /* ---------- ④ 粒子背景 + 鼠标跟随光晕（增强） ---------- */
  try {
    var canvas = document.getElementById("particles");
    var ctx = canvas.getContext("2d");
    var particles = [];
    var MOUSE = { x: -9999, y: -9999, radius: 140 };
    var LINK_DIST = 130;

    function resizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      var count = Math.min(90, Math.floor(window.innerWidth / 14));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 2.2 + 0.8
        });
      }
    }

    function drawParticles() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var a = particles[i];
          var b = particles[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            var alpha = (1 - dist / LINK_DIST) * 0.16;
            ctx.strokeStyle =
              "rgba(" + particleRGB[0] + "," + particleRGB[1] + "," +
              particleRGB[2] + "," + alpha + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (var k = 0; k < particles.length; k++) {
        var p = particles[k];
        var pdx = p.x - MOUSE.x;
        var pdy = p.y - MOUSE.y;
        var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < MOUSE.radius && pdist > 0) {
          var force = (MOUSE.radius - pdist) / MOUSE.radius;
          p.vx += (pdx / pdist) * force * 0.02;
          p.vy += (pdy / pdist) * force * 0.02;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.vx += (Math.random() - 0.5) * 0.008;
        p.vy += (Math.random() - 0.5) * 0.008;

        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;

        ctx.fillStyle =
          "rgba(" + particleRGB[0] + "," + particleRGB[1] + "," +
          particleRGB[2] + ",0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(drawParticles);
    }

    window.addEventListener("mousemove", function (e) {
      MOUSE.x = e.clientX;
      MOUSE.y = e.clientY;
    });
    window.addEventListener("mouseout", function () {
      MOUSE.x = -9999;
      MOUSE.y = -9999;
    });

    updateParticleColor();
    resizeCanvas();
    initParticles();
    drawParticles();

    window.addEventListener("resize", function () {
      resizeCanvas();
      initParticles();
    });
  } catch (e) { /* 粒子失败不影响页面 */ }

  /* ---------- ⑤ 鼠标跟随光晕（增强） ---------- */
  try {
    var glow = document.getElementById("cursorGlow");
    var glowX = 0, glowY = 0, targetX = 0, targetY = 0, glowOn = false;

    window.addEventListener("mousemove", function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!glowOn) {
        glow.style.opacity = "1";
        glowOn = true;
      }
    });
    window.addEventListener("mouseout", function () {
      glow.style.opacity = "0";
      glowOn = false;
    });

    (function animateGlow() {
      glowX += (targetX - glowX) * 0.12;
      glowY += (targetY - glowY) * 0.12;
      glow.style.transform = "translate(" + glowX + "px," + glowY + "px)";
      requestAnimationFrame(animateGlow);
    })();
  } catch (e) { /* 光晕失败不影响页面 */ }

  /* ---------- ⑥ 底部下载按钮：平滑返回顶部并高亮提示下载按钮 ---------- */
  try {
    var scrollBtn = document.getElementById("scroll-to-download");
    var heroBtn = document.getElementById("hero-download-btn");
    if (scrollBtn && heroBtn) {
      scrollBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        heroBtn.classList.remove("download-pulse");
        void heroBtn.offsetWidth; // 强制重排，确保动画可重新触发
        heroBtn.classList.add("download-pulse");
        setTimeout(function () {
          heroBtn.classList.remove("download-pulse");
        }, 2600);
      });
    }
  } catch (e) { /* 忽略 */ }
})();