import { reactive } from 'vue'

const TAU = Math.PI * 2
const LERP = 0.15
const MELODY_HUE_API =
  'https://melodyhue.com/developer/api/Cr4efK3YTBuiwAeQEEo4VA/color'

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

// ── DotField engine ──

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
const MAX_OFFSET = 10
const DAMPING = 0.97
const NUM_EM = 3
const ALPHA_LUT = new Uint8Array([3, 10, 25, 50, 85])
const RAD_LUT = [1, 1, 2, 2, 3]
const BUCKETS = 5

export function createDotFieldEngine(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  let W = 0,
    H = 0,
    cx = 0,
    cy = 0,
    cols = 0,
    rows = 0
  let dotCount = 0
  let baseX = new Float32Array(0)
  let baseY = new Float32Array(0)
  let offX = new Float32Array(0)
  let offY = new Float32Array(0)
  let imgData: ImageData | null = null
  let buf32: Uint32Array
  let vigLUT: Uint16Array
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

  function initGrid() {
    cols = Math.ceil(W / SPACING) + 2
    rows = Math.ceil(H / SPACING) + 2
    dotCount = cols * rows
    baseX = new Float32Array(dotCount)
    baseY = new Float32Array(dotCount)
    offX = new Float32Array(dotCount)
    offY = new Float32Array(dotCount)
    const ox = ((W % SPACING) / 2) | 0
    const oy = ((H % SPACING) / 2) | 0
    let idx = 0
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        baseX[idx] = ox + i * SPACING
        baseY[idx] = oy + j * SPACING
        offX[idx] = 0
        offY[idx] = 0
        idx++
      }
    }
  }

  function buildVigLUT() {
    vigLUT = new Uint16Array(W * H)
    const maxR = Math.max(W, H) * 0.72
    const minR = W * 0.12
    const range = maxR - minR
    for (let y = 0; y < H; y++) {
      const dy = y - cy
      for (let x = 0; x < W; x++) {
        const dx = x - cx
        const d = Math.sqrt(dx * dx + dy * dy)
        let f = 1
        if (d > minR) f = 1 - Math.min(1, (d - minR) / range) * 0.65
        vigLUT[y * W + x] = (f * 256) | 0
      }
    }
  }

  function resize() {
    W = canvas.width = canvas.parentElement?.clientWidth ?? innerWidth
    H = canvas.height = canvas.parentElement?.clientHeight ?? innerHeight
    cx = W / 2
    cy = H / 2
    initGrid()
    buildVigLUT()
  }

  function updateOffsets() {
    _ct++
    for (const c of currents) {
      c.angle += c.da * 0.005 + Math.sin(_ct * 0.003 + c.ph_a) * 0.002
      c.x += c.dx * 0.005 + Math.sin(_ct * 0.002 + c.ph_x) * 0.0003
      c.y += c.dy * 0.005 + Math.cos(_ct * 0.0025 + c.ph_y) * 0.0003
      c.ph_a += 0.00007
      c.ph_x += 0.00005
      c.ph_y += 0.00006
      if (c.x < -0.1 || c.x > 1.1) c.dx *= -1
      if (c.y < -0.1 || c.y > 1.1) c.dy *= -1
    }
    for (let i = 0; i < dotCount; i++) {
      const nx = baseX[i]! / W
      const ny = baseY[i]! / H
      let fx = 0,
        fy = 0
      for (const c of currents) {
        const dx = nx - c.x,
          dy = ny - c.y
        const dSq = dx * dx + dy * dy
        const r2 = c.radius * c.radius
        if (dSq > r2) continue
        const inf = 1 - dSq / r2
        fx += Math.cos(c.angle) * c.speed * inf
        fy += Math.sin(c.angle) * c.speed * inf
      }
      offX[i] = offX[i]! * DAMPING + fx * 0.15
      offY[i] = offY[i]! * DAMPING + fy * 0.15
      if (offX[i]! > MAX_OFFSET) offX[i] = MAX_OFFSET
      else if (offX[i]! < -MAX_OFFSET) offX[i] = -MAX_OFFSET
      if (offY[i]! > MAX_OFFSET) offY[i] = MAX_OFFSET
      else if (offY[i]! < -MAX_OFFSET) offY[i] = -MAX_OFFSET
    }
  }

  function ensureBuffer() {
    if (!imgData || imgData.width !== W || imgData.height !== H) {
      imgData = ctx.createImageData(W, H)
      buf32 = new Uint32Array(imgData.data.buffer)
    }
  }

  function render(ts: number) {
    if (destroyed) return
    rafId = requestAnimationFrame(render)
    if (ts - _lastFrame < FRAME_INTERVAL) return
    _lastFrame = ts
    ensureBuffer()
    lerpColor()
    const fR = color.r,
      fG = color.g,
      fB = color.b

    updateOffsets()

    const dt = 1 / 30
    for (const e of EM) {
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
    }

    const emPos = []
    for (let j = 0; j < NUM_EM; j++) {
      const e = EM[j]!
      emPos.push({
        x:
          cx +
          (Math.cos(e.px1) * 0.6 + Math.cos(e.px2) * 0.3 + Math.sin(e.px3) * 0.1) * W * e.rx,
        y:
          cy +
          (Math.sin(e.py1) * 0.6 + Math.sin(e.py2) * 0.3 + Math.cos(e.py3) * 0.1) * H * e.ry,
        freq: e.freq,
        wph: e.wavePh,
      })
    }

    buf32.fill(0xff000000)

    for (let i = 0; i < dotCount; i++) {
      const px = (baseX[i]! + offX[i]!) | 0
      const py = (baseY[i]! + offY[i]!) | 0

      let wave = 0
      for (let j = 0; j < NUM_EM; j++) {
        const dx = px - emPos[j]!.x,
          dy = py - emPos[j]!.y
        wave += Math.sin(Math.sqrt(dx * dx + dy * dy) * emPos[j]!.freq - emPos[j]!.wph)
      }

      const raw = (wave + NUM_EM) / (NUM_EM * 2)
      const biased = raw * raw * (3 - 2 * raw)
      const b = Math.min(BUCKETS - 1, (biased * BUCKETS) | 0)
      const alpha = ALPHA_LUT[b]!
      const rad = RAD_LUT[b]!

      const startY = py - rad < 0 ? 0 : py - rad
      const endY = py + rad >= H ? H - 1 : py + rad
      const startX = px - rad < 0 ? 0 : px - rad
      const endX = px + rad >= W ? W - 1 : px + rad

      for (let yy = startY; yy <= endY; yy++) {
        const rowOff = yy * W
        for (let xx = startX; xx <= endX; xx++) {
          const idx = rowOff + xx
          const existing = buf32[idx]!
          const er = existing & 0xff
          const eg = (existing >> 8) & 0xff
          const eb = (existing >> 16) & 0xff
          const cr = (alpha * fR) | 0
          const cg = (alpha * fG) | 0
          const cb = (alpha * fB) | 0
          if (cr > er || cg > eg || cb > eb) {
            buf32[idx] =
              0xff000000 |
              ((cb > eb ? cb : eb) << 16) |
              ((cg > eg ? cg : eg) << 8) |
              (cr > er ? cr : er)
          }
        }
      }
    }

    for (let i = 0; i < buf32.length; i++) {
      const pixel = buf32[i]!
      const r = pixel & 0xff
      if (r === 0 && ((pixel >> 8) & 0xff) === 0) continue
      const vig = vigLUT[i]!
      const nr = (r * vig) >> 8
      const ng = (((pixel >> 8) & 0xff) * vig) >> 8
      const nb = (((pixel >> 16) & 0xff) * vig) >> 8
      buf32[i] = 0xff000000 | (nb << 16) | (ng << 8) | nr
    }

    ctx.putImageData(imgData!, 0, 0)
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
