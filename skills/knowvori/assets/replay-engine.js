/**
 * knowvori · 自动回放引擎
 *
 * 这不是视频。它把「标准操作」照着做一遍：拖真的滑块、按真的按钮，
 * 数字仍然是页面自己算的。所以演示永远不会和真操作脱节。
 *
 * ── 为什么内联 ────────────────────────────────────────────────
 * 课程是单文件交付，不能 import。这段代码要原样拷进每个课程的
 * script 里。validate-lesson.mjs 第 19 项会检查各课程的
 * `KVReplay ▸ v1` 标记是否一致，改这里就要同步到那 7 个文件。
 *
 * ── 平滑是怎么做到的 ──────────────────────────────────────────
 * 回放不直接给 input.value 赋值，而是每帧写一点、每帧派发 input
 * 事件，页面自己会跟着重算重绘。这样拖动是连续的，不是跳变。
 * 缓动用 easeInOutCubic，起步和收尾都软。
 */

window.KVReplay = (function () {
  'use strict';

  // 系统设了「减少动态效果」时，不粗暴跳变，只是把时长压到 1/3
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = reduce ? 0.34 : 1;

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function raf(fn) { return window.requestAnimationFrame(fn); }
  function caf(id) { window.cancelAnimationFrame(id); }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function pick(sel) {
    return typeof sel === 'string' ? document.querySelector(sel) : sel;
  }

  function create(opt) {
    var root = opt.root;
    if (!root) return null;

    var btn = root.querySelector('[data-replay-btn]');
    var note = root.querySelector('[data-replay-note]');
    var bar = root.querySelector('[data-replay-bar]');
    var fill = bar && bar.firstElementChild;
    var steps = opt.steps || [];
    var cancels = [];          // 正在跑的所有缓动，暂停时全部掐断
    var running = false;
    var stopped = false;
    var at = 0;

    function abortAll() {
      while (cancels.length) {
        try { cancels.pop()(); } catch (e) { /* 已经结束的忽略 */ }
      }
    }

    function say(t) { if (note && t) note.textContent = t; }

    function progress() {
      if (!fill) return;
      fill.style.width = Math.round((at / Math.max(1, steps.length)) * 100) + '%';
    }

    function wait(ms) {
      return new Promise(function (done) {
        var id = setTimeout(done, Math.max(0, ms * SPEED));
        cancels.push(function () { clearTimeout(id); done(); });
      });
    }

    /** 逐帧回调。fn(缓动后的进度, 线性进度) */
    function tween(ms, fn) {
      var dur = Math.max(1, ms * SPEED);
      var t0 = null, id = 0, dead = false;
      return new Promise(function (done) {
        function tick(ts) {
          if (dead) return done();
          if (t0 === null) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur);
          try { fn(ease(p), p); } catch (e) { dead = true; return done(); }
          if (p < 1) id = raf(tick); else done();
        }
        id = raf(tick);
        cancels.push(function () { dead = true; caf(id); done(); });
      });
    }

    /**
     * 平滑拖动滑块 / 写值。
     * 每帧都派发 input，页面才会跟着重算 —— 少了这一步，动画在跑，
     * 但页面纹丝不动（这是最典型的「录出来是一张静止图」的原因）。
     */
    function slide(sel, to, ms) {
      var el = pick(sel);
      if (!el) return Promise.resolve();
      var from = Number(el.value);
      to = Number(to);
      if (!isFinite(to) || from === to) return Promise.resolve();
      return tween(ms == null ? 620 : ms, function (e) {
        el.value = String(from + (to - from) * e);
        fire(el, 'input');
      }).then(function () {
        el.value = String(to);
        fire(el, 'input');
        fire(el, 'change');
      });
    }

    function click(sel) {
      var el = pick(sel);
      if (el) el.click();
    }

    function stop(msg) {
      running = false;
      stopped = true;
      abortAll();
      if (btn) {
        btn.textContent = '▶ ' + (opt.label || '看一遍演示');
        btn.setAttribute('aria-pressed', 'false');
      }
      if (fill) fill.style.width = '0%';
      if (msg) say(msg);
    }

    var api = {
      say: say, wait: wait, tween: tween, slide: slide, click: click,
      el: pick, fire: fire,
      /** 逐帧打字，让文字是「写出来」的而不是整段蹦出来 */
      type: function (sel, text, ms) {
        var el = pick(sel);
        if (!el) return Promise.resolve();
        var base = el.value || '';
        var n = text.length;
        return tween(ms == null ? 1200 : ms, function (e) {
          el.value = base + text.slice(0, Math.round(n * e));
          fire(el, 'input');
        }).then(function () {
          el.value = base + text;
          fire(el, 'input');
        });
      },
      /** 读二元查找那类页面的当前状态，供文案使用（页面没有该结构时返回空串） */
      state: function () {
        if (typeof opt.state === 'function') return opt.state();
        return '';
      },
      setNow: function (sel, v) {
        var el = pick(sel);
        if (!el) return;
        el.value = String(v);
        fire(el, 'input');
        fire(el, 'change');
      }
    };

    async function run() {
      for (at = 0; at < steps.length; at++) {
        if (stopped) return;
        progress();
        try {
          await steps[at](api);
        } catch (e) {
          stop('演示中断：' + e.message);
          return;
        }
      }
      if (stopped) return;
      // 最后一步的旁白要留得住。直接 stop() 会用结束语把它盖掉，
      // 用户几乎看不到那句收尾的话（最该读的往往就是它）。
      await wait(1600);
      if (stopped) return;
      stop(opt.done || '演示结束。现在轮到你动手了 —— 同样的操作，数字一样是现算的。');
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (running) { stop('已暂停。再点一次从头演示。'); return; }
        running = true;
        stopped = false;
        at = 0;
        if (fill) fill.style.width = '0%';
        btn.textContent = '⏸ 暂停';
        btn.setAttribute('aria-pressed', 'true');
        if (opt.onStart) opt.onStart();
        run();
      });
    }

    // 用户一动手，立刻交还控制权。演示不该跟用户抢方向盘。
    //
    // 必须挂在 document 上，不能挂 root：用户真正会去碰的是下面那块
    // 画布 / 滑块，它们不在 .replay 里，事件冒不到 root —— 挂在 root
    // 上等于「只有点演示条本身才会停」，用户一动控制权纹丝不动。
    document.addEventListener('pointerdown', function (e) {
      // 点按钮本身是「暂停」，不算接管
      if (btn && btn.contains(e.target)) return;
      if (running) stop('你接手了，演示停在这一步。');
    }, true);

    document.addEventListener('keydown', function (e) {
      // 按钮获得焦点时，空格 / 回车是它自己的暂停键，不算接管；
      // 但方向键、字母键等一律算用户插手 —— 否则「用键盘动滑块」就停不下来。
      if (btn && btn.contains(e.target) && (e.key === ' ' || e.key === 'Enter')) return;
      if (running) stop('你接手了，演示停在这一步。');
    }, true);

    return api;
  }

  return { create: create, reduce: reduce };
})();
