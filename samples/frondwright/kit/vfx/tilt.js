/* vfx/tilt.js · a depth layer: a framed object turns slightly toward the pointer and its layers separate.
   Use:  <div data-tilt="6">                       (max degrees, default 5)
           <img data-depth="0" ...>                 (back layer)
           <span data-depth="0.6" ...>              (front layers move more)
         </div>
         <script src="vfx/tilt.js" defer></script>
   Input: a fine pointer over the element. On touch devices it uses device orientation only where the browser
   gives it without a permission prompt (Android Chrome); iOS asks for permission, so there it stays still
   rather than nag the visitor.
   Budget: transforms only, one rAF loop that stops when the layer has settled; no layout reads in the loop
   (the box is measured on pointerenter). Reduced motion or no input: the object rests flat. */
(() => {
  const els = [...document.querySelectorAll('[data-tilt]')];
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  els.forEach((el) => {
    const max = +el.dataset.tilt || 5;
    const layers = [...el.querySelectorAll('[data-depth]')].map((l) => [l, +l.dataset.depth || 0]);
    el.style.transformStyle = 'preserve-3d';
    let box = null, tx = 0, ty = 0, x = 0, y = 0, raf = 0, visible = true;
    const paint = () => {
      x += (tx - x) * .09; y += (ty - y) * .09;
      el.style.transform = `perspective(1100px) rotateX(${(-y * max).toFixed(3)}deg) rotateY(${(x * max).toFixed(3)}deg)`;
      for (const [l, d] of layers) l.style.transform = `translate3d(${(x * d * 14).toFixed(2)}px,${(y * d * 14).toFixed(2)}px,0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > .001 ? requestAnimationFrame(paint) : 0;
    };
    const aim = (nx, ny) => { tx = Math.max(-1, Math.min(1, nx)); ty = Math.max(-1, Math.min(1, ny)); if (!raf && visible) raf = requestAnimationFrame(paint); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
    if (fine) {
      el.addEventListener('pointerenter', () => { box = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', (e) => { if (!box) box = el.getBoundingClientRect();
        aim(((e.clientX - box.left) / box.width - .5) * 2, ((e.clientY - box.top) / box.height - .5) * 2); }, { passive: true });
      el.addEventListener('pointerleave', () => { box = null; aim(0, 0); });
      addEventListener('scroll', () => { box = null; }, { passive: true });
    } else if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      let base = null;
      addEventListener('deviceorientation', (e) => { if (e.beta == null || !visible) return;
        if (!base) base = [e.gamma, e.beta];
        aim((e.gamma - base[0]) / 25, (e.beta - base[1]) / 25); }, { passive: true });
    }
  });
})();
