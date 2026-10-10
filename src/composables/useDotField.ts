import { reactive } from 'vue'
import { io, type Socket } from 'socket.io-client'

const TAU = Math.PI * 2
const LERP = 0.15
const FRAME_INTERVAL = 1000 / 30
const DEFAULT_COLOR = { r: 83 / 255, g: 172 / 255, b: 106 / 255 }
const MIN_HSL_LIGHTNESS = 0.55
const ciderQuery = new URLSearchParams(window.location.search)
const CIDER_IP = ciderQuery.get('CiderAdress')?.trim() || ciderQuery.get('CiderAddress')?.trim() || ''
const CIDER_PORT = Number(ciderQuery.get('CiderPort')?.trim() || '10767')
const CIDER_TOKEN = ciderQuery.get('CiderToken')?.trim() || ''
const SMTC_BRIDGE_URL =
  ciderQuery.get('SMTCBridgeUrl')?.trim() || 'http://127.0.0.1:5000/now-playing'
const CIDER_RECONNECT_DELAY = 2000
const WS_INITIAL_STATE_TIMEOUT = 2000
const GET_CURRENT_ITEM_TIMEOUT = 500
const ARTWORK_COLOR_FALLBACK_DELAY = 500
const PAUSE_RESET_DELAY = 2500

const color = reactive({ ...DEFAULT_COLOR })
const playbackStatus = reactive({
  state: 'unknown' as 'unknown' | 'playing' | 'paused',
  trackRevision: 0,
})
let targetR = DEFAULT_COLOR.r
let targetG = DEFAULT_COLOR.g
let targetB = DEFAULT_COLOR.b
let ciderStarted = false
let ciderSocket: Socket | undefined
let playbackRevision = 0
let wsInitialStateTimer: ReturnType<typeof setTimeout> | undefined
let getCurrentItemTimeout: ReturnType<typeof setTimeout> | undefined
let pauseResetTimer: ReturnType<typeof setTimeout> | undefined
let currentArtworkUrl: string | undefined
let artworkRequestId = 0
let artworkFallbackTimer: ReturnType<typeof setTimeout> | undefined
let pendingArtworkUrl: string | undefined
let restSyncInProgress = false
const artworkColorCache = new Map<string, [number, number, number]>()

interface ColorBucket {
  count: number
  r: number
  g: number
  b: number
  score: number
}

function resetToDefaultColor() {
  if (pauseResetTimer) clearTimeout(pauseResetTimer)
  pauseResetTimer = undefined
  cancelArtworkImageFallback()
  artworkRequestId++
  targetR = DEFAULT_COLOR.r
  targetG = DEFAULT_COLOR.g
  targetB = DEFAULT_COLOR.b
}

function restoreCachedArtworkColor() {
  if (!currentArtworkUrl) return false
  const cached = artworkColorCache.get(currentArtworkUrl)
  if (!cached) return false
  setTargetColor(...cached)
  return true
}

function schedulePauseReset() {
  if (pauseResetTimer) clearTimeout(pauseResetTimer)
  cancelArtworkImageFallback()
  pauseResetTimer = setTimeout(() => {
    pauseResetTimer = undefined
    resetToDefaultColor()
  }, PAUSE_RESET_DELAY)
}

function setTargetColor(r: number, g: number, b: number) {
  if (pauseResetTimer) clearTimeout(pauseResetTimer)
  pauseResetTimer = undefined
  const [lightR, lightG, lightB] = lightenIfTooDark(r, g, b)
  targetR = lightR
  targetG = lightG
  targetB = lightB
}

function lightenIfTooDark(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (lightness >= MIN_HSL_LIGHTNESS) return [r, g, b]

  const delta = max - min
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0

  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue /= 6
    if (hue < 0) hue += 1
  }

  const adjustedLightness = MIN_HSL_LIGHTNESS
  const chroma = (1 - Math.abs(2 * adjustedLightness - 1)) * saturation
  const hueSection = hue * 6
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1))
  const offset = adjustedLightness - chroma / 2

  let adjusted: [number, number, number]
  if (hueSection < 1) adjusted = [chroma, secondary, 0]
  else if (hueSection < 2) adjusted = [secondary, chroma, 0]
  else if (hueSection < 3) adjusted = [0, chroma, secondary]
  else if (hueSection < 4) adjusted = [0, secondary, chroma]
  else if (hueSection < 5) adjusted = [secondary, 0, chroma]
  else adjusted = [chroma, 0, secondary]

  return [adjusted[0] + offset, adjusted[1] + offset, adjusted[2] + offset]
}

function getDominantImageColor(image: HTMLImageElement): [number, number, number] | undefined {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D context is unavailable')

  const size = 32
  canvas.width = size
  canvas.height = size
  context.drawImage(image, 0, 0, size, size)

  const { data } = context.getImageData(0, 0, size, size)
  const buckets = new Map<number, ColorBucket>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]! / 255
    const g = data[i + 1]! / 255
    const b = data[i + 2]! / 255
    if (data[i + 3]! < 128) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    if (lightness < 0.06 || lightness > 0.94) continue

    const key = (Math.round(r * 15) << 8) | (Math.round(g * 15) << 4) | Math.round(b * 15)
    const saturation = max === 0 ? 0 : (max - min) / max
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, score: 0 }
    bucket.count++
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.score += 0.65 + saturation * 0.7
    buckets.set(key, bucket)
  }

  let dominant: ColorBucket | undefined
  for (const bucket of buckets.values()) {
    if (!dominant || bucket.score > dominant.score) dominant = bucket
  }

  if (!dominant || dominant.count === 0) return undefined
  return [
    dominant.r / dominant.count,
    dominant.g / dominant.count,
    dominant.b / dominant.count,
  ]
}

function loadColorFromArtworkImage(url: string) {
  if (pauseResetTimer) clearTimeout(pauseResetTimer)
  pauseResetTimer = undefined
  if (url === currentArtworkUrl) return

  if (artworkColorCache.has(url)) {
    currentArtworkUrl = url
    const cachedColor = artworkColorCache.get(url)
    if (cachedColor) setTargetColor(...cachedColor)
    return
  }

  currentArtworkUrl = url
  const requestId = ++artworkRequestId

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    if (requestId !== artworkRequestId) return

    try {
      const sampledColor = getDominantImageColor(image)
      if (!sampledColor) {
        console.warn('[Cider] Could not find a usable color in the artwork')
        return
      }

      artworkColorCache.set(url, sampledColor)
      setTargetColor(...sampledColor)
    } catch (error) {
      currentArtworkUrl = undefined
      console.warn(
        '[Cider] Could not read the artwork image; check that its server allows CORS',
        error,
      )
    }
  }
  image.onerror = () => {
    if (requestId === artworkRequestId) {
      currentArtworkUrl = undefined
      console.warn('[Cider] Could not load the artwork image')
    }
  }
  image.src = url
}

function cancelArtworkImageFallback() {
  if (artworkFallbackTimer) clearTimeout(artworkFallbackTimer)
  artworkFallbackTimer = undefined
  pendingArtworkUrl = undefined
}

function scheduleArtworkImageFallback(url: string) {
  if (url === currentArtworkUrl || url === pendingArtworkUrl) return

  cancelArtworkImageFallback()
  artworkRequestId++
  pendingArtworkUrl = url
  artworkFallbackTimer = setTimeout(() => {
    artworkFallbackTimer = undefined
    pendingArtworkUrl = undefined
    loadColorFromArtworkImage(url)
  }, ARTWORK_COLOR_FALLBACK_DELAY)
}

function findArtworkWithBgColor(
  value: unknown,
): { color: string; url?: string } | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findArtworkWithBgColor(item)
      if (result) return result
    }
    return undefined
  }

  if (!isRecord(value)) return undefined

  const artwork = value.artwork
  if (isRecord(artwork) && typeof artwork.bgColor === 'string') {
    const match = /^#?([0-9a-f]{6})$/i.exec(artwork.bgColor)
    if (match?.[1]) {
      return {
        color: match[1],
        url: typeof artwork.url === 'string' ? artwork.url : undefined,
      }
    }
  }

  for (const item of Object.values(value)) {
    const result = findArtworkWithBgColor(item)
    if (result) return result
  }
  return undefined
}

function findArtworkUrl(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findArtworkUrl(item)
      if (url) return url
    }
    return undefined
  }

  if (!isRecord(value)) return undefined

  const artwork = value.artwork
  if (isRecord(artwork) && typeof artwork.url === 'string' && artwork.url.trim()) {
    return artwork.url.trim()
  }

  for (const item of Object.values(value)) {
    const url = findArtworkUrl(item)
    if (url) return url
  }
  return undefined
}

function updateColorFromArtwork(value: unknown): boolean {
  const artworkWithColor = findArtworkWithBgColor(value)
  if (artworkWithColor) {
    cancelArtworkImageFallback()
    currentArtworkUrl = artworkWithColor.url
    artworkRequestId++
    setTargetColor(
      parseInt(artworkWithColor.color.slice(0, 2), 16) / 255,
      parseInt(artworkWithColor.color.slice(2, 4), 16) / 255,
      parseInt(artworkWithColor.color.slice(4, 6), 16) / 255,
    )
    return true
  }

  const artworkUrl = findArtworkUrl(value)
  if (!artworkUrl) return false

  scheduleArtworkImageFallback(artworkUrl)
  return true
}

function getPlaybackState(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalizedValue = value.toLowerCase()
    if (['playing', 'play'].includes(normalizedValue)) return true
    if (['paused', 'pause', 'stopped', 'stop', 'ended'].includes(normalizedValue)) {
      return false
    }
    return undefined
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const state = getPlaybackState(item)
      if (state !== undefined) return state
    }
    return undefined
  }

  if (typeof value !== 'object' || value === null) return undefined

  if (
    'type' in value &&
    typeof value.type === 'string' &&
    value.type.endsWith('playbackStateDidChange') &&
    'data' in value &&
    typeof value.data === 'string'
  ) {
    const state = value.data.toLowerCase()
    if (['playing', 'play'].includes(state)) return true
    if (['paused', 'pause'].includes(state)) return false
  }

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '')

    if (
      [
        'playing',
        'isplaying',
        'playbackstate',
        'currentplaybackstate',
        'state',
        'status',
      ].includes(normalizedKey)
    ) {
      if (typeof item === 'boolean') return item
      if (typeof item === 'string') {
        const normalizedValue = item.toLowerCase()
        if (['playing', 'play'].includes(normalizedValue)) return true
        if (['paused', 'pause'].includes(normalizedValue)) {
          return false
        }
      }
    }

    const nestedState = getPlaybackState(item)
    if (nestedState !== undefined) return nestedState
  }

  return undefined
}

function updatePlaybackStatus(value: unknown): boolean | undefined {
  const isPlaying = getPlaybackState(value)
  if (isPlaying !== undefined) playbackStatus.state = isPlaying ? 'playing' : 'paused'
  return isPlaying
}

function applyPlaybackState(value: unknown, socket: Socket) {
  const previousState = playbackStatus.state
  const isPlaying = updatePlaybackStatus(value)

  if (isPlaying === false) {
    schedulePauseReset()
    return
  }
  if (isPlaying === true) {
    if (pauseResetTimer) clearTimeout(pauseResetTimer)
    pauseResetTimer = undefined
    if (previousState !== 'playing' && !updateColorFromArtwork(value)) {
      if (!restoreCachedArtworkColor()) requestCurrentPlayback(socket)
    }
  }
}

function handlePlaybackStateChange(value: unknown, socket: Socket) {
  playbackRevision++
  applyPlaybackState(value, socket)
}

function handleTrackChange(value: unknown) {
  playbackStatus.trackRevision++
  playbackRevision++
  if (pauseResetTimer) clearTimeout(pauseResetTimer)
  pauseResetTimer = undefined
  if (!updateColorFromArtwork(value)) {
    void syncPlaybackFromRest()
  }
}

function handleCiderPlayback(payload: unknown, socket: Socket) {
  try {
    if (typeof payload === 'object' && payload !== null && 'type' in payload) {
      const eventType = payload.type
      const eventData = 'data' in payload ? payload.data : undefined
      if (typeof eventType === 'string') {
        if (eventType === 'playbackStatus.playbackTimeDidChange') {
          applyPlaybackState(eventData, socket)
          return
        }

        if (eventType === 'playbackStatus.playbackStateDidChange') {
          clearWsInitialStateTimer()
          handlePlaybackStateChange(eventData, socket)
          return
        }

        if (eventType === 'playbackStatus.nowPlayingStatusDidChange') {
          updatePlaybackStatus(eventData)
          return
        }

        if (eventType === 'playbackStatus.nowPlayingItemDidChange') {
          clearWsInitialStateTimer()
          handleTrackChange(eventData)
          return
        }

        if (eventType === 'playbackStatus.getCurrentItem') {
          clearGetCurrentItemTimeout()
          clearWsInitialStateTimer()
          playbackRevision++
          if (!updateColorFromArtwork(eventData)) {
            console.warn('[Cider] Current-item response did not include artwork')
          }
          return
        }
      }
    }

    updatePlaybackStatus(payload)
    const playbackState = getPlaybackState(payload)
    if (playbackState === false) {
      playbackRevision++
      schedulePauseReset()
      return
    }

    const hasArtwork = updateColorFromArtwork(payload)
    if (hasArtwork) playbackRevision++

    if (playbackState === true && !hasArtwork) requestCurrentPlayback(socket)
  } catch (error) {
    console.warn('[Cider] Could not process playback event', error)
  }
}

function clearWsInitialStateTimer() {
  if (wsInitialStateTimer) clearTimeout(wsInitialStateTimer)
  wsInitialStateTimer = undefined
}

function clearGetCurrentItemTimeout() {
  if (getCurrentItemTimeout) clearTimeout(getCurrentItemTimeout)
  getCurrentItemTimeout = undefined
}

function scheduleInitialRestFallback() {
  clearWsInitialStateTimer()
  wsInitialStateTimer = setTimeout(() => {
    wsInitialStateTimer = undefined
    if (ciderSocket?.connected) void syncPlaybackFromRest(true)
  }, WS_INITIAL_STATE_TIMEOUT)
}

async function syncPlaybackFromRest(allowPauseReset = false) {
  if (restSyncInProgress) return
  restSyncInProgress = true
  const revisionAtStart = playbackRevision

  try {
    const response = await fetch(`http://${CIDER_IP}:${CIDER_PORT}/api/v1/playback/is-playing`, {
      headers: { apptoken: CIDER_TOKEN },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Cider returned HTTP ${response.status}`)

    const playback: unknown = await response.json()
    if (playbackRevision !== revisionAtStart) return
    updatePlaybackStatus(playback)

    if (getPlaybackState(playback) === false) {
      if (allowPauseReset || !ciderSocket?.connected) schedulePauseReset()
      return
    }

    const trackResponse = await fetch(
      `http://${CIDER_IP}:${CIDER_PORT}/api/v1/playback/now-playing`,
      {
        headers: { apptoken: CIDER_TOKEN },
        cache: 'no-store',
      },
    )
    if (!trackResponse.ok) throw new Error(`Cider returned HTTP ${trackResponse.status}`)

    const track: unknown = await trackResponse.json()
    if (playbackRevision === revisionAtStart && !updateColorFromArtwork(track)) {
      console.warn('[Cider] REST playback response did not include artwork')
    }
  } catch (error) {
    console.warn('[Cider] Could not sync playback via REST', error)
    try {
      await syncPlaybackFromSmtcBridge(allowPauseReset, revisionAtStart)
    } catch (bridgeError) {
      console.warn('[SMTC Bridge] Could not sync playback', bridgeError)
    }
  } finally {
    restSyncInProgress = false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function syncPlaybackFromSmtcBridge(
  allowPauseReset: boolean,
  revisionAtStart: number,
) {
  const response = await fetch(SMTC_BRIDGE_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`SMTC Bridge returned HTTP ${response.status}`)

  const payload: unknown = await response.json()
  if (playbackRevision !== revisionAtStart || !isRecord(payload)) return

  const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
  const session =
    sessions.find(
      (item) =>
        isRecord(item) &&
        item.source_app_id === 'CiderCollective.Cider_a6qxe093bx5xj!App',
    ) ??
    sessions.find(
      (item) =>
        isRecord(item) &&
        typeof item.source_app_id === 'string' &&
        item.source_app_id.toLowerCase().includes('cider'),
    )

  if (!session || !isRecord(session.playback_info)) {
    updatePlaybackStatus(false)
    if (allowPauseReset || !ciderSocket?.connected) schedulePauseReset()
    return
  }

  const status = session.playback_info.PlaybackStatus
  if (status !== 4) {
    if (typeof status === 'number' && [0, 1, 3, 5].includes(status)) {
      updatePlaybackStatus(false)
      if (allowPauseReset || !ciderSocket?.connected) schedulePauseReset()
    }
    return
  }

  updatePlaybackStatus(true)
  const mediaProperties = isRecord(session.media_properties)
    ? session.media_properties
    : undefined
  const thumbnail = mediaProperties?.Thumbnail

  if (typeof thumbnail === 'string' && thumbnail.startsWith('data:image/')) {
    loadColorFromArtworkImage(thumbnail)
  } else {
    console.warn('[SMTC Bridge] Current-item response did not include artwork')
  }
}

function requestCurrentPlayback(socket: Socket) {
  if (socket !== ciderSocket || !socket.connected) return
  clearGetCurrentItemTimeout()
  socket.emit('API:Playback', { type: 'playbackStatus.getCurrentItem' })
  getCurrentItemTimeout = setTimeout(() => {
    getCurrentItemTimeout = undefined
    void syncPlaybackFromRest()
  }, GET_CURRENT_ITEM_TIMEOUT)
}

function connectToCider() {
  try {
    const socket = io(`http://${CIDER_IP}:${CIDER_PORT}`, {
      transports: ['websocket'],
      query: { apptoken: CIDER_TOKEN },
      auth: { apptoken: CIDER_TOKEN },
      reconnection: true,
      reconnectionDelay: CIDER_RECONNECT_DELAY,
    })
    ciderSocket = socket

    socket.on('connect', () => {
      if (socket !== ciderSocket) return
      console.info('[Cider] Socket.IO connected')
      requestCurrentPlayback(socket)
      scheduleInitialRestFallback()
    })

    socket.on('API:Playback', (payload: unknown) => {
      if (socket === ciderSocket) handleCiderPlayback(payload, socket)
    })

    socket.on('connect_error', (error: Error) => {
      console.warn('[Cider] Socket.IO connection failed', error.message)
      void syncPlaybackFromRest(true)
    })

    socket.on('disconnect', (reason: string) => {
      console.warn('[Cider] Socket.IO disconnected', reason)
      clearWsInitialStateTimer()
      void syncPlaybackFromRest(true)
    })
  } catch (error) {
    console.warn('[Cider] Could not create Socket.IO connection', error)
  }
}

export function lerpColor() {
  color.r += (targetR - color.r) * LERP
  color.g += (targetG - color.g) * LERP
  color.b += (targetB - color.b) * LERP
}

export function useCiderArtworkColor() {
  if (!ciderStarted) {
    ciderStarted = true

    if (!CIDER_IP) {
      console.warn('[Cider] Set CiderAdress in the page URL')
    } else if (!CIDER_TOKEN) {
      console.warn('[Cider] Set CiderToken in the page URL')
    } else if (!Number.isInteger(CIDER_PORT) || CIDER_PORT < 1 || CIDER_PORT > 65535) {
      console.warn('[Cider] CiderPort must be a valid TCP port')
    } else {
      connectToCider()
    }
  }

  return color
}

export function useCiderPlaybackStatus() {
  useCiderArtworkColor()
  return playbackStatus
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
    useCiderArtworkColor()
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
