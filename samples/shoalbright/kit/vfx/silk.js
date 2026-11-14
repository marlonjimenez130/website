/* vfx/silk.js · a silk distortion for one hero picture: the picture breathes like fabric in a slow draught,
   and the pointer presses a soft dimple into it that relaxes when it leaves.
   Use:  <div class="vfx-silk" data-silk data-strength="1">
           <img src="hero.jpg" width="1600" height="1000" alt="...">   (same-origin image; it stays the fallback)
         </div>
         <script src="vfx/silk.js" defer></script>
   The <img> is always in the page (no JavaScript, no WebGL2, reduced motion, slow image): it simply shows.
   When the shader is ready a canvas fades in over it, cropped like object-fit: cover.
   Budget: renders at 0.6x (phones 0.5x), at most 30 fps, one texture, one draw call; pauses off screen and in
   background tabs; about 4 KB. One silk picture per page. */
(() => {
  const els = [...document.querySelectorAll('[data-silk]')];
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const FRAG = `#version 300 es
  precision mediump float;
  uniform sampler2D I; uniform vec2 R, A; uniform float T, K; uniform vec3 P;
  in vec2 v; out vec4 o;
  float h(vec2 p){ return fract(sin(dot(p, vec2(17.1, 113.7))) * 43758.5); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    // cover-crop: A = image aspect / box aspect
    vec2 uv = v; vec2 s = A.x > 1. ? vec2(1. / A.x, 1.) : vec2(1., A.x);
    vec2 c = (uv - .5) * s + .5;
    float t = T * .35;
    vec2 w = vec2(n(uv * 3. + vec2(t, 0.)), n(uv * 3. + vec2(0., t * .8) + 4.)) - .5;
    float fold = sin((uv.x * 2.2 + uv.y * 1.3 + w.x * 1.6) * 6.2831 - t * 1.4);
    vec2 d = w * .010 + vec2(fold * .004, fold * .006);
    vec2 pv = (uv - P.xy) * vec2(R.x / R.y, 1.);
    float dimple = exp(-dot(pv, pv) * 18.) * P.z;
    d -= normalize(pv + 1e-5) * dimple * .022;
    vec3 col = texture(I, c + d * K).rgb;
    col *= 1. + fold * .025 * K - dimple * .06;   // light catches the folds
    o = vec4(col, 1.);
  }`;
  els.forEach((el) => {
    const img = el.querySelector('img'); if (!img) return;
    const K = +(el.dataset.strength || 1);
    const go = () => {
      const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1s cubic-bezier(.445,.05,.55,.95)';
      const gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false });
      if (!gl) return;
      try {
        const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a;out vec2 v;void main(){v=vec2(a.x,-a.y)*.5+.5;gl_Position=vec4(a,0.,1.);}'));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        const U = (k) => gl.getUniformLocation(pr, k), uR = U('R'), uA = U('A'), uT = U('T'), uP = U('P');
        gl.uniform1f(U('K'), K);
        const scale = (coarse ? .5 : .6) * Math.min(devicePixelRatio || 1, 2);
        const fit = () => { const w = Math.max(2, Math.round(el.clientWidth * scale)), h = Math.max(2, Math.round(el.clientHeight * scale));
          if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); } };
        const ptr = { x: .5, y: .5, z: 0, tx: .5, ty: .5, tz: 0 };
        const draw = (t) => { ptr.x += (ptr.tx - ptr.x) * .1; ptr.y += (ptr.ty - ptr.y) * .1; ptr.z += (ptr.tz - ptr.z) * .06;
          gl.uniform2f(uR, cv.width, cv.height); gl.uniform2f(uA, (img.naturalWidth / img.naturalHeight) / (cv.width / cv.height), 0);
          gl.uniform1f(uT, t); gl.uniform3f(uP, ptr.x, ptr.y, ptr.z); gl.drawArrays(gl.TRIANGLES, 0, 3); };
        el.style.position = el.style.position || 'relative'; el.append(cv); fit();
        new ResizeObserver(fit).observe(el);
        el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); ptr.tx = (e.clientX - r.left) / r.width; ptr.ty = (e.clientY - r.top) / r.height; ptr.tz = 1; }, { passive: true });
        el.addEventListener('pointerleave', () => { ptr.tz = 0; });
        const t0 = performance.now(); let on = false, run = false, last = 0;
        const loop = (now) => { if (!on || document.hidden) { run = false; return; } if (now - last > 32) { last = now; draw((now - t0) / 1000); } requestAnimationFrame(loop); };
        const start = () => { if (!run) { run = true; requestAnimationFrame(loop); } };
        new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) start(); }).observe(el);
        document.addEventListener('visibilitychange', () => { if (!document.hidden && on) start(); });
        draw(0); requestAnimationFrame(() => { cv.style.opacity = 1; });
        cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cv.remove(); });
      } catch (e) { /* the picture stays */ }
    };
    img.complete && img.naturalWidth ? go() : img.addEventListener('load', go, { once: true });
  });
})();
