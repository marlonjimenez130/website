/* vfx/lightfield.js · a slow field of light: silk-like bands of warm light drifting over a ground, like sun
   through a linen curtain. WebGL2 fragment shader (original), a Canvas 2D fallback, and a CSS fallback.
   Use:  <div class="vfx-field" data-lightfield data-ground="#f5f2ec" data-light="#fffaf0" data-shade="#e4dccd"
                data-speed="1" data-strength="1"></div>  (absolutely fill a section; put content above it)
         <script src="vfx/lightfield.js" defer></script>
   Budget: renders at 0.35x (phones 0.3x) of CSS pixels, capped at 30 fps, one draw call; pauses off screen and
   in background tabs; under 4 KB. Reduced motion: one still frame. No WebGL2: Canvas 2D gradients at 15 fps.
   No JavaScript: the element keeps its CSS background (set one; see README). */
(() => {
  const els = [...document.querySelectorAll('[data-lightfield]')];
  if (!els.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const hex = (v, d) => { const m = /^#?([0-9a-f]{6})$/i.exec(v || d); const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  const FRAG = `#version 300 es
  precision mediump float;
  uniform vec2 R; uniform float T; uniform vec3 G, L, S; uniform float K;
  out vec4 o;
  float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 13758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fb(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
  void main(){
    vec2 uv = gl_FragCoord.xy / R; vec2 p = uv * vec2(R.x / R.y, 1.);
    float t = T * .045;
    // warp twice: folds of cloth, then the light that falls through them
    vec2 q = vec2(fb(p * 1.3 + vec2(0., t)), fb(p * 1.3 + vec2(5.2, -t * .8)));
    vec2 r = vec2(fb(p * 1.1 + 2.2 * q + vec2(1.7, 9.2) + t * .6), fb(p * 1.1 + 2.2 * q + vec2(8.3, 2.8) - t * .5));
    float folds = fb(p * .9 + 2.6 * r);
    float bands = .5 + .5 * sin((p.x * 1.6 + p.y * .7 + folds * 3.2 - t * 2.) * 3.14159);
    float light = smoothstep(.35, 1., bands) * (.55 + .45 * folds);
    float shade = smoothstep(.55, .0, folds) * .6;
    vec3 c = mix(G, S, shade * K);
    c = mix(c, L, light * .75 * K);
    c += (h(gl_FragCoord.xy + fract(T) * 61.) - .5) * .012;   // dither, kills banding
    o = vec4(c, 1.);
  }`;

  els.forEach((el) => {
    const ds = el.dataset, G = hex(ds.ground, '#f5f2ec'), L = hex(ds.light, '#fffaf0'), S = hex(ds.shade, '#e4dccd');
    const speed = +ds.speed || 1, K = +(ds.strength || 1);
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.2s cubic-bezier(.445,.05,.55,.95)';
    el.append(cv);
    const scale = coarse ? .3 : .35;
    let draw, size;
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (gl) {
      try {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const u = (k) => gl.getUniformLocation(pr, k);
        gl.uniform3fv(u('G'), G); gl.uniform3fv(u('L'), L); gl.uniform3fv(u('S'), S); gl.uniform1f(u('K'), K);
        const uR = u('R'), uT = u('T');
        size = () => gl.viewport(0, 0, cv.width, cv.height);
        draw = (t) => { gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };
      } catch (e) { draw = null; }
    }
    if (!draw) { // Canvas 2D fallback: three soft lights drifting on the ground
      const c = cv.getContext('2d'); if (!c) return cv.remove();
      const css = (a, k = 1) => `rgba(${a.map((x) => Math.round(x * 255)).join(',')},${k})`;
      size = () => {};
      draw = (t) => { const w = cv.width, h = cv.height; c.fillStyle = css(G); c.fillRect(0, 0, w, h);
        for (let i = 0; i < 3; i++) { const x = w * (.5 + .38 * Math.sin(t * .05 + i * 2.1)), y = h * (.5 + .3 * Math.cos(t * .04 + i * 1.3)), r = Math.max(w, h) * .55;
          const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(i === 1 ? S : L, .8 * K)); g.addColorStop(1, css(i === 1 ? S : L, 0));
          c.fillStyle = g; c.fillRect(0, 0, w, h); } };
    }
    const fit = () => { const w = Math.max(2, Math.round(el.clientWidth * scale)), h = Math.max(2, Math.round(el.clientHeight * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; size(); } };
    const t0 = performance.now() - 40000 * Math.random();
    let on = false, running = false, last = 0;
    const frameMs = gl && draw ? 33 : 66;
    const loop = (now) => { if (!on || document.hidden) { running = false; return; }
      if (now - last >= frameMs) { last = now; draw((now - t0) / 1000 * speed); }
      requestAnimationFrame(loop); };
    const start = () => { if (reduce || running) return; running = true; requestAnimationFrame(loop); };
    new ResizeObserver(() => { fit(); draw(reduce ? 12 : (performance.now() - t0) / 1000 * speed); }).observe(el);
    fit(); draw(12); cv.style.opacity = 1;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) start(); }).observe(el);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && on) start(); });
    if (gl) cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); on = false; cv.remove(); });
  });
})();
