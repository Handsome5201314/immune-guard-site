/* 生命方程 · 免疫卫士 官网公共脚本 v2.0
   模块：导航 / 移动菜单 / 滚动渐入 / 目录高亮 / 预约表单 / 游戏化互动演示
   原则：所有演示数据不写入任何真实账号；表单无真实接口时明确告知，不伪造成功。 */
(function () {
  'use strict';
  var doc = document;
  doc.documentElement.classList.add('js');
  var mReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || doc).querySelectorAll(s)); }
  function navH() { var n = $('.site-header'); return n ? n.offsetHeight : 68; }

  /* ---------- 移动端菜单 ---------- */
  var toggle = $('.nav-toggle');
  var menu = doc.getElementById('mobile-menu');
  function focusables() { return menu ? menu.querySelectorAll('a,button,summary') : []; }
  function openMenu() {
    if (!menu || !menu.hidden) return;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.classList.add('is-active');
    doc.body.classList.add('no-scroll');
    var first = focusables()[0];
    if (first) first.focus();
    doc.addEventListener('keydown', onMenuKey);
  }
  function closeMenu(refocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('is-active');
    doc.body.classList.remove('no-scroll');
    doc.removeEventListener('keydown', onMenuKey);
    if (refocus !== false) toggle.focus();
  }
  function onMenuKey(e) {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables();
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { menu.hidden ? openMenu() : closeMenu(); });
    menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(false); });
    var mq = window.matchMedia('(min-width: 1024px)');
    var onMq = function () { if (!menu.hidden) closeMenu(false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && !menu.hidden) closeMenu(false);
    });
  }

  /* ---------- 当前页高亮：按文件名匹配，共享导航无需逐页手改 ---------- */
  (function () {
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!here) here = 'index.html';
    $$('.nav-desktop .nav-link').forEach(function (el) {
      var href = (el.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (href && href === here) el.setAttribute('aria-current', 'page');
    });
    /* 移动菜单：只展开当前页所在分组，不重复设置 aria-current */
    $$('.mobile-menu-nav .mm-sub a').forEach(function (el) {
      var href = (el.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (href && href === here) {
        var group = el.closest('.mm-group');
        if (group) group.open = true;
      }
    });
  })();

  /* ---------- 锚点偏移（同页锚点 + 跨页锚点） ---------- */
  function scrollToHash() {
    if (!location.hash || location.hash === '#') return;
    var id = decodeURIComponent(location.hash.slice(1));
    var target = doc.getElementById(id);
    if (!target) return;
    var off = navH() + 14;
    window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - off);
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') { e.preventDefault(); return; }
      var id = decodeURIComponent(href.slice(1));
      var target = doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      closeMenu(false);
      var off = navH() + 14;
      var top = target.getBoundingClientRect().top + window.pageYOffset - off;
      if (mReduce.matches) window.scrollTo(0, top); else window.scrollTo({ top: top, behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', href);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
  window.addEventListener('hashchange', scrollToHash);
  if (location.hash) setTimeout(scrollToHash, 60);

  /* ---------- 滚动渐入 ---------- */
  var revealEls = $$('.reveal');
  function showAll() { revealEls.forEach(function (el) { el.classList.add('is-visible'); }); }
  if (mReduce.matches || !('IntersectionObserver' in window)) showAll();
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 目录高亮（长页面） ---------- */
  var tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = doc.getElementById(id);
      if (sec) map[id] = a;
    });
    var secIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
        var a = map[en.target.id];
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-' + navH() + 'px 0px -65% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) { secIo.observe(doc.getElementById(id)); });
  }

  /* ---------- 表单校验工具 ---------- */
  function setInvalid(input, on) {
    /* CSS 规则是 .field.is-invalid input / .field.is-invalid .err，
       所以标记必须加在外层 .field 上，而不是 input 本身 */
    var wrap = input && input.closest ? input.closest('.field') : null;
    if (wrap) wrap.classList.toggle('is-invalid', on);
    else if (input) input.classList.toggle('is-invalid', on);
  }
  function validPhone(v) { return /^1[3-9]\d{9}$/.test(v) || /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v) || /^\+?\d{6,15}$/.test(v.replace(/[\s-]/g, '')); }

  /* ---------- 预约体验表单 ---------- */
  var form = doc.getElementById('trial-form');
  if (form) {
    var status = doc.getElementById('trial-status');
    var submitBtn = form.querySelector('button[type="submit"]');
    var consent = doc.getElementById('f-consent');
    var fields = ['f-name', 'f-contact'].map(function (id) { return doc.getElementById(id); });
    var ENDPOINT = form.getAttribute('data-endpoint') || '';
    function showStatus(kind, msg) {
      status.className = 'form-status is-on ' + kind;
      status.innerHTML = (kind === 'ok'
        ? '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>'
        : '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>') + '<span>' + msg + '</span>';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var name = fields[0], contact = fields[1];
      setInvalid(name, !name.value.trim());
      if (!name.value.trim()) ok = false;
      setInvalid(contact, !validPhone(contact.value.trim()));
      if (!validPhone(contact.value.trim())) ok = false;
      if (!consent.checked) { ok = false; setInvalid(consent, true); consent.focus(); }
      if (!ok) { showStatus('fail', '请检查标红的必填项，并勾选信息使用授权。'); return; }

      if (!ENDPOINT) {
        /* 无真实接收接口：明确告知，不伪造成功 */
        showStatus('fail', '预约通道正在接入。当前表单尚未连接服务器，你的信息没有被发送或保存。正式渠道开放后会在此页公布。');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = '正在提交…';
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      payload.page = location.pathname;
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function () {
        showStatus('ok', '已收到你的预约申请。我们会在 1–2 个工作日内通过你留下的方式联系你，确认体验时间。');
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = '提交预约';
      }).catch(function (err) {
        showStatus('fail', '提交没有成功（' + (err && err.message ? err.message : '网络异常') + '）。请稍后重试。');
        submitBtn.disabled = false;
        submitBtn.textContent = '提交预约';
      });
    });
    fields.forEach(function (f) {
      if (f) f.addEventListener('input', function () { setInvalid(f, false); });
    });
  }

  /* ---------- 游戏化互动演示（growth.html） ----------
     纯前端状态机。不连账号、不发请求、不写 Cookie。数值仅用于演示玩法结构。 */
  var demo = doc.getElementById('vp-demo');
  if (demo) {
    var state = { vp: 120, done: {}, badges: {} };
    var LEVELS = [
      { name: '萌芽', at: 0 }, { name: '探索者', at: 100 }, { name: '守护者', at: 300 },
      { name: '习惯建筑师', at: 600 }, { name: '免疫卫士', at: 1000 }
    ];
    var TASKS = [
      { id: 'sleep', title: '今晚 23:30 前上床', cat: '睡眠', vp: 20 },
      { id: 'activity', title: '完成 20 分钟快走', cat: '活动', vp: 15 },
      { id: 'sedentary', title: '每坐 50 分钟起身活动', cat: '久坐中断', vp: 10 },
      { id: 'data', title: '补录今天的睡眠时长', cat: '数据补全', vp: 10 },
      { id: 'learn', title: '阅读 1 篇免疫科普', cat: '科普学习', vp: 10 },
      { id: 'followup', title: '确认复查提醒时间', cat: '复查随访', vp: 15 }
    ];
    var BADGES = [
      { id: 'b1', name: '数据侦探', cond: '完成 1 次数据补全', when: function () { return !!state.done.data; } },
      { id: 'b2', name: '规律睡眠', cond: '完成睡眠挑战', when: function () { return !!state.done.sleep; } },
      { id: 'b3', name: '第一次看懂血检', cond: '完成 1 次科普学习', when: function () { return !!state.done.learn; } },
      { id: 'b4', name: '恢复日也重要', cond: '完成久坐中断', when: function () { return !!state.done.sedentary; } },
      { id: 'b5', name: '安全重测专家', cond: '完成复查随访', when: function () { return !!state.done.followup; } },
      { id: 'b6', name: '团队协作', cond: '全部任务完成', when: function () { return TASKS.every(function (t) { return state.done[t.id]; }); } }
    ];
    var el = function (s) { return $(s, demo); };
    function levelIndex(v) { var i = 0; for (var k = 0; k < LEVELS.length; k++) if (v >= LEVELS[k].at) i = k; return i; }
    function render() {
      var li = levelIndex(state.vp);
      var cur = LEVELS[li], next = LEVELS[li + 1];
      var pct = next ? Math.min(100, Math.round((state.vp - cur.at) / (next.at - cur.at) * 100)) : 100;
      el('[data-vp]').textContent = state.vp;
      el('[data-level]').textContent = cur.name;
      el('[data-next]').textContent = next ? '距「' + next.name + '」还差 ' + (next.at - state.vp) + ' VP' : '已达最高等级';
      el('[data-bar]').style.width = pct + '%';
      el('[data-pct]').textContent = pct + '%';
      var doneCount = Object.keys(state.done).length;
      el('[data-done]').textContent = doneCount + ' / ' + TASKS.length;
      el('[data-season]').style.width = Math.round(doneCount / TASKS.length * 100) + '%';
      $$('.vp-task', demo).forEach(function (b) {
        var d = !!state.done[b.dataset.task];
        b.classList.toggle('is-done', d);
        b.setAttribute('aria-pressed', d ? 'true' : 'false');
        $('.vp-task-state', b).textContent = d ? '已完成' : '待完成';
      });
      $$('.vp-badge', demo).forEach(function (c) {
        var b = BADGES.filter(function (x) { return x.id === c.dataset.badge; })[0];
        var got = !!state.badges[b.id];
        c.classList.toggle('is-earned', got);
        $('.vp-badge-state', c).textContent = got ? '已点亮' : '未点亮';
      });
      $$('.vp-level', demo).forEach(function (d, i) {
        d.classList.toggle('is-current', i === li);
        d.classList.toggle('is-reached', i < li);
      });
    }
    function complete(id) {
      if (state.done[id]) return;
      state.done[id] = true;
      var t = TASKS.filter(function (x) { return x.id === id; })[0];
      state.vp += t.vp;
      BADGES.forEach(function (b) { if (!state.badges[b.id] && b.when()) { state.badges[b.id] = true; } });
      render();
      var toast = el('[data-toast]');
      toast.textContent = '完成 · +' + t.vp + ' VP（演示）';
      toast.classList.add('is-on');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
    }
    $$('.vp-task', demo).forEach(function (b) {
      b.addEventListener('click', function () { complete(b.dataset.task); });
    });
    var reset = el('[data-reset]');
    if (reset) reset.addEventListener('click', function () { state = { vp: 120, done: {}, badges: {} }; render(); });
    render();
  }
})();
