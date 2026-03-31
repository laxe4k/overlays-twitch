import { reactive } from 'vue'

const TAU = Math.PI * 2
const LERP = 0.15
const MELODY_HUE_API = 'https://melodyhue.com/developer/api/Cr4efK3YTBuiwAeQEEo4VA/color'

const color = reactive({ r: 1, g: 1, b: 1 })
let targetR = 1,
  targetG = 1,
  targetB = 1
let polling = false

function pollColor() {
  fetch(MELODY_HUE_API)
    .then((r) => r.json())
    .then((data) => {
      if (data.color?.hex) {
        const h = data.color.hex.replace('#', '')
        targetR = parseInt(h.substring(0, 2), 16) / 255
        targetG = parseInt(h.substring(2, 4), 16) / 255
        targetB = parseInt(h.substring(4, 6), 16) / 255
      }
    })
    .catch(() => {})
}

export function lerpColor() {
  color.r += (targetR - color.r) * LERP
  color.g += (targetG - color.g) * LERP
  color.b += (targetB - color.b) * LERP
}

export function useMelodyHue() {
  if (!polling) {
    polling = true
    pollColor()
    setInterval(pollColor, 1000)
  }
  return color
}

// ── WebGL DotField engine ──

interface Current {
  x: number
  y: number
  angle: number
  speed: number
  radius: number
  da: number
  dx: number
  dy: number
  ph_a: number
  ph_x: number
  ph_y: number
}

interface Emitter {
  rx: number
  ry: number
  freq: number
  px1: number
  px2: number
  px3: number
  py1: number
  py2: number
  py3: number
  vx1: number
  vx2: number
  vx3: number
  vy1: number
  vy2: number
  vy3: number
  wavePh: number
  waveSpeed: number
  dWaveSpeed: number
  dvx1: number
  dvx2: number
  dvy1: number
  dvy2: number
  dFreq: number
  dRx: number
  dRy: number
}

const SPACING = 10
const FRAME_INTERVAL = 1000 / 30
const NUM_EM = 3

// ── Shaders ──

const VERT_SRC = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_color;
uniform vec2 u_gridOffset;

uniform vec2  u_currentPos[2];
uniform float u_currentAngle[2];
uniform float u_currentSpeed[2];
uniform float u_currentRadius[2];

uniform vec2  u_emitterPos[3];
uniform float u_emitterFreq[3];
uniform float u_emitterWph[3];

out vec4 fragColor;

const float SPACING     = 10.0;
const float MAX_OFFSET  = 10.0;
const float STEADY      = 5.0;   // 0.15 / (1 - 0.97)
const int   NUM_EM      = 3;
const int   BUCKETS     = 5;

const float ALPHA_LUT[5] = float[5](
  3.0/255.0, 10.0/255.0, 25.0/255.0, 50.0/255.0, 85.0/255.0
);
const float RAD_LUT[5] = float[5](1.0, 1.0, 2.0, 2.0, 3.0);

void main() {
  vec2 px = gl_FragCoord.xy;
  px.y = u_resolution.y - px.y;

  vec2 gridIdx = round((px - u_gridOffset) / SPACING);

  float best = 0.0;

  for (int dj = -1; dj <= 1; dj++) {
    for (int di = -1; di <= 1; di++) {
      vec2 dotBase = u_gridOffset + (gridIdx + vec2(float(di), float(dj))) * SPACING;

      vec2 npos = dotBase / u_resolution;
      vec2 off  = vec2(0.0);

      for (int c = 0; c < 2; c++) {
        vec2  d   = npos - u_currentPos[c];
        float dSq = dot(d, d);
        float r2  = u_currentRadius[c] * u_currentRadius[c];
        if (dSq < r2) {
          float inf = 1.0 - dSq / r2;
          off += vec2(cos(u_currentAngle[c]), sin(u_currentAngle[c]))
               * u_currentSpeed[c] * inf;
        }
      }

      off = clamp(off * STEADY, -MAX_OFFSET, MAX_OFFSET);
      vec2 dotPos = dotBase + off;

      // square distance check (matches original rasterisation)
      vec2 diff = abs(px - dotPos);

      float wave = 0.0;
      for (int j = 0; j < NUM_EM; j++) {
        vec2 ed = dotPos - u_emitterPos[j];
        wave += sin(length(ed) * u_emitterFreq[j] - u_emitterWph[j]);
      }

      float raw    = (wave + float(NUM_EM)) / (float(NUM_EM) * 2.0);
      float biased = raw * raw * (3.0 - 2.0 * raw);
      int   b      = min(BUCKETS - 1, int(biased * float(BUCKETS)));

      float alpha = ALPHA_LUT[b];
      float rad   = RAD_LUT[b];

      if (diff.x <= rad && diff.y <= rad) {
        best = max(best, alpha);
      }
    }
  }

  // Vignette
  vec2  center = u_resolution * 0.5;
  float d      = length(px - center);
  float maxR   = max(u_resolution.x, u_resolution.y) * 0.72;
  float minR   = u_resolution.x * 0.12;
  float vig    = 1.0;
  if (d > minR) vig = 1.0 - min(1.0, (d - minR) / (maxR - minR)) * 0.65;

  fragColor = vec4(u_color * best * vig, 1.0);
}
`

// ── GL helpers ──

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error('Shader compile: ' + info)
  }
  return s
}

function createProgram(gl: WebGL2RenderingContext) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  const pg = gl.createProgram()!
  gl.attachShader(pg, vs)
  gl.attachShader(pg, fs)
  gl.linkProgram(pg)
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS))
    throw new Error('Program link: ' + gl.getProgramInfoLog(pg))
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return pg
}

// ── Engine ──

export function createDotFieldEngine(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2')!
  const program = createProgram(gl)
  gl.useProgram(program)

  // Full-screen quad
  const quadBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // Uniform locations
  const u = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    color: gl.getUniformLocation(program, 'u_color'),
    gridOffset: gl.getUniformLocation(program, 'u_gridOffset'),
    cPos: [0, 1].map((i) => gl.getUniformLocation(program, `u_currentPos[${i}]`)),
    cAngle: [0, 1].map((i) => gl.getUniformLocation(program, `u_currentAngle[${i}]`)),
    cSpeed: [0, 1].map((i) => gl.getUniformLocation(program, `u_currentSpeed[${i}]`)),
    cRadius: [0, 1].map((i) => gl.getUniformLocation(program, `u_currentRadius[${i}]`)),
    ePos: [0, 1, 2].map((i) => gl.getUniformLocation(program, `u_emitterPos[${i}]`)),
    eFreq: [0, 1, 2].map((i) => gl.getUniformLocation(program, `u_emitterFreq[${i}]`)),
    eWph: [0, 1, 2].map((i) => gl.getUniformLocation(program, `u_emitterWph[${i}]`)),
  }

  let W = 0,
    H = 0,
    cx = 0,
    cy = 0
  let _ct = 0
  let _lastFrame = 0
  let rafId = 0
  let destroyed = false

  // Currents
  const currents: Current[] = []
  for (let i = 0; i < 2; i++) {
    currents.push({
      x: Math.random(),
      y: Math.random(),
      angle: Math.random() * TAU,
      speed: 0.2 + Math.random() * 0.3,
      radius: 0.5 + Math.random() * 0.3,
      da: (Math.random() - 0.5) * 0.15,
      dx: (Math.random() - 0.5) * 0.008,
      dy: (Math.random() - 0.5) * 0.008,
      ph_a: Math.random() * TAU,
      ph_x: Math.random() * TAU,
      ph_y: Math.random() * TAU,
    })
  }

  // Emitters
  const EM: Emitter[] = []
  for (let i = 0; i < NUM_EM; i++) {
    EM.push({
      rx: 0.18 + Math.random() * 0.22,
      ry: 0.18 + Math.random() * 0.22,
      freq: 0.005 + Math.random() * 0.009,
      px1: Math.random() * TAU,
      px2: Math.random() * TAU,
      px3: Math.random() * TAU,
      py1: Math.random() * TAU,
      py2: Math.random() * TAU,
      py3: Math.random() * TAU,
      vx1: 0.015 + Math.random() * 0.035,
      vx2: (0.015 + Math.random() * 0.035) * (1.618 + Math.random() * 0.3),
      vx3: (0.015 + Math.random() * 0.035) * (0.437 + Math.random() * 0.2),
      vy1: 0.015 + Math.random() * 0.035,
      vy2: (0.015 + Math.random() * 0.035) * (1.618 + Math.random() * 0.3),
      vy3: (0.015 + Math.random() * 0.035) * (0.437 + Math.random() * 0.2),
      wavePh: Math.random() * TAU,
      waveSpeed: 0.6 + Math.random() * 0.5,
      dWaveSpeed: (Math.random() - 0.5) * 0.00008,
      dvx1: (Math.random() - 0.5) * 0.00003,
      dvx2: (Math.random() - 0.5) * 0.00004,
      dvy1: (Math.random() - 0.5) * 0.00003,
      dvy2: (Math.random() - 0.5) * 0.00004,
      dFreq: (Math.random() - 0.5) * 0.000002,
      dRx: (Math.random() - 0.5) * 0.000006,
      dRy: (Math.random() - 0.5) * 0.000006,
    })
  }

  function resize() {
    W = canvas.width = canvas.parentElement?.clientWidth ?? innerWidth
    H = canvas.height = canvas.parentElement?.clientHeight ?? innerHeight
    cx = W / 2
    cy = H / 2
    gl.viewport(0, 0, W, H)
    gl.uniform2f(u.resolution, W, H)
    gl.uniform2f(u.gridOffset, ((W % SPACING) / 2) | 0, ((H % SPACING) / 2) | 0)
  }

  function uploadCurrents() {
    _ct++
    for (let i = 0; i < currents.length; i++) {
      const c = currents[i]!
      c.angle += c.da * 0.005 + Math.sin(_ct * 0.003 + c.ph_a) * 0.002
      c.x += c.dx * 0.005 + Math.sin(_ct * 0.002 + c.ph_x) * 0.0003
      c.y += c.dy * 0.005 + Math.cos(_ct * 0.0025 + c.ph_y) * 0.0003
      c.ph_a += 0.00007
      c.ph_x += 0.00005
      c.ph_y += 0.00006
      if (c.x < -0.1 || c.x > 1.1) c.dx *= -1
      if (c.y < -0.1 || c.y > 1.1) c.dy *= -1
      gl.uniform2f(u.cPos[i]!, c.x, c.y)
      gl.uniform1f(u.cAngle[i]!, c.angle)
      gl.uniform1f(u.cSpeed[i]!, c.speed)
      gl.uniform1f(u.cRadius[i]!, c.radius)
    }
  }

  function uploadEmitters() {
    const dt = 1 / 30
    for (let j = 0; j < NUM_EM; j++) {
      const e = EM[j]!
      e.vx1 += e.dvx1
      e.vx2 += e.dvx2
      e.vy1 += e.dvy1
      e.vy2 += e.dvy2
      if (e.vx1 < 0.01 || e.vx1 > 0.065) e.dvx1 *= -1
      if (e.vx2 < 0.018 || e.vx2 > 0.11) e.dvx2 *= -1
      if (e.vy1 < 0.01 || e.vy1 > 0.065) e.dvy1 *= -1
      if (e.vy2 < 0.018 || e.vy2 > 0.11) e.dvy2 *= -1
      e.px1 += e.vx1 * dt
      e.px2 += e.vx2 * dt
      e.px3 += e.vx3 * dt
      e.py1 += e.vy1 * dt
      e.py2 += e.vy2 * dt
      e.py3 += e.vy3 * dt
      e.waveSpeed += e.dWaveSpeed
      if (e.waveSpeed < 0.4 || e.waveSpeed > 1.3) e.dWaveSpeed *= -1
      e.wavePh += e.waveSpeed * dt
      e.freq += e.dFreq
      e.rx += e.dRx
      e.ry += e.dRy
      if (e.freq < 0.004 || e.freq > 0.016) e.dFreq *= -1
      if (e.rx < 0.13 || e.rx > 0.45) e.dRx *= -1
      if (e.ry < 0.13 || e.ry > 0.45) e.dRy *= -1
      const posX =
        cx + (Math.cos(e.px1) * 0.6 + Math.cos(e.px2) * 0.3 + Math.sin(e.px3) * 0.1) * W * e.rx
      const posY =
        cy + (Math.sin(e.py1) * 0.6 + Math.sin(e.py2) * 0.3 + Math.cos(e.py3) * 0.1) * H * e.ry
      gl.uniform2f(u.ePos[j]!, posX, posY)
      gl.uniform1f(u.eFreq[j]!, e.freq)
      gl.uniform1f(u.eWph[j]!, e.wavePh)
    }
  }

  function render(ts: number) {
    if (destroyed) return
    rafId = requestAnimationFrame(render)
    if (ts - _lastFrame < FRAME_INTERVAL) return
    _lastFrame = ts

    lerpColor()
    gl.uniform3f(u.color, color.r, color.g, color.b)

    uploadCurrents()
    uploadEmitters()

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  function start() {
    useMelodyHue()
    resize()
    addEventListener('resize', resize)
    rafId = requestAnimationFrame(render)
  }

  function destroy() {
    destroyed = true
    cancelAnimationFrame(rafId)
    removeEventListener('resize', resize)
    gl.deleteProgram(program)
    gl.deleteBuffer(quadBuf)
  }

  /** Fige l'animation après un délai (pour background-fixe) */
  function freezeAfter(ms: number) {
    setTimeout(() => {
      destroyed = true
      cancelAnimationFrame(rafId)
    }, ms)
  }

  return { start, destroy, freezeAfter }
}
