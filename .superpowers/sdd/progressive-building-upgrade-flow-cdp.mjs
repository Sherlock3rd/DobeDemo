// Safe, repeatable Chrome/CDP acceptance for the progressive building upgrade
// flow. Drives real Chrome via CDP at desktop 1440x900 and mobile 390x844 and
// verifies the full "per-level slot building -> 100% -> independent main
// confirmation -> next slot" loop, the exact block reasons, the two debug
// actions, reset, and the one-time v2 hidden-slot refund.
//
// SAFETY MODEL:
// - Selects free dev/CDP ports dynamically; never connects to or kills a
//   listener found during preflight (existing 5176/5177 dev servers are safe).
// - Tracks child PIDs and only terminates process trees this script spawned.
// - Creates an isolated Chrome profile under os.tmpdir() with the exact prefix
//   'dobe-progressive-upgrade-cdp-' and only removes that verified profile.
// - Vite runs with --strictPort.
// - The result JSON records only basenames, relative repo paths and numeric
//   measurements, never absolute paths.
// - Errors record a whitelisted name/code only; raw stacks go to stderr.
// - A pure-data assertion self-test fails on empty/bad data and includes a
//   Windows/Unix path redaction self-check.
// - Exits non-zero on any failed assertion, runtime error, cleanup failure,
//   occupied-owned-port mismatch or missing screenshot.
//
// Config via env: DEV_PORT, CDP_PORT, CHROME_PATH. Preferred occupied ports are
// skipped. Run: node .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs

import zlib from 'node:zlib'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUT_JSON = path.join(
  HERE,
  'progressive-building-upgrade-flow-results.json',
)
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')
const PROFILE_PREFIX = 'dobe-progressive-upgrade-cdp-'

const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
]
// getUnlockedProducerIds filters BUILDING_IDS in place for gang Lv.50, so the
// persisted activeProducerIds compare equal element-by-element.
const PRODUCER_IDS = [
  'repair-shop',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
]
// getGangLevel(1470) === 50, unlocking every building. 210 === Lv.8 reputation,
// where recycling-yard is unlocked but Clubhouse (Lv.40) is not.
const GANG_LV50_REPUTATION = 1470
const GANG_LV8_REPUTATION = 210
const GANG_LV40_REPUTATION = 1170
const LARGE_MONEY = 100_000
// Minimum changed pixels inside the building ROI that proves the 3D model
// re-rendered during the 400ms slot animation.
const CANVAS_MIN_CHANGED = 30
const ROI_LEFT = 220
const ROI_RIGHT = 180
const ROI_UP = 240
const ROI_DOWN = 150

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = {
  generatedAt: new Date().toISOString(),
  script: 'progressive-building-upgrade-flow-cdp.mjs',
  preflight: {
    terminalAndPortCheckPerformed: true,
    strategy: 'skip occupied preferred ports; never terminate unknown PID',
    attemptedDevPorts: [],
    attemptedCdpPorts: [],
  },
  processSafety: {
    ownedPids: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  dist: {},
  http: {},
  fresh: {},
  slotUpgrade: {},
  selection: {},
  hundred: {},
  confirmView: {},
  back: {},
  insufficient: {},
  confirmApply: {},
  reasons: {},
  repairBand: {},
  clubhouseFree: {},
  unlockGang: {},
  grant: {},
  reset: {},
  migration: {},
  layout: {},
  screenshots: {},
  teardown: {},
  assertionSelfTest: {},
  assertions: [],
}

let devPort
let cdpPort
let devUrl
let devProc
let chromeProc
let profileDir
let ws
let nextId = 1
const pending = new Map()
const ownedPids = new Set()
const spots = {}

// ---------- port / process safety ----------
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    let settled = false
    const finish = (inUse) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(600)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function selectFreePort(preferred, attempted) {
  for (let offset = 0; offset < 40; offset += 1) {
    const port = preferred + offset
    const inUse = await isPortInUse(port)
    attempted.push({ port, free: !inUse })
    if (!inUse) return port
  }
  throw new Error(`No free port in safe range ${preferred}-${preferred + 39}`)
}

function registerOwnedProcess(child, label) {
  if (!child?.pid) throw new Error(`${label} did not return a PID`)
  ownedPids.add(child.pid)
  results.processSafety.ownedPids.push({ label, pid: child.pid })
}

function killOwnedTree(child, label) {
  const pid = child?.pid
  if (!pid || !ownedPids.has(pid)) {
    if (pid) {
      throw new Error(`SAFETY_ABORT: refusing to terminate unowned PID ${pid}`)
    }
    return
  }
  results.processSafety.killAttempts.push({ label, pid, owned: true })
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {
    // The owned child may already have exited.
  }
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(
      os.homedir(),
      'AppData',
      'Local',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Chrome not found; set CHROME_PATH')
  return found
}

// ---------- CDP plumbing ----------
function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connectCdp() {
  let targets
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json`)
      targets = await response.json()
      if (targets.some((target) => target.type === 'page')) break
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  const page = targets?.find((target) => target.type === 'page')
  if (!page) throw new Error('No CDP page target')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (!message.id || !pending.has(message.id)) return
    const waiter = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails) {
    throw new Error(
      `CDP evaluate failed: ${JSON.stringify(response.exceptionDetails)}`,
    )
  }
  return response.result.value
}

async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await sleep(30)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

function pointExpression(selector, index) {
  return `(() => {
    const els = document.querySelectorAll(${JSON.stringify(selector)})
    const element = els[${index}]
    if (!element) return null
    element.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`
}

// Real pointer click on the nth match of a selector (default first).
async function clickSelector(selector, index = 0) {
  const point = await evaluate(pointExpression(selector, index))
  if (!point) throw new Error(`Element not found for real click: ${selector}#${index}`)
  await sleep(80)
  const settled = await evaluate(pointExpression(selector, index))
  const target = settled ?? point
  await mouseClick(Math.round(target.x), Math.round(target.y))
}

async function screenshot(fileName) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  const buffer = Buffer.from(response.data, 'base64')
  fs.writeFileSync(path.join(HERE, fileName), buffer)
  results.screenshots[fileName] = fileName
  return buffer
}

// ---------- PNG decode + ROI diff ----------
function decodePng(buffer) {
  let pos = 8
  let width
  let height
  let colorType
  let bitDepth
  const idat = []
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos)
    const type = buffer.toString('ascii', pos + 4, pos + 8)
    const data = buffer.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data.readUInt8(8)
      colorType = data.readUInt8(9)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!channels) throw new Error(`unsupported colorType ${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let rp = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rp++]
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[rp++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c =
        x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let val
      switch (filter) {
        case 0:
          val = cur
          break
        case 1:
          val = cur + a
          break
        case 2:
          val = cur + b
          break
        case 3:
          val = cur + ((a + b) >> 1)
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          val = cur + pr
          break
        }
        default:
          throw new Error(`bad filter ${filter}`)
      }
      out[y * stride + x] = val & 0xff
    }
  }
  return { width, height, channels, data: out }
}

function diffPixels(a, b, { roi = null, excludes = [], tol = 18 } = {}) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.width !== B.width || A.height !== B.height) {
    return { changedPixels: -1, consideredPixels: 0, changedPct: 100 }
  }
  const rx0 = roi ? Math.max(0, Math.floor(roi.x)) : 0
  const ry0 = roi ? Math.max(0, Math.floor(roi.y)) : 0
  const rx1 = roi ? Math.min(A.width, Math.ceil(roi.x + roi.w)) : A.width
  const ry1 = roi ? Math.min(A.height, Math.ceil(roi.y + roi.h)) : A.height
  const inExcluded = (x, y) =>
    excludes.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  const ca = A.channels
  const cb = B.channels
  let changed = 0
  let considered = 0
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      if (inExcluded(x, y)) continue
      considered += 1
      const i = y * A.width + x
      const ai = i * ca
      const bi = i * cb
      if (
        Math.abs(A.data[ai] - B.data[bi]) > tol ||
        Math.abs(A.data[ai + 1] - B.data[bi + 1]) > tol ||
        Math.abs(A.data[ai + 2] - B.data[bi + 2]) > tol
      ) {
        changed += 1
      }
    }
  }
  return {
    changedPixels: changed,
    consideredPixels: considered,
    roiClipped: { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 },
    changedPct: +((changed / Math.max(1, considered)) * 100).toFixed(3),
  }
}
// ---------- DOM readers ----------
async function readStorage() {
  return evaluate(`(() => {
    const parse = (key) => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : JSON.parse(raw)
    }
    return {
      city: parse(${JSON.stringify(CITY_KEY)}),
      gang: parse(${JSON.stringify(GANG_KEY)})
    }
  })()`)
}

async function readPanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    if (!panel) return { present: false }
    const text = (s) => panel.querySelector(s)?.textContent?.trim() ?? null
    const options = [
      ...panel.querySelectorAll('.building-panel__child-option'),
    ].map((o) => ({
      name: o.querySelector('.building-panel__child-name')?.textContent?.trim() ?? null,
      status: o.querySelector('.building-panel__child-status')?.textContent?.trim() ?? null,
      checked: o.getAttribute('aria-checked') === 'true',
    }))
    const progressbar = panel.querySelector('.building-panel__progress-bar')
    const mainButton = panel.querySelector('.building-panel__main-button')
    const sharedButton = panel.querySelector('.building-panel__shared-upgrade')
    const confirmSubmit = panel.querySelector('.building-panel__confirm-submit')
    const confirmTitle = panel.querySelector('#building-panel-confirm-title')
    return {
      present: true,
      unlocked: Boolean(panel.querySelector('.building-panel__level')),
      view: confirmSubmit
        ? 'confirm'
        : panel.querySelector('.building-panel__lock-status')
          ? 'locked'
          : 'details',
      title: text('.building-panel__title'),
      level: text('.building-panel__level'),
      lockStatus: text('.building-panel__lock-status'),
      childCount: options.length,
      options,
      selectedIndex: options.findIndex((o) => o.checked),
      progressPresent: Boolean(progressbar),
      progressNow: progressbar
        ? Number(progressbar.getAttribute('aria-valuenow'))
        : null,
      progressLabel: text('.building-panel__progress-label'),
      sharedButtonPresent: Boolean(sharedButton),
      sharedButtonLabel: sharedButton?.textContent?.trim() ?? null,
      sharedButtonDisabled: sharedButton ? Boolean(sharedButton.disabled) : null,
      shortfall: text('.building-panel__child-shortfall'),
      mainButtonPresent: Boolean(mainButton),
      mainButtonLabel: mainButton?.textContent?.trim() ?? null,
      mainStatus: text('.building-panel__main-status'),
      mainBlocker: text('.building-panel__main-blocker'),
      confirmCost: [
        ...panel.querySelectorAll('.building-panel__confirm-cost li'),
      ].map((li) => li.textContent.trim()),
      confirmPower: [
        ...panel.querySelectorAll('.building-panel__confirm-power'),
      ].map((p) => p.textContent.trim()),
      confirmSubmitDisabled: confirmSubmit ? Boolean(confirmSubmit.disabled) : null,
      confirmTitleFocused: Boolean(confirmTitle && document.activeElement === confirmTitle),
    }
  })()`)
}

async function readSettings() {
  return evaluate(`(() => {
    const panel = document.querySelector('.settings-panel')
    if (!panel) return { present: false }
    return {
      present: true,
      feedback: panel.querySelector('.settings-panel__feedback')?.textContent?.trim() ?? null,
      confirming: Boolean(panel.querySelector('.settings-panel__confirm-reset')),
    }
  })()`)
}

async function readHud() {
  return evaluate(`(() => {
    const t = (s) => document.querySelector(s)?.textContent?.trim() ?? null
    return {
      level: t('.city-hud__level'),
      rate: t('.city-hud__rate'),
      resources: [...document.querySelectorAll('.city-hud__resource p')].map(
        (p) => p.textContent.trim(),
      ),
    }
  })()`)
}

async function excludeRects() {
  return evaluate(`(() => {
    const rects = []
    for (const sel of ['.city-hud', '.building-panel', '.settings-panel']) {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      rects.push({
        x: Math.floor(r.left) - 4,
        y: Math.floor(r.top) - 4,
        w: Math.ceil(r.width) + 8,
        h: Math.ceil(r.height) + 8,
      })
    }
    return rects
  })()`)
}

async function closePanel() {
  const present = await evaluate(
    `Boolean(document.querySelector('.building-panel__close'))`,
  )
  if (present) {
    await clickSelector('.building-panel__close')
    await sleep(150)
  }
}

async function waitForApp(previousTimeOrigin = null) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const state = await evaluate(`({
        href: location.href,
        ready: document.readyState,
        hasCanvas: Boolean(document.querySelector('canvas')),
        hasHud: Boolean(document.querySelector('.city-hud')),
        timeOrigin: performance.timeOrigin
      })`)
      if (
        state.href?.startsWith('http') &&
        state.ready === 'complete' &&
        state.hasCanvas &&
        state.hasHud &&
        (previousTimeOrigin === null || state.timeOrigin !== previousTimeOrigin)
      ) {
        return state
      }
    } catch {
      // The initial about:blank target has an opaque origin.
    }
    await sleep(250)
  }
  throw new Error('App did not become ready')
}

async function reloadAndWait(extraDelay = 1400) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previousTimeOrigin)
  if (extraDelay) await sleep(extraDelay)
}

// ---------- save builders + injection ----------
function childArray(id, fill) {
  return Array(id === 'repair-shop' ? 5 : 10).fill(fill)
}

function buildBuildingProgress(overrides = {}) {
  const progress = {}
  for (const id of BUILDING_IDS) {
    progress[id] = { level: 1, childLevels: childArray(id, 0) }
  }
  for (const [id, value] of Object.entries(overrides)) {
    progress[id] = value
  }
  return progress
}

function citySave({
  buildingProgress,
  resources = { money: 0, oil: 0, materials: 0 },
  lastResourceUpdatedAt,
  activeProducerIds = ['repair-shop'],
  version = 3,
}) {
  return {
    state: {
      buildingProgress,
      resources,
      lastResourceUpdatedAt,
      activeProducerIds,
    },
    version,
  }
}

function gangSave(totalReputation, lastUpdatedAt) {
  return { state: { totalReputation, lastUpdatedAt }, version: 0 }
}

async function inject(city, gang) {
  await evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(city))})
    localStorage.setItem(${JSON.stringify(GANG_KEY)}, ${JSON.stringify(JSON.stringify(gang))})
  })()`)
  await reloadAndWait()
}

async function clearStorageAndReload() {
  await evaluate(`(() => { localStorage.clear() })()`)
  await reloadAndWait()
}

// Real CDP clicks on the 3D scene until the requested building panel opens;
// leaves it open. Caches the coordinate per title so reloads stay cheap.
async function findBuilding(title, { requireUnlocked = true } = {}) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(170)
    const panel = await readPanel()
    if (
      panel.present &&
      panel.title === title &&
      (!requireUnlocked || panel.unlocked)
    ) {
      return { x, y, panel }
    }
    if (panel.present) await closePanel()
    return null
  }
  const cached = spots[title]
  if (cached) {
    const hit = await tryAt(cached.x, cached.y)
    if (hit) return hit
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) {
        spots[title] = { x, y }
        return hit
      }
    }
  }
  throw new Error(`Building not found via real CDP click scan: ${title}`)
}

// ---------- assertions (pure, testable) ----------
function arraysEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  )
}
function evaluateAssertions(value) {
  const checks = []
  const add = (name, pass, detail) =>
    checks.push({ name, pass: pass === true, detail: String(detail ?? '') })

  add(
    'preflight selected free dev port',
    value.preflight?.devPortFree === true,
    value.preflight?.devPort,
  )
  add(
    'preflight selected free CDP port',
    value.preflight?.cdpPortFree === true,
    value.preflight?.cdpPort,
  )
  add(
    'dist assets use /DobeDemo/',
    value.dist?.baseOk === true,
    JSON.stringify(value.dist?.assetRefs),
  )
  add('HTTP status 200', value.http?.status === 200, value.http?.status)

  // 1. Fresh v3 save: wallet 10000/0/0, all main Lv.1, repair 5 slots all 0,
  // only the first slot visible in the UI (no hidden scaffold/label/radio).
  const fc = value.fresh?.storage?.city
  const fr = fc?.state?.buildingProgress?.['repair-shop']
  const fw = fc?.state?.resources
  add(
    '1. fresh v3 wallet {10000,0,0}, repair Lv.1 childLevels all 0',
    fc?.version === 3 &&
      fr?.level === 1 &&
      arraysEqual(fr?.childLevels, [0, 0, 0, 0, 0]) &&
      fw?.money === 10000 &&
      fw?.oil === 0 &&
      fw?.materials === 0,
    JSON.stringify({ version: fc?.version, fr, fw }),
  )
  add(
    '1b. every main building Lv.1',
    BUILDING_IDS.every(
      (id) => fc?.state?.buildingProgress?.[id]?.level === 1,
    ),
    JSON.stringify(
      BUILDING_IDS.map((id) => fc?.state?.buildingProgress?.[id]?.level),
    ),
  )
  add(
    '1c. repair panel shows only the first unlocked slot (no hidden radios)',
    value.fresh?.repairPanel?.childCount === 1 &&
      value.fresh?.repairPanel?.selectedIndex === 0 &&
      value.fresh?.repairPanel?.options?.[0]?.status === 'Lv.0 / Lv.1',
    JSON.stringify(value.fresh?.repairPanel),
  )
  add(
    '1d. HUD reputation rate is +1 声望/10秒',
    value.fresh?.hud?.rate === '+1 声望/10秒',
    value.fresh?.hud?.rate,
  )

  // 2. Shared-button slot upgrade: completed steps +1, exact percent change,
  // only the building ROI animates in the 400ms window.
  const su = value.slotUpgrade
  add(
    '2. shared button upgraded slot 0 to Lv.1 and progress 0% -> 25%',
    arraysEqual(su?.childLevelsBefore, [0, 0, 0, 0, 0]) &&
      su?.childLevel0After === 1 &&
      su?.progressBefore === 0 &&
      su?.progressAfter === 25,
    JSON.stringify(su),
  )
  add(
    `2b. only the target 3D ROI changed (>= ${CANVAS_MIN_CHANGED}, control stable)`,
    typeof su?.canvasTarget?.changedPixels === 'number' &&
      su.canvasTarget.changedPixels >= CANVAS_MIN_CHANGED &&
      typeof su?.canvasControl?.changedPct === 'number' &&
      su.canvasControl.changedPct <= 2,
    `target=${su?.canvasTarget?.changedPixels} controlPct=${su?.canvasControl?.changedPct}`,
  )

  // 3. Manual selection survives a resource tick; selection cycles after a slot
  // catches up.
  const se = value.selection
  add(
    '3. manual radio selection survives a real resource tick',
    se?.selectedAfterSelect === 1 &&
      se?.selectedAfterTick === 1 &&
      typeof se?.moneyBeforeTick === 'number' &&
      typeof se?.moneyAfterTick === 'number' &&
      se.moneyAfterTick > se.moneyBeforeTick,
    JSON.stringify(se),
  )
  add(
    '3b. selection cycles to slot 0 after slot 1 catches up',
    se?.cyclicIndex === 0,
    se?.cyclicIndex,
  )

  // 4. 100% replaces progress + shared button with the main-upgrade button.
  add(
    '4. at 100% progress region is replaced by 升级主建筑至 Lv.3',
    value.hundred?.progressPresent === false &&
      value.hundred?.sharedButtonPresent === false &&
      value.hundred?.mainButtonPresent === true &&
      value.hundred?.mainButtonLabel === '升级主建筑至 Lv.3',
    JSON.stringify(value.hundred),
  )

  // 5. Clicking the main button opens confirm without any deduction and shows
  // full cost + three power lines; focus moves to the confirm title.
  const cv = value.confirmView
  add(
    '5. main button opens confirm with no wallet/level change',
    cv?.view === 'confirm' &&
      cv?.walletUnchanged === true &&
      cv?.levelUnchanged === true,
    JSON.stringify({ view: cv?.view, walletUnchanged: cv?.walletUnchanged }),
  )
  add(
    '5b. confirm shows full cost 钱60/油0/物资0 and power 130/+35/165',
    arraysEqual(cv?.confirmCost, ['钱 60', '油 0', '物资 0']) &&
      arraysEqual(cv?.confirmPower, [
        '当前建筑战力 130',
        '本次战力 +35',
        '升级后战力 165',
      ]),
    JSON.stringify({ cost: cv?.confirmCost, power: cv?.confirmPower }),
  )
  add(
    '5c. focus moved to the confirm-page title',
    cv?.confirmTitleFocused === true,
    cv?.confirmTitleFocused,
  )

  // 6. 返回 leaves state unchanged.
  add(
    '6. 返回 returns to details with no state change',
    value.back?.view === 'details' &&
      value.back?.walletUnchanged === true &&
      value.back?.levelUnchanged === true,
    JSON.stringify(value.back),
  )

  // 7. Confirm deducts exactly once, main +1, new Lv.0 slot appears and is
  // auto-selected.
  const ca = value.confirmApply
  add(
    '7. confirm deducts 60 once, repair -> Lv.3, new Lv.0 slot auto-selected',
    ca?.moneySpent === 60 &&
      ca?.levelAfter === 3 &&
      ca?.childCountAfter === 3 &&
      ca?.newSlotStatus === 'Lv.0 / Lv.3' &&
      ca?.selectedIndexAfter === 2,
    JSON.stringify(ca),
  )

  // 8. Insufficient resources: exact reason + disabled confirm.
  add(
    '8. insufficient-resources shows 资源不足 还需 钱 60 and disables confirm',
    value.insufficient?.blocker === '资源不足，还需 钱 60' &&
      value.insufficient?.submitDisabled === true,
    JSON.stringify(value.insufficient),
  )

  // 9. Exact block reasons + priority.
  const r = value.reasons
  add(
    '9a. building-locked: locked panel, no upgrade controls',
    r?.locked?.view === 'locked' &&
      r?.locked?.lockStatus === '尚未解锁' &&
      r?.locked?.mainButtonPresent === false,
    JSON.stringify(r?.locked),
  )
  add(
    '9b. building-maxed: 已达到最高等级 Lv.10, no main button',
    r?.maxed?.mainStatus === '已达到最高等级 Lv.10' &&
      r?.maxed?.mainButtonPresent === false,
    JSON.stringify(r?.maxed),
  )
  add(
    '9c. children-not-caught-up: progress 25%, no main button',
    r?.incomplete?.progressPresent === true &&
      r?.incomplete?.mainButtonPresent === false &&
      r?.incomplete?.progressNow === 25,
    JSON.stringify(r?.incomplete),
  )
  add(
    '9d. repair-shop-too-low beats resources: 需要先将修车厂提升至 Lv.2',
    r?.repairTooLow?.blocker === '需要先将修车厂提升至 Lv.2',
    r?.repairTooLow?.blocker,
  )
  add(
    '9e. clubhouse-locked: 需要先将帮派树提升至 Lv.40 解锁 Clubhouse',
    r?.clubhouseLocked?.blocker ===
      '需要先将帮派树提升至 Lv.40 解锁 Clubhouse',
    r?.clubhouseLocked?.blocker,
  )
  add(
    '9f. clubhouse-too-low: 需要先将 Clubhouse 提升至 Lv.6',
    r?.clubhouseTooLow?.blocker === '需要先将 Clubhouse 提升至 Lv.6',
    r?.clubhouseTooLow?.blocker,
  )

  // 10. Repair Lv.5 -> Lv.6 is gated by Clubhouse, and after success keeps five
  // slots, selecting the first child below Lv.6.
  const rb = value.repairBand
  add(
    '10. repair Lv.5->6 ready via Clubhouse, keeps 5 slots, selects slot 0',
    rb?.readyBlocker === null &&
      rb?.levelAfter === 6 &&
      rb?.childCountAfter === 5 &&
      rb?.selectedIndexAfter === 0 &&
      rb?.firstStatus === 'Lv.5 / Lv.6',
    JSON.stringify(rb),
  )

  // 11. Clubhouse ignores the repair-shop gate.
  add(
    '11. Clubhouse upgrades to Lv.2 despite repair-shop at Lv.1',
    value.clubhouseFree?.levelAfter === 2,
    JSON.stringify(value.clubhouseFree),
  )

  // 12. Unlock gang tree debug action.
  const ug = value.unlockGang
  add(
    '12. 解锁帮派树 sets reputation 1470 / Lv.50 with feedback',
    ug?.repAfter === 1470 &&
      ug?.levelAfter === 'Lv. 50' &&
      ug?.feedback === '帮派树已解锁',
    JSON.stringify({ repAfter: ug?.repAfter, level: ug?.levelAfter }),
  )
  add(
    '12b. producers synced to the four Lv.50 producers, no historical backfill',
    arraysEqual(ug?.producersAfter, PRODUCER_IDS) &&
      typeof ug?.moneyJump === 'number' &&
      ug.moneyJump >= 0 &&
      ug.moneyJump < 200,
    JSON.stringify({ producers: ug?.producersAfter, moneyJump: ug?.moneyJump }),
  )
  add(
    '12c. second click is idempotent (still 1470)',
    ug?.repAfterSecond === 1470,
    ug?.repAfterSecond,
  )

  // 13. Grant resources twice: cumulative +20000, panel stays open.
  const g = value.grant
  add(
    '13. 钱/油/物资各 +10000 twice adds exactly +20000 oil & materials',
    g?.oilDelta === 20000 &&
      g?.materialsDelta === 20000 &&
      typeof g?.moneyDelta === 'number' &&
      g.moneyDelta >= 20000,
    JSON.stringify(g),
  )
  add(
    '13b. settings panel stays open with polite feedback',
    g?.panelStillOpen === true &&
      g?.feedback === '钱、油、物资各增加 10000',
    JSON.stringify({ open: g?.panelStillOpen, feedback: g?.feedback }),
  )

  // 14. Reset through two confirmations.
  const rs = value.reset
  add(
    '14. reset restores wallet 10000/0/0, all Lv.1, repair childLevels zero',
    rs?.money === 10000 &&
      rs?.oil === 0 &&
      rs?.materials === 0 &&
      rs?.allLevelsOne === true &&
      arraysEqual(rs?.repairChildLevels, [0, 0, 0, 0, 0]),
    JSON.stringify(rs),
  )
  add(
    '14b. reset: reputation 0, repair-only producer, clocks equal, session closed',
    rs?.gangReputation === 0 &&
      arraysEqual(rs?.producers, ['repair-shop']) &&
      rs?.clocksEqual === true &&
      rs?.panelClosed === true &&
      rs?.settingsClosed === true,
    JSON.stringify(rs),
  )

  // 15. v2 -> v3 one-time refund.
  const m = value.migration
  add(
    '15. v2 injection refunds 40 money once and zeroes hidden slots',
    m?.moneyFirst === 140 &&
      arraysEqual(m?.repairChildFirst, [2, 1, 0, 0, 0]) &&
      arraysEqual(m?.commercialChildFirst, [3, 2, 1, 0, 0, 0, 0, 0, 0, 0]) &&
      m?.versionFirst === 3,
    JSON.stringify(m),
  )
  add(
    '15b. second reload persists version 3 and does not refund again',
    m?.versionSecond === 3 && m?.moneySecond === 140,
    JSON.stringify({ version: m?.versionSecond, money: m?.moneySecond }),
  )

  // 16. Desktop + 390x844 layout.
  const l = value.layout
  add(
    '16. desktop details/confirm within viewport, no horizontal overflow',
    l?.desktopDetails?.noHorizontalOverflow === true &&
      l?.desktopDetails?.withinBounds === true &&
      l?.desktopConfirm?.noHorizontalOverflow === true,
    JSON.stringify({ details: l?.desktopDetails, confirm: l?.desktopConfirm }),
  )
  add(
    '16b. 390x844 panel scrolls without overflow and 44px controls reachable',
    l?.mobile?.noHorizontalOverflow === true &&
      l?.mobile?.withinBounds === true &&
      l?.mobile?.scrollableOrFits === true &&
      l?.mobile?.control44 === true,
    JSON.stringify(l?.mobile),
  )

  // Teardown / process safety.
  const shots = [
    'progressive-initial.png',
    'progressive-slot-before.png',
    'progressive-slot-after.png',
    'progressive-confirm.png',
    'progressive-new-slot.png',
    'progressive-gate.png',
    'progressive-debug.png',
    'progressive-reset.png',
    'progressive-migration.png',
    'progressive-mobile.png',
  ]
  add(
    'all expected screenshots written and nonempty',
    value.screenshots &&
      shots.every((name) => {
        const file = path.join(HERE, name)
        return (
          value.screenshots[name] === name &&
          fs.existsSync(file) &&
          fs.statSync(file).size > 0
        )
      }),
    JSON.stringify(Object.keys(value.screenshots ?? {})),
  )
  add(
    'teardown: only owned PIDs targeted',
    value.processSafety?.unknownProcessesTerminated === false &&
      Array.isArray(value.processSafety?.killAttempts) &&
      value.processSafety.killAttempts.every((a) => a.owned === true),
    JSON.stringify(value.processSafety?.killAttempts),
  )
  add(
    'teardown: dev port released',
    value.teardown?.devPortReleased === true,
    value.teardown?.devPortReleased,
  )
  add(
    'teardown: CDP port released',
    value.teardown?.cdpPortReleased === true,
    value.teardown?.cdpPortReleased,
  )
  add(
    'teardown: temporary Chrome profile removed',
    value.teardown?.tempProfileRemoved === true,
    value.teardown?.tempProfileRemoved,
  )
  return checks
}
// ---------- error sanitization ----------
function toPublicErrorCategory(error) {
  const candidateName =
    error && typeof error === 'object' && typeof error.name === 'string'
      ? error.name
      : 'Error'
  const name = /^[A-Za-z][A-Za-z0-9]*$/.test(candidateName)
    ? candidateName.slice(0, 64)
    : 'Error'
  const candidateCode =
    error && typeof error === 'object' && typeof error.code === 'string'
      ? error.code
      : null
  const code =
    candidateCode && /^[A-Z0-9_-]{1,40}$/.test(candidateCode)
      ? candidateCode
      : null
  return code ? { name, code } : { name }
}

function runPublicErrorSelfTest() {
  const windowsError = new Error(
    'failed at C:\\Users\\private\\secret\\progressive-building-upgrade-flow-cdp.mjs',
  )
  windowsError.stack =
    'Error: secret\n at C:\\Users\\private\\secret\\progressive-building-upgrade-flow-cdp.mjs:1:1'
  windowsError.code = 'ENOENT'
  const unixError = new TypeError(
    'failed at /Users/private/secret/progressive-building-upgrade-flow-cdp.mjs',
  )
  unixError.stack =
    'TypeError: secret\n at /Users/private/secret/progressive-building-upgrade-flow-cdp.mjs:1:1'
  const outputs = [
    toPublicErrorCategory(windowsError),
    toPublicErrorCategory(unixError),
  ]
  const serialized = JSON.stringify(outputs)
  const forbidden = /Users|secret|[A-Za-z]:\\|\/Users\/|message|stack/i.test(
    serialized,
  )
  const expected =
    serialized ===
    JSON.stringify([{ name: 'Error', code: 'ENOENT' }, { name: 'TypeError' }])
  return {
    ok: !forbidden && expected,
    checked: 1,
    outputs,
    forbiddenDataPresent: forbidden,
  }
}

function runAssertionSelfTest() {
  const good = {
    preflight: { devPortFree: true, cdpPortFree: true, devPort: 1, cdpPort: 2 },
    processSafety: {
      unknownProcessesTerminated: false,
      killAttempts: [{ owned: true }],
    },
    dist: { baseOk: true, assetRefs: ['/DobeDemo/assets/a.js'] },
    http: { status: 200 },
    fresh: {
      storage: {
        city: {
          version: 3,
          state: {
            buildingProgress: buildBuildingProgress(),
            resources: { money: 10000, oil: 0, materials: 0 },
          },
        },
      },
      repairPanel: {
        childCount: 1,
        selectedIndex: 0,
        options: [{ status: 'Lv.0 / Lv.1' }],
      },
      hud: { rate: '+1 声望/10秒' },
    },
    slotUpgrade: {
      childLevelsBefore: [0, 0, 0, 0, 0],
      childLevel0After: 1,
      progressBefore: 0,
      progressAfter: 25,
      canvasTarget: { changedPixels: 5000 },
      canvasControl: { changedPct: 0.1 },
    },
    selection: {
      selectedAfterSelect: 1,
      selectedAfterTick: 1,
      moneyBeforeTick: 10,
      moneyAfterTick: 11,
      cyclicIndex: 0,
    },
    hundred: {
      progressPresent: false,
      sharedButtonPresent: false,
      mainButtonPresent: true,
      mainButtonLabel: '升级主建筑至 Lv.3',
    },
    confirmView: {
      view: 'confirm',
      walletUnchanged: true,
      levelUnchanged: true,
      confirmCost: ['钱 60', '油 0', '物资 0'],
      confirmPower: ['当前建筑战力 130', '本次战力 +35', '升级后战力 165'],
      confirmTitleFocused: true,
    },
    back: { view: 'details', walletUnchanged: true, levelUnchanged: true },
    confirmApply: {
      moneySpent: 60,
      levelAfter: 3,
      childCountAfter: 3,
      newSlotStatus: 'Lv.0 / Lv.3',
      selectedIndexAfter: 2,
    },
    insufficient: { blocker: '资源不足，还需 钱 60', submitDisabled: true },
    reasons: {
      locked: {
        view: 'locked',
        lockStatus: '尚未解锁',
        mainButtonPresent: false,
      },
      maxed: {
        mainStatus: '已达到最高等级 Lv.10',
        mainButtonPresent: false,
      },
      incomplete: {
        progressPresent: true,
        mainButtonPresent: false,
        progressNow: 25,
      },
      repairTooLow: { blocker: '需要先将修车厂提升至 Lv.2' },
      clubhouseLocked: {
        blocker: '需要先将帮派树提升至 Lv.40 解锁 Clubhouse',
      },
      clubhouseTooLow: { blocker: '需要先将 Clubhouse 提升至 Lv.6' },
    },
    repairBand: {
      readyBlocker: null,
      levelAfter: 6,
      childCountAfter: 5,
      selectedIndexAfter: 0,
      firstStatus: 'Lv.5 / Lv.6',
    },
    clubhouseFree: { levelAfter: 2 },
    unlockGang: {
      repAfter: 1470,
      levelAfter: 'Lv. 50',
      feedback: '帮派树已解锁',
      producersAfter: [...PRODUCER_IDS],
      moneyJump: 3,
      repAfterSecond: 1470,
    },
    grant: {
      oilDelta: 20000,
      materialsDelta: 20000,
      moneyDelta: 20003,
      panelStillOpen: true,
      feedback: '钱、油、物资各增加 10000',
    },
    reset: {
      money: 10000,
      oil: 0,
      materials: 0,
      allLevelsOne: true,
      repairChildLevels: [0, 0, 0, 0, 0],
      gangReputation: 0,
      producers: ['repair-shop'],
      clocksEqual: true,
      panelClosed: true,
      settingsClosed: true,
    },
    migration: {
      moneyFirst: 140,
      repairChildFirst: [2, 1, 0, 0, 0],
      commercialChildFirst: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      versionFirst: 3,
      moneySecond: 140,
      versionSecond: 3,
    },
    layout: {
      desktopDetails: { noHorizontalOverflow: true, withinBounds: true },
      desktopConfirm: { noHorizontalOverflow: true },
      mobile: {
        noHorizontalOverflow: true,
        withinBounds: true,
        scrollableOrFits: true,
        control44: true,
      },
    },
    screenshots: {},
    teardown: {
      devPortReleased: true,
      cdpPortReleased: true,
      tempProfileRemoved: true,
    },
  }
  const skipRuntimeFiles = (check) =>
    check.name !== 'all expected screenshots written and nonempty'
  const pureChecks = evaluateAssertions(good).filter(skipRuntimeFiles)
  const badChecks = evaluateAssertions({}).filter(skipRuntimeFiles)
  const errorSanitization = runPublicErrorSelfTest()
  return {
    ok:
      pureChecks.every((check) => check.pass) &&
      badChecks.every((check) => !check.pass) &&
      errorSanitization.ok,
    checked: pureChecks.length + errorSanitization.checked,
    failuresOnGoodData: pureChecks
      .filter((check) => !check.pass)
      .map((check) => check.name),
    passesOnBadData: badChecks
      .filter((check) => check.pass)
      .map((check) => check.name),
    errorSanitization,
  }
}

// ---------- infrastructure ----------
async function preflight() {
  const preferredDev = Number(process.env.DEV_PORT || 5312)
  const preferredCdp = Number(process.env.CDP_PORT || 9361)
  devPort = await selectFreePort(
    preferredDev,
    results.preflight.attemptedDevPorts,
  )
  cdpPort = await selectFreePort(
    preferredCdp,
    results.preflight.attemptedCdpPorts,
  )
  devUrl = `http://127.0.0.1:${devPort}/`
  results.preflight.devPort = devPort
  results.preflight.cdpPort = cdpPort
  results.preflight.devPortFree = true
  results.preflight.cdpPortFree = true
  results.preflight.ok = true
}

function checkDist() {
  const html = fs.readFileSync(DIST_INDEX, 'utf8')
  const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('/assets/'))
  results.dist = {
    index: 'dist/index.html',
    assetRefs,
    baseOk:
      assetRefs.length > 0 &&
      assetRefs.every((reference) => reference.startsWith('/DobeDemo/')),
  }
}

async function startDevServer() {
  if (!fs.existsSync(VITE_BIN)) throw new Error(`Vite CLI missing: ${VITE_BIN}`)
  devProc = spawn(
    process.execPath,
    [VITE_BIN, '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'],
    { cwd: REPO, stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(devProc, 'vite')
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(devUrl)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    if (devProc.exitCode !== null) {
      throw new Error(`Owned Vite process exited ${devProc.exitCode}`)
    }
    await sleep(250)
  }
  throw new Error('Owned Vite server did not become ready')
}

async function checkHttp() {
  const response = await fetch(devUrl)
  const body = await response.text()
  results.http = {
    url: devUrl,
    status: response.status,
    hasRoot: /id="root"/.test(body),
    hasMainTsx: body.includes('/src/main.tsx'),
  }
}

function launchChrome() {
  const chromePath = resolveChromePath()
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX))
  // The JSON is a public artifact, so it records basenames only.
  results.processSafety.chromeExecutable = path.basename(chromePath)
  results.processSafety.tempProfileName = path.basename(profileDir)
  chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      devUrl,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(chromeProc, 'chrome')
}
async function cityMoney() {
  return (await readStorage()).city?.state?.resources?.money ?? null
}

async function measurePanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    const root = document.documentElement
    if (!panel) return { present: false }
    const rect = panel.getBoundingClientRect()
    const cs = getComputedStyle(panel)
    const btn = panel.querySelector(
      '.building-panel__main-button, .building-panel__shared-upgrade, .building-panel__confirm-submit',
    )
    const b = btn ? btn.getBoundingClientRect() : null
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      withinBounds:
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1,
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1,
      scrollableOrFits:
        panel.scrollHeight <= panel.clientHeight + 1 ||
        cs.overflowY === 'auto' ||
        cs.overflowY === 'scroll',
      control44: b ? b.height >= 44 || b.width >= 44 : false,
    }
  })()`)
}

// ---------- the browser flow ----------
async function runFlow() {
  await preflight()
  checkDist()
  await startDevServer()
  await checkHttp()
  launchChrome()
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })
  await send('Page.navigate', { url: devUrl })
  await waitForApp()
  await sleep(800)

  // 1. Fresh v3 save from a cleared store.
  await clearStorageAndReload()
  const freshStorage = await readStorage()
  const freshHud = await readHud()
  const freshRepair = await findBuilding('修车厂')
  results.fresh = {
    storage: freshStorage,
    hud: freshHud,
    repairPanel: freshRepair.panel,
  }
  await screenshot('progressive-initial.png')
  await closePanel()

  // 2 + 3 + 4 + 5 + 6 + 7. Drive a repair Lv.2 building from empty to a full
  // main upgrade using only real pointer clicks.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [0, 0, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const repair2 = await findBuilding('修车厂')
  const repairSpot = { x: repair2.x, y: repair2.y }
  const beforePanel = repair2.panel
  const roi = {
    x: repairSpot.x - ROI_LEFT,
    y: repairSpot.y - ROI_UP,
    w: ROI_LEFT + ROI_RIGHT,
    h: ROI_UP + ROI_DOWN,
  }
  const uiRects = await excludeRects()
  const beforeShot = await screenshot('progressive-slot-before.png')
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(190)
  const afterShot = await screenshot('progressive-slot-after.png')
  const afterUpgrade = await readPanel()
  const afterUpgradeStorage = await readStorage()
  results.slotUpgrade = {
    childCountBefore: beforePanel.childCount,
    selectedBefore: beforePanel.selectedIndex,
    progressBefore: beforePanel.progressNow,
    childLevelsBefore: [0, 0, 0, 0, 0],
    childLevel0After:
      afterUpgradeStorage.city?.state?.buildingProgress?.['repair-shop']
        ?.childLevels?.[0] ?? null,
    progressAfter: afterUpgrade.progressNow,
    canvasTarget: diffPixels(beforeShot, afterShot, { roi, excludes: uiRects }),
    canvasControl: diffPixels(beforeShot, afterShot, {
      excludes: [
        ...uiRects,
        { x: roi.x, y: roi.y, w: roi.w, h: roi.h },
      ],
    }),
  }

  // 3. Manual selection survives a real tick, then cycles after catch-up.
  await clickSelector('.building-panel__child-option', 1)
  const afterSelect = await readPanel()
  const moneyBeforeTick = await cityMoney()
  let moneyAfterTick = moneyBeforeTick
  for (let attempt = 0; attempt < 56; attempt += 1) {
    await sleep(250)
    moneyAfterTick = await cityMoney()
    if (
      typeof moneyAfterTick === 'number' &&
      typeof moneyBeforeTick === 'number' &&
      moneyAfterTick > moneyBeforeTick
    ) {
      break
    }
  }
  const afterTick = await readPanel()
  // slot 1: 0 -> 1 (still selected because it is below the main level)
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(200)
  // slot 1: 1 -> 2 (caught up, selection cycles forward to slot 0)
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(250)
  const cyclic = await readPanel()
  // slot 0: 1 -> 2 (whole building caught up, progress replaced by main button)
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(300)
  results.selection = {
    selectedAfterSelect: afterSelect.selectedIndex,
    moneyBeforeTick,
    moneyAfterTick,
    selectedAfterTick: afterTick.selectedIndex,
    cyclicIndex: cyclic.selectedIndex,
  }

  // 4. 100% state.
  const hundred = await readPanel()
  results.hundred = {
    progressPresent: hundred.progressPresent,
    sharedButtonPresent: hundred.sharedButtonPresent,
    mainButtonPresent: hundred.mainButtonPresent,
    mainButtonLabel: hundred.mainButtonLabel,
  }

  // 5. Open the confirm page: no deduction, full cost + power, focus transfer.
  const walletBeforeConfirm = await cityMoney()
  const levelBeforeConfirm =
    (await readStorage()).city?.state?.buildingProgress?.['repair-shop']?.level
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const confirmPanel = await readPanel()
  const walletAfterConfirm = await cityMoney()
  const levelAfterConfirm =
    (await readStorage()).city?.state?.buildingProgress?.['repair-shop']?.level
  results.confirmView = {
    view: confirmPanel.view,
    confirmCost: confirmPanel.confirmCost,
    confirmPower: confirmPanel.confirmPower,
    confirmTitleFocused: confirmPanel.confirmTitleFocused,
    walletUnchanged:
      typeof walletAfterConfirm === 'number' &&
      typeof walletBeforeConfirm === 'number' &&
      walletAfterConfirm >= walletBeforeConfirm,
    levelUnchanged: levelAfterConfirm === levelBeforeConfirm,
  }
  await screenshot('progressive-confirm.png')

  // 6. 返回 leaves everything unchanged.
  await clickSelector('.building-panel__confirm-back')
  await sleep(200)
  const backPanel = await readPanel()
  const walletAfterBack = await cityMoney()
  const levelAfterBack =
    (await readStorage()).city?.state?.buildingProgress?.['repair-shop']?.level
  results.back = {
    view: backPanel.view,
    walletUnchanged:
      typeof walletAfterBack === 'number' &&
      walletAfterBack >= walletBeforeConfirm,
    levelUnchanged: levelAfterBack === 2,
  }

  // 7. Confirm deducts exactly once and reveals the auto-selected new slot.
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const moneyBeforeApply = await cityMoney()
  await clickSelector('.building-panel__confirm-submit')
  await sleep(350)
  const applyPanel = await readPanel()
  const applyStorage = await readStorage()
  const moneyAfterApply = await cityMoney()
  results.confirmApply = {
    moneySpent:
      typeof moneyBeforeApply === 'number' && typeof moneyAfterApply === 'number'
        ? moneyBeforeApply - moneyAfterApply
        : null,
    levelAfter:
      applyStorage.city?.state?.buildingProgress?.['repair-shop']?.level ?? null,
    childCountAfter: applyPanel.childCount,
    newSlotStatus: applyPanel.options?.[2]?.status ?? null,
    selectedIndexAfter: applyPanel.selectedIndex,
  }
  await screenshot('progressive-new-slot.png')
  await closePanel()

  // 8. Insufficient resources disables confirm with the exact shortfall text.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [2, 2, 0, 0, 0] },
      }),
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  await findBuilding('修车厂')
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const insufficientPanel = await readPanel()
  results.insufficient = {
    blocker: insufficientPanel.mainBlocker,
    submitDisabled: insufficientPanel.confirmSubmitDisabled,
  }
  await closePanel()

  // 9. Exact block reasons and priority.
  results.reasons = {}
  // 9a. building-locked (recycling-yard at gang Lv.1).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const lockedHit = await findBuilding('废车回收厂', { requireUnlocked: false })
  results.reasons.locked = {
    view: lockedHit.panel.view,
    lockStatus: lockedHit.panel.lockStatus,
    mainButtonPresent: lockedHit.panel.mainButtonPresent,
  }
  await screenshot('progressive-gate.png')
  await closePanel()

  // 9b. building-maxed (repair Lv.10).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 10, childLevels: [10, 10, 10, 10, 10] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV50_REPUTATION, Date.now()),
  )
  const maxedHit = await findBuilding('修车厂')
  results.reasons.maxed = {
    mainStatus: maxedHit.panel.mainStatus,
    mainButtonPresent: maxedHit.panel.mainButtonPresent,
  }
  await closePanel()

  // 9c. children-not-caught-up (repair Lv.2, one slot behind).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [1, 0, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const incompleteHit = await findBuilding('修车厂')
  results.reasons.incomplete = {
    progressPresent: incompleteHit.panel.progressPresent,
    mainButtonPresent: incompleteHit.panel.mainButtonPresent,
    progressNow: incompleteHit.panel.progressNow,
  }
  await closePanel()

  // 9d. repair-shop-too-low beats insufficient-resources (recycling target 2).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 1, childLevels: [0, 0, 0, 0, 0] },
        'recycling-yard': {
          level: 1,
          childLevels: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      }),
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV50_REPUTATION, Date.now()),
  )
  await findBuilding('废车回收厂')
  await clickSelector('.building-panel__main-button')
  await sleep(200)
  results.reasons.repairTooLow = { blocker: (await readPanel()).mainBlocker }
  await closePanel()

  // 9e. clubhouse-locked (recycling target 6 at gang Lv.8).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 5, childLevels: [5, 5, 5, 5, 5] },
        'recycling-yard': {
          level: 5,
          childLevels: [5, 5, 5, 5, 5, 0, 0, 0, 0, 0],
        },
      }),
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV8_REPUTATION, Date.now()),
  )
  await findBuilding('废车回收厂')
  await clickSelector('.building-panel__main-button')
  await sleep(200)
  results.reasons.clubhouseLocked = { blocker: (await readPanel()).mainBlocker }
  await closePanel()

  // 9f. clubhouse-too-low (recycling target 6, Clubhouse Lv.5).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 5, childLevels: [5, 5, 5, 5, 5] },
        'recycling-yard': {
          level: 5,
          childLevels: [5, 5, 5, 5, 5, 0, 0, 0, 0, 0],
        },
        clubhouse: { level: 5, childLevels: [5, 5, 5, 5, 5, 0, 0, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV50_REPUTATION, Date.now()),
  )
  await findBuilding('废车回收厂')
  await clickSelector('.building-panel__main-button')
  await sleep(200)
  results.reasons.clubhouseTooLow = { blocker: (await readPanel()).mainBlocker }
  await closePanel()

  // 10. Repair Lv.5 -> Lv.6 gated by Clubhouse; success keeps five slots.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 5, childLevels: [5, 5, 5, 5, 5] },
        clubhouse: {
          level: 6,
          childLevels: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
        },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV50_REPUTATION, Date.now()),
  )
  await findBuilding('修车厂')
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const repairBandConfirm = await readPanel()
  await clickSelector('.building-panel__confirm-submit')
  await sleep(350)
  const repairBandPanel = await readPanel()
  const repairBandStorage = await readStorage()
  results.repairBand = {
    readyBlocker: repairBandConfirm.mainBlocker,
    levelAfter:
      repairBandStorage.city?.state?.buildingProgress?.['repair-shop']?.level ??
      null,
    childCountAfter: repairBandPanel.childCount,
    selectedIndexAfter: repairBandPanel.selectedIndex,
    firstStatus: repairBandPanel.options?.[0]?.status ?? null,
  }
  await closePanel()

  // 11. Clubhouse ignores the repair-shop gate.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 1, childLevels: [0, 0, 0, 0, 0] },
        clubhouse: {
          level: 1,
          childLevels: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(GANG_LV50_REPUTATION, Date.now()),
  )
  await findBuilding('Clubhouse')
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  await clickSelector('.building-panel__confirm-submit')
  await sleep(350)
  results.clubhouseFree = {
    levelAfter:
      (await readStorage()).city?.state?.buildingProgress?.clubhouse?.level ??
      null,
  }
  await closePanel()

  // 12. Debug: unlock gang tree.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: 10_000, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const unlockMoneyBefore = await cityMoney()
  await clickSelector('.city-hud__open-settings')
  await sleep(200)
  await clickSelector('.settings-panel__debug-action', 0)
  await sleep(300)
  const unlockGang = (await readStorage()).gang
  const unlockSettings = await readSettings()
  const unlockHud = await readHud()
  const unlockCity = (await readStorage()).city
  await screenshot('progressive-debug.png')
  await clickSelector('.settings-panel__debug-action', 0)
  await sleep(250)
  const unlockGangSecond = (await readStorage()).gang
  results.unlockGang = {
    repBefore: 0,
    repAfter: unlockGang?.state?.totalReputation ?? null,
    levelAfter: unlockHud.level,
    feedback: unlockSettings.feedback,
    producersAfter: unlockCity?.state?.activeProducerIds ?? null,
    moneyJump:
      typeof unlockMoneyBefore === 'number' &&
      typeof unlockCity?.state?.resources?.money === 'number'
        ? unlockCity.state.resources.money - unlockMoneyBefore
        : null,
    repAfterSecond: unlockGangSecond?.state?.totalReputation ?? null,
  }
  await clickSelector('.settings-panel__close')
  await sleep(150)

  // 13. Debug: grant resources twice (gang Lv.1 so oil/materials do not produce).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: 10_000, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const grantBefore = (await readStorage()).city?.state?.resources
  await clickSelector('.city-hud__open-settings')
  await sleep(200)
  await clickSelector('.settings-panel__debug-action', 1)
  await sleep(220)
  await clickSelector('.settings-panel__debug-action', 1)
  await sleep(300)
  const grantAfter = (await readStorage()).city?.state?.resources
  const grantSettings = await readSettings()
  results.grant = {
    oilDelta:
      typeof grantAfter?.oil === 'number' && typeof grantBefore?.oil === 'number'
        ? grantAfter.oil - grantBefore.oil
        : null,
    materialsDelta:
      typeof grantAfter?.materials === 'number' &&
      typeof grantBefore?.materials === 'number'
        ? grantAfter.materials - grantBefore.materials
        : null,
    moneyDelta:
      typeof grantAfter?.money === 'number' &&
      typeof grantBefore?.money === 'number'
        ? grantAfter.money - grantBefore.money
        : null,
    panelStillOpen: grantSettings.present,
    feedback: grantSettings.feedback,
  }
  await clickSelector('.settings-panel__close')
  await sleep(150)

  // 14. Reset through two confirmations.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 3, childLevels: [3, 3, 3, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 500, materials: 500 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(500, Date.now()),
  )
  await clickSelector('.city-hud__open-settings')
  await sleep(200)
  await clickSelector('.settings-panel__reset')
  await sleep(180)
  await clickSelector('.settings-panel__confirm-reset')
  await sleep(400)
  const resetStorage = await readStorage()
  const resetCity = resetStorage.city?.state
  const resetGang = resetStorage.gang?.state
  const resetPanelPresent = await evaluate(
    `Boolean(document.querySelector('.building-panel'))`,
  )
  const resetSettingsPresent = (await readSettings()).present
  results.reset = {
    money: resetCity?.resources?.money ?? null,
    oil: resetCity?.resources?.oil ?? null,
    materials: resetCity?.resources?.materials ?? null,
    allLevelsOne: BUILDING_IDS.every(
      (id) => resetCity?.buildingProgress?.[id]?.level === 1,
    ),
    repairChildLevels:
      resetCity?.buildingProgress?.['repair-shop']?.childLevels ?? null,
    gangReputation: resetGang?.totalReputation ?? null,
    producers: resetCity?.activeProducerIds ?? null,
    clocksEqual:
      typeof resetCity?.lastResourceUpdatedAt === 'number' &&
      resetCity.lastResourceUpdatedAt === resetGang?.lastUpdatedAt,
    panelClosed: resetPanelPresent === false,
    settingsClosed: resetSettingsPresent === false,
  }
  await screenshot('progressive-reset.png')

  // 15. v2 -> v3 one-time hidden-slot refund.
  await inject(
    citySave({
      version: 2,
      buildingProgress: {
        'repair-shop': { level: 2, childLevels: [2, 1, 2, 0, 1] },
        'commercial-street': {
          level: 3,
          childLevels: [3, 2, 1, 2, 1, 0, 0, 0, 0, 0],
        },
      },
      resources: { money: 100, oil: 7, materials: 9 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const migratedCity = (await readStorage()).city
  results.migration = {
    moneyFirst: migratedCity?.state?.resources?.money ?? null,
    repairChildFirst:
      migratedCity?.state?.buildingProgress?.['repair-shop']?.childLevels ??
      null,
    commercialChildFirst:
      migratedCity?.state?.buildingProgress?.['commercial-street']
        ?.childLevels ?? null,
    versionFirst: migratedCity?.version ?? null,
  }
  await screenshot('progressive-migration.png')
  await reloadAndWait()
  const remigratedCity = (await readStorage()).city
  results.migration.moneySecond = remigratedCity?.state?.resources?.money ?? null
  results.migration.versionSecond = remigratedCity?.version ?? null

  // 16. Desktop + 390x844 layout for details, confirm and mobile panel.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [2, 2, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  await findBuilding('修车厂')
  const desktopDetails = await measurePanel()
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const desktopConfirm = await measurePanel()
  await clickSelector('.building-panel__confirm-back')
  await sleep(180)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(500)
  const mobile = await measurePanel()
  await screenshot('progressive-mobile.png')
  await send('Emulation.clearDeviceMetricsOverride')
  results.layout = { desktopDetails, desktopConfirm, mobile }
}
async function teardown() {
  try {
    ws?.close()
  } catch {
    // Ignore close races.
  }
  killOwnedTree(chromeProc, 'chrome')
  killOwnedTree(devProc, 'vite')
  await sleep(1200)
  results.teardown.cdpPortReleased = cdpPort
    ? !(await isPortInUse(cdpPort))
    : null
  results.teardown.devPortReleased = devPort
    ? !(await isPortInUse(devPort))
    : null
  if (profileDir) {
    const expectedPrefix = path.join(os.tmpdir(), PROFILE_PREFIX)
    if (!profileDir.startsWith(expectedPrefix)) {
      throw new Error(
        `SAFETY_ABORT: refusing to remove unexpected profile ${path.basename(profileDir)}`,
      )
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
      results.teardown.tempProfileRemoved = !fs.existsSync(profileDir)
    } catch {
      results.teardown.tempProfileRemoved = false
    }
  } else {
    results.teardown.tempProfileRemoved = null
  }
}

results.assertionSelfTest = runAssertionSelfTest()
let runError
let teardownError
try {
  if (!results.assertionSelfTest.ok) {
    throw new Error('Assertion self-test failed before browser run')
  }
  await runFlow()
} catch (error) {
  runError = error
  results.error = toPublicErrorCategory(error)
} finally {
  try {
    await teardown()
  } catch (error) {
    teardownError = error
    runError ||= error
    results.teardown.error = toPublicErrorCategory(error)
  }
}

results.assertions = evaluateAssertions(results)
const failures = results.assertions.filter((assertion) => !assertion.pass)
fs.writeFileSync(OUT_JSON, `${JSON.stringify(results, null, 2)}\n`)
console.log(`WROTE ${path.basename(OUT_JSON)}`)
console.log(
  `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
)
if (!results.assertionSelfTest.ok) {
  console.error(
    'SELF-TEST FAILURES:',
    JSON.stringify({
      failuresOnGoodData: results.assertionSelfTest.failuresOnGoodData,
      passesOnBadData: results.assertionSelfTest.passesOnBadData,
    }),
  )
}
for (const assertion of results.assertions) {
  console.log(
    `${assertion.pass ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`,
  )
}
if (runError) console.error('RUN ERROR:', runError?.stack || runError)
if (teardownError && teardownError !== runError) {
  console.error('TEARDOWN ERROR:', teardownError?.stack || teardownError)
}
if (failures.length) {
  console.error(
    `FAILED ASSERTIONS: ${failures.map((item) => item.name).join(', ')}`,
  )
}
const ok = !runError && results.assertionSelfTest.ok && failures.length === 0
console.log(ok ? 'ALL ASSERTIONS PASSED' : 'ACCEPTANCE FAILED')
process.exitCode = ok ? 0 : 1
