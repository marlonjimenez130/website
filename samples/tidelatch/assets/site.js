/* Tidelatch Home Watch (concept site) · the page's three behaviours:
   1. the morning round: a film the visitor plays forward by scrolling (image sequence on a canvas);
   2. the walk-through: a house plan where a lamp walks from room to room;
   3. the email helper: builds a mailto: link from two choices.
   Everything rests in a finished state without JavaScript and with reduced motion. */
(function () {
  'use strict';
  var d = document, mq = function (q) { return window.matchMedia(q).matches; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var conn = navigator.connection || {}, saveData = !!conn.saveData;

  /* 1. The morning round ------------------------------------------------------------ */
  (function () {
    var sec = d.querySelector('.round'); if (!sec) return;
    var canvas = sec.querySelector('canvas'), ctx = canvas && canvas.getContext && canvas.getContext('2d');
    var lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    if (!ctx || reduce || saveData || lowPower || !('IntersectionObserver' in window)) return; // the still and all four lines stay
    var N = +sec.dataset.frames || 73, beats = [].slice.call(sec.querySelectorAll('.beat')), bar = sec.querySelector('.round__bar');
    var phoneQ = window.matchMedia('(max-width: 760px)'), set = null, frames = [], loaded = [], pos = 0, drawn = -1, running = false, near = false, started = false;
    sec.classList.add('is-scrub');
    function src(i) { return 'frames/street/' + set + '/' + (i < 10 ? '0' : '') + i + '.webp'; }
    function order() { var o = [0], seen = { 0: 1 }; [16, 8, 4, 2, 1].forEach(function (s) { for (var i = 0; i < N; i += s) if (!seen[i]) { seen[i] = 1; o.push(i); } }); if (!seen[N - 1]) o.push(N - 1); return o; }
    function prepare() {
      set = phoneQ.matches ? 'p' : 'd';
      canvas.width = set === 'p' ? 540 : 1152; canvas.height = set === 'p' ? 960 : 648;
      frames = []; loaded = []; drawn = -1; started = false;
    }
    function load() {
      if (started) return; started = true;
      var q = order(), k = 0, live = 0, mySet = set;
      function next() {
        while (live < 4 && k < q.length) {
          (function (i) {
            var im = new Image(); live++; im.decoding = 'async';
            im.onload = function () { live--; if (mySet !== set) return; frames[i] = im; loaded[i] = 1; if (i === 0 || drawn < 0) draw(true); next(); };
            im.onerror = function () { live--; next(); };
            im.src = src(i);
          })(q[k++]);
        }
      }
      next();
    }
    function nearest(i) { for (var r = 0; r < N; r++) { if (loaded[i - r]) return i - r; if (loaded[i + r]) return i + r; } return -1; }
    var stage = sec.querySelector('.round__stage');
    function progress() { // 0 when the stage first sticks under the header, 1 when it lets go
      var top = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--head-h')) || 0;
      return Math.min(1, Math.max(0, (top - sec.getBoundingClientRect().top) / Math.max(1, sec.offsetHeight - stage.offsetHeight)));
    }
    function draw(force) {
      var i = nearest(Math.round(pos)); if (i < 0 || (i === drawn && !force)) return;
      ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height); drawn = i;
    }
    function tick() {
      var p = progress(), target = p * (N - 1);
      pos += (target - pos) * 0.22; if (Math.abs(target - pos) < 0.02) pos = target;
      draw(false);
      var b = Math.min(beats.length - 1, Math.floor(p * beats.length * 0.999));
      beats.forEach(function (el, j) { el.classList.toggle('on', j === b); });
      if (bar) bar.style.setProperty('--p', p.toFixed(4));
      if (near) requestAnimationFrame(tick); else running = false;
    }
    function go() { if (!running) { running = true; requestAnimationFrame(tick); } }
    prepare();
    beats[0].classList.add('on');
    // Frames download only once the chapter has stayed on screen for a moment (like the kit's data-dwell),
    // so a visitor who flings past never pays for them. Frame 0 is the poster, so nothing jumps while they arrive.
    var dwell = 0;
    new IntersectionObserver(function (es) { es.forEach(function (e) { clearTimeout(dwell); if (e.isIntersecting) dwell = setTimeout(load, 600); }); }).observe(sec);
    new IntersectionObserver(function (es) { es.forEach(function (e) { near = e.isIntersecting; if (near) go(); }); }, { rootMargin: '10% 0px 10% 0px' }).observe(sec);
    var onChange = function () { prepare(); load(); go(); };
    if (phoneQ.addEventListener) phoneQ.addEventListener('change', onChange); else if (phoneQ.addListener) phoneQ.addListener(onChange);
  })();

  /* 2. The walk-through ------------------------------------------------------------- */
  (function () {
    var list = d.querySelector('[data-rooms]'); if (!list) return;
    var svg = d.querySelector('.plan svg'), lamp = svg.querySelector('.lamp'), trail = svg.querySelector('.trail');
    var btns = [].slice.call(list.querySelectorAll('.rb')), status = d.querySelector('[data-walk-status]'), walkBtn = d.querySelector('[data-walk]');
    var planStatus = d.querySelector('[data-plan-status]');
    var P = { entry: [245, 75], garage: [105, 110], laundry: [105, 250], kitchen: [245, 215], living: [440, 250], baths: [370, 110], lanai: [220, 362] };
    var E = { 'entry|kitchen': [], 'entry|garage': [[190, 75]], 'kitchen|laundry': [[190, 235]], 'garage|laundry': [[80, 200]],
      'kitchen|living': [[300, 250]], 'baths|living': [[400, 200]], 'lanai|living': [[420, 300], [330, 309]], 'baths|entry': [[300, 160]] };
    var adj = {}; Object.keys(E).forEach(function (k) { var a = k.split('|'); (adj[a[0]] = adj[a[0]] || []).push(a[1]); (adj[a[1]] = adj[a[1]] || []).push(a[0]); });
    function via(a, b) { var k = a < b ? a + '|' + b : b + '|' + a, pts = E[k] || []; return a < b ? pts : pts.slice().reverse(); }
    function route(a, b) { // breadth-first over the doors: a list of points from room a to room b
      if (a === b) return [P[a]];
      var prev = {}, q = [a], seen = {}; seen[a] = 1;
      while (q.length) { var c = q.shift(); if (c === b) break; (adj[c] || []).forEach(function (n) { if (!seen[n]) { seen[n] = 1; prev[n] = c; q.push(n); } }); }
      var path = [b]; while (path[0] !== a) path.unshift(prev[path[0]]);
      var pts = [P[a]]; for (var i = 1; i < path.length; i++) { pts = pts.concat(via(path[i - 1], path[i])); pts.push(P[path[i]]); }
      return pts;
    }
    var here = 'entry', cur = P.entry.slice(), anim = 0, timer = null, visited = {};
    function setLamp(x, y) { cur = [x, y]; lamp.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'); }
    function light(room) {
      svg.querySelectorAll('.glow').forEach(function (g) { g.classList.toggle('on', g.dataset.room === room); });
      svg.querySelectorAll('.seen').forEach(function (g) { g.classList.toggle('on', !!visited[g.dataset.room] && g.dataset.room !== room); });
    }
    function travel(to, done) {
      cancelAnimationFrame(anim);
      var pts = route(here, to); pts[0] = cur.slice();
      here = to;
      if (reduce || pts.length < 2) { setLamp(P[to][0], P[to][1]); trail.setAttribute('d', 'M0 0'); if (done) done(); return; }
      var segs = [], total = 0; for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
      var dur = Math.min(1700, Math.max(650, total * 3.4)), t0 = performance.now();
      trail.classList.remove('fade'); trail.setAttribute('d', 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L'));
      var len = trail.getTotalLength ? trail.getTotalLength() : total; trail.style.strokeDasharray = '1 7'; trail.style.strokeDashoffset = 0;
      trail.style.clipPath = '';
      function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, dist = e * total, acc = 0;
        for (var j = 0; j < segs.length; j++) { if (acc + segs[j] >= dist || j === segs.length - 1) { var f = segs[j] ? (dist - acc) / segs[j] : 1; f = Math.min(1, Math.max(0, f));
          setLamp(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f); break; } acc += segs[j]; }
        if (k < 1) anim = requestAnimationFrame(step); else { trail.classList.add('fade'); if (done) done(); }
      }
      anim = requestAnimationFrame(step);
    }
    function show(b, announce) {
      btns.forEach(function (o) { var on = o === b; o.setAttribute('aria-expanded', on); d.getElementById(o.getAttribute('aria-controls')).hidden = !on; });
      var room = b.dataset.go, name = b.querySelector('.nm').textContent, tm = b.querySelector('.tm').textContent;
      visited[here] = 1;
      light(room); travel(room);
      if (planStatus) planStatus.textContent = tm + ' · ' + name;
      if (announce && status) status.textContent = 'Now in: ' + name + ', ' + tm;
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; walkBtn.textContent = 'Walk the whole route'; } }
    function inView(el) { var r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }
    btns.forEach(function (b) { b.addEventListener('click', function () { stop(); show(b, false); }); });
    svg.querySelectorAll('.room').forEach(function (r) {
      r.addEventListener('click', function () { var b = list.querySelector('[data-go="' + r.dataset.room + '"]'); if (!b) return; stop(); show(b, true);
        var li = b.closest('li'); if (!inView(li) && window.matchMedia('(max-width: 760px)').matches) li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); });
    });
    walkBtn.addEventListener('click', function () {
      if (timer) { stop(); return; }
      var i = 0; visited = {}; walkBtn.textContent = 'Stop the walk';
      function next() {
        if (i >= btns.length) { stop(); status.textContent = 'Route walked: seven rooms, the same order every visit.'; return; }
        show(btns[i], true); i++; timer = setTimeout(next, reduce ? 2600 : 2300);
      }
      next();
    });
    btns.forEach(function (o) { d.getElementById(o.getAttribute('aria-controls')).hidden = o !== btns[0]; });
    light('entry'); if (planStatus) planStatus.textContent = '07:52 · Entry and doors';
    // First sight of the plan: the lamp comes in from the street through the front door, once (not for reduced motion).
    if (!reduce && 'IntersectionObserver' in window) {
      setLamp(245, -14);
      var io = new IntersectionObserver(function (es) { if (!es[0].isIntersecting) return; io.disconnect();
        if (here !== 'entry' || timer) return; var t0 = performance.now();
        (function st(now) { var k = Math.min(1, (now - t0) / 1300), e = 1 - Math.pow(1 - k, 4), y = -14 + (75 + 14) * e;
          if (here === 'entry' && !timer) setLamp(245, y); if (k < 1) requestAnimationFrame(st); })(t0);
      }, { threshold: 0.45 });
      io.observe(svg);
    }
  })();

  /* 3. The email helper --------------------------------------------------------------- */
  (function () {
    var a = d.querySelector('[data-mail]'); if (!a) return;
    var form = a.closest('.plan-mail');
    function val(n) { var c = form.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : ''; }
    function update() {
      var body = 'Hello Tidelatch,\n\nI would like a first walk-through of my house in [town].\nVisits: ' + val('freq') + '.\nI leave in ' + val('when') + ' and come back in [month].\n\nThe best number to reach me: [your number]\n';
      a.href = 'mailto:hello@example.com?subject=' + encodeURIComponent('A first walk-through') + '&body=' + encodeURIComponent(body);
    }
    form.addEventListener('change', update); update();
  })();
})();
