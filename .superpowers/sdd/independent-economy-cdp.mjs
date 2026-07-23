// Safe, repeatable Chrome/CDP acceptance for the independent sub-building economy.
//
// Covers the Task 6 browser flow: fresh v2 save, 10-second money tick, free
// real-click upgrade of the 5th repair child with a 3D ROI change, the two exact
// Clubhouse gate texts, the full clubhouse->repair upgrade loop via real clicks,
// refresh persistence, three-resource production growth, level caps, and the
// 390x844 mobile panel.
//
// SAFETY MODEL:
// - Selects free dev/CDP ports dynamically; never connects to or kills a listener
//   found during preflight.
// - Tracks child PIDs and only terminates process trees this script spawned.
// - Creates an isolated Chrome profile under os.tmpdir() and only removes that
//   exact temp-prefixed profile.
// - Vite runs with --strictPort.
// - The result JSON records only basenames, never absolute paths.
// - Errors record a whitelisted name/code only; raw stacks go to stderr.
// - A pure-data assertion self-test fails on empty/bad data and includes an error
//   path sanitization self-check.
// - Exits non-zero on any failure.
//
// Config via env: DEV_PORT, CDP_PORT, CHROME_PATH. Preferred occupied ports are
// skipped. Run: node .superpowers/sdd/independent-economy-cdp.mjs

import zlib from 'node:zlib'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUT_JSON = path.join(HERE, 'independent-economy-results.json')
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')

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
// Order mirrors getUnlockedProducerIds, which filters BUILDING_IDS in place, so
// the persisted activeProducerIds compare equal element-by-element.
const PRODUCER_IDS = [
  'repair-shop',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
]
// getGangLevel(1170) === floor(1170/30)+1 === 40, so Clubhouse (Lv.40) unlocks.
const GANG_LV40_REPUTATION = 1170
const LARGE_MONEY = 100_000
// Minimum changed pixels inside the building ROI that proves the 3D model
// actually re-rendered after the 5th child fragment was built.
const CANVAS_MIN_CHANGED = 40
const ROI_LEFT = 220
const ROI_RIGHT = 180
const ROI_UP = 240
const ROI_DOWN = 150

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = {
  generatedAt: new Date().toISOString(),
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
  idle: {},
  freeChoice: {},
  gateLocked: {},
  gateTooLow: {},
  loop: {},
  persist: {},
  resourceGrowth: {},
  maxed: {},
  mobile: {},
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

async function clickSelector(selector) {
  // Scroll the target to the centre of any scrollable ancestor first so its
  // click point is inside the viewport; the building panel's child grid can push
  // later cards and the main button out of view.
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    element.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      inView:
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= innerHeight &&
        rect.right <= innerWidth,
    }
  })()`)
  if (!point) throw new Error(`Element not found for real click: ${selector}`)
  await sleep(80)
  const settled = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
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
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
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
    const mainButton = panel.querySelector('.building-panel__main-button')
    const childCards = panel.querySelectorAll('.building-panel__child-card')
    const childButtons = [
      ...panel.querySelectorAll('.building-panel__child-upgrade'),
    ].map((b) => ({
      label: b.getAttribute('aria-label'),
      disabled: Boolean(b.disabled),
    }))
    return {
      present: true,
      unlocked: Boolean(panel.querySelector('.building-panel__level')),
      title: text('.building-panel__title'),
      level: text('.building-panel__level'),
      mainStatus: text('.building-panel__main-status'),
      mainBlocker: text('.building-panel__main-blocker'),
      mainGoal: text('.building-panel__main-goal'),
      mainCost: text('.building-panel__main-cost'),
      mainButtonPresent: Boolean(mainButton),
      mainButtonLabel: mainButton?.getAttribute('aria-label') ?? null,
      childCount: childCards.length,
      childButtons,
    }
  })()`)
}

async function readHud() {
  return evaluate(`(() => {
    const t = (s) => document.querySelector(s)?.textContent?.trim() ?? null
    return {
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
    for (const sel of ['.city-hud', '.building-panel']) {
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

async function reloadAndWait(extraDelay = 1500) {
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
}) {
  return {
    state: {
      buildingProgress,
      resources,
      lastResourceUpdatedAt,
      activeProducerIds,
    },
    version: 2,
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

// Real CDP clicks on the 3D scene until the requested unlocked building panel
// opens; leaves it open. Reuses a preferred coordinate first so reloads stay
// cheap.
async function findBuilding(title, prefer) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(170)
    const panel = await readPanel()
    if (panel.present && panel.title === title && panel.unlocked) {
      return { x, y, panel }
    }
    if (panel.present) await closePanel()
    return null
  }
  if (prefer) {
    const hit = await tryAt(prefer.x, prefer.y)
    if (hit) return hit
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) return hit
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

  const freshCity = value.fresh?.storage?.city
  const freshRepair = freshCity?.state?.buildingProgress?.['repair-shop']
  const freshResources = freshCity?.state?.resources

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
  add(
    'HTTP contains root and main.tsx',
    value.http?.hasRoot === true && value.http?.hasMainTsx === true,
    JSON.stringify(value.http),
  )

  // 1. fresh v2 save.
  add(
    '1. fresh v2 save: repair Lv.1, 5 children all 0, resources 0',
    freshCity?.version === 2 &&
      freshRepair?.level === 1 &&
      arraysEqual(freshRepair?.childLevels, [0, 0, 0, 0, 0]) &&
      freshResources?.money === 0 &&
      freshResources?.oil === 0 &&
      freshResources?.materials === 0,
    JSON.stringify({ version: freshCity?.version, freshRepair, freshResources }),
  )
  add(
    '1b. HUD shows +1 声望/10秒 and 钱 +1/10秒',
    value.fresh?.hud?.rate === '+1 声望/10秒' &&
      Array.isArray(value.fresh?.hud?.resources) &&
      value.fresh.hud.resources.includes('钱 +1/10秒'),
    JSON.stringify(value.fresh?.hud),
  )

  // 2. 10 second money tick.
  add(
    '2. exactly +1 money after a 10s tick',
    value.idle?.moneyBefore === 0 && value.idle?.moneyAfter === 1,
    JSON.stringify(value.idle),
  )

  // 3. free real-click on the 5th repair child.
  add(
    '3. real click 5th repair child sets childLevels [0,0,0,0,1] and spends 5 money',
    arraysEqual(value.freeChoice?.childLevelsBefore, [0, 0, 0, 0, 0]) &&
      arraysEqual(value.freeChoice?.childLevelsAfter, [0, 0, 0, 0, 1]) &&
      value.freeChoice?.moneySpent === 5,
    JSON.stringify(value.freeChoice?.childLevelsAfter),
  )

  // 4. 3D ROI change for the 5th slot; other child data unchanged.
  add(
    `4. 5th slot 3D ROI changed >= ${CANVAS_MIN_CHANGED} and other children unchanged`,
    typeof value.freeChoice?.canvas?.changedPixels === 'number' &&
      value.freeChoice.canvas.changedPixels >= CANVAS_MIN_CHANGED &&
      arraysEqual(value.freeChoice?.childLevelsBefore, [0, 0, 0, 0, 0]) &&
      arraysEqual(value.freeChoice?.childLevelsAfter, [0, 0, 0, 0, 1]),
    `changed=${value.freeChoice?.canvas?.changedPixels}/${value.freeChoice?.canvas?.consideredPixels}`,
  )

  // 5. Clubhouse locked gate text.
  add(
    '5. clubhouse-locked gate text exact',
    value.gateLocked?.blocker === '需要先将帮派树提升至 Lv.40 解锁 Clubhouse',
    value.gateLocked?.blocker,
  )

  // 6. Clubhouse too-low gate text.
  add(
    '6. clubhouse-too-low gate text exact',
    value.gateTooLow?.blocker === '需要先将 Clubhouse 提升至 Lv.2',
    value.gateTooLow?.blocker,
  )

  // 7. Full upgrade loop via real clicks.
  add(
    '7. real loop: Clubhouse Lv.2 then repair Lv.2',
    value.loop?.clubhouseLevelAfter === '等级 2 / 10' &&
      value.loop?.clubhouseStored === 2 &&
      value.loop?.repairLevelAfter === '等级 2 / 5' &&
      value.loop?.repairStored === 2 &&
      arraysEqual(value.loop?.repairChildLevels, [1, 1, 1, 1, 1]),
    JSON.stringify(value.loop),
  )

  // 8. Refresh persistence.
  add(
    '8. refresh persists wallet, producers, main/child levels',
    value.persist?.repairLevel === 2 &&
      arraysEqual(value.persist?.repairChildLevels, [1, 1, 1, 1, 1]) &&
      value.persist?.clubhouseLevel === 2 &&
      arraysEqual(value.persist?.activeProducerIds, PRODUCER_IDS) &&
      typeof value.persist?.moneyAfter === 'number' &&
      typeof value.persist?.moneyBefore === 'number' &&
      value.persist.moneyAfter >= value.persist.moneyBefore,
    JSON.stringify(value.persist),
  )

  // 9. Three-resource production growth.
  add(
    '9. three resources grow per config (money=3/tick, oil=1/tick, materials=1/tick)',
    typeof value.resourceGrowth?.oil === 'number' &&
      value.resourceGrowth.oil >= 1 &&
      value.resourceGrowth.money === value.resourceGrowth.oil * 3 &&
      value.resourceGrowth.materials === value.resourceGrowth.oil,
    JSON.stringify(value.resourceGrowth),
  )
  add(
    '9b. HUD shows 钱 +3/10秒, 油 +1/10秒, 物资 +1/10秒',
    Array.isArray(value.resourceGrowth?.hud?.resources) &&
      value.resourceGrowth.hud.resources.includes('钱 +3/10秒') &&
      value.resourceGrowth.hud.resources.includes('油 +1/10秒') &&
      value.resourceGrowth.hud.resources.includes('物资 +1/10秒'),
    JSON.stringify(value.resourceGrowth?.hud),
  )

  // 10. Level caps disable upgrades.
  add(
    '10. repair Lv.5 and Clubhouse Lv.10 disable main upgrade',
    value.maxed?.repairLevel === '等级 5 / 5' &&
      value.maxed?.repairMainButtonPresent === false &&
      value.maxed?.repairStatus === '已达到最高等级 Lv.5' &&
      value.maxed?.clubhouseLevel === '等级 10 / 10' &&
      value.maxed?.clubhouseMainButtonPresent === false &&
      value.maxed?.clubhouseStatus === '已达到最高等级 Lv.10',
    JSON.stringify(value.maxed),
  )

  // 11. Mobile 390x844.
  add(
    '11. mobile 390x844 no horizontal overflow and within bounds',
    value.mobile?.measure?.noHorizontalOverflow === true &&
      value.mobile?.measure?.withinBounds === true &&
      value.mobile?.measure?.scrollableOrFits === true,
    JSON.stringify(value.mobile?.measure),
  )

  // 12. Teardown / process safety.
  add(
    'all five screenshots written',
    value.screenshots &&
      [
        'independent-economy-initial.png',
        'independent-economy-free-choice.png',
        'independent-economy-gate.png',
        'independent-economy-resources.png',
        'independent-economy-mobile.png',
      ].every(
        (name) =>
          value.screenshots[name] === name &&
          fs.existsSync(path.join(HERE, name)),
      ),
    JSON.stringify(value.screenshots),
  )
  add(
    '12. only owned PIDs targeted',
    value.processSafety?.unknownProcessesTerminated === false &&
      Array.isArray(value.processSafety?.killAttempts) &&
      value.processSafety.killAttempts.every((attempt) => attempt.owned === true),
    JSON.stringify(value.processSafety),
  )
  add(
    '12. dev port released',
    value.teardown?.devPortReleased === true,
    value.teardown?.devPortReleased,
  )
  add(
    '12. CDP port released',
    value.teardown?.cdpPortReleased === true,
    value.teardown?.cdpPortReleased,
  )
  add(
    '12. temporary Chrome profile removed',
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
    'failed at C:\\Users\\private\\secret\\independent-economy-cdp.mjs',
  )
  windowsError.stack =
    'Error: secret\n at C:\\Users\\private\\secret\\independent-economy-cdp.mjs:1:1'
  windowsError.code = 'ENOENT'
  const unixError = new TypeError(
    'failed at /Users/private/secret/independent-economy-cdp.mjs',
  )
  unixError.stack =
    'TypeError: secret\n at /Users/private/secret/independent-economy-cdp.mjs:1:1'
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
    processSafety: { unknownProcessesTerminated: false, killAttempts: [] },
    dist: { baseOk: true, assetRefs: ['/DobeDemo/assets/a.js'] },
    http: { status: 200, hasRoot: true, hasMainTsx: true },
    fresh: {
      storage: {
        city: {
          version: 2,
          state: {
            buildingProgress: {
              'repair-shop': { level: 1, childLevels: [0, 0, 0, 0, 0] },
            },
            resources: { money: 0, oil: 0, materials: 0 },
          },
        },
      },
      hud: { rate: '+1 声望/10秒', resources: ['钱 0', '钱 +1/10秒'] },
    },
    idle: { moneyBefore: 0, moneyAfter: 1 },
    freeChoice: {
      childLevelsBefore: [0, 0, 0, 0, 0],
      childLevelsAfter: [0, 0, 0, 0, 1],
      moneySpent: 5,
      canvas: { changedPixels: 5000, consideredPixels: 20000 },
    },
    gateLocked: { blocker: '需要先将帮派树提升至 Lv.40 解锁 Clubhouse' },
    gateTooLow: { blocker: '需要先将 Clubhouse 提升至 Lv.2' },
    loop: {
      clubhouseLevelAfter: '等级 2 / 10',
      clubhouseStored: 2,
      repairLevelAfter: '等级 2 / 5',
      repairStored: 2,
      repairChildLevels: [1, 1, 1, 1, 1],
    },
    persist: {
      repairLevel: 2,
      repairChildLevels: [1, 1, 1, 1, 1],
      clubhouseLevel: 2,
      activeProducerIds: PRODUCER_IDS,
      moneyBefore: 99_950,
      moneyAfter: 99_953,
    },
    resourceGrowth: {
      money: 3,
      oil: 1,
      materials: 1,
      hud: {
        resources: ['钱 +3/10秒', '油 +1/10秒', '物资 +1/10秒'],
      },
    },
    maxed: {
      repairLevel: '等级 5 / 5',
      repairMainButtonPresent: false,
      repairStatus: '已达到最高等级 Lv.5',
      clubhouseLevel: '等级 10 / 10',
      clubhouseMainButtonPresent: false,
      clubhouseStatus: '已达到最高等级 Lv.10',
    },
    mobile: {
      measure: {
        noHorizontalOverflow: true,
        withinBounds: true,
        scrollableOrFits: true,
      },
    },
    screenshots: Object.fromEntries(
      [
        'independent-economy-initial.png',
        'independent-economy-free-choice.png',
        'independent-economy-gate.png',
        'independent-economy-resources.png',
        'independent-economy-mobile.png',
      ].map((name) => [name, name]),
    ),
    teardown: {
      devPortReleased: true,
      cdpPortReleased: true,
      tempProfileRemoved: true,
    },
  }
  const checks = evaluateAssertions(good)
  // Screenshot existence depends on runtime files, so it is excluded from the
  // pure-data portion while every other check must distinguish good from empty.
  const pureChecks = checks.filter(
    (check) => check.name !== 'all five screenshots written',
  )
  const badChecks = evaluateAssertions({}).filter(
    (check) => check.name !== 'all five screenshots written',
  )
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
  const preferredDev = Number(process.env.DEV_PORT || 5199)
  const preferredCdp = Number(process.env.CDP_PORT || 9245)
  devPort = await selectFreePort(preferredDev, results.preflight.attemptedDevPorts)
  cdpPort = await selectFreePort(preferredCdp, results.preflight.attemptedCdpPorts)
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
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-independent-economy-cdp-'))
  // Keep absolute paths only in local runtime variables. The JSON is a public
  // artifact, so it records basenames that cannot expose a drive, home folder,
  // username, or install directory.
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

  // 1. Fresh v2 save: repair Lv.1, five children all 0, resources all 0.
  const freshAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: freshAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(0, freshAt),
  )
  results.fresh = { storage: await readStorage(), hud: await readHud() }
  await screenshot('independent-economy-initial.png')

  // 2. Wait for a real 10-second money tick to add exactly +1.
  const moneyBefore =
    results.fresh.storage.city?.state?.resources?.money ?? null
  let moneyAfter = moneyBefore
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const storage = await readStorage()
    moneyAfter = storage.city?.state?.resources?.money ?? null
    if (typeof moneyAfter === 'number' && moneyAfter >= 1) break
    await sleep(250)
  }
  results.idle = { moneyBefore, moneyAfter }

  // 3 + 4. Inject money, then really click the 5th repair child; verify the
  // stored array becomes [0,0,0,0,1] and the 3D ROI around the building changed.
  const freeAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: freeAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(0, freeAt),
  )
  const repairSpot = await findBuilding('修车厂')
  results.freeChoice.coordinate = { x: repairSpot.x, y: repairSpot.y }
  const beforeStorage = await readStorage()
  const childLevelsBefore =
    beforeStorage.city?.state?.buildingProgress?.['repair-shop']?.childLevels
  const moneyPre =
    beforeStorage.city?.state?.buildingProgress === undefined
      ? null
      : beforeStorage.city?.state?.resources?.money
  const masks = await excludeRects()
  const roi = {
    x: repairSpot.x - ROI_LEFT,
    y: repairSpot.y - ROI_UP,
    w: ROI_LEFT + ROI_RIGHT,
    h: ROI_UP + ROI_DOWN,
  }
  const beforeShot = await screenshot('independent-economy-free-choice-before.png')
  await clickSelector('[aria-label="升级 诊断工位 至 Lv.1"]')
  await sleep(900)
  const afterShot = await screenshot('independent-economy-free-choice.png')
  const afterStorage = await readStorage()
  const childLevelsAfter =
    afterStorage.city?.state?.buildingProgress?.['repair-shop']?.childLevels
  const moneyPost = afterStorage.city?.state?.resources?.money
  results.freeChoice = {
    ...results.freeChoice,
    childLevelsBefore,
    childLevelsAfter,
    moneyPre,
    moneyPost,
    moneySpent:
      typeof moneyPre === 'number' && typeof moneyPost === 'number'
        ? moneyPre - moneyPost
        : null,
    roiRequested: roi,
    canvas: diffPixels(beforeShot, afterShot, { roi, excludes: masks }),
  }

  // 5. Clubhouse-locked gate: gang Lv.1, repair children all caught up.
  const lockedAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 1, childLevels: [1, 1, 1, 1, 1] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: lockedAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(0, lockedAt),
  )
  const lockedSpot = await findBuilding('修车厂')
  results.gateLocked = {
    coordinate: { x: lockedSpot.x, y: lockedSpot.y },
    blocker: lockedSpot.panel.mainBlocker,
    panel: lockedSpot.panel,
  }
  await screenshot('independent-economy-gate.png')

  // 6. Clubhouse-too-low gate: gang Lv.40, Clubhouse still Lv.1.
  const tooLowAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 1, childLevels: [1, 1, 1, 1, 1] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: tooLowAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(GANG_LV40_REPUTATION, tooLowAt),
  )
  const tooLowSpot = await findBuilding('修车厂')
  results.gateTooLow = {
    coordinate: { x: tooLowSpot.x, y: tooLowSpot.y },
    blocker: tooLowSpot.panel.mainBlocker,
    panel: tooLowSpot.panel,
  }

  // 7. Full loop via real clicks: upgrade Clubhouse to Lv.2, then repair to Lv.2.
  const loopAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 1, childLevels: [1, 1, 1, 1, 1] },
        clubhouse: { level: 1, childLevels: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: loopAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(GANG_LV40_REPUTATION, loopAt),
  )
  const clubhouseSpot = await findBuilding('Clubhouse')
  const clubhouseCoordinate = { x: clubhouseSpot.x, y: clubhouseSpot.y }
  const clubhouseBefore = clubhouseSpot.panel
  if (clubhouseBefore.mainButtonPresent) {
    await clickSelector('[aria-label="升级主建筑至 Lv.2"]')
    await sleep(500)
  }
  const clubhouseAfter = await readPanel()
  const afterClubhouseStorage = await readStorage()
  await closePanel()
  const repairLoopSpot = await findBuilding('修车厂', results.freeChoice.coordinate)
  const repairLoopBefore = repairLoopSpot.panel
  if (repairLoopBefore.mainButtonPresent) {
    await clickSelector('[aria-label="升级主建筑至 Lv.2"]')
    await sleep(500)
  }
  const repairLoopAfter = await readPanel()
  const afterRepairStorage = await readStorage()
  results.loop = {
    clubhouseBefore,
    clubhouseLevelBefore: clubhouseBefore.level,
    clubhouseLevelAfter: clubhouseAfter.level,
    clubhouseStored:
      afterClubhouseStorage.city?.state?.buildingProgress?.clubhouse?.level ??
      null,
    repairLoopBefore,
    repairLevelBefore: repairLoopBefore.level,
    repairLevelAfter: repairLoopAfter.level,
    repairStored:
      afterRepairStorage.city?.state?.buildingProgress?.['repair-shop']?.level ??
      null,
    repairChildLevels:
      afterRepairStorage.city?.state?.buildingProgress?.['repair-shop']
        ?.childLevels ?? null,
    clubhouseCoordinate,
  }

  // 8. Refresh persistence (no injection): levels, producers, wallet persist.
  const beforeRefresh = await readStorage()
  await reloadAndWait()
  const afterRefresh = await readStorage()
  results.persist = {
    repairLevel:
      afterRefresh.city?.state?.buildingProgress?.['repair-shop']?.level ?? null,
    repairChildLevels:
      afterRefresh.city?.state?.buildingProgress?.['repair-shop']?.childLevels ??
      null,
    clubhouseLevel:
      afterRefresh.city?.state?.buildingProgress?.clubhouse?.level ?? null,
    activeProducerIds:
      afterRefresh.city?.state?.activeProducerIds ?? null,
    moneyBefore: beforeRefresh.city?.state?.resources?.money ?? null,
    moneyAfter: afterRefresh.city?.state?.resources?.money ?? null,
  }

  // 9. Three-resource production growth. Gang Lv.40 activates all four
  // producers; injected active set matches so lastResourceUpdatedAt is kept.
  const growAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: growAt,
      activeProducerIds: [...PRODUCER_IDS],
    }),
    gangSave(GANG_LV40_REPUTATION, growAt),
  )
  let growWallet = { money: 0, oil: 0, materials: 0 }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const storage = await readStorage()
    growWallet = storage.city?.state?.resources ?? growWallet
    if (typeof growWallet.oil === 'number' && growWallet.oil >= 1) break
    await sleep(250)
  }
  results.resourceGrowth = {
    money: growWallet.money,
    oil: growWallet.oil,
    materials: growWallet.materials,
    hud: await readHud(),
  }
  await screenshot('independent-economy-resources.png')

  // 10. Level caps: repair Lv.5 and Clubhouse Lv.10 disable the main upgrade.
  const maxedAt = Date.now()
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 5, childLevels: [5, 5, 5, 5, 5] },
        clubhouse: {
          level: 10,
          childLevels: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: maxedAt,
      activeProducerIds: ['repair-shop'],
    }),
    gangSave(GANG_LV40_REPUTATION, maxedAt),
  )
  const maxedRepair = await findBuilding('修车厂', results.freeChoice.coordinate)
  const maxedRepairPanel = maxedRepair.panel
  await closePanel()
  const maxedClubhouse = await findBuilding(
    'Clubhouse',
    results.loop.clubhouseCoordinate,
  )
  const maxedClubhousePanel = maxedClubhouse.panel
  results.maxed = {
    repairLevel: maxedRepairPanel.level,
    repairMainButtonPresent: maxedRepairPanel.mainButtonPresent,
    repairStatus: maxedRepairPanel.mainStatus,
    clubhouseLevel: maxedClubhousePanel.level,
    clubhouseMainButtonPresent: maxedClubhousePanel.mainButtonPresent,
    clubhouseStatus: maxedClubhousePanel.mainStatus,
  }

  // 11. Mobile 390x844: the open panel has no horizontal overflow and scrolls.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(500)
  const mobileMeasure = await evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    const root = document.documentElement
    if (!panel) return { present: false }
    const rect = panel.getBoundingClientRect()
    const cs = getComputedStyle(panel)
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
    }
  })()`)
  results.mobile = { dom: await readPanel(), measure: mobileMeasure }
  await screenshot('independent-economy-mobile.png')
  await send('Emulation.clearDeviceMetricsOverride')
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
    const expectedPrefix = path.join(os.tmpdir(), 'dobe-independent-economy-cdp-')
    if (!profileDir.startsWith(expectedPrefix)) {
      throw new Error(
        `SAFETY_ABORT: refusing to remove unexpected profile ${profileDir}`,
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
console.log(`WROTE ${OUT_JSON}`)
console.log(
  `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
)
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
