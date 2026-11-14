/* Web Studio kit · sfx.js: quiet interface sounds made live with the Web Audio API (no audio files).
   OFF by default. Sound starts only after the visitor presses a visible sound toggle (a user gesture), and it
   never plays on load, on scroll or on its own. Every new page starts silent; nothing is stored.
   Markup:
     <button class="m-sound" type="button" data-sfx-toggle aria-pressed="false" hidden>
       <svg viewBox="0 0 20 20" aria-hidden="true">…speaker, <path class="on">waves</path>, <path class="off">cross</path>…</svg><span>Sound</span></button>
     (the script un-hides it; without JavaScript or Web Audio it stays hidden)
     <a href="#price" data-sfx="tap">…</a>       sounds: tap, confirm, open, arrive, toggle
   Events it also listens for: <details> opening plays "open"; motion.js's m:arrive plays "arrive".
   Budget: about 3 KB; one AudioContext, created on the first press of the toggle; every sound under 0.6 s,
   peak level about -20 dBFS, so it sits under any music the visitor is playing. */
(() => {
  const toggles = [...document.querySelectorAll('[data-sfx-toggle]')];
  if (!toggles.length || !('AudioContext' in window || 'webkitAudioContext' in window)) { toggles.forEach((t) => t.hidden = true); return; }
  let ctx = null, out = null, on = false;
  const set = (v) => { on = v; toggles.forEach((t) => t.setAttribute('aria-pressed', String(v))); };
  const boot = () => {
    if (ctx) return ctx.state === 'suspended' ? ctx.resume() : null;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); out.gain.value = .1;                    // about -20 dBFS master
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    out.connect(lp).connect(ctx.destination);
  };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  const tone = (f, t, a, d, peak = 1, type = 'sine', glide) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + a + d);
    env(g, t, a, peak, d); o.connect(g).connect(out); o.start(t); o.stop(t + a + d + .05);
  };
  const noise = (t, d, f, q, peak) => {
    const len = Math.ceil(ctx.sampleRate * d), b = ctx.createBuffer(1, len, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b;
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(f[0], t); bp.frequency.exponentialRampToValueAtTime(f[1], t + d); bp.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + d * .45); g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(bp).connect(g).connect(out); s.start(t);
  };
  const SOUNDS = {
    tap: (t) => { tone(1850, t, .002, .045, .5, 'sine', 1200); noise(t, .03, [3000, 2000], 1.2, .25); },              // a soft key
    toggle: (t) => { tone(660, t, .003, .07, .45, 'triangle'); },
    confirm: (t) => { tone(587.33, t, .006, .22, .45); tone(880, t + .07, .006, .32, .4); },                             // D5 then A5, a fifth
    open: (t) => { noise(t, .32, [500, 2400], .9, .35); tone(392, t + .02, .08, .25, .12); },                            // fabric drawn back
    arrive: (t) => { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * .035, .01, .55, .22)); tone(1046.5, t + .1, .01, .35, .06); }, // a soft chime
  };
  const play = (name) => { if (!on || !ctx || !SOUNDS[name]) return; if (ctx.state === 'suspended') ctx.resume(); SOUNDS[name](ctx.currentTime + .005); };
  window.mSound = { play, get on() { return on; } };
  set(false); // silent until the visitor presses the toggle; the AudioContext is only made inside that click
  toggles.forEach((t) => { t.hidden = false; t.addEventListener('click', () => { boot(); set(!on); if (on) play('toggle'); }); });
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-sfx]'); if (el) play(el.dataset.sfx); });
  document.addEventListener('toggle', (e) => { if (e.target.tagName === 'DETAILS' && e.target.open) play('open'); }, true);
  document.addEventListener('m:arrive', () => setTimeout(() => play('arrive'), 420));
})();
