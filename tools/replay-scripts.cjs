module.exports = {
  /* ───────────────────────────────────────────── 梯度下降 ── */
  'gradient-descent-lab.html': {
    before: '<div class="lab">',
    label: '看一遍演示',
    done: '演示结束。自己拖一下滑块——同样的公式，数字一样是现算的。',
    onStart: `document.getElementById('reset').click();`,
    steps: `
      async (r) => {
        r.say('先把起点放到 x₀ = −1，学习率调成 η = 0.2 —— 一个偏保守的值。');
        await r.slide('#start', -1, 700);
        await r.slide('#lr', 0.2, 700);
        await r.wait(500);
      },
      async (r) => {
        r.say('每按一次「走 1 步」，误差就乘上 |1 − 2η| = 0.6。先走一步。');
        r.click('#step');
        await r.wait(900);
      },
      async (r) => { r.say('再走一步。数在缩，但每一步的收益越来越小。'); r.click('#step'); await r.wait(700); },
      async (r) => { r.say('第三步。已经贴到谷底附近了。'); r.click('#step'); await r.wait(700); },
      async (r) => {
        r.say('继续走到 5 步：误差 3 → 0.05。η = 0.2 稳得很。');
        r.click('#step'); await r.wait(500);
        r.click('#step'); await r.wait(1100);
      },
      async (r) => {
        r.say('现在只改一件事：η 换成 1.2，起点换到 x₀ = 1。看住了。');
        await r.slide('#start', 1, 700);
        await r.slide('#lr', 1.2, 700);
        await r.wait(700);
      },
      async (r) => { r.say('第 1 步就冲过头，直接飞到了谷底另一边——x 变成了 3.4。'); r.click('#step'); await r.wait(850); },
      async (r) => { r.say('第 2 步。误差没缩，反而变成了 1.96。'); r.click('#step'); await r.wait(850); },
      async (r) => { r.say('第 3 步。越跳越远，已经在画面外面了。'); r.click('#step'); await r.wait(850); },
      async (r) => {
        r.say('再走两步：f(x) 从 1 涨到 28.9，每一跳都是上一跳的 1.4 倍。');
        r.click('#step'); await r.wait(500);
        r.click('#step'); await r.wait(1400);
      },
      async (r) => {
        r.say('两段唯一的不同就是 η。稳定边界卡在 η = 1：跨过去，误差就被放大而不是缩小。');
      }
    `,
  },

  /* ─────────────────────────────────────────── 二分查找 ── */
  'binary-search-detective.html': {
    before: '<div class="game" id="game">',
    // 演示要读「还剩几个候选」才能说对话，所以暴露一个只读的状态函数。
    bridgeAnchor: "  autoBtn.addEventListener('click', function () {",
    bridgeCode: "  window.kvState = function () {\n    return '现在 ' + rangeText.textContent + '，还剩 ' + remainEl.textContent + ' 个候选，最多再问 ' + needEl.textContent + ' 次。';\n  };\n\n  autoBtn.addEventListener('click', function () {",
    label: '看侦探走一遍',
    done: '演示结束。换你自己的问法试试，看能不能更快。',
    stateFn: `function () { return window.kvState ? window.kvState() : ''; }`,
    onStart: `document.getElementById('reset').click();`,
    steps: `
      async (r) => {
        r.say('目标已经藏好了。侦探不一个个问，而是每次问当前范围的正中间。');
        await r.wait(600);
      },
      async (r) => {
        // 答案随机，可能几步就中。所以每一步都先问「还剩几个候选」，
        // 而不是硬演固定 7 步 —— 硬演会在答案碰巧靠中间时说出不成立的话。
        document.getElementById('auto').click();
        await r.wait(900);
        var won = document.getElementById('game').classList.contains('won');
        r.say(won
          ? '一下子就中了——答案正好是这轮问的那个数。'
          : '一次回答就砍掉一半，这就是二分的全部秘密。' + r.state());
      },
      async (r) => {
        if (document.getElementById('game').classList.contains('won')) return;
        document.getElementById('auto').click();
        await r.wait(900);
        var won = document.getElementById('game').classList.contains('won');
        r.say(won ? '中了。' : '在新的一半里，再问它的正中。' + r.state());
      },
      async (r) => {
        if (document.getElementById('game').classList.contains('won')) return;
        r.say('盯住「最多还需」那一栏，它会一路掉到 1。' + r.state());
        await r.wait(700);
        document.getElementById('auto').click();
        await r.wait(900);
      },
      async (r) => {
        if (document.getElementById('game').classList.contains('won')) return;
        document.getElementById('auto').click();
        await r.wait(800);
      },
      async (r) => {
        // 收尾：把「这次」和「最坏」分开说，避免和正文的 7 次混为一谈
        var asked = Number(document.getElementById('steps').textContent) || 0;
        var won = document.getElementById('game').classList.contains('won');
        if (!won) { r.say('演示到这里。剩下几步，你自己点「让侦探走一步」会更清楚。'); return; }
        r.say(asked < 7
          ? '这次 ' + asked + ' 次就中了，运气不错。但算法保证的是「最坏 7 次」—— 目标落在哪，你事先并不知道。'
          : '正好 7 次，这就是最坏情况。2⁷ = 128 > 100，所以 7 次一定够。');
        await r.wait(1600);
      }
    `,
  },

  /* ───────────────────────────────────────── AB 测试 ── */
  'ab-test-editorial.html': {
    before: '<div class="desk">',
    label: '看一遍演示',
    done: '演示结束。自己拖一下样本量，反复抽样，看区间怎么抖。',
    onStart: `document.getElementById('reset').click();`,
    steps: `
      async (r) => {
        r.say('A 的真实转化率 10%，B 是 12%——差别只有 2 个百分点。先用 n = 400 抽一次。');
        await r.wait(600);
        document.getElementById('draw').click();
        await r.wait(1200);
      },
      async (r) => {
        r.say('B 观测比 A 高，但两组的 95% 区间都跨过了对方的真实值——这一次还下不了结论。');
        await r.wait(1500);
      },
      async (r) => {
        r.say('再抽一次。同样的真实值，换一批样本，观测值和区间都会动。');
        document.getElementById('draw').click();
        await r.wait(1400);
      },
      async (r) => {
        r.say('现在只改样本量：把 n 从 400 一路拉到 3000，看误差棒怎么缩。');
        await r.slide('#n', 3000, 1400);
        await r.wait(1200);
      },
      async (r) => {
        r.say('区间明显变窄了。样本越多，估计越稳——但注意：真实差距没变，只是看得更清了。');
        await r.wait(1600);
      },
      async (r) => {
        r.say('缩到 3000 后，差值的区间基本不再跨过 0。结论不是「抽得更准了」，是「终于分得开了」。');
      }
    `,
  },

  /* ───────────────────────────────────────── 一点透视 ── */
  'one-point-perspective.html': {
    before: '<div class="card"><svg class="scene"',
    // 消失点 x 在课程闭包里，外面碰不到。加一个只写位置的桥，
    // 让演示能逐帧推它 —— 直接改 x 不可见，因为 draw() 也在闭包里。
    bridgeAnchor: 'document.getElementById(\'reset\').addEventListener(\'click\',()=>{x=300;draw()});',
    bridgeCode: "document.getElementById('reset').addEventListener('click',()=>{x=300;draw()});window.kvSetVP=function(v){x=Math.max(45,Math.min(555,v));draw()};",
    label: '看一遍演示',
    done: '演示结束。自己拖那个红点，四条线会跟着你走。',
    onStart: `document.getElementById('reset').click();`,
    steps: `
      async (r) => {
        r.say('消失点现在在画面正中。四条红线从近处正面的四个角，一起连向它。');
        await r.wait(900);
      },
      async (r) => {
        r.say('把消失点往左推。注意：红线的方向变了，但四条仍然交于同一点。');
        await r.tween(1100, (e) => { window.kvSetVP(300 + (90 - 300) * e); });
        await r.wait(900);
      },
      async (r) => {
        r.say('往右推回去，再越过中心推到右侧。走廊的「深度方向」跟着转。');
        await r.tween(1500, (e) => { window.kvSetVP(90 + (510 - 90) * e); });
        await r.wait(900);
      },
      async (r) => {
        r.say('回到中心。记住这条规则：现实中互相平行的深度边线，在画面里一定交于同一个消失点。');
        await r.tween(1100, (e) => { window.kvSetVP(510 + (300 - 510) * e); });
        await r.wait(1200);
      }
    `,
  },

  /* ───────────────────────────────────────── softmax ── */
  'softmax-数值稳定.html': {
    before: '<div class="demo">',
    label: '看一遍演示',
    done: '演示结束。自己把滑块拖到 709–710 附近，看它怎么崩。',
    onStart: `document.getElementById('demoReset').click();`,
    steps: `
      async (r) => {
        r.say('分数还很小的时候，exp 的结果温和，一整组分得好好的。先慢慢往上加。');
        await r.slide('#demoSlider', 400, 1500);
        await r.wait(700);
      },
      async (r) => {
        r.say('继续加。分数的绝对值一变大，exp 就飞快地往上涨——这是指数，不是直线。');
        await r.slide('#demoSlider', 700, 1500);
        await r.wait(800);
      },
      async (r) => {
        r.say('现在最关键的一小段：709 到 710。眼睛别眨。');
        await r.slide('#demoSlider', 709, 700);
        await r.wait(1100);
        await r.slide('#demoSlider', 710, 900);
        await r.wait(1400);
      },
      async (r) => {
        r.say('过了 709，exp 越过双精度能表示的最大值，变成 Infinity。除以 Infinity，整组概率变成 NaN。');
        await r.slide('#demoSlider', 780, 900);
        await r.wait(1500);
      },
      async (r) => {
        r.say('不是「精度差一点」，是整组结果全废。这就是为什么要先减去最大值。');
        await r.wait(1200);
      }
    `,
  },

  /* ───────────────────────────────────────── 面试练习 ── */
  'interview-practice.html': {
    before: '<div class="card"><label for="draft">',
    label: '看一遍演示',
    done: '演示结束。现在写你自己的，写完再展开示例对照。',
    onStart: `document.getElementById('clear').click();`,
    steps: `
      async (r) => {
        r.say('题目是「讲一次你处理线上故障的经历」。先别急着写漂亮话——先想清楚四件事。');
        await r.wait(1200);
      },
      async (r) => {
        r.say('第一件：情境和影响。「上周订单服务错误率突然升高，结算开始超时」——听者立刻知道多严重。');
        await r.type('#draft', '上周订单服务的错误率突然升高，结算请求开始超时。', 1300);
        await r.wait(700);
      },
      async (r) => {
        r.say('第二件：你怎么判断原因。这一步最容易被追问，必须说清依据。');
        await r.type('#draft', '\\n我先核对部署时间和依赖服务指标，发现故障紧跟一次数据库连接池配置变更，而数据库本身负载正常。', 1600);
        await r.wait(700);
      },
      async (r) => {
        r.say('第三件：行动要具体，能分清哪些是你做的。');
        await r.type('#draft', '\\n我和同事核对后先回滚这次配置，再盯错误率和延迟曲线。', 1300);
        await r.wait(700);
      },
      async (r) => {
        r.say('第四件：结果要有可核对的证据，别只说「恢复了」。');
        await r.type('#draft', '\\n十分钟内错误率回到变更前水平，告警解除。复盘时我们补了连接池耗尽告警，并把配置变更加进灰度观察。', 1700);
        await r.wait(900);
      },
      async (r) => {
        r.say('现在展开示例与自评表，逐项对照刚才写的四段——注意是看证据够不够，不是看措辞像不像。');
        document.getElementById('reveal').click();
        await r.wait(1600);
      },
      async (r) => {
        r.say('草稿只存在这个页面的内存里，不上传、不评分。要不要现在自己写一遍？');
      }
    `,
  },

  /* ───────────────────────────────────────── 3D 相机 ── */
  'three-camera-depth.html': {
    before: '<div class="stage">',
    label: '看一遍演示',
    done: '演示结束。自己拖画面旋转，或改 FOV / 距离，比例会跟着变。',
    onStart: `document.getElementById('reset').click();`,
    steps: `
      async (r) => {
        r.say('两个方块的真实边长完全相同。现在只看它们离相机多远——近的屏幕占比大，远的占比小。');
        await r.wait(1100);
      },
      async (r) => {
        r.say('把相机拉近：距离从 9 收到 6。两个方块一起变大，但比例基本不变。');
        await r.slide('#dist', 6, 1600);
        await r.wait(900);
      },
      async (r) => {
        r.say('再把距离推远到 15。两个方块一起变小——同样，比例没怎么动。');
        await r.slide('#dist', 15, 1800);
        await r.wait(900);
      },
      async (r) => {
        r.say('最容易搞混的一步：缩 FOV。视场角从 55° 收到 30°，像换了一支长焦镜头。');
        await r.slide('#fov', 30, 1600);
        await r.wait(1100);
      },
      async (r) => {
        r.say('重点来了：所有东西一起变大了，但「近处 ÷ 远处」的比值几乎没变。变化的只是取景范围，不是空间关系。');
        await r.wait(1800);
      },
      async (r) => {
        r.say('现在切到正交相机。同一场景，透视的「越远越小」直接消失了。');
        document.getElementById('btnOrtho').click();
        await r.wait(1700);
      },
      async (r) => {
        r.say('两个方块看上去一样大——因为正交投影不除以深度。这就是它适合工程制图、不适合模拟人眼的原因。');
        await r.wait(1500);
      }
    `,
  },
};
// 把每课的 cfg.steps 包成完整的演示脚本（IIFE）
for (const [name, cfg] of Object.entries(module.exports)) {
  cfg.script = `
/* ─── KVReplaySteps ▸ ${name} ▸ v1 ───────────────────────────────
   这一课的演示脚本。r.slide 是逐帧缓动拖滑块，r.click 是按真按钮。
   数字全部由页面自己算，没有写死的。
   ────────────────────────────────────────────────────────────── */
(function () {
  var root = document.getElementById('kvReplay');
  if (!root || !window.KVReplay) return;
  KVReplay.create({
    root: root,
    label: ${JSON.stringify(cfg.label)},
    done: ${JSON.stringify(cfg.done)},
    onStart: function () { ${cfg.onStart} },
    state: ${cfg.stateFn || 'undefined'},
    steps: [${cfg.steps}
    ]
  });
})();
`;
}
