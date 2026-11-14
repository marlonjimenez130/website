/* Rootwater Plumbing Co.: the choreography. Each part runs only if its element exists; everything rests in its final
   state for reduced motion; without JavaScript the page is complete and readable (hidden states live under .js). */
(() => {
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // Split an element's text into word spans (keeps inline elements like <em>), numbering them with --i.
  function splitWords(el, cls) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const s = document.createElement("span");
            s.className = cls; s.style.setProperty("--i", i++); s.textContent = part;
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return i;
  }

  // ---------- header state and the phone bar
  const onScrollClass = () => html.classList.toggle("is-scrolled", scrollY > 60);
  // the black strip slides away on scroll: its real height (it wraps to two lines on small phones)
  const strip = document.querySelector(".strip");
  const stripH = () => strip && html.style.setProperty("--strip", strip.offsetHeight + "px");
  stripH(); addEventListener("resize", stripH);

  // ---------- 1. the drop lands, the water ripples, the headline arrives
  const hero = document.querySelector(".hero");
  if (hero) {
    const title = hero.querySelector("[data-words]");
    if (title) splitWords(title, "w");
    hero.querySelectorAll(".proof li").forEach((li, i) => li.style.setProperty("--i", i));
    const drop = hero.querySelector(".hero__drop");
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      if (drop && window.__water) {
        const c = hero.querySelector("[data-water]").getBoundingClientRect(), d = drop.getBoundingClientRect();
        const x = (d.left + d.width / 2 - c.left) / c.width, y = (d.bottom - c.top) / c.height;
        window.__water.ripple(x, y, 1.35);
        setTimeout(() => window.__water && window.__water.ripple(x, y, .6), 260);
      }
      hero.classList.add("is-landed");
    };
    if (reduce || !drop) land();
    else { drop.addEventListener("animationend", land, { once: true }); setTimeout(land, 1700); }
  }

  // ---------- 2. statement: words light up as you read
  const statement = document.querySelector("[data-fill]");
  let fillCount = 0;
  if (statement) fillCount = splitWords(statement, "w2");

  // ---------- 3. the story, scrubbed by scroll
  const track = document.querySelector("[data-story]");
  const story = track && track.closest(".story");
  if (story) story.querySelector(".story__caps").classList.add("is-live");

  function frame() {
    onScrollClass();
    const vh = innerHeight;
    if (statement) {
      const r = statement.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      statement.style.setProperty("--fill", (p * (fillCount + 6) - 3).toFixed(2));
    }
    if (story) {
      const r = track.getBoundingClientRect();
      // pre-rolled: the pipes are already drawing as the stage pins, so it never arrives as an empty cabinet
      const p = clamp((vh * 0.5 - r.top) / (r.height - vh * 0.5), 0, 1);
      const s = [0, 1, 2, 3].map((i) => clamp(p * 4.2 - i * 1.05, 0, 1));
      s.forEach((v, i) => story.style.setProperty(`--s${i + 1}`, v.toFixed(3)));
      story.style.setProperty("--drip", ((p * 4.2 * 3) % 1).toFixed(3));
      story.style.setProperty("--pud", (clamp((s[0] + s[1]) / 1.4, 0, 1) * (1 - s[3])).toFixed(3));
      story.dataset.step = String(Math.min(3, Math.floor(clamp(p * 4.2 - 0.15, 0, 3.99))));
    }
  }
  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
  addEventListener("scroll", () => { onScrollClass(); request(); }, { passive: true });
  addEventListener("resize", request);
  frame();

  // ---------- reveals, the map, counters (when they come into view)
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    if (e.target.dataset.count !== undefined) count(e.target);
    io.unobserve(e.target);
  }), { threshold: 0.1 });
  // a counter inside an SVG (a tspan) is watched through its [data-roll] figure, which needs to be 45% on screen
  const rio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); rio.unobserve(e.target); const n = e.target.querySelector("[data-count]"); if (n) count(n); } }), { threshold: 0.45 });
  document.querySelectorAll("[data-reveal], [data-map], [data-count]").forEach((el) => { if (!el.closest("[data-roll]")) io.observe(el); });
  document.querySelectorAll("[data-roll]").forEach((el) => (reduce ? el.classList.add("is-arrived") : rio.observe(el)));

  // count up to the number already in the HTML; a [data-roll] figure around it rolls while counting, then arrives
  function count(el) {
    const to = +el.dataset.count, from = +(el.dataset.from || 0), roll = el.closest("[data-roll]");
    const done = () => roll && roll.classList.add("is-arrived");
    if (reduce || to === from) { el.textContent = to; done(); return; }
    let t0;
    const dur = +(el.dataset.dur || 1400);
    const step = (t) => {
      t0 ??= t;
      const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    if (roll) roll.classList.add("is-rolling");
    el.textContent = from;
    requestAnimationFrame(step);
  }

  // ---------- service areas: the sticky map follows the town you're reading (desktop; CSS ignores it on phones)
  const tour = document.querySelector("[data-tour]");
  if (tour) {
    const now = tour.querySelector(".map__now");
    const names = { naples: "Naples and Golden Gate", "marco-island": "Naples to Marco Island", "bonita-springs": "Naples to Bonita Springs", estero: "Naples to Estero" };
    const tio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      if (id && names[id]) { tour.dataset.town = id; if (now) now.textContent = "Showing: " + names[id] + "."; }
      else { delete tour.dataset.town; if (now) now.textContent = ""; }
    }), { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll(".areas__towns .town").forEach((t) => tio.observe(t));
  }

  // ---------- the price sheet (home): a job link opens the job's price line before the form.
  // A native <dialog>: focus moves into it, Escape and the backdrop close it, focus returns to the link.
  const sheet = document.getElementById("price-sheet");
  if (sheet && typeof sheet.showModal === "function") {
    const $ = (k) => sheet.querySelector(`[data-sheet-${k}]`);
    let opener = null;
    document.querySelectorAll("a[data-sheet]").forEach((a) => a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      opener = a;
      $("job").textContent = a.textContent;
      $("name").textContent = a.dataset.sheet;
      $("ph").textContent = a.dataset.ph || "[from price range]";
      $("send").href = a.href;
      sheet.showModal();
      $("call").focus();
    }));
    const close = () => sheet.close();
    $("close").addEventListener("click", close);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });
    sheet.addEventListener("close", () => { if (opener) opener.focus(); });
  }

  // ---------- phone menu: the button, Esc or a link closes it; focus goes to the first link; scroll locked
  const top = document.querySelector(".top"), toggle = document.querySelector(".top__toggle"), menu = document.getElementById("site-menu");
  if (top && toggle && menu) {
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
    const set = (on, back) => {
      toggle.setAttribute("aria-expanded", String(on));
      html.classList.toggle("menu-open", on);
      if (on) {
        html.style.setProperty("--menu-top", Math.max(0, top.getBoundingClientRect().bottom) + "px");
        const a = menu.querySelector("a"); if (a) setTimeout(() => a.focus(), 60);
      } else if (back) toggle.focus();
    };
    toggle.addEventListener("click", () => set(!isOpen()));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) set(false, true); });
    top.addEventListener("focusout", (e) => { if (isOpen() && e.relatedTarget && !top.contains(e.relatedTarget)) set(false); });
    matchMedia("(min-width: 981px)").addEventListener("change", (e) => { if (e.matches) set(false); });
  }

  // ---------- FAQ: with data-single, opening one answer closes the others
  document.querySelectorAll(".faq[data-single]").forEach((q) => q.addEventListener("toggle", (e) => {
    if (e.target.open) q.querySelectorAll("details[open]").forEach((x) => { if (x !== e.target) x.open = false; });
  }, true));

  // ---------- the guided first question: contact/?job=leak#quote preselects the job type
  const job = new URLSearchParams(location.search).get("job"), jobSelect = document.getElementById("q-job");
  if (job && jobSelect && [...jobSelect.options].some((o) => o.value === job)) jobSelect.value = job;

  // ---------- forms: errors in words under each field, a status line, a honeypot; data-demo sends nothing
  document.querySelectorAll("form.form").forEach((form) => {
    const status = form.querySelector('[role="status"]'), hp = form.querySelector(".form__hp input");
    const fields = [...form.querySelectorAll("input, select, textarea")].filter((f) => !f.closest(".form__hp") && f.type !== "hidden");
    form.noValidate = true;
    const msg = (f) => {
      const v = f.validity;
      return v.valid ? "" : v.valueMissing ? f.dataset.required || "Please fill this in."
        : v.typeMismatch && f.type === "email" ? "Please enter an email like name@example.com." : f.dataset.invalid || "Please check this.";
    };
    const mark = (f, m) => {
      const id = f.id + "-error";
      let er = document.getElementById(id);
      if (!er) {
        er = document.createElement("p"); er.className = "field__error"; er.id = id;
        (f.closest(".field") || f.parentElement).append(er);
        f.setAttribute("aria-describedby", ((f.getAttribute("aria-describedby") || "") + " " + id).trim());
      }
      er.textContent = m; er.hidden = !m;
      if (m) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid");
    };
    const say = (t, bad) => { if (status) { status.textContent = t; status.classList.toggle("is-error", !!bad); } };
    fields.forEach((f) => {
      f.addEventListener("blur", () => { if (f.value) mark(f, msg(f)); });
      f.addEventListener("input", () => { if (f.getAttribute("aria-invalid")) mark(f, msg(f)); });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const bad = fields.filter((f) => { const m = msg(f); mark(f, m); return m; });
      if (bad.length) { say(bad.length > 1 ? `Please fix the ${bad.length} fields marked below.` : "Please fix the field marked below.", true); bad[0].focus(); return; }
      const first = ((form.elements.name || {}).value || "").trim().split(/\s+/)[0] || "there";
      if (hp && hp.value) { say("Thanks."); return; }
      say((form.dataset.demo || "Thanks, {name}. This is a concept site, so nothing was sent.").replace("{name}", first));
    });
  });

  window.siteReady = true;
})();
