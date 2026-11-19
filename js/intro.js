/* =========================================================
   我的旅行足迹 · 开场加载
   全屏开场动画：标题浮现、航线绘制、数据就绪后退场。
   对外接口：window.TravelIntro.ready(stats)
   ========================================================= */
(function () {
  'use strict';

  var INTRO_KEY = 'travel-intro-seen';
  var MIN_TIME = 2500;   // 至少停留多久再开始收尾
  var FINISH_MS = 480;   // 92% → 100% 的收尾时长
  var HOLD_MS = 750;     // 到达 100% 后停留多久再退场
  var MAX_TIME = 8000;   // 数据迟迟不就绪时的兜底退场时间
  var BASE_PROGRESS = 0.92;

  var intro = document.getElementById('intro');
  if (!intro) return;

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (document.documentElement.classList.contains('no-intro') || reduceMotion || window.TravelIntro) {
    if (intro.parentNode) intro.parentNode.removeChild(intro);
    return;
  }

  var title = document.getElementById('intro-title');
  var routeLine = document.getElementById('intro-route-line');
  var routeDest = document.getElementById('intro-route-dest');
  var plane = document.getElementById('intro-plane');
  var bar = document.getElementById('intro-bar');
  var barFill = document.getElementById('intro-bar-fill');
  var percentEl = document.getElementById('intro-percent');
  var phaseEl = document.getElementById('intro-phase');
  var statsEl = document.getElementById('intro-stats');
  var statCities = document.getElementById('intro-stat-cities');
  var statCountries = document.getElementById('intro-stat-countries');
  var statKm = document.getElementById('intro-stat-km');
  var skipBtn = document.getElementById('intro-skip');

  var lockedEls = Array.prototype.slice.call(
    document.querySelectorAll('.page, .detail, .lightbox')
  );
  var start = performance.now();
  var progress = 0;
  var lastPct = -1;
  var lastPhase = '';
  var ready = false;
  var readyStats = null;
  var finishStart = null;
  var statsStart = null;
  var statsShown = false;
  var dismissQueued = false;
  var finished = false;
  var rafId = 0;
  var maxTimer = 0;
  var routeLength = 0;

  splitTitle();
  prepareRoute();
  lockPage(true);
  bindSkip();

  window.TravelIntro = {
    ready: function (stats) {
      if (finished) return;
      ready = true;
      readyStats = stats || null;
    }
  };

  maxTimer = window.setTimeout(function () {
    if (!finished) dismiss();
  }, MAX_TIME);

  rafId = window.requestAnimationFrame(tick);

  /* ---------------- 初始化 ---------------- */

  function splitTitle() {
    if (!title) return;
    var text = (title.textContent || '').trim();
    if (!text) return;
    title.textContent = '';
    title.setAttribute('aria-label', text);
    Array.prototype.forEach.call(text, function (ch, i) {
      var span = document.createElement('span');
      span.className = 'intro-char';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.animationDelay = (0.2 + i * 0.075).toFixed(3) + 's';
      title.appendChild(span);
    });
  }

  function prepareRoute() {
    if (!routeLine || typeof routeLine.getTotalLength !== 'function') return;
    routeLength = routeLine.getTotalLength();
    movePlane(0);
  }

  function lockPage(locked) {
    lockedEls.forEach(function (el) {
      if (locked) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    });
  }

  function bindSkip() {
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        dismiss();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !finished) dismiss();
    });
  }

  /* ---------------- 动画循环 ---------------- */

  function tick(now) {
    if (finished) return;

    var elapsed = now - start;
    var p;

    if (ready && elapsed >= MIN_TIME) {
      if (finishStart === null) finishStart = now;
      var ft = Math.min((now - finishStart) / FINISH_MS, 1);
      p = BASE_PROGRESS + (1 - BASE_PROGRESS) * easeOutCubic(ft);
      if (ft >= 1) p = 1;
    } else {
      // 数据未就绪时停在 92%，等应用发出 ready 后再收尾
      p = BASE_PROGRESS * easeOutCubic(Math.min(elapsed / 2100, 1));
      p = Math.min(p, BASE_PROGRESS);
    }

    progress = Math.max(progress, p);
    update(progress, now);

    if (progress >= 1 && !dismissQueued) {
      dismissQueued = true;
      window.setTimeout(dismiss, HOLD_MS);
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function update(p, now) {
    var pct = Math.round(p * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      if (percentEl) percentEl.textContent = pct + '%';
      if (bar) {
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuetext', phaseFor(p) + ' ' + pct + '%');
      }
    }

    if (barFill) barFill.style.width = (p * 100).toFixed(2) + '%';
    if (routeLine) routeLine.style.strokeDashoffset = String(1 - p);
    movePlane(p);

    var phase = phaseFor(p);
    if (phase !== lastPhase) {
      lastPhase = phase;
      if (phaseEl) phaseEl.textContent = phase;
    }

    if (p >= 1 && routeDest) routeDest.classList.add('is-arrived');

    if (finishStart !== null && !statsShown && readyStats && now - finishStart >= 140) {
      statsShown = true;
      statsStart = now;
      if (statsEl) statsEl.classList.add('is-visible');
    }

    if (statsShown && readyStats) countStats(now);
  }

  function countStats(now) {
    var t = Math.min((now - statsStart) / 650, 1);
    var e = easeOutCubic(t);
    var cities = Math.round((Number(readyStats.cities) || 0) * e);
    var countries = Math.round((Number(readyStats.countries) || 0) * e);
    var km = Math.round((Number(readyStats.km) || 0) * e);
    if (statCities) statCities.textContent = String(cities);
    if (statCountries) statCountries.textContent = String(countries);
    if (statKm) statKm.textContent = km.toLocaleString('en-US');
  }

  function movePlane(p) {
    if (!plane || !routeLine || !routeLength) return;
    var pos = routeLength * p;
    var point = routeLine.getPointAtLength(pos);
    var ahead = routeLine.getPointAtLength(Math.min(pos + 2, routeLength));
    var angle;

    if (ahead.x === point.x && ahead.y === point.y) {
      var before = routeLine.getPointAtLength(Math.max(pos - 2, 0));
      angle = Math.atan2(point.y - before.y, point.x - before.x);
    } else {
      angle = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    }

    plane.setAttribute(
      'transform',
      'translate(' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ') rotate(' + (angle * 180 / Math.PI).toFixed(1) + ')'
    );
  }

  function phaseFor(p) {
    if (p >= 0.99) return '旅途开始';
    if (p >= 0.7) return '正在标记足迹';
    if (p >= 0.35) return '正在展开地图';
    return '正在收拾行李';
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* ---------------- 退场 ---------------- */

  function dismiss() {
    if (finished) return;
    finished = true;

    window.cancelAnimationFrame(rafId);
    window.clearTimeout(maxTimer);

    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch (err) {}

    // 收尾时把剩余进度直接补满，避免跳变
    update(1, performance.now());

    intro.classList.add('intro--leave');
    document.body.classList.add('page-reveal');
    lockPage(false);

    if (skipBtn && document.activeElement === skipBtn) {
      try { skipBtn.blur(); } catch (err) {}
    }

    focusOpenDialog();

    window.setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    }, 1100);
  }

  function focusOpenDialog() {
    var target =
      document.querySelector('#detail:not([hidden]) #detail-close') ||
      document.querySelector('#lightbox:not([hidden]) #lightbox-close');
    if (!target) return;
    window.requestAnimationFrame(function () {
      try {
        target.focus({ preventScroll: true });
      } catch (err) {
        try { target.focus(); } catch (err2) {}
      }
    });
  }
})();
