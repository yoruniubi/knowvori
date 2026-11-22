/* ─── KVProgress ▸ v1 ─────────────────────────────────────────────
   学习路线的进度读写。内联进 route.html 和每个 day-XX.html。

   为什么要内联：课程是单文件交付，断网双击能开，不能外链脚本文件。

   为什么进度单独存：进度属于「这条路线」，不属于某一天的课。
   存进某节课里，换一节课就丢了。file:// 下同目录的 HTML 共享
   localStorage（已实测 Edge / file 协议），所以汇总页和各天课程
   能读写同一份。

   三条纪律：
   1. 所有读写都 try/catch。隐私模式下 localStorage 会直接抛异常，
      不能让整页白屏 —— 存不了进度也得能学。
   2. 数据格式带版本号。以后改了格式要能识别旧数据，而不是崩。
   3. 读失败一律当「全部未开始」，不要猜。
   ──────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var VERSION = 1;

  function keyOf(routeId) {
    return 'kv:route:' + routeId;
  }

  function empty(routeId) {
    return { v: VERSION, route: routeId, done: {}, visited: {}, notes: {} };
  }

  /* 存不了的时候用什么顶上。
     用内存对象兜住，这样同一次会话里进度还是「看起来在动」，
     不保存也不会让用户以为操作失败了。 */
  var memoryFallback = {};
  var available = null;

  function canStore() {
    if (available !== null) return available;
    try {
      var probe = 'kv:probe';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      available = true;
    } catch (e) {
      available = false;
    }
    return available;
  }

  function load(routeId) {
    var base = empty(routeId);
    if (!canStore()) return memoryFallback[routeId] || base;

    try {
      var raw = global.localStorage.getItem(keyOf(routeId));
      if (!raw) return base;

      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return base;

      // 版本不匹配：当前只有 v1。未来加 v2 时在这里迁移，
      // 不认识的就当空数据，不要拿结构不明的对象往下跑。
      if (data.v !== VERSION) return base;

      // 逐字段兜底：手改过的数据、半截写入都可能缺字段
      return {
        v: VERSION,
        route: routeId,
        done: data.done && typeof data.done === 'object' ? data.done : {},
        visited: data.visited && typeof data.visited === 'object' ? data.visited : {},
        notes: data.notes && typeof data.notes === 'object' ? data.notes : {}
      };
    } catch (e) {
      // JSON 坏了、被别的程序写脏了 —— 当空数据，别崩
      return base;
    }
  }

  function save(routeId, data) {
    data.v = VERSION;
    data.route = routeId;
    if (!canStore()) {
      memoryFallback[routeId] = data;
      return false;
    }
    try {
      global.localStorage.setItem(keyOf(routeId), JSON.stringify(data));
      return true;
    } catch (e) {
      // 配额满（手机尤其容易）、无痕模式 —— 退到内存，本次会话仍可用
      memoryFallback[routeId] = data;
      return false;
    }
  }

  function markDone(routeId, dayId) {
    var d = load(routeId);
    if (!d.done[dayId]) d.done[dayId] = Date.now();
    d.visited[dayId] = Date.now();
    save(routeId, d);
    return d;
  }

  function undoSelf(routeId, dayId) {
    // 允许退回。点错了、想重学一遍都得能撤销，
    // 不然一次误点就永久污染了进度。
    var d = load(routeId);
    delete d.done[dayId];
    save(routeId, d);
    return d;
  }

  function markVisited(routeId, dayId) {
    var d = load(routeId);
    d.visited[dayId] = Date.now();
    save(routeId, d);
    return d;
  }

  /* 第一个未完成的天 —— 汇总页「今天该学」用它。
     注意不是「最后访问 + 1」：用户可能跳着学完了 Day 5 而 Day 3 没做。 */
  function nextDay(routeId, days) {
    var d = load(routeId);
    for (var i = 0; i < days.length; i++) {
      if (!d.done[days[i].id]) return days[i];
    }
    return null;
  }

  function counts(routeId, days) {
    var d = load(routeId);
    var done = 0;
    for (var i = 0; i < days.length; i++) {
      if (d.done[days[i].id]) done++;
    }
    return { done: done, total: days.length };
  }

  /* 「上次学到哪」—— 取最近一次访问且未完成的天。
     完成的也算进来会让文案变成「上次学到 Day 5」，而 Day 5 早学完了，
     说「你上次在 Day 6」才是有用的信息。 */
  function lastActive(routeId, days) {
    var d = load(routeId);
    var best = null, bestTs = 0;
    for (var i = 0; i < days.length; i++) {
      var ts = d.visited[days[i].id] || 0;
      if (ts > bestTs) { bestTs = ts; best = days[i]; }
    }
    return best ? { day: best, at: bestTs } : null;
  }

  /* 前置有没有做完 —— 用于在卡片上提示「建议先完成 Day 5」。
     只提示，不拦人。 */
  function unmetDeps(routeId, day) {
    if (!day.deps || !day.deps.length) return [];
    var d = load(routeId);
    return day.deps.filter(function (id) { return !d.done[id]; });
  }

  global.KVProgress = {
    version: VERSION,
    available: canStore,
    load: load,
    save: save,
    markDone: markDone,
    undoSelf: undoSelf,
    markVisited: markVisited,
    nextDay: nextDay,
    counts: counts,
    lastActive: lastActive,
    unmetDeps: unmetDeps
  };
})(typeof window !== 'undefined' ? window : this);
