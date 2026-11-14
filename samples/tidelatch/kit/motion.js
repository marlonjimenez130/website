/* Web Studio motion kit · motion.js (deferred, vanilla, no dependencies).
   Each part runs only if its markup exists. Pairs with motion.css. In the page head:
   <script>document.documentElement.classList.add('js');setTimeout(function(){window.mReady||document.documentElement.classList.remove('js')},3000)</script> */
(() => {
  const d = document, R = d.documentElement, $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const mq = (q) => matchMedia(q).matches;
  const reduce = mq('(prefers-reduced-motion: reduce)');
  const fine = mq('(hover: hover) and (pointer: fine)');
  const IO = 'IntersectionObserver' in window;
  const CSS_TIMELINE = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  window.mReady = true;
  R.classList.add('js');
  const watch = (els, fn, opt) => { if (!els.length) return; const o = new IntersectionObserver((es) => es.forEach((e) => fn(e, o)), opt); els.forEach((el) => o.observe(el)); };

  // 1. Text lines: split a heading into its rendered lines once, animate, then restore the plain text.
  const splitLines = () => $$('[data-lines]').forEach((h) => {
    h.classList.add('is-split');
    if (reduce) return;
    const html = h.innerHTML, text = h.textContent.trim().replace(/\s+/g, ' ');
    const words = text.split(' ');
    h.innerHTML = words.map((w) => `<span class="m-w">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
    const lines = [];
    let top = null;
    $$('.m-w', h).forEach((s) => { const t = s.offsetTop; if (t !== top) { lines.push([]); top = t; } lines[lines.length - 1].push(s.textContent); });
    h.setAttribute('aria-label', text);
    h.innerHTML = lines.map((l, i) => `<span class="m-line" aria-hidden="true"><span style="--l:${i}">${l.join(' ')}</span></span>`).join('');
    const done = () => { h.innerHTML = html; h.removeAttribute('aria-label'); };
    const last = h.querySelector('.m-line:last-child > span');
    last ? last.addEventListener('animationend', done, { once: true }) : done();
    setTimeout(done, 3200); // safety: never leave it split
  });

  // 2. Load choreography: wait for fonts (max 700 ms) so lines are measured with the real face, then go.
  const ready = () => { splitLines(); R.classList.add('m-ready'); };
  if (d.fonts && d.fonts.ready) Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 700))]).then(ready); else ready();

  // 3. Reveals and arrivals: add .is-in once, when 12% is on screen. Stagger children get --i.
  $$('[data-stagger]').forEach((p) => [...p.children].forEach((c, i) => c.style.setProperty('--i', i)));
  const revealables = $$('.m-reveal, [data-stagger], .m-arrive, .m-unveil');
  if (!IO || reduce) revealables.forEach((el) => el.classList.add('is-in'));
  else watch(revealables, (e, o) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    // a picture arrives only once it has loaded, so the settle is never wasted on an empty frame
    const img = el.matches('.m-arrive') && el.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', () => el.classList.add('is-in'), { once: true }), img.addEventListener('error', () => el.classList.add('is-in'), { once: true });
    else el.classList.add('is-in');
    o.unobserve(el);
  }, { rootMargin: '0px 0px -12% 0px' });

  // 4. Scroll-linked progress fallback (--p on [data-parallax]/[data-grow], --pin and data-step on .m-pin).
  const linked = $$('[data-parallax], [data-grow]'), pins = $$('.m-pin');
  pins.forEach((p) => p.style.setProperty('--steps', p.dataset.steps || 3));
  if (!reduce && (linked.length || pins.length)) {
    const live = new Set(CSS_TIMELINE ? [] : linked);
    let raf = 0;
    const frame = () => {
      raf = 0;
      const vh = innerHeight;
      live.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        el.style.setProperty('--p', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(4)); });
      pins.forEach((el) => { const r = el.getBoundingClientRect(); const span = r.height - vh; if (span <= 0) return;
        const p = Math.min(1, Math.max(0, -r.top / span));
        if (!CSS_TIMELINE) el.style.setProperty('--pin', p.toFixed(4));
        const n = +el.dataset.steps || 3, step = Math.min(n, 1 + Math.floor(p * n * .999));
        if (el.dataset.step !== String(step)) { el.dataset.step = step; el.dispatchEvent(new CustomEvent('m:step', { detail: step })); } });
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); ask();
  } else pins.forEach((el) => { el.dataset.step = el.dataset.steps || 3; });

  // 5. Header tone follows the section under it: sections carry data-tone="dark|light".
  //    Put data-header-tone="auto" in the markup and style it light by default and dark under .js, so the header
  //    is readable without JavaScript too.
  //    It reads the section just below the header's bottom edge (plus a margin, so the header turns solid
  //    before anything from the dark section, such as a film's Pause button, can slide under it).
  const head = d.querySelector('[data-header-tone]');
  if (head && $$('[data-tone]').length) {
    let rq = 0;
    const tone = () => { rq = 0; const y = head.getBoundingClientRect().bottom + 56;
      const hit = d.elementsFromPoint(innerWidth / 2, Math.min(innerHeight - 1, y)).find((el) => !head.contains(el) && el.closest('[data-tone]'));
      const t = hit ? hit.closest('[data-tone]').dataset.tone : 'light';
      if (head.dataset.headerTone !== t) head.dataset.headerTone = t; };
    addEventListener('scroll', () => { if (!rq) rq = requestAnimationFrame(tone); }, { passive: true });
    addEventListener('resize', tone); tone();
  }

  // 6. Anchors: smooth (unless reduced motion), land below the sticky header, move focus for keyboard and screen readers.
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute('href').length < 2) return;
    const t = d.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (!t) return;
    e.preventDefault();
    const off = parseFloat(getComputedStyle(R).getPropertyValue('--anchor-offset')) || 0;
    scrollTo({ top: t.getBoundingClientRect().top + scrollY - off, behavior: reduce ? 'auto' : 'smooth' });
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
    history.pushState(null, '', a.getAttribute('href'));
    d.dispatchEvent(new CustomEvent('m:arrive', { detail: t }));
  });

  // 7. Magnetic controls and the cursor follower: fine pointers only, never for reduced motion.
  if (fine && !reduce) {
    $$('[data-magnetic]').forEach((el) => {
      const k = +el.dataset.magnetic || 6;
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect();
        el.style.transform = `translate3d(${((e.clientX - r.left) / r.width - .5) * k}px,${((e.clientY - r.top) / r.height - .5) * k}px,0)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    const zones = $$('[data-follow]');
    if (zones.length) {
      const f = d.createElement('div'); f.className = 'm-follow'; f.setAttribute('aria-hidden', 'true'); d.body.append(f);
      let x = -100, y = -100, tx = x, ty = y, run = false;
      const tick = () => { x += (tx - x) * .18; y += (ty - y) * .18; f.style.setProperty('--fx', x.toFixed(1) + 'px'); f.style.setProperty('--fy', y.toFixed(1) + 'px');
        if (Math.abs(tx - x) + Math.abs(ty - y) > .3) requestAnimationFrame(tick); else run = false; };
      const go = () => { if (!run) { run = true; requestAnimationFrame(tick); } };
      zones.forEach((z) => {
        z.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; x = tx = e.clientX; y = ty = e.clientY; f.classList.add('is-on'); go(); });
        z.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; go(); }, { passive: true });
        z.addEventListener('pointerleave', () => f.classList.remove('is-on', 'is-press'));
        z.addEventListener('pointerdown', () => f.classList.add('is-press'));
        z.addEventListener('pointerup', () => f.classList.remove('is-press'));
      });
    }
  }

  // 8. Video stages: play only on screen, never with reduced motion or Save-Data, and a Pause/Play control
  //    whose choice the scroll observer respects (WCAG 2.2.2). Markup: README.md.
  const saveData = navigator.connection && navigator.connection.saveData;
  $$('.m-stage').forEach((st) => {
    const v = st.querySelector('video'), btn = st.querySelector('.m-stage__toggle'); if (!v) return;
    const what = st.dataset.name || 'video';
    let chosen = null, onScreen = false; // chosen: null (auto), 'play' or 'pause' (the visitor's choice wins)
    const label = () => { if (!btn) return; const paused = v.paused;
      btn.classList.toggle('is-paused', paused);
      btn.querySelector('.t').textContent = paused ? 'Play' : 'Pause';
      btn.querySelector('.m-stage__sr').textContent = ` the ${what}`; };
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => label()); };
    v.addEventListener('playing', () => { st.classList.add('is-playing'); label(); });
    v.addEventListener('pause', label);
    const auto = !reduce && !saveData && IO;
    if (btn) { btn.hidden = false; label();
      btn.addEventListener('click', () => { if (v.paused) { chosen = 'play'; if (v.preload === 'none') v.preload = 'auto'; play(); } else { chosen = 'pause'; v.pause(); } }); }
    // A film starts only after it has stayed on screen for a moment (data-dwell ms, default 450),
    // so visitors who fling past never download it.
    let dwell = 0;
    if (IO) watch([st], (e) => { onScreen = e.isIntersecting; clearTimeout(dwell);
      if (!onScreen) { if (!v.paused) v.pause(); return; }
      if (chosen === 'play' || (chosen === null && auto)) dwell = setTimeout(() => onScreen && play(), +(st.dataset.dwell ?? 450)); }, { threshold: .25 });
    d.addEventListener('visibilitychange', () => { if (d.hidden) v.pause(); else if (onScreen && (chosen === 'play' || (chosen === null && auto))) play(); });
  });

  // 9. Press feedback for sound and haptics hooks: other modules listen for m:press.
  d.addEventListener('pointerdown', (e) => { const t = e.target.closest('[data-sfx]'); if (t) d.dispatchEvent(new CustomEvent('m:press', { detail: t })); });
})();
