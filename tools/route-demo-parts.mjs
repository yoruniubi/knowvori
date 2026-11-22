/* 示例路线的五个真算演示 + 自动回放脚本。
   演示都是真算：滑块一动就重算并重绘，不是预设动画。 */

export const DEMOS = {
  fit: {
    title: '拖动斜率，看误差怎么变',
    ctrl: `<label>斜率 k <input type="range" id="kSlider" min="-30" max="60" value="10" step="1"></label>
      <span class="val" id="kVal">1.0</span>
      <button class="btn-reset" id="resetBtn" type="button">重置</button>`,
    canvas: '<svg id="demoSvg" viewBox="0 0 340 190" width="100%" height="190" role="img" aria-label="散点与拟合直线"></svg>',
    out: '<div id="demoOut" class="out">［误差会画在这里］</div>',
  },
  gd: {
    title: '拖动学习率，看它怎么下山',
    ctrl: `<label>学习率 <input type="range" id="lrSlider" min="1" max="130" value="20" step="1"></label>
      <span class="val" id="lrVal">0.20</span>
      <button class="btn-reset" id="resetBtn" type="button">重置</button>`,
    canvas: '<svg id="demoSvg" viewBox="0 0 340 190" width="100%" height="190" role="img" aria-label="损失曲线与迭代点"></svg>',
    out: '<div id="demoOut" class="out">［迭代轨迹会画在这里］</div>',
  },
  lr: {
    title: '拖动学习率跨过临界点',
    ctrl: `<label>学习率 <input type="range" id="lrSlider" min="5" max="130" value="20" step="1"></label>
      <span class="val" id="lrVal">0.20</span>
      <button class="btn-reset" id="resetBtn" type="button">重置</button>`,
    canvas: '<svg id="demoSvg" viewBox="0 0 340 190" width="100%" height="190" role="img" aria-label="误差随迭代变化"></svg>',
    out: '<div id="demoOut" class="out">［每步误差会画在这里］</div>',
  },
  scale: {
    title: '拖动特征比例，看下降路径怎么变成锯齿',
    ctrl: `<label>特征 B 的量级 <input type="range" id="ratioSlider" min="1" max="100" value="10" step="1"></label>
      <span class="val" id="ratioVal">10×</span>
      <button class="btn-reset" id="resetBtn" type="button">重置</button>`,
    canvas: '<svg id="demoSvg" viewBox="0 0 340 190" width="100%" height="190" role="img" aria-label="等高线与下降路径"></svg>',
    out: '<div id="demoOut" class="out">［下降路径会画在这里］</div>',
  },
  overfit: {
    title: '拖动模型复杂度，看两条误差曲线分叉',
    ctrl: `<label>模型复杂度 <input type="range" id="cSlider" min="1" max="12" value="1" step="1"></label>
      <span class="val" id="cVal">1</span>
      <button class="btn-reset" id="resetBtn" type="button">重置</button>`,
    canvas: '<svg id="demoSvg" viewBox="0 0 340 190" width="100%" height="190" role="img" aria-label="训练与测试误差曲线"></svg>',
    out: '<div id="demoOut" class="out">［两条误差会画在这里］</div>',
  },
};

/* 每段代码都在页面里真跑：滑块一改就重算重绘。
   window.kvState() 供自动回放的旁白读取真实数值 —— 不背台词。 */
export const SCRIPTS = {
  fit: `
  var PTS = [[30,150],[75,128],[120,118],[170,92],[215,78],[265,48],[305,38]];
  var kEl = document.getElementById('kSlider'), kVal = document.getElementById('kVal');
  var out = document.getElementById('demoOut'), svg = document.getElementById('demoSvg');

  function fitCalc(k) {
    var mx = 0, my = 0;
    PTS.forEach(function (p) { mx += p[0]; my += (190 - p[1]); });
    mx /= PTS.length; my /= PTS.length;
    var slope = k / 10;
    var b = my - slope * mx;
    var err = 0;
    PTS.forEach(function (p) {
      var r = (190 - p[1]) - (slope * p[0] + b);
      err += r * r;
    });
    return { sse: err, slope: slope, b: b };
  }

  function draw() {
    var k = +kEl.value, m = fitCalc(k);
    kVal.textContent = m.slope.toFixed(1);
    var h = '';
    PTS.forEach(function (p) {
      var yhat = 190 - (m.slope * p[0] + m.b);
      h += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[0] + '" y2="' + yhat +
           '" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 2" opacity=".5"/>';
    });
    h += '<line x1="0" y1="' + (190 - m.b) + '" x2="340" y2="' + (190 - (m.slope * 340 + m.b)) +
         '" stroke="var(--ink)" stroke-width="2"/>';
    PTS.forEach(function (p) {
      h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="var(--ink)"/>';
    });
    svg.innerHTML = h;
    out.innerHTML = '斜率 <b>' + m.slope.toFixed(2) + '</b> · 平方误差和 <b>' + m.sse.toFixed(0) + '</b>';
    window.kvState = function () { return { sse: m.sse, slope: m.slope }; };
  }

  kEl.addEventListener('input', draw);
  document.getElementById('resetBtn').addEventListener('click', function () { kEl.value = 10; draw(); });
  draw();
`,
  gd: `
  var lrEl = document.getElementById('lrSlider'), lrVal = document.getElementById('lrVal');
  var out = document.getElementById('demoOut'), svg = document.getElementById('demoSvg');
  var E = function (k) { return (k - 3) * (k - 3); };
  var G = function (k) { return 2 * (k - 3); };

  function draw() {
    var lr = +lrEl.value / 100;
    lrVal.textContent = lr.toFixed(2);

    var k = 0.2, path = [k], diverged = false;
    for (var i = 0; i < 12; i++) {
      k = k - lr * G(k);
      path.push(k);
      if (!isFinite(k) || Math.abs(k) > 1e4) { diverged = true; break; }
    }

    var X = function (v) { return 20 + (v + 2) / 9.5 * 300; };
    var Y = function (e) { return 172 - Math.min(e, 26) / 26 * 145; };

    var h = '', d = '';
    for (var t = -2; t <= 7.5; t += 0.1) d += (d ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(E(t)).toFixed(1);
    h += '<path d="' + d + '" fill="none" stroke="var(--line)" stroke-width="2"/>';
    h += '<line x1="' + X(3) + '" y1="24" x2="' + X(3) + '" y2="176" stroke="var(--line)" stroke-dasharray="3 3"/>';
    path.forEach(function (v, i) {
      if (!isFinite(v) || Math.abs(v) > 12) return;
      h += '<circle cx="' + X(v) + '" cy="' + Y(E(v)) + '" r="' + (i === 0 ? 4 : 2.7) +
           '" fill="var(--accent)" opacity="' + Math.max(0.25, 1 - i / 14).toFixed(2) + '"/>';
    });
    svg.innerHTML = h;

    var last = path[path.length - 1];
    var bad = diverged || E(last) > E(path[0]);
    out.innerHTML = '学习率 <b>' + lr.toFixed(2) + '</b> · 12 步后 k = <b>' +
      (isFinite(last) ? last.toFixed(2) : '∞') + '</b> · 误差 <b>' +
      (isFinite(last) ? E(last).toFixed(3) : '∞') + '</b>' + (bad ? ' · 发散了' : '');
    window.kvState = function () { return { lr: lr, err: E(last), bad: bad }; };
  }

  lrEl.addEventListener('input', draw);
  document.getElementById('resetBtn').addEventListener('click', function () { lrEl.value = 20; draw(); });
  draw();
`,
  lr: `
  var lrEl = document.getElementById('lrSlider'), lrVal = document.getElementById('lrVal');
  var out = document.getElementById('demoOut'), svg = document.getElementById('demoSvg');
  var E = function (k) { return (k - 3) * (k - 3); };

  function draw() {
    var lr = +lrEl.value / 100;
    lrVal.textContent = lr.toFixed(2);

    var k = 0, series = [E(k)];
    for (var i = 0; i < 14; i++) {
      k = k - lr * 2 * (k - 3);
      series.push(isFinite(k) ? E(k) : Infinity);
    }

    var maxE = 1;
    series.forEach(function (e) { if (isFinite(e)) maxE = Math.max(maxE, e); });
    var X = function (i) { return 26 + i / 14 * 288; };
    var Y = function (e) { return isFinite(e) ? 172 - Math.min(e, maxE) / maxE * 144 : 12; };

    var h = '', d = '';
    series.forEach(function (e, i) { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(e).toFixed(1); });
    h += '<line x1="26" y1="172" x2="314" y2="172" stroke="var(--line)"/>';
    h += '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2"/>';
    series.forEach(function (e, i) {
      if (i % 2) return;
      h += '<circle cx="' + X(i) + '" cy="' + Y(e) + '" r="2.6" fill="var(--accent)"/>';
    });
    svg.innerHTML = h;

    var last = series[series.length - 1], first = series[0];
    var verdict = !isFinite(last) ? '发散（溢出）'
      : last > first * 1.5 ? '发散'
      : Math.abs(last - first) < 1e-9 ? '原地弹跳（因子=1）'
      : '收敛';
    out.innerHTML = '学习率 <b>' + lr.toFixed(2) + '</b> · 14 步后误差 <b>' +
      (isFinite(last) ? last.toFixed(3) : '∞') + '</b> · <b>' + verdict + '</b>';
    window.kvState = function () { return { lr: lr, verdict: verdict }; };
  }

  lrEl.addEventListener('input', draw);
  document.getElementById('resetBtn').addEventListener('click', function () { lrEl.value = 20; draw(); });
  draw();
`,
  scale: `
  var rEl = document.getElementById('ratioSlider'), rVal = document.getElementById('ratioVal');
  var out = document.getElementById('demoOut'), svg = document.getElementById('demoSvg');

  function draw() {
    var ratio = +rEl.value;
    rVal.textContent = ratio + '×';

    // E(x,y) = x^2 + ratio*y^2，学习率固定 —— 量级差越大，锯齿越明显
    var lr = 0.09, x = 1, y = 1, path = [[x, y]];
    for (var i = 0; i < 60; i++) {
      x -= lr * 2 * x;
      y -= lr * 2 * ratio * y;
      if (!isFinite(x) || !isFinite(y)) break;
      path.push([x, y]);
    }

    var X = function (v) { return 170 + v * 150; };
    var Y = function (v) { return 95 - v * 78; };
    var h = '';
    [0.3, 0.6, 1].forEach(function (r) {
      h += '<ellipse cx="170" cy="95" rx="' + (r * 150).toFixed(1) + '" ry="' + (r * 78).toFixed(1) +
           '" fill="none" stroke="var(--line)"/>';
    });
    var d = '';
    path.forEach(function (p, i) {
      if (!isFinite(p[0]) || Math.abs(p[0]) > 2 || Math.abs(p[1]) > 2) return;
      d += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1);
    });
    h += '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>';
    h += '<circle cx="' + X(1) + '" cy="' + Y(1) + '" r="3.5" fill="var(--ink)"/>';
    svg.innerHTML = h;

    var last = path[path.length - 1];
    out.innerHTML = '特征 B 量级 <b>' + ratio + '×</b> · 60 步后 |x| = <b>' +
      (isFinite(last[0]) ? Math.abs(last[0]).toFixed(4) : '∞') + '</b> · |y| = <b>' +
      (isFinite(last[1]) ? Math.abs(last[1]).toFixed(4) : '∞') + '</b>';
    window.kvState = function () { return { ratio: ratio, x: last[0], y: last[1] }; };
  }

  rEl.addEventListener('input', draw);
  document.getElementById('resetBtn').addEventListener('click', function () { rEl.value = 10; draw(); });
  draw();
`,
  overfit: `
  var cEl = document.getElementById('cSlider'), cVal = document.getElementById('cVal');
  var out = document.getElementById('demoOut'), svg = document.getElementById('demoSvg');
  var train = function (c) { return 0.9 * Math.exp(-0.55 * c); };
  var test  = function (c) { return 0.05 + 0.35 * Math.exp(-0.55 * c) + 0.045 * c * c; };

  function draw() {
    var c = +cEl.value;
    cVal.textContent = c;
    var X = function (v) { return 30 + (v - 1) / 11 * 284; };
    var Y = function (v) { return 172 - Math.min(v, 1.2) / 1.2 * 144; };

    var h = '', dt = '', dv = '';
    for (var i = 1; i <= 12; i += 0.25) {
      dt += (dt ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(train(i)).toFixed(1);
      dv += (dv ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(test(i)).toFixed(1);
    }
    h += '<path d="' + dt + '" fill="none" stroke="var(--ink)" stroke-width="1.8" opacity=".5"/>';
    h += '<path d="' + dv + '" fill="none" stroke="var(--accent)" stroke-width="2.2"/>';
    h += '<line x1="' + X(c) + '" y1="24" x2="' + X(c) + '" y2="176" stroke="var(--accent)" stroke-dasharray="3 3" opacity=".5"/>';
    h += '<circle cx="' + X(c) + '" cy="' + Y(train(c)) + '" r="3.5" fill="var(--ink)"/>';
    h += '<circle cx="' + X(c) + '" cy="' + Y(test(c)) + '" r="4.5" fill="var(--accent)"/>';
    svg.innerHTML = h;

    var gap = test(c) - train(c);
    var verdict = gap < 0.06 ? '差不多（还欠拟合）' : gap > 0.3 ? '差距大 · 过拟合了' : '差距健康';
    out.innerHTML = '复杂度 <b>' + c + '</b> · 训练 <b>' + train(c).toFixed(3) +
      '</b> · 测试 <b>' + test(c).toFixed(3) + '</b> · <b>' + verdict + '</b>';
    window.kvState = function () { return { c: c, gap: gap, verdict: verdict }; };
  }

  cEl.addEventListener('input', draw);
  document.getElementById('resetBtn').addEventListener('click', function () { cEl.value = 1; draw(); });
  draw();
`,
};

export const REPLAYS = {
  fit: `[
      async (r) => { r.say('先把斜率压到最低 —— 误差会非常大。');
        await r.slide('#kSlider', 0, 900); await r.wait(700); },
      async (r) => { r.say('慢慢往上抬，误差开始变小。');
        await r.slide('#kSlider', 22, 800); await r.wait(600); },
      async (r) => {
        await r.slide('#kSlider', 33, 700); await r.wait(500);
        var s = window.kvState ? window.kvState() : null;
        r.say(s ? ('穿到点堆中间，误差降到 ' + s.sse.toFixed(0) + ' —— 这是最贴的时候。') : '穿到点堆中间，误差最小。');
        await r.wait(800);
      },
      async (r) => { r.say('再往上抬就变差了。最小值左侧和右侧，误差都会变大。'); }
    ]`,
  gd: `[
      async (r) => { r.say('学习率 0.2：一步步稳稳滚到谷底。');
        await r.slide('#lrSlider', 20, 700); await r.wait(1500); },
      async (r) => { r.say('调大一些，收敛更快。');
        await r.slide('#lrSlider', 50, 700); await r.wait(1200); },
      async (r) => { r.say('再大就开始在谷底两侧弹跳。');
        await r.slide('#lrSlider', 95, 700); await r.wait(1200); },
      async (r) => { r.say('过了临界值误差反而涨 —— 明天专门算这个阈值。'); }
    ]`,
  lr: `[
      async (r) => { r.say('学习率 0.2：误差一路下降。');
        await r.slide('#lrSlider', 20, 800); await r.wait(1100); },
      async (r) => { r.say('调到 0.5：一步就到谷底，因子正好为 0。');
        await r.slide('#lrSlider', 50, 800); await r.wait(1100); },
      async (r) => { r.say('调到 1.0：不收敛也不发散，在两个点之间永久弹跳。');
        await r.slide('#lrSlider', 100, 800); await r.wait(1200); },
      async (r) => { r.say('过了 1.0，误差指数爆炸 —— 这就是临界值。');
        await r.slide('#lrSlider', 118, 700); await r.wait(1000); }
    ]`,
  scale: `[
      async (r) => { r.say('量级一样时，路径几乎是直线走向原点的。');
        await r.slide('#ratioSlider', 1, 800); await r.wait(1200); },
      async (r) => { r.say('差 10 倍，开始出现折返。');
        await r.slide('#ratioSlider', 10, 800); await r.wait(1200); },
      async (r) => {
        await r.slide('#ratioSlider', 100, 800); await r.wait(900);
        var s = window.kvState ? window.kvState() : null;
        r.say(s ? ('差 100 倍：60 步后 x 还剩 ' + Math.abs(s.x).toFixed(2) + '，几乎没动。') : '差 100 倍就是细长沟，几乎走不动。');
        await r.wait(700);
      },
      async (r) => { r.say('所以训练前先缩放特征 —— 不改变答案，只改变地形。'); }
    ]`,
  overfit: `[
      async (r) => { r.say('复杂度 1：训练和测试误差都很高，这是欠拟合。');
        await r.slide('#cSlider', 1, 800); await r.wait(1000); },
      async (r) => { r.say('复杂度 3：测试误差最低，这是最合适的地方。');
        await r.slide('#cSlider', 3, 900); await r.wait(1100); },
      async (r) => { r.say('继续加复杂度：训练误差还在降，测试误差却回升了。');
        await r.slide('#cSlider', 9, 900); await r.wait(1200); },
      async (r) => { r.say('只看训练误差会一路选到最复杂的那个 —— 那恰恰最差。'); }
    ]`,
};
