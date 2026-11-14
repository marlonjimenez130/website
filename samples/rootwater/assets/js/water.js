/* Live Gulf water for the hero: caustic light, light shafts and ripples, rendered on the GPU (WebGL2, no libraries).
   - A drop lands on load and its ripple reveals the headline (site.js calls window.__water.ripple).
   - The pointer leaves soft ripples and carries a small light; a tap or click makes a big one.
   - Pauses when off screen or in a background tab; renders one still frame under reduced motion.
   - No WebGL: <html> gets .no-water and the CSS shows a painted gradient instead. */
(() => {
  const canvas = document.querySelector("[data-water]");
  if (!canvas) return;
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false,
                                            powerPreference: "high-performance", preserveDrawingBuffer: false });
  if (!gl) { html.classList.add("no-water"); return; }

  const VERT = `#version 300 es
  in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec2 uPtr; uniform float uPtrOn;
  uniform vec4 uRip[10];
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uLight; uniform vec3 uGlint;
  out vec4 outColor;

  vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= .5; } return v; }

  // Distance between the two nearest moving cell points: thin where light focuses, like light through ripples.
  float edge(vec2 x, float t){
    vec2 n = floor(x), f = fract(x); float f1 = 8., f2 = 8.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      vec2 g = vec2(float(i), float(j)); vec2 o = h2(n + g);
      o = .5 + .42 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
    }
    return f2 - f1;
  }
  float caustic(vec2 w, float t){
    float c = pow(1. - smoothstep(0., .12, edge(w * 4.4, t * .6)), 3.4);
    c += .6 * pow(1. - smoothstep(0., .09, edge(w * 7.1 + vec2(3.1, 1.7), t * .85 + 1.3)), 3.6);
    return c;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * asp, uv.y);
    float t = uTime;

    // ripples bend the light (displacement) and catch a glint on their crest
    vec2 disp = vec2(0.); float crest = 0.;
    for (int i = 0; i < 10; i++){
      vec4 r = uRip[i];
      if (r.w <= 0.) continue;
      float age = t - r.z;
      if (age < 0. || age > 7.) continue;
      vec2 d = p - vec2(r.x * asp, r.y);
      float dist = length(d);
      float k = dist - age * .3;
      float env = exp(-k * k * 70.) * exp(-age * .7) * r.w;
      float wave = sin(k * 62.) * env;
      disp += d / (dist + 1e-4) * wave * .014;
      crest += max(0., wave);
    }

    vec2 q = p + disp;
    vec2 w = q + .5 * vec2(fbm(q * 1.7 + vec2(0., t * .09)), fbm(q * 1.7 + vec2(5.2, -t * .08)));
    vec3 caus = vec3(caustic(w + vec2(.004, 0.), t), caustic(w, t), caustic(w - vec2(.004, 0.), t));
    float sun = smoothstep(.28, .82, fbm(q * .75 + vec2(t * .03, -t * .02)));   // sunlit patches drift by

    vec3 col = mix(uDeep, uShallow, smoothstep(-.15, 1.15, uv.y * .75 + uv.x * .35));
    col += (fbm(q * 13.) - .5) * .035;                                   // sand on the bottom

    float shafts = 0.;
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      float x = uv.x + uv.y * .38 - .32 - .27 * fi + .035 * sin(t * .21 + fi * 1.7);
      shafts += smoothstep(.11, 0., abs(x)) * (.45 + .3 * sin(t * .33 + fi * 2.1));
    }
    shafts *= smoothstep(.05, 1., uv.y);

    vec2 pp = vec2(uPtr.x * asp, uPtr.y);
    float spot = exp(-dot(p - pp, p - pp) * 16.) * uPtrOn;

    col += caus * uLight * (.04 + .26 * sun) * (.45 + .55 * smoothstep(0., 1., uv.y));
    col += shafts * uLight * .15;
    col += crest * uGlint * .55;                                           // glints on the ripple crests
    col += spot * (uLight * .75 + caus * .6) * .28;

    // The right side: dark mangrove prop roots stand in the water (about 24% at rest; Rootwater's own copy of the
    // Effects water). Each root arches out from a trunk above the frame and down into the sand. Bright caustics wrap
    // around them instead of crossing them, and the pointer's light catches their edges.
    float right = smoothstep(.6, .95, uv.x);
    float roots = 0., rim = 0.;
    float k = 1. - uv.y;                                                   // 0 at the top, 1 at the bottom
    for (int i = 0; i < 7; i++){
      float fi = float(i);
      float side = mod(fi, 2.) * 2. - 1.;
      float x = .845 + side * (.012 + (.035 + .028 * fi) * (1. - pow(1. - k, 2.4)))   // arch out, then down
              + .012 * (fbm(vec2(uv.y * 3.2 + fi * 7.1, t * .05)) - .5);
      float d = abs(uv.x - x) * asp;
      float wid = .0045 + .0105 * k;                                       // thicker toward the sand
      float body = smoothstep(wid, wid * .5, d);
      roots = max(roots, body);
      rim = max(rim, smoothstep(wid * 2.2, wid, d) * (1. - body));
    }
    roots = max(roots, smoothstep(.02, .012, abs(uv.x - .845) * asp) * smoothstep(.7, .9, uv.y));   // the trunk
    col += caus * uLight * .22 * right * (.4 + .6 * sun) * (1. - roots);
    col = mix(col, uDeep * .3, roots * .24);
    col += rim * caus * uLight * .3 * (.5 + .5 * sun);
    col += rim * spot * uLight * .5;

    float vig = smoothstep(1.3, .2, length((uv - vec2(.55, .5)) * vec2(1.15, 1.)));
    col *= mix(.5, 1., vig);
    col *= mix(.6, 1., smoothstep(.12, .46, abs(uv.x - .5)));             // keeps the centred headline calm and dark
    col += (h1(gl_FragCoord.xy + fract(t) * 91.) - .5) * .018;           // a little grain
    outColor = vec4(col, 1.);
  }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader failed");
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link failed");
  } catch (e) {
    console.warn("water:", e.message);
    html.classList.add("no-water");
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U("uRes"), uTime = U("uTime"), uPtr = U("uPtr"), uPtrOn = U("uPtrOn"), uRip = U("uRip");
  // Colors come from the canvas's data attributes, so every site can have its own water:
  // data-deep, data-shallow, data-light (caustic light), data-glint (ripple crests), as #rrggbb.
  const hex = (v, d) => { const m = /^#?([0-9a-f]{6})$/i.exec(v || "") || /^#?([0-9a-f]{6})$/i.exec(d);
    const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const ds = canvas.dataset;
  gl.uniform3fv(U("uDeep"), hex(ds.deep, "#03150f"));
  gl.uniform3fv(U("uShallow"), hex(ds.shallow, "#083730"));
  gl.uniform3fv(U("uLight"), hex(ds.light, "#80f0d1"));
  gl.uniform3fv(U("uGlint"), hex(ds.glint, "#f2bd85"));

  // Size: water is soft, so it renders below screen resolution and the GPU stays cool.
  const coarse = matchMedia("(pointer: coarse)").matches;
  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 1.5) * (coarse ? 0.5 : 0.62);
    const w = Math.max(2, Math.round(canvas.clientWidth * scale));
    const h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(canvas);
  resize();

  const rip = new Float32Array(40);
  let slot = 0;
  const start = performance.now();
  const now = () => (performance.now() - start) / 1000;
  function ripple(x, y, strength = 1) {           // x, y in 0..1 of the canvas, y from the top
    rip.set([x, 1 - y, now(), strength], slot * 4);
    slot = (slot + 1) % 10;
  }

  const ptr = { x: .7, y: .45, tx: .7, ty: .45, on: 0, ton: 0, last: 0, lx: 0, ly: 0 };
  const host = canvas.closest("[data-water-host]") || canvas;
  if (!reduce) {
    host.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.tx = (e.clientX - r.left) / r.width; ptr.ty = 1 - (e.clientY - r.top) / r.height; ptr.ton = 1;
      const t = performance.now(), dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
      if (t - ptr.last > 140 && dx * dx + dy * dy > 900) {
        ripple((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, .28);
        ptr.last = t; ptr.lx = e.clientX; ptr.ly = e.clientY;
      }
    }, { passive: true });
    host.addEventListener("pointerleave", () => { ptr.ton = 0; });
    host.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button")) return;
      const r = canvas.getBoundingClientRect();
      ripple((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1);
    }, { passive: true });
  }

  function draw(t = reduce ? 14 : now()) {
    ptr.x += (ptr.tx - ptr.x) * .08; ptr.y += (ptr.ty - ptr.y) * .08; ptr.on += (ptr.ton - ptr.on) * .05;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uPtr, ptr.x, ptr.y);
    gl.uniform1f(uPtrOn, ptr.on);
    gl.uniform4fv(uRip, rip);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let visible = true, running = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });
  function loop() {
    if (running || reduce) return;
    running = true;
    const tick = () => {
      if (!visible || document.hidden) { running = false; return; }
      draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); html.classList.add("no-water"); });

  html.classList.add("has-water");
  draw();
  loop();
  window.__water = { ripple, draw };
})();
